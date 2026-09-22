"use client";
import { LocalLink } from "@/components/ui/LocalLink";
import { useRef, useState } from "react";
import { useStore } from "@/providers/StoreProvider";
import { getDueCards, type Rating } from "@/lib/learning/scheduling";
import { newHistory, commitAttempts } from "@/data/history";
import { Button } from "@/components/ui/Button";
import { Flashcard } from "@/components/study/Flashcard";
import { StarButton } from "./StarButton";
import { Metrics, durationLabel } from "./StudyControls";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import type { Card, Deck } from "@/types";
export function DailyReview() {
  const { ready, decks } = useStore();
  if (!ready) return <ScreenSkeleton />;
  return <Review decks={decks} />;
}
function Review({ decks }: { decks: Deck[] }) {
  const all = decks.flatMap(deck => deck.cards);
  const [queue] = useState(() => getDueCards(all).map(card => card.id));
  const [index, setIndex] = useState(0), [flipped, setFlipped] = useState(false), [history, setHistory] = useState(() => newHistory("all", "Daily Review", "review"));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const started = useRef(0), lock = useRef(false);
  const card = all.find(card => card.id === queue[index]);
  const source = decks.find(deck => deck.id === card?.deckId);
  async function rate(rating: Rating) {
    if (!card || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const next = await commitAttempts(history, [{ id: `${history.id}-${index}`, cardId: card.id, correct: rating !== "again", dontKnow: rating === "again", rating, durationMs: Date.now() - (started.current || history.startedAt) }], index + 1 === queue.length);
      setHistory(next); setIndex(index + 1); setFlipped(false); started.current = Date.now();
    } catch { setError("Could not save your review. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!queue.length) return <div className="mx-auto max-w-2xl space-y-5 py-8"><h1 className="font-display text-3xl">You’re up to date</h1><p className="text-muted">No cards are due right now. Come back later or explore a deck.</p><LocalLink className="study-link" href="/library">Open Library</LocalLink><LocalLink className="study-link" href="/">Home</LocalLink></div>;
  if (index >= queue.length) { const next = all.filter(card => card.nextReviewAt > 0).sort((a, b) => a.nextReviewAt - b.nextReviewAt)[0]; return <div className="mx-auto max-w-3xl space-y-6"><h1 className="font-display text-3xl">Daily Review complete</h1><Metrics values={[["Cards reviewed", history.studiedIds.length], ["Again", history.ratings.again ?? 0], ["Hard", history.ratings.hard ?? 0], ["Good", history.ratings.good ?? 0], ["Easy", history.ratings.easy ?? 0], ["Time studied", durationLabel(history.durationMs)]]} /><p className="text-muted">{next ? `Next review: ${new Date(next.nextReviewAt).toLocaleString()}` : "No upcoming reviews."}</p><LocalLink className="study-link" href="/">Back Home</LocalLink></div>; }
  if (!card) return <div className="space-y-4"><p>This card was removed from the deck.</p><Button onClick={() => setIndex(index + 1)}>Skip removed card</Button></div>;
  return <div className="mx-auto max-w-4xl space-y-5"><header className="flex items-center justify-between gap-3"><div><p className="text-sm text-accent">Daily Review · {source?.title}</p><h1 className="font-display text-2xl">{index + 1} / {queue.length}</h1></div><LocalLink className="study-link" href="/">Back Home</LocalLink><StarButton card={card as Card} /></header>
    <Flashcard key={card.id} card={card} direction="term" flipped={flipped} onFlip={() => setFlipped(value => !value)} onGrade={known => { if (flipped) void rate(known ? "good" : "again"); }} disabled={busy} />
    {!flipped ? <Button size="lg" onClick={() => setFlipped(true)}>Show Answer</Button> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(["again", "hard", "good", "easy"] as Rating[]).map(rating => <Button key={rating} disabled={busy} variant={rating === "good" ? "primary" : "secondary"} size="lg" onClick={() => void rate(rating)}>{rating[0].toUpperCase() + rating.slice(1)}</Button>)}</div>}
    <p className="text-sm text-muted">Again returns in 10 minutes. Hard, Good, and Easy gradually increase the interval.</p>{error && <p role="alert" className="text-danger">{error}</p>}</div>;
}
