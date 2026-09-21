import { getDb } from "@/lib/db";
import type { Card, DeckInput } from "@/types";

export async function saveDeck(input: DeckInput, deckId?: string) {
  if (!input.title.trim()) throw new Error("Give your deck a title.");
  if (input.cards.some(card => !card.term.trim() || !card.definition.trim()))
    throw new Error("Each card needs both a term and a definition.");
  const db = getDb();
  const id = deckId ?? crypto.randomUUID();
  const now = Date.now();
  await db.transaction("rw", db.decks, db.cards, async () => {
    const existing = await db.decks.get(id);
    if (deckId && !existing) throw new Error("This deck has been deleted.");
    const oldCards = await db.cards.where("deckId").equals(id).toArray();
    const byId = new Map(oldCards.map(card => [card.id, card]));
    const cards: Card[] = input.cards.map((draft, position) => {
      const old = draft.id ? byId.get(draft.id) : undefined;
      return {
        id: old?.id ?? crypto.randomUUID(), deckId: id, termStarred: false, definitionStarred: false,
        nextReviewAt: now, reviewCount: 0, correctStreak: 0, incorrectCount: 0, dontKnowCount: 0, masteryLevel: "New",
        createdAt: now, mastery: 0, ease: 2.5, intervalDays: 0,
        repetitions: 0, dueAt: now, ...old,
        term: draft.term.trim(), definition: draft.definition.trim(), position, updatedAt: now,
      };
    });
    await db.decks.put({
      id, createdAt: now, favorite: false, ...existing,
      title: input.title.trim(), description: input.description.trim(),
      subject: input.subject.trim() || "Unsorted", updatedAt: now,
    });
    await db.cards.where("deckId").equals(id).delete();
    await db.cards.bulkPut(cards);
  });
  return id;
}

export async function removeDeck(id: string) {
  const db = getDb();
  await db.transaction("rw", db.decks, db.cards, db.sessions, async () => {
    await db.sessions.where("deckId").equals(id).delete();
    await db.cards.where("deckId").equals(id).delete();
    await db.decks.delete(id);
  });
}
