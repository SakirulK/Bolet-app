import type { Card } from "@/types";
export type Side = "term" | "definition";
export type ContentFilter = "all" | "starred";
export type LegacyContentFilter = ContentFilter | "terms" | "definitions" | "any";
export type Direction = "term" | "definition" | "mixed";
export const contentLabels: Record<ContentFilter, string> = { all: "All cards", starred: "Starred only" };
export function isCardStarred(card: Pick<Card, "starred" | "termStarred" | "definitionStarred">) {
  return !!(card.starred || card.termStarred || card.definitionStarred);
}
export function normalizeContentFilter(filter: string): ContentFilter {
  return filter === "starred" || filter === "terms" || filter === "definitions" || filter === "any" ? "starred" : "all";
}
export function filterCards(cards: Card[], filter: LegacyContentFilter = "all") {
  return cards.filter(card => filter === "all" || isCardStarred(card));
}
export function emptyContent(filter: LegacyContentFilter) {
  return filter === "all" ? "This deck has no cards yet." : "No starred cards yet.";
}
export function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function promptSide(direction: Direction, index = 0): Side { return direction === "mixed" ? (index % 2 ? "definition" : "term") : direction; }
export function opposite(side: Side): Side { return side === "term" ? "definition" : "term"; }
export function studyUrl(deckId: string, mode = "flashcards", ids?: string[], filter: ContentFilter = "all") {
  const query = new URLSearchParams({ deck: deckId, mode, filter });
  if (ids) query.set("ids", ids.join(","));
  return `/practice?${query}`;
}
