import { getDb, type RecallDB } from '@/lib/db';
import { baseline, entityTypes, materialize, mergeEnvelopes, queueItem, remoteTransactions, type EntityType, type SyncRow } from './sync/model';
export type Backup = { format: 'bolet-backup'; version: 1; exportedAt: string; data: Record<EntityType, SyncRow[]> };
export async function createBackup(db = getDb()): Promise<Backup> {
  return db.transaction('r', entityTypes.map(type => db.table(type)), async () => ({
    format: 'bolet-backup', version: 1, exportedAt: new Date().toISOString(),
    data: Object.fromEntries(await Promise.all(entityTypes.map(async type => [type, await db.table(type).toArray()]))) as Backup['data'],
  }));
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function fail(detail: string): never { throw new Error(`Invalid BOLET backup: ${detail}. No data was changed.`); }
/** Validate the entire file before opening any write transaction. No partial imports. */
export function validateBackup(input: unknown): Backup {
  if (!object(input) || input.format !== 'bolet-backup' || input.version !== 1 || typeof input.exportedAt !== 'string' || !Number.isFinite(Date.parse(input.exportedAt)) || !object(input.data)) fail('unsupported format');
  const data = input.data as Record<string, unknown>;
  for (const type of entityTypes) {
    if (!Array.isArray(data[type])) fail(`missing ${type}`);
    const ids = new Set<string>();
    for (const value of data[type] as unknown[]) {
      if (!object(value)) fail(`${type} must contain records`);
      const row = value as SyncRow, id = row[type === 'activity' ? 'date' : 'id'];
      if (typeof id !== 'string' || !id || ids.has(id)) fail(`invalid or duplicate ${type} ID`);
      ids.add(id);
      for (const [key, val] of Object.entries(row)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('unsafe property');
        if (['createdAt','updatedAt','deletedAt','purgedAt','nextReviewAt','dueAt','lastReviewedAt','startedAt','endedAt','at','mastery','reviewCount','correctStreak','incorrectCount','dontKnowCount','intervalDays','repetitions','ease','cardsStudied','dailyGoal','incorrect','durationMs','rounds','position'].includes(key) && val != null && (typeof val !== 'number' || !Number.isFinite(val) || val < 0)) fail(`invalid ${key}`);
      }
      if (row.purgedAt) continue;
      const strings = type === 'decks' ? ['title','description','subject'] : type === 'cards' ? ['deckId','term','definition'] : type === 'prefs' ? ['displayName'] : type === 'events' ? ['cardId','deckId','sessionId','mode','rating'] : type === 'history' ? ['deckId','title','mode'] : type === 'sessions' ? ['deckId'] : [];
      if (strings.some(key => typeof row[key] !== 'string')) fail(`missing ${type} content`);
      const numbers = type === 'cards' ? ['createdAt','updatedAt','mastery','ease','intervalDays','repetitions','dueAt','nextReviewAt','reviewCount','correctStreak','incorrectCount','dontKnowCount'] : type === 'decks' ? ['createdAt','updatedAt'] : type === 'prefs' ? ['dailyGoal'] : type === 'activity' ? ['cardsStudied'] : type === 'events' ? ['at','durationMs'] : type === 'history' ? ['startedAt','updatedAt','correct','incorrect','dontKnow','durationMs','rounds'] : ['startedAt','updatedAt','correct','incorrect','revision'];
      if (numbers.some(key => typeof row[key] !== 'number' || !Number.isFinite(row[key]) || (row[key] as number) < 0)) fail(`missing ${type} numbers`);
      const booleans = type === 'cards' ? ['termStarred','definitionStarred'] : type === 'decks' ? ['favorite'] : type === 'events' ? ['correct','dontKnow','mastered'] : [];
      if (booleans.some(key => typeof row[key] !== 'boolean')) fail(`invalid ${type} flags`);
      for (const key of ['acceptedAnswers','acceptedTermAnswers','studiedIds','difficultIds','masteredIds','missedIds','queue','cardIds']) {
        if (row[key] !== undefined && (!Array.isArray(row[key]) || (row[key] as unknown[]).some(value => typeof value !== 'string'))) fail(`invalid ${key}`);
      }
      if (type === 'cards' && !['New','Learning','Familiar','Mastered'].includes(String(row.masteryLevel))) fail('invalid mastery');
      if ((type === 'events' || type === 'history') && !['flashcards','learn','match','test','review'].includes(String(row.mode))) fail('invalid mode');
      if (type === 'events' && !['again','hard','good','easy'].includes(String(row.rating))) fail('invalid rating');
      if (type === 'prefs' && (id !== 'local' || (row.theme !== undefined && !['system','dark','light'].includes(String(row.theme))))) fail('invalid preferences');
      if (type === 'history' && (!object(row.ratings) || ['studiedIds','difficultIds','masteredIds'].some(key => !Array.isArray(row[key])))) fail('incomplete history');
      if (row.notes !== undefined && typeof row.notes !== 'string') fail('invalid notes');
      if (type === 'history' && Object.values(row.ratings as Record<string, unknown>).some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) fail('invalid rating counts');
      if (type === 'sessions') {
        if (!object(row.options) || !object(row.streaks) || ['queue','cardIds','missedIds','studiedIds'].some(key => !Array.isArray(row[key]))) fail('incomplete flashcard session');
        if (typeof row.options.shuffle !== 'boolean' || !['term','definition','random'].includes(String(row.options.direction))) fail('invalid flashcard options');
        if (Object.values(row.streaks).some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) fail('invalid flashcard streaks');
      }
      if (row._reviewBase !== undefined && (!object(row._reviewBase) || !object(row._reviewBase.card) || !Array.isArray(row._reviewBase.eventIds))) fail('invalid scheduling baseline');
      if (object(row._reviewBase)) {
        const base = row._reviewBase.card as Record<string, unknown>;
        if (['mastery','reviewCount','correctStreak','incorrectCount','dontKnowCount','intervalDays','repetitions'].some(key => typeof base[key] !== 'number' || !Number.isFinite(base[key]) || (base[key] as number) < 0) || (row._reviewBase.eventIds as unknown[]).some(id => typeof id !== 'string')) fail('invalid scheduling values');
      }
      // Sync envelopes are internal metadata. Validate recursively so malformed versions
      // cannot reach the merger or prototype-sensitive object operations.
      if (row._sync !== undefined) {
        const env = row._sync;
        if (!object(env) || env.entityType !== type || env.entityId !== id || !object(env.fields) || !object(env.versions)) fail('invalid sync metadata');
        for (const field of Object.values(env.fields)) if (!object(field) || typeof field.stamp !== 'string' || !/^\d{16}:[\w-]+$/.test(field.stamp) || !('value' in field)) fail('invalid field clock');
        if (Object.values(env.versions).some(value => !object(value))) fail('invalid content revisions');
      }
    }
  }
  const deckIds = new Set((data.decks as SyncRow[]).map(row => row.id));
  for (const row of data.cards as SyncRow[]) if (!row.purgedAt && !deckIds.has(row.deckId)) fail('card has no deck');
  // Reject unsafe keys anywhere, including nested aliases, clocks and baselines.
  JSON.stringify(input, (key, value) => { if (['__proto__','prototype','constructor'].includes(key)) fail('unsafe property'); return value; });
  return structuredClone(input) as Backup;
}
export async function restoreBackup(input: unknown, mode: 'merge' | 'replace', db: RecallDB = getDb()) {
  const backup = validateBackup(input);
  await db.transaction('rw', [...entityTypes.map(type => db.table(type)), db.syncQueue, db.syncMeta], async tx => {
    remoteTransactions.add(tx.idbtrans);
    const terminal: import('./sync/model').Envelope[] = [];
    if (mode === 'replace') {
      for (const type of entityTypes) for (const row of await db.table(type).toArray()) if (row.purgedAt) terminal.push(baseline(type, row));
      const safety = await createBackup(db);
      await db.syncMeta.put({ id: 'beforeRestore', value: JSON.stringify(safety) });
      // Local-only replacement is explicit. Pending uploads are preserved; absence
      // from this backup sends no deletion to the account.
      for (const type of entityTypes) await db.table(type).clear();
      for (const envelope of terminal) await db.table(envelope.entityType).put(materialize(envelope));
    }
    for (const type of entityTypes) {
      for (const row of backup.data[type]) {
        const envelope = baseline(type, { ...row, _sync: undefined });
        if (row.purgedAt) { envelope.purged = true; envelope.fields = {}; }
        else if (row._sync) {
          for (const [key, field] of Object.entries(envelope.fields)) {
            const original = row._sync.fields[key];
            if (original && JSON.stringify(original.value) === JSON.stringify(field.value)) field.stamp = original.stamp;
          }
          envelope.versions = row._sync.versions;
        }
        const existing = await db.table(type).get(envelope.entityId);
        const merged = existing ? mergeEnvelopes(baseline(type, existing), envelope) : envelope;
        await db.table(type).put(materialize(merged));
        await db.syncQueue.put(queueItem(merged));
      }
    }
  });
}
export function downloadBackup(backup: Backup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `BOLET-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
