"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { DeckCard } from "@/components/decks/DeckCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { studyUrl } from "@/lib/learning/content";
import { useStore } from "@/providers/StoreProvider";

export function StudyPicker() {
  const router = useRouter();
  const { ready, decks, masteryForDeck, dueCountForDeck, toggleFavorite } =
    useStore();

  const dueDecks = useMemo(
    () =>
      decks
        .map((deck) => ({ deck, due: dueCountForDeck(deck.id) }))
        .filter((item) => item.deck.cards.length > 0)
        .sort((a, b) => b.due - a.due),
    [decks, dueCountForDeck],
  );

  if (!ready) return <ScreenSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Study"
        title="What will you review?"
        description="Due counts are based on a simple interval. Tap a deck to flip cards."
      />

      {dueDecks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-surface px-5 py-10">
          <p className="text-sm text-muted">No cards to study yet.</p>
          <Button className="mt-4" onClick={() => router.push("/library")}>
            Go to library
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {dueDecks.map(({ deck, due }) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              mastery={masteryForDeck(deck.id)}
              dueCount={due}
              href={studyUrl(deck.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
