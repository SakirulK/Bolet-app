import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-ts.mjs';
globalThis.window = {};
const { parseCards, exportDeck } = load('src/lib/deck-transfer.ts');
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

test('exports valid JSON backup and round-trippable CSV', async () => {
  const deck = { id: 'test', title: 'A deck', cards: [{ term: 'A, "term"', definition: 'Line one\nLine two' }] };
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
    const backup = JSON.parse(await blob.text());
    assert.equal(backup.version, 1);
    assert.deepEqual(backup.deck, deck);
  } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; globalThis.setTimeout = timer; delete globalThis.document; }
});
