"use client";

import { useState } from "react";
import { StarButton } from "@/components/learning/StarButton";
import { studyUrl } from "@/lib/learning/content";
import { CreateDeckDialog } from "@/components/decks/CreateDeckDialog";
import { Dialog } from "@/components/ui/Dialog";
import { exportDeck } from "@/lib/deck-transfer";
import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { cn } from "@/lib/cn";
import { useStore } from "@/providers/StoreProvider";

export function DeckDetail({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const {
    ready,
    decks,
    masteryForDeck,
    toggleFavorite,
    deleteDeck,
  } = useStore();

  const deck = decks.find((item) => item.id === deckId);

  if (!ready) return <ScreenSkeleton />;

  if (!deck) {
    return (
      <div className="space-y-4">
        <PageHeader title="Deck not found" description="It may have been deleted." />
        <Button variant="secondary" onClick={() => router.push("/library")}>
          Back to library
        </Button>
      </div>
    );
  }

  const mastery = masteryForDeck(deck.id);
  const currentDeckId = deck.id;
  async function handleDelete() {
    if (deleting) return;
    setDeleting(true); setError("");
    try { await deleteDeck(currentDeckId); router.push("/library"); }
    catch { setError("Could not delete the deck. Please try again."); setDeleting(false); }
  }
  function report(action: Promise<void>) {
    setError("");
    void action.catch(() => setError("Could not save this change. Please try again."));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={deck.subject}
        title={deck.title}
        description={deck.description || "No description yet."}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => report(toggleFavorite(deck.id))}
              aria-pressed={deck.favorite}
            >
              <Star
                className={cn("h-4 w-4", deck.favorite && "fill-accent text-accent")}
              />
              {deck.favorite ? "Favorited" : "Favorite"}
            </Button>
            <Button disabled={!deck.cards.length} onClick={() => router.push(studyUrl(deck.id))}>Flashcards</Button>
            <Button variant="secondary" disabled={!deck.cards.length} onClick={() => router.push(studyUrl(deck.id, "learn"))}>Learn</Button>
            <Button variant="secondary" disabled={!deck.cards.length} onClick={() => router.push(studyUrl(deck.id, "test"))}>Test</Button>
            <Button variant="secondary" disabled={!deck.cards.length} onClick={() => router.push(studyUrl(deck.id, "match"))}>Match</Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit deck</Button>
          </>
        }
      />

      <div className="rounded-2xl border border-edge bg-surface p-5">
        <ProgressBar value={mastery} label="Mastery" />
        <p className="mt-3 text-sm text-muted">
          {deck.cards.length} {deck.cards.length === 1 ? "term" : "terms"}
        </p>
      </div>

      {deck.cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge bg-surface px-5 py-10 text-sm text-muted">
          Your next learning session starts with a card. Edit this deck to add terms or import a list.
        </p>
      ) : (
        <ul className="space-y-3">
          {deck.cards.map((card) => (
            <li
              key={card.id}
              className="rounded-2xl border border-edge bg-surface p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">
                    Term
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words font-medium text-ink">{card.term}</p>
                </div>
                <StarButton card={card} side="term" />
              </div>
              <div className="mt-3 flex items-start justify-between gap-3"><p className="whitespace-pre-wrap break-words text-base leading-6 text-muted">{card.definition}</p><StarButton card={card} side="definition" /></div>
              {card.notes ? (
                <p className="mt-2 text-sm text-ink/80">{card.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => exportDeck(deck, "json")}>Export JSON</Button>
      <Button variant="secondary" onClick={() => exportDeck(deck, "csv")}>Export CSV</Button>
      <Button variant="danger" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete deck
      </Button>
      </div>
      <CreateDeckDialog open={editing} deck={deck} onClose={() => setEditing(false)} />
      {confirming && <Dialog title="Delete deck?" busy={deleting} onClose={() => setConfirming(false)}>
        <p className="text-muted">“{deck.title}” and its {deck.cards.length} cards will move to Trash. You can restore them in Settings. Trash is never emptied automatically.</p>
        {error && <p role="alert" className="mt-3 text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button autoFocus variant="secondary" disabled={deleting} onClick={() => setConfirming(false)}>Keep deck</Button><Button variant="danger" disabled={deleting} onClick={handleDelete}>{deleting ? "Moving…" : "Move to Trash"}</Button></div>
      </Dialog>}
    </div>
  );
}
