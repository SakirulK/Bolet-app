import type { Card, StudyEvent, StudyHistory } from "@/types";
import { addDays, computeStreak, localDateKey, parseLocalDateKey } from "@/lib/dates";
export function accuracy(correct: number, incorrect: number) { return correct + incorrect ? `${Math.round(correct / (correct + incorrect) * 100)}%` : "—"; }
export function needsAttention(card: Card, now = Date.now()) { return card.incorrectCount >= 2 || card.dontKnowCount >= 2 || (card.reviewCount > 0 && card.mastery < 30) || (card.reviewCount > 0 && card.nextReviewAt < now - 86_400_000); }
export function studyAnalytics(events: StudyEvent[], history: StudyHistory[], now = new Date()) {
  const today = localDateKey(now), rows = events.filter(event => localDateKey(new Date(event.at)) === today);
  const dates = [...new Set(events.map(event => localDateKey(new Date(event.at))).concat(history.filter(item => item.correct + item.incorrect > 0).map(item => localDateKey(new Date(item.startedAt)))))].sort();
  let longest = 0, run = 0, previous = "";
  for (const date of dates) { run = previous && localDateKey(addDays(parseLocalDateKey(previous), 1)) === date ? run + 1 : 1; longest = Math.max(longest, run); previous = date; }
  const legacy = history.filter(item => !events.some(event => event.sessionId === item.id));
  const legacyToday = legacy.filter(item => localDateKey(new Date(item.startedAt)) === today);
  return { cards: new Set(rows.map(event => event.cardId).concat(legacyToday.flatMap(item => item.studiedIds))).size,
    questions: rows.length + legacyToday.reduce((n, item) => n + item.correct + item.incorrect, 0),
    durationMs: rows.reduce((n, item) => n + item.durationMs, 0) + legacyToday.reduce((n, item) => n + item.durationMs, 0),
    correct: rows.filter(item => item.correct).length + legacyToday.reduce((n, item) => n + item.correct, 0),
    incorrect: rows.filter(item => !item.correct).length + legacyToday.reduce((n, item) => n + item.incorrect, 0),
    mastered: new Set(rows.filter(item => item.mastered).map(item => item.cardId)).size,
    streak: computeStreak(dates), longest,
    days: Array.from({ length: 7 }, (_, index) => { const date = localDateKey(addDays(parseLocalDateKey(today), index - 6)); return { date, count: events.filter(event => localDateKey(new Date(event.at)) === date).length + legacy.filter(item => localDateKey(new Date(item.startedAt)) === date).reduce((n, item) => n + item.correct + item.incorrect, 0) }; }) };
}
