import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-ts.mjs';
globalThis.window = {};
const { parseCards, exportDeck } = load('src/lib/deck-transfer.ts');
const { createBrainBoDeckFile, parseBrainBoDeck, sharedDeckInput, MAX_BRAINBO_DECK_BYTES } = load('src/lib/deck-share.ts');
const { saveDeck, removeDeck, restoreDeck, permanentlyDeleteDeck } = load('src/data/decks.ts');
const { getDb } = load('src/lib/db.ts');

test('imports all delimiters, CRLF, Unicode, headers, and quoted multiline CSV', () => {
  for (const delimiter of ['\t', ',', ';']) {
    const result = parseCards(`Apple${delimiter}An edible fruit\r\nCPU${delimiter}Central Processing Unit`, 'auto');
    assert.equal(result.delimiter, delimiter);
    assert.equal(result.cards.length, 2);
    assert.deepEqual(result.invalid, []);
  }
  const quoted = parseCards('\uFEFFterm,definition\r\n"日本語","A language, with commas\nand ""quotes"""', ',');
  assert.deepEqual(quoted.cards, [{ term: '日本語', definition: 'A language, with commas\nand "quotes"' }]);
  assert.equal(quoted.quoted, false);
  assert.equal(parseCards('A;B,C', ';').cards[0].definition, 'B,C');
  assert.deepEqual(parseCards('Missing\nA,\nA,B,C', ',').invalid, [1, 2, 3]);
  assert.equal(parseCards('A,"unfinished', ',').quoted, true);
  assert.equal(parseCards('\n \n', 'auto').cards.length, 0);
});

test('deck edits persist order and mastery, reject invalid input, and deliberate tombstone deletion', async () => {
  const db = getDb();
  const input = { title: ' Basics ', subject: '', description: ' Notes ', cards: [{ term: 'A', definition: 'First' }, { term: 'B', definition: 'Second' }] };
  const id = await saveDeck(input);
  const old = (await db.cards.where('deckId').equals(id).toArray()).sort((a, b) => a.position - b.position);
  await db.cards.update(old[1].id, { mastery: 72, termStarred: true });
  await saveDeck({ ...input, title: 'Edited', removedCardIds: [old[0].id], cards: [{ ...old[1], definition: 'Updated' }, { term: 'C', definition: 'Third' }] }, id);
  db.close(); await db.open();
  const cards = (await db.cards.where('deckId').equals(id).toArray()).filter(card => !card.deletedAt).sort((a, b) => a.position - b.position);
  assert.deepEqual(cards.map(card => card.term), ['B', 'C']);
  assert.equal(cards[0].mastery, 72);
  assert.equal(cards[0].termStarred, true);
  assert.equal(cards[0].definition, 'Updated');
  assert.ok((await db.cards.get(old[0].id)).deletedAt);
  assert.equal((await db.cards.get(old[0].id)).term, "A");
  assert.equal((await db.decks.get(id)).subject, 'Unsorted');
  await assert.rejects(saveDeck({ ...input, cards: [{ term: '', definition: 'Invalid' }] }, id));
  assert.equal((await db.decks.get(id)).title, 'Edited');
  const otherId = await saveDeck({ ...input, cards: [] });
  await removeDeck(id);
  assert.ok((await db.decks.get(id)).deletedAt);
  assert.equal(await db.cards.where('deckId').equals(id).count(), 3);
  assert.ok(await db.decks.get(otherId));
  await assert.rejects(saveDeck(input, id), /deleted/);
  await restoreDeck(id);
  assert.equal((await db.decks.get(id)).deletedAt, null);
  await removeDeck(id); await permanentlyDeleteDeck(id);
  assert.ok((await db.decks.get(id)).purgedAt);
  assert.equal((await db.decks.get(id)).title, undefined);
  await removeDeck(otherId);
  db.close(); await db.open();
  assert.equal(await db.decks.filter(deck => !deck.deletedAt).count(), 0);
  await db.delete();
});

test('BrainBo deck sharing exports content only and imports a fresh, syncable copy', async () => {
  const now = Date.now();
  const deck = { id: 'sender-deck', title: 'Pharmacology', description: 'Exam two', subject: 'Medicine', createdAt: 1, updatedAt: 2, favorite: true, lastStudiedAt: 3, userId: 'sender', syncVersion: 99,
    cards: [{ id: 'sender-card', deckId: 'sender-deck', term: 'Agonist', definition: 'Activates a receptor', notes: 'Compare antagonist', acceptedAnswers: ['Receptor activator'], acceptedTermAnswers: ['Agonistic drug'], starred: true, termStarred: true, definitionStarred: true, mastery: 92, masteryLevel: 'Mastered', reviewCount: 20, correctStreak: 9, incorrectCount: 3, dontKnowCount: 2, intervalDays: 30, repetitions: 8, ease: 3, nextReviewAt: now + 1000, dueAt: now + 1000, lastReviewedAt: now, createdAt: 1, updatedAt: 2, deletedAt: null, cloudOwner: 'sender' }] };
  const exported = createBrainBoDeckFile(deck, '2026-09-22T00:00:00.000Z');
  assert.deepEqual(Object.keys(exported), ['format', 'version', 'exportedAt', 'deck']);
  assert.equal(exported.format, 'brainbo-deck');
  assert.deepEqual(exported.deck.cards[0], { term: 'Agonist', definition: 'Activates a receptor', notes: 'Compare antagonist', acceptedAnswers: ['Receptor activator'], acceptedTermAnswers: ['Agonistic drug'] });
  const serialized = JSON.stringify(exported);
  for (const forbidden of ['sender-deck', 'sender-card', 'sender', 'mastery', 'reviewCount', 'starred', 'nextReviewAt', 'cloudOwner']) assert.equal(serialized.includes(forbidden), false, forbidden);

  const db = getDb(); await db.open();
  const existing = await saveDeck(sharedDeckInput(exported.deck));
  const imported = await saveDeck(sharedDeckInput(parseBrainBoDeck(serialized).file.deck));
  assert.notEqual(imported, existing);
  assert.notEqual(imported, deck.id);
  const importedCards = await db.cards.where('deckId').equals(imported).toArray();
  assert.equal(importedCards.length, 1); assert.notEqual(importedCards[0].id, deck.cards[0].id);
  assert.deepEqual({ notes: importedCards[0].notes, acceptedAnswers: importedCards[0].acceptedAnswers, acceptedTermAnswers: importedCards[0].acceptedTermAnswers }, { notes: 'Compare antagonist', acceptedAnswers: ['Receptor activator'], acceptedTermAnswers: ['Agonistic drug'] });
  assert.deepEqual({ starred: importedCards[0].starred, termStarred: importedCards[0].termStarred, definitionStarred: importedCards[0].definitionStarred, mastery: importedCards[0].mastery, masteryLevel: importedCards[0].masteryLevel, reviewCount: importedCards[0].reviewCount, correctStreak: importedCards[0].correctStreak, incorrectCount: importedCards[0].incorrectCount, dontKnowCount: importedCards[0].dontKnowCount, intervalDays: importedCards[0].intervalDays, repetitions: importedCards[0].repetitions }, { starred: false, termStarred: false, definitionStarred: false, mastery: 0, masteryLevel: 'New', reviewCount: 0, correctStreak: 0, incorrectCount: 0, dontKnowCount: 0, intervalDays: 0, repetitions: 0 });
  assert.equal(await db.history.where('deckId').equals(imported).count(), 0);
  assert.equal(await db.decks.filter(item => item.title === 'Pharmacology').count(), 2);
  assert.ok((await db.syncQueue.toArray()).some(item => item.entityType === 'decks' && item.entityId === imported));
  await db.delete();
});

test('BrainBo deck validation rejects unsafe files and accepts sanitized legacy JSON', () => {
  const card = { term: 'CPU', definition: 'Central Processing Unit', id: 'ignored', mastery: 100, starred: true };
  const legacy = parseBrainBoDeck(JSON.stringify({ version: 1, exportedAt: 'old', deck: { id: 'old', title: 'Legacy', description: '', subject: 'Computing', cards: [card] } }));
  assert.equal(legacy.legacy, true); assert.deepEqual(legacy.file.deck.cards, [{ term: 'CPU', definition: 'Central Processing Unit' }]);
  assert.throws(() => parseBrainBoDeck('{oops'), /valid JSON/);
  assert.throws(() => parseBrainBoDeck(JSON.stringify({ format: 'something-else', version: 1, deck: {} })), /not a BrainBo deck/);
  assert.throws(() => parseBrainBoDeck(JSON.stringify({ format: 'brainbo-deck', version: 2, deck: {} })), /not supported/);
  assert.throws(() => parseBrainBoDeck(JSON.stringify({ format: 'brainbo-deck', version: 1, deck: { title: 'Broken', cards: [{ term: '', definition: 'Missing term' }] } })), /term is missing/);
  assert.throws(() => parseBrainBoDeck(' '.repeat(MAX_BRAINBO_DECK_BYTES + 1)), /smaller than 5 MB/);
});

test('exports valid BrainBo Deck JSON and round-trippable CSV', async () => {
  const deck = { id: 'test', title: 'A deck', description: '', subject: 'General', cards: [{ term: 'A, "term"', definition: 'Line one\nLine two' }] };
  let blob, download;
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL, timer = globalThis.setTimeout;
  URL.createObjectURL = value => { blob = value; return 'blob:test'; };
  URL.revokeObjectURL = () => {};
  globalThis.setTimeout = callback => { callback(); return 0; };
  globalThis.document = { createElement: () => ({ click() { download = this.download; }, remove() {} }), body: { appendChild() {} } };
  try {
    exportDeck(deck, 'csv');
    assert.equal(download, 'A-deck.csv');
    assert.deepEqual(parseCards(await blob.text(), ',').cards, deck.cards);
    exportDeck(deck, 'json');
    const shared = JSON.parse(await blob.text());
    assert.equal(download, 'A-deck.brainbo-deck.json');
    assert.equal(shared.format, 'brainbo-deck');
    assert.deepEqual(shared.deck, { title: 'A deck', description: '', subject: 'General', cards: deck.cards });
  } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; globalThis.setTimeout = timer; delete globalThis.document; }
});
