"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import dynamic from "next/dynamic";
const CreateDeckDialog = dynamic(() => import("@/components/decks/CreateDeckDialog").then(module => module.CreateDeckDialog));
import { DeckCard } from "@/components/decks/DeckCard";
import { Button } from "@/components/ui/Button";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { getDueCards, estimateReviewTime } from "@/lib/learning/scheduling";
import { greetingForHour } from "@/lib/dates";
import { studyUrl } from "@/lib/learning/content";
import { useStore } from "@/providers/StoreProvider";
import { latestStudyDraft, type SavedStudyDraft } from "@/data/drafts";

export function HomeDashboard() {
  const router = useRouter();
  const {
    ready,
    decks,
    prefs,
    todayCount,
    streak,
    sessions,
    masteryForDeck,
    dueCountForDeck,
    toggleFavorite,
  } = useStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<SavedStudyDraft | null>(null);
  const greeting = useSyncExternalStore(
    () => () => undefined,
    () => greetingForHour(new Date().getHours()),
    () => "Welcome back",
  );

  const recentDecks = useMemo(() => decks.slice().sort((a, b) =>
    (b.lastStudiedAt ?? b.updatedAt) - (a.lastStudiedAt ?? a.updatedAt),
  ).slice(0, 6), [decks]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void latestStudyDraft().then(draft => { if (active) setActiveDraft(draft); }).catch(() => { if (active) setActiveDraft(null); }); };
    refresh(); window.addEventListener("brainbo-draft-change", refresh); window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("brainbo-draft-change", refresh); window.removeEventListener("focus", refresh); };
  }, []);

  const allCards = decks.flatMap(deck => deck.cards);
  const due = getDueCards(allCards);
  const continuationDeck = recentDecks[0];
  const resumable = sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt).find(session => {
    const deck = decks.find(item => item.id === session.deckId);
    return deck && session.queue.some(id => deck.cards.some(card => card.id === id));
  });
  const resumeDeck = resumable ? decks.find(deck => deck.id === resumable.deckId) : undefined;
  const draftDeck = activeDraft?.deckId === "all" ? undefined : decks.find(deck => deck.id === activeDraft?.deckId);
  const validActiveDraft = activeDraft && (activeDraft.mode === "review" || !!draftDeck) ? activeDraft : null;
  const draftIsNewer = !!validActiveDraft && validActiveDraft.savedAt > (resumable?.updatedAt ?? 0);
  const primaryAction = draftIsNewer && validActiveDraft
    ? { label: validActiveDraft.mode === "review" ? "Resume Daily Review" : `Resume ${validActiveDraft.mode[0].toUpperCase() + validActiveDraft.mode.slice(1)} · ${validActiveDraft.title}`, detail: "Restores your saved question, answer, and progress on this device.", href: validActiveDraft.href }
    : resumable && resumeDeck
    ? { label: `Resume ${resumeDeck.title}`, detail: `${resumable.studiedIds.length} of ${resumable.cardIds.length} cards reviewed`, href: studyUrl(resumeDeck.id) }
    : continuationDeck
    ? { label: "Continue studying", detail: `${continuationDeck.title} · ${continuationDeck.cards.length} cards · ${dueCountForDeck(continuationDeck.id)} due`, href: `/library/${continuationDeck.id}` }
      : null;
  if (!ready) return <ScreenSkeleton />;

  return (
    <div className="space-y-8">
      <div className="dashboard-hero !min-h-0">
        <div className="relative z-10 max-w-xl">
          <p className="hero-eyebrow">Your space to grow · {greeting}</p>
          <h1 className="mt-3 font-display text-3xl leading-[1.08] tracking-tight sm:text-4xl">
            {prefs.displayName && prefs.displayName !== "there" ? `Ready when you are, ${prefs.displayName}.` : "Ready when you are."}
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-white/75">{primaryAction ? primaryAction.detail : decks.length ? "You’re caught up. Choose a deck when you’re ready." : "Create your first deck and turn what you’re learning into something you remember."}</p>
          {!!decks.length && <p className="mt-3 text-sm text-white/65">Today · {todayCount} of {prefs.dailyGoal} cards · {streak} day{streak === 1 ? "" : "s"} streak</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            {primaryAction ? <Button size="lg" className="hero-action" onClick={() => router.push(primaryAction.href)}>{primaryAction.label}<ArrowRight className="h-5 w-5" /></Button> : <Button size="lg" className="hero-action" onClick={() => setCreateOpen(true)}><Plus className="h-5 w-5" />Create your first deck</Button>}
            {!!decks.length && <Button size="lg" variant="secondary" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => setCreateOpen(true)}><Plus className="h-5 w-5" />New deck</Button>}
          </div>
        </div>
      </div>

      <section className="review-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-edge px-5 py-4">
        <div><h2 className="font-display text-xl">Review due</h2><p className="mt-1 text-sm text-muted">{due.length ? `${due.length} cards · about ${estimateReviewTime(due.length)} min` : "You’re up to date"}</p></div>
        <Button variant="secondary" onClick={() => router.push("/review")}>{due.length ? "Start review" : "Open review"}</Button>
      </section>

      <section aria-labelledby="recent-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 id="recent-heading" className="font-display text-2xl">
            Recent decks
          </h2>
          <Button variant="ghost" onClick={() => router.push("/library")}>
            Open library
          </Button>
        </div>
        {recentDecks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-edge bg-surface px-5 py-8 text-sm text-muted">
            Your first deck will appear here.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recentDecks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                mastery={masteryForDeck(deck.id)}
                dueCount={dueCountForDeck(deck.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </section>

      {createOpen && <CreateDeckDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => router.push(`/library/${id}`)}
      />}
    </div>
  );
}
