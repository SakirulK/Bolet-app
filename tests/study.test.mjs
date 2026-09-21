import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-ts.mjs';
globalThis.window = {};
const { startSession, answerSession, sessionStats, defaultStudyOptions } = load('src/lib/study-session.ts');
const { recordAnswer, finishSession } = load('src/data/study.ts');
const { saveDeck, removeDeck } = load('src/data/decks.ts');
const { getDb } = load('src/lib/db.ts');

test('misses return later; only two consecutive recalls master a card', () => {
  const cards = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, termStarred: id === 'a' }));
  let session = startSession('deck', cards, defaultStudyOptions, 100);
  session = answerSession(session, false, 200);
  assert.deepEqual(session.queue, ['b', 'c', 'd', 'a', 'e']);
  assert.deepEqual(session.missedIds, ['a']);
  assert.equal(sessionStats(session).remaining, 5);
  for (let i = 0; !session.endedAt && i < 30; i++) session = answerSession(session, true, 300 + i);
  assert.ok(session.endedAt);
  assert.equal(sessionStats(session).mastered, 5);
  assert.equal(sessionStats(session).remaining, 0);
  assert.equal(session.correct, 10);
  assert.equal(session.incorrect, 1);
  assert.equal(sessionStats(session).accuracy, 91);
  assert.equal(sessionStats(session).studied, 5);
  assert.equal(answerSession(session, true), session);

  let single = startSession('deck', cards.slice(0, 1), defaultStudyOptions);
  single = answerSession(single, true);
  single = answerSession(single, false);
  single = answerSession(single, true);
  assert.equal(sessionStats(single).mastered, 0);
  single = answerSession(single, true);
  assert.equal(sessionStats(single).mastered, 1);
});

test('options filter stars, shuffle without loss, and leave source cards unchanged', () => {
  const cards = ['a', 'b', 'c'].map(id => ({ id, termStarred: id === 'b' }));
  const session = startSession('deck', cards, { shuffle: true, filter: "terms", direction: 'definition' });
  assert.deepEqual(session.queue, ['b']);
  assert.equal(session.options.direction, 'definition');
  const shuffled = startSession('deck', cards, { ...defaultStudyOptions, shuffle: true });
  assert.deepEqual([...shuffled.queue].sort(), ['a', 'b', 'c']);
  assert.deepEqual(cards.map(card => card.id), ['a', 'b', 'c']);
  assert.deepEqual(startSession('deck', [], defaultStudyOptions).queue, []);
});

test('answers persist atomically, duplicate requests count once, and session history survives reopen', async () => {
  const db = getDb();
  const id = await saveDeck({ title: 'Study', subject: 'Tests', description: '', cards: [{ term: 'CPU', definition: 'Central Processing Unit' }] });
  const cards = await db.cards.where('deckId').equals(id).toArray();
  const session = startSession(id, cards, defaultStudyOptions);
  const [first, duplicate] = await Promise.all([recordAnswer(session, false), recordAnswer(session, false)]);
  assert.equal(first.revision, 1);
  assert.equal(duplicate.revision, 1);
  assert.equal((await db.activity.toArray())[0].cardsStudied, 1);
  const second = await recordAnswer(first, true);
  const final = await recordAnswer(second, true);
  assert.ok(final.endedAt);
  assert.equal(final.correct, 2);
  assert.equal(final.incorrect, 1);
  assert.equal(sessionStats(final).mastered, 1);
  assert.equal((await db.cards.get(cards[0].id)).mastery, 20);
  db.close(); await db.open();
  assert.equal((await db.sessions.get(session.id)).correct, 2);
  assert.equal((await db.activity.toArray())[0].cardsStudied, 3);
  const early = startSession(id, cards, defaultStudyOptions);
  const incomplete = await finishSession(await recordAnswer(early, false));
  assert.ok(incomplete.endedAt);
  assert.equal(sessionStats(incomplete).remaining, 1);
  assert.equal((await recordAnswer(incomplete, true)).revision, incomplete.revision);
  await removeDeck(id);
  assert.equal(await db.sessions.where('deckId').equals(id).count(), 2);
  assert.equal((await db.cards.get(cards[0].id)).reviewCount, 4);
  await assert.rejects(recordAnswer(startSession(id, cards, defaultStudyOptions), true), /deleted/);
  assert.equal((await db.activity.toArray())[0].cardsStudied, 4);
  await db.delete();
});
