import type { Card } from "@/types";
export type Side = "term" | "definition";
export type ContentFilter = "all" | "terms" | "definitions" | "any";
export type Direction = "term" | "definition" | "mixed";
export const contentLabels: Record<ContentFilter, string> = { all: "All cards", terms: "Starred terms only", definitions: "Starred definitions only", any: "Any starred" };
export function filterCards(cards: Card[], filter: ContentFilter = "all") {
  return cards.filter(card => filter === "all" || (filter === "terms" ? card.termStarred : filter === "definitions" ? card.definitionStarred : card.termStarred || card.definitionStarred));
}
export function emptyContent(filter: ContentFilter) {
  return filter === "terms" ? "No starred terms in this deck yet." : filter === "definitions" ? "No starred definitions in this deck yet." : filter === "any" ? "No starred terms or definitions in this deck yet." : "This deck has no cards yet.";
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
