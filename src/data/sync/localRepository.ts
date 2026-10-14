import type { RecallDB } from '@/lib/db';
import { baseline, entityTypes, materialize, mergeEnvelopes, queueItem, remoteTransactions, type Envelope, type SyncRow } from './model';
import { calculateNextReview } from '@/lib/learning/scheduling';
import type { Card, StudyEvent } from '@/types';

/** Bind once: a different login must never upload another person's cached data. */
export async function bindAccount(db: RecallDB, userId: string, consent: boolean) {
  return db.transaction('rw', [...entityTypes.map(type => db.table(type)), db.syncMeta, db.syncQueue], async tx => {
    const owner = await db.syncMeta.get('owner');
    if (owner && owner.value !== userId) throw new Error('This browser holds another account’s data. Use a separate browser profile to sign into this account. Nothing was removed.');
    if (!owner) {
      const hasData = (await Promise.all(['decks', 'cards', 'history', 'events', 'sessions', 'prefs', 'activity'].map(type => db.table(type).count()))).some(Boolean);
      if (hasData && !consent) return false;
      remoteTransactions.add(tx.idbtrans);
      for (const type of entityTypes) {
        for (const row of await db.table(type).toArray() as SyncRow[]) {
          const envelope = baseline(type, row);
          await db.table(type).put(materialize(envelope));
          await db.syncQueue.put(queueItem(envelope));
        }
      }
      await db.syncMeta.put({ id: 'owner', value: userId });
    }
    return true;
  });
}

/** Absence in a cloud response is never deletion. Only explicit terminal tombstones purge. */
export async function applyRemote(db: RecallDB, incoming: Envelope[]) {
  await db.transaction('rw', [...entityTypes.map(type => db.table(type)), db.syncQueue, db.syncMeta], async tx => {
    remoteTransactions.add(tx.idbtrans);
    for (const remote of incoming) {
      if (!entityTypes.includes(remote.entityType) || !remote.entityId) throw new Error('Invalid cloud record');
      const table = db.table(remote.entityType);
      const local = await table.get(remote.entityId) as SyncRow | undefined;
      const merged = local ? mergeEnvelopes(baseline(remote.entityType, local), remote) : remote;
      // Preserve locally derived review fields when the cloud envelope is unchanged.
      if (!local?._sync || JSON.stringify(local._sync) !== JSON.stringify(merged)) await table.put(materialize(merged));
      const pending = await db.syncQueue.get(`${remote.entityType}:${remote.entityId}`);
      if (pending && pending.revision !== JSON.stringify(merged)) await db.syncQueue.put({ ...queueItem(merged), attemptCount: pending.attemptCount });
    }
    // Study events are unique, additive facts. Replaying them in a stable order merges
    // concurrent offline practice without double-counting or changing the scheduler.
    const events = (await db.events.toArray()).filter(event => event.cardId).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    const eventsByCard = new Map<string, StudyEvent[]>();
    for (const event of events) {
      const list = eventsByCard.get(event.cardId) ?? [];
      list.push(event); eventsByCard.set(event.cardId, list);
    }
    for (const card of await db.cards.toArray()) {
      if (card.purgedAt || card.deletedAt || !card._reviewBase) continue;
      const base = card._reviewBase;
      let projection = { ...card, ...base.card } as Card;
      const baseIds = new Set(base.eventIds);
      for (const event of eventsByCard.get(card.id) ?? []) {
        if (baseIds.has(event.id)) continue;
        projection = { ...projection, ...calculateNextReview(projection, event.rating, event.at, event.dontKnow) };
      }
      const fields = ['mastery', 'masteryLevel', 'reviewCount', 'correctStreak', 'incorrectCount', 'dontKnowCount', 'intervalDays', 'repetitions', 'dueAt', 'nextReviewAt', 'lastReviewedAt'] as const;
      const changes = fields.filter(key => projection[key] !== undefined && projection[key] !== card[key]);
      if (changes.length) await db.cards.update(card.id, current => { Object.assign(current, Object.fromEntries(changes.map(key => [key, projection[key]]))); });
    }
    // Purging a deck is terminal even if a stale device later uploads an unknown card.
    const purged = new Set((await db.decks.toArray()).filter(deck => deck.purgedAt).map(deck => deck.id));
    if (!purged.size) return;
    for (const id of purged) await db.syncMeta.bulkDelete([`draft:learn:${id}`, `draft:test:${id}`]);
    for (const type of ['cards', 'events', 'history', 'sessions'] as const) {
      for (const row of await db.table(type).toArray()) {
        if (!purged.has(row.deckId) || row.purgedAt) continue;
        const envelope: Envelope = { entityType: type, entityId: row.id, fields: {}, versions: {}, purged: true };
        await db.table(type).put(materialize(envelope));
        await db.syncQueue.put(queueItem(envelope));
      }
    }
  });
}
