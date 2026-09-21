import { getDb } from "@/lib/db";
import { commitAttempts, newHistory } from "@/data/history";
import { answerSession, type Session } from "@/lib/study-session";

/** Commit the answer, card mastery, daily activity and session together; retry-safe. */
export async function recordAnswer(session: Session, known: boolean): Promise<Session> {
  const db = getDb();
  return db.transaction("rw", [db.sessions, db.cards, db.decks, db.activity, db.history, db.events], async () => {
    const stored = await db.sessions.get(session.id);
    if (stored && stored.revision > session.revision) return stored;
    const card = await db.cards.get(session.queue[0]);
    if (!card || card.deletedAt || card.purgedAt || !(await db.decks.get(session.deckId)) || (await db.decks.get(session.deckId))?.deletedAt) throw new Error("This card or deck was deleted. Return to your deck to start a new session.");
    const now = Date.now();
    const next = answerSession(session, known, now);
    if (next === session) return session;
    const history = await db.history.get(session.id) ?? { ...newHistory(session.deckId, (await db.decks.get(session.deckId))!.title, "flashcards"), id: session.id, startedAt: session.startedAt };
    await commitAttempts(history, [{ id: `${session.id}-${next.revision}`, cardId: card.id, correct: known, dontKnow: !known, durationMs: now - session.updatedAt }], !!next.endedAt);
    await db.sessions.put(next);
    return next;
  });
}
export async function finishSession(session: Session): Promise<Session> {
  const db = getDb();
  return db.transaction("rw", db.sessions, db.decks, db.history, async () => {
    if (!(await db.decks.get(session.deckId))) throw new Error("This deck was deleted.");
    const current = await db.sessions.get(session.id) ?? session;
    const next = { ...current, endedAt: current.endedAt ?? Date.now(), updatedAt: Date.now(), revision: current.revision + 1 };
    await db.sessions.put(next);
    await db.history.update(session.id, { endedAt: next.endedAt, updatedAt: next.updatedAt });
    return next;
  });
}
