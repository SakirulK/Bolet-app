import type { Card, MasteryLevel } from "@/types";
export type Rating = "again" | "hard" | "good" | "easy";
export function updateMastery(card: Pick<Card, "reviewCount" | "correctStreak" | "mastery">): MasteryLevel {
  if (!card.reviewCount) return "New";
  if (card.correctStreak >= 5 && card.reviewCount >= 8 && card.mastery >= 80) return "Mastered";
  if (card.correctStreak >= 2 && card.mastery >= 40) return "Familiar";
  return "Learning";
}
/** A small bounded scheduler: Again in 10 minutes; other ratings grow days up to a year. */
export function calculateNextReview(card: Card, rating: Rating, now = Date.now(), dontKnow = false): Partial<Card> {
  const old = card.intervalDays || 0;
  const intervalDays = rating === "again" ? 0 : Math.min(365, Math.max(1, Math.round(rating === "hard" ? old * 1.2 : rating === "good" ? Math.max(1, old) * 2 : Math.max(1, old) * 3.5)));
  const correctStreak = rating === "again" ? 0 : (card.correctStreak ?? 0) + 1;
  const reviewCount = (card.reviewCount ?? 0) + 1;
  const mastery = Math.max(0, Math.min(100, card.mastery + (rating === "again" ? -15 : rating === "hard" ? 5 : rating === "good" ? 10 : 14)));
  const nextReviewAt = now + (rating === "again" ? 600_000 : intervalDays * 86_400_000);
  return { lastReviewedAt: now, nextReviewAt, dueAt: nextReviewAt, reviewCount, correctStreak,
    incorrectCount: (card.incorrectCount ?? 0) + Number(rating === "again"), dontKnowCount: (card.dontKnowCount ?? 0) + Number(dontKnow),
    intervalDays, mastery, masteryLevel: updateMastery({ reviewCount, correctStreak, mastery }),
    repetitions: (card.repetitions ?? 0) + Number(rating !== "again"), updatedAt: now };
}
export function getDueCards(cards: Card[], now = Date.now()) { return cards.filter(card => (card.nextReviewAt ?? card.dueAt) <= now).sort((a, b) => (a.nextReviewAt ?? a.dueAt) - (b.nextReviewAt ?? b.dueAt)); }
export function estimateReviewTime(count: number) { return Math.max(1, Math.ceil(count * 25 / 60)); }
