import type { Card, StudyHistory } from "@/types";
export function recommendRounds(cards: Card[], history: StudyHistory[] = []): number {
  if (!cards.length) return 1;
  const mastery = cards.reduce((sum, card) => sum + card.mastery, 0) / cards.length;
  const newRatio = cards.filter(card => !card.reviewCount).length / cards.length;
  const recent = history.slice().sort((a, b) => b.startedAt - a.startedAt).slice(0, 5);
  const answers = recent.reduce((n, item) => n + item.correct + item.incorrect, 0);
  const correct = recent.reduce((n, item) => n + item.correct, 0);
  const dk = recent.reduce((n, item) => n + item.dontKnow, 0);
  const accuracy = answers ? correct / answers : null;
  let rounds = mastery >= 80 ? 2 : mastery >= 45 ? 4 : 6;
  if (newRatio > 0.6) rounds = Math.max(rounds, 5);
  if (answers >= 10 && accuracy !== null && accuracy < 0.4) rounds = 8;
  if (answers >= 25 && accuracy !== null && accuracy < 0.2 && dk / answers > 0.4) rounds = 10;
  if (cards.length > 40 && rounds > 3 && rounds < 8) rounds--;
  return Math.min(10, Math.max(1, rounds));
}
