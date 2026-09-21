import { getDb, type RecallDB } from "@/lib/db";
import type { Card, DeckInput } from "@/types";

export async function saveDeck(input: DeckInput, deckId?: string, db: RecallDB = getDb()) {
  if (!input.title.trim()) throw new Error("Give your deck a title.");
  if (input.cards.some(card => !card.term.trim() || !card.definition.trim()))
    throw new Error("Each card needs both a term and a definition.");
  const id = deckId ?? crypto.randomUUID();
  const now = Date.now();
  await db.transaction("rw", db.decks, db.cards, async () => {
    const existing = await db.decks.get(id);
    if (deckId && (!existing || existing.deletedAt || existing.purgedAt)) throw new Error("This deck has been deleted.");
    const oldCards = await db.cards.where("deckId").equals(id).toArray();
    const byId = new Map(oldCards.map(card => [card.id, card]));
    const cards: Card[] = input.cards.map((draft, position) => {
      const old = draft.id ? byId.get(draft.id) : undefined;
      if (draft.id && (!old || old.deletedAt || old.purgedAt)) throw new Error("A card changed or was removed. Reopen the editor before saving.");
      return {
        id: old?.id ?? crypto.randomUUID(), deckId: id, termStarred: false, definitionStarred: false,
        nextReviewAt: now, reviewCount: 0, correctStreak: 0, incorrectCount: 0, dontKnowCount: 0, masteryLevel: "New",
        createdAt: now, mastery: 0, ease: 2.5, intervalDays: 0,
        repetitions: 0, dueAt: now, ...old,
        acceptedAnswers: (draft.original && JSON.stringify(draft.acceptedAnswers) === JSON.stringify(draft.original.acceptedAnswers) ? old?.acceptedAnswers : draft.acceptedAnswers ?? old?.acceptedAnswers)?.map(answer => answer.trim()).filter(Boolean),
        acceptedTermAnswers: (draft.original && JSON.stringify(draft.acceptedTermAnswers) === JSON.stringify(draft.original.acceptedTermAnswers) ? old?.acceptedTermAnswers : draft.acceptedTermAnswers ?? old?.acceptedTermAnswers)?.map(answer => answer.trim()).filter(Boolean),
        term: old && draft.original?.term === draft.term ? old.term : draft.term.trim(),
        definition: old && draft.original?.definition === draft.definition ? old.definition : draft.definition.trim(),
        position: old && draft.original?.position === position ? old.position : position, updatedAt: now,
      };
    });
    await db.decks.put({
      id, createdAt: now, favorite: false, ...existing,
      title: existing && input.original?.title === input.title ? existing.title : input.title.trim(),
      description: existing && input.original?.description === input.description ? existing.description : input.description.trim(),
      subject: existing && input.original?.subject === input.subject ? existing.subject : input.subject.trim() || "Unsorted", updatedAt: now,
    });
    for (const removedId of input.removedCardIds ?? []) {
      if (input.cards.some(card => card.id === removedId)) throw new Error("A removed card cannot also be saved.");
      if (byId.has(removedId)) await db.cards.update(removedId, { deletedAt: now, updatedAt: now });
    }
    await db.cards.bulkPut(cards);
  });
  return id;
}

/** Move to Trash; cards, stars, and study history remain intact. */
export async function removeDeck(id: string, db: RecallDB = getDb()) {
  await db.decks.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
}
export async function restoreDeck(id: string, db: RecallDB = getDb()) {
  const deck = await db.decks.get(id);
  if (!deck || deck.purgedAt) throw new Error("This deck was permanently deleted.");
  await db.decks.update(id, { deletedAt: null, updatedAt: Date.now() });
}
/** Explicit permanent deletion keeps only a terminal ID tombstone, never content. */
export async function permanentlyDeleteDeck(id: string, db: RecallDB = getDb()) {
  await db.transaction('rw', [db.decks, db.cards, db.sessions, db.events, db.history, db.syncMeta], async () => {
    const deck = await db.decks.get(id);
    if (!deck?.deletedAt) throw new Error('Move this deck to Trash first.');
    const now = Date.now();
    await db.syncMeta.bulkDelete([`draft:learn:${id}`, `draft:test:${id}`]);
    for (const type of ['cards', 'sessions', 'events', 'history'] as const) {
      for (const row of await db.table(type).where('deckId').equals(id).toArray()) {
        await db.table(type).put({ id: row.id, deletedAt: now, purgedAt: now });
      }
    }
    await db.decks.put({ id, deletedAt: now, purgedAt: now } as import('@/types').DeckRecord);
  });
}
