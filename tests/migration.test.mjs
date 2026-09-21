import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { load } from './load-ts.mjs';
globalThis.window = {};
const { RecallDB } = load('src/lib/db.ts');
const { saveDeck } = load('src/data/decks.ts');
test('v1/v2 migration preserves decks, legacy stars, mastery, activity and session history', async () => {
  for (const version of [1, 2]) {
    const old = new Dexie('recall');
    old.version(1).stores({ decks: 'id, subject, favorite, updatedAt, lastStudiedAt', cards: 'id, deckId, starred, dueAt', activity: 'date', prefs: 'id' });
    if (version === 2) old.version(2).stores({ sessions: 'id, deckId, startedAt, endedAt' });
    await old.table('decks').put({ id: 'old', title: 'Keep me', createdAt: 5, subject: 'Old', favorite: true });
    for (const starred of [true, false]) await old.table('cards').put({ id: String(starred), deckId: 'old', term: 'Term', definition: 'Definition', starred, mastery: 72, repetitions: 9, intervalDays: 12, dueAt: 123 });
    await old.table('activity').put({ date: '2026-09-01', cardsStudied: 7 });
    if (version === 2) await old.table('sessions').put({ id: 'old-session', deckId: 'old', startedAt: 1, updatedAt: 50, endedAt: 50, correct: 3, incorrect: 2, studiedIds: ['true'], missedIds: ['true'] });
    old.close();
    const current = new RecallDB(); await current.open();
    assert.equal((await current.decks.get('old')).title, 'Keep me');
    for (const starred of [true, false]) {
      const card = await current.cards.get(String(starred));
      assert.equal(card.termStarred, starred); assert.equal(card.definitionStarred, starred);
      assert.equal(card.mastery, 72); assert.equal(card.repetitions, 9); assert.equal(card.intervalDays, 12); assert.equal(card.nextReviewAt, 123);
      assert.equal(card.acceptedAnswers, undefined);
    }
    assert.equal((await current.activity.get('2026-09-01')).cardsStudied, 7);
    if (version === 2) { assert.equal((await current.sessions.get('old-session')).correct, 3); assert.equal((await current.history.get('old-session')).incorrect, 2); }
    await current.delete();
  }
});
test('optional aliases persist without replacing stars or mastery', async () => {
  const id = await saveDeck({ title: 'Aliases', subject: '', description: '', cards: [{ term: 'CPU', definition: 'Central Processing Unit', acceptedAnswers: ['Processor'], acceptedTermAnswers: ['CPU chip'] }] });
  const { getDb } = load('src/lib/db.ts'); const db = getDb();
  const [card] = await db.cards.where('deckId').equals(id).toArray();
  await db.cards.update(card.id, { termStarred: true, mastery: 70 });
  await saveDeck({ title: 'Aliases', subject: '', description: '', cards: [{ id: card.id, term: 'CPU', definition: 'Central Processing Unit' }] }, id);
  const saved = await db.cards.get(card.id);
  assert.deepEqual(saved.acceptedAnswers, ['Processor']); assert.equal(saved.termStarred, true); assert.equal(saved.mastery, 70);
  await db.delete();
});
