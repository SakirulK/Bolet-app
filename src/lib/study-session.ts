import { filterCards, type ContentFilter } from "@/lib/learning/content";
import type { Card } from "@/types";

export type StudyOptions = { shuffle: boolean; direction: "term" | "definition" | "random"; filter: ContentFilter; starredOnly?: boolean };
export const defaultStudyOptions: StudyOptions = { shuffle: false, direction: "term", filter: "all" };
export type Session = {
  id: string; deckId: string; startedAt: number; updatedAt: number; endedAt?: number;
  options: StudyOptions; cardIds: string[]; queue: string[];
  streaks: Record<string, number>; missedIds: string[]; studiedIds: string[];
  correct: number; incorrect: number; revision: number;
};
export function startSession(deckId: string, cards: Card[], options: StudyOptions, now = Date.now()): Session {
  const cardIds = filterCards(cards, options.filter ?? (options.starredOnly ? "starred" : "all")).map(card => card.id);
  if (options.shuffle) {
    for (let i = cardIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardIds[i], cardIds[j]] = [cardIds[j], cardIds[i]];
    }
  }
  return { id: crypto.randomUUID(), deckId, startedAt: now, updatedAt: now, options: { ...options }, cardIds,
    queue: [...cardIds], streaks: {}, missedIds: [], studiedIds: [], correct: 0, incorrect: 0, revision: 0 };
}
export function answerSession(session: Session, known: boolean, now = Date.now()): Session {
  if (session.endedAt || !session.queue.length) return session;
  const [id, ...queue] = session.queue;
  const streak = known ? (session.streaks[id] ?? 0) + 1 : 0;
  // Two consecutive recalls retire a card. Misses return after up to three other cards.
  if (streak < 2) queue.splice(Math.min(3, queue.length), 0, id);
  return { ...session, queue, streaks: { ...session.streaks, [id]: streak },
    studiedIds: [...new Set([...session.studiedIds, id])],
    missedIds: known ? session.missedIds : [...new Set([...session.missedIds, id])],
    correct: session.correct + Number(known), incorrect: session.incorrect + Number(!known),
    updatedAt: now, endedAt: queue.length ? undefined : now, revision: session.revision + 1 };
}
export function sessionStats(session: Session) {
  const attempts = session.correct + session.incorrect;
  const mastered = session.cardIds.filter(id => (session.streaks[id] ?? 0) >= 2).length;
  const known = session.studiedIds.filter(id => (session.streaks[id] ?? 0) > 0).length;
  const stillLearning = session.studiedIds.filter(id => (session.streaks[id] ?? 0) === 0).length;
  const unseen = Math.max(0, session.cardIds.length - session.studiedIds.length);
  return { attempts, mastered, remaining: session.cardIds.length - mastered,
    known, stillLearning, unseen, missed: session.missedIds.length,
    studied: session.studiedIds.length, accuracy: attempts ? Math.round(session.correct / attempts * 100) : 0,
    durationMs: Math.max(0, (session.endedAt ?? session.updatedAt) - session.startedAt) };
}
