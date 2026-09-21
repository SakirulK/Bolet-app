import { getDb } from "@/lib/db";
import { localDateKey } from "@/lib/dates";
import { calculateNextReview, type Rating } from "@/lib/learning/scheduling";
import type { StudyEvent, StudyHistory, StudyMode } from "@/types";
export function newHistory(deckId: string, title: string, mode: StudyMode): StudyHistory {
  const now = Date.now();
  return { id: crypto.randomUUID(), deckId, title, mode, startedAt: now, updatedAt: now, correct: 0, incorrect: 0, dontKnow: 0, durationMs: 0, studiedIds: [], difficultIds: [], masteredIds: [], rounds: 0, ratings: {} };
}
export type Attempt = { id: string; cardId: string; correct: boolean; dontKnow?: boolean; rating?: Rating; durationMs?: number; override?: boolean; answer?: string };
/** Idempotent writes protect double taps and retries; no answer is counted twice. */
export async function commitAttempts(history: StudyHistory, attempts: Attempt[], complete = false): Promise<StudyHistory> {
  const db = getDb();
  return db.transaction("rw", [db.cards, db.decks, db.events, db.history, db.activity], async () => {
    let next = { ...(await db.history.get(history.id) ?? history), rounds: history.rounds };
    for (const attempt of attempts) {
      if (await db.events.get(attempt.id)) continue;
      const card = await db.cards.get(attempt.cardId);
      if (!card) throw new Error("A card was deleted. Return to the deck and start again.");
      const now = Date.now(), rating = attempt.rating ?? (attempt.correct ? "good" : "again");
      const patch = calculateNextReview(card, rating, now, !!attempt.dontKnow);
      const mastered = patch.masteryLevel === "Mastered" && card.masteryLevel !== "Mastered";
      const durationMs = Math.max(0, Math.min(attempt.durationMs ?? 0, 3_600_000));
      const event: StudyEvent = { ...attempt, sessionId: history.id, deckId: card.deckId, mode: history.mode, at: now, dontKnow: !!attempt.dontKnow, rating, mastered, durationMs };
      await db.cards.update(card.id, patch);
      await db.decks.update(card.deckId, { lastStudiedAt: now, updatedAt: now });
      await db.events.put(event);
      const date = localDateKey();
      const activity = await db.activity.get(date);
      await db.activity.put({ date, cardsStudied: (activity?.cardsStudied ?? 0) + 1 });
      next = { ...next, correct: next.correct + Number(attempt.correct), incorrect: next.incorrect + Number(!attempt.correct),
        dontKnow: next.dontKnow + Number(!!attempt.dontKnow), durationMs: next.durationMs + durationMs, updatedAt: now,
        studiedIds: [...new Set([...next.studiedIds, card.id])],
        difficultIds: attempt.correct ? next.difficultIds : [...new Set([...next.difficultIds, card.id])],
        masteredIds: mastered ? [...new Set([...next.masteredIds, card.id])] : next.masteredIds,
        ratings: { ...next.ratings, [rating]: (next.ratings[rating] ?? 0) + 1 } };
    }
    if (complete) next.endedAt = Date.now();
    await db.history.put(next);
    return next;
  });
}
