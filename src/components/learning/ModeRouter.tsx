"use client";
import { LocalLink } from "@/components/ui/LocalLink";
import { useStore } from "@/providers/StoreProvider";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { StudySession } from "@/components/study/StudySession";
import { LearnMode } from "./LearnMode";
import { MatchMode } from "./MatchMode";
import { TestMode } from "./TestMode";
import { normalizeContentFilter } from "@/lib/learning/content";
export function ModeRouter({ deckId, mode = "flashcards", ids, filter = "all" }: { deckId: string; mode?: string; ids?: string[]; filter?: string }) {
  const { ready, decks } = useStore();
  if (!ready) return <ScreenSkeleton />;
  const original = decks.find(deck => deck.id === deckId);
  if (!original) return <div className="space-y-4"><h1 className="font-display text-3xl">Deck not found</h1><LocalLink className="study-link" href="/library">Back to Library</LocalLink></div>;
  const deck = { ...original, cards: ids ? original.cards.filter(card => ids.includes(card.id)) : original.cards };
  const content = normalizeContentFilter(filter);
  if (mode === "learn") return <LearnMode deck={deck} initialFilter={content} />;
  if (mode === "match") return <MatchMode deck={deck} initialFilter={content} />;
  if (mode === "test") return <TestMode deck={deck} initialFilter={content} />;
  return <StudySession deckId={deckId} ids={ids} filter={content} />;
}
