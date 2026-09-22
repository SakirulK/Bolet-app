"use client";

import Link from "next/link";
import { Layers, Star } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/dates";
import type { Deck } from "@/types";

type DeckCardProps = {
  deck: Deck;
  mastery: number;
  dueCount?: number;
  href?: string;
  onToggleFavorite?: (deckId: string) => void;
};

export function DeckCard({
  deck,
  mastery,
  dueCount,
  href = `/library/${deck.id}`,
  onToggleFavorite,
}: DeckCardProps) {
  return (
    <article className="deck-tile group relative rounded-2xl border border-edge bg-surface p-4 shadow-sm transition-colors duration-150 hover:border-edge-strong sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-3 inline-flex rounded-lg bg-accent/8 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-accent uppercase">
            {deck.subject}
          </p>
          <h3 className="mt-1 break-words font-display text-xl leading-snug text-ink">
            <Link
              href={href}
              className="rounded-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {deck.title}
            </Link>
          </h3>
        </div>
        {onToggleFavorite ? (
          <button
            type="button"
            onClick={() => onToggleFavorite(deck.id)}
            className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-pressed={deck.favorite}
            aria-label={
              deck.favorite ? `Unfavorite ${deck.title}` : `Favorite ${deck.title}`
            }
          >
            <Star
              className={cn(
                "h-5 w-5",
                deck.favorite && "fill-accent text-accent",
              )}
            />
          </button>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
        {deck.description || "No description yet."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Layers className="h-4 w-4" aria-hidden />
          {deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"}
        </span>
        {typeof dueCount === "number" ? (
          <span>{dueCount} due</span>
        ) : null}
        <span>{formatRelativeTime(deck.lastStudiedAt)}</span>
      </div>

      <ProgressBar
        className="mt-4"
        size="sm"
        value={mastery}
        label="Mastery"
      />
    </article>
  );
}
