"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Layers, Plus, Target } from "lucide-react";
import { CreateDeckDialog } from "@/components/decks/CreateDeckDialog";
import { DeckCard } from "@/components/decks/DeckCard";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatCard } from "@/components/ui/StatCard";
import { getDueCards, estimateReviewTime } from "@/lib/learning/scheduling";
import { Metrics } from "@/components/learning/StudyControls";
import { greetingForHour } from "@/lib/dates";
import { studyUrl } from "@/lib/learning/content";
import { useStore } from "@/providers/StoreProvider";

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
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const greeting = useSyncExternalStore(
    () => () => undefined,
    () => greetingForHour(new Date().getHours()),
    () => "Welcome back",
  );

  const continueDecks = useMemo(
    () =>
      decks
        .filter((deck) => deck.lastStudiedAt)
        .sort((a, b) => (b.lastStudiedAt ?? 0) - (a.lastStudiedAt ?? 0))
        .slice(0, 3),
    [decks],
  );

  const recentDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decks
      .filter((deck) => {
        if (!q) return true;
        return `${deck.title} ${deck.subject} ${deck.description}`
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 6);
  }, [decks, query]);

  const goalProgress = prefs.dailyGoal
    ? Math.min(100, Math.round((todayCount / prefs.dailyGoal) * 100))
    : 0;

  const allCards = decks.flatMap(deck => deck.cards);
  const due = getDueCards(allCards);
  const lastDeck = continueDecks[0];
  const resumable = sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt).find(session => decks.some(deck => deck.id === session.deckId));
  const resumeDeck = resumable ? decks.find(deck => deck.id === resumable.deckId) : undefined;
  const primaryAction = resumable && resumeDeck
    ? { label: `Resume ${resumeDeck.title}`, detail: `${resumable.studiedIds.length} of ${resumable.cardIds.length} cards reviewed`, href: studyUrl(resumeDeck.id) }
    : lastDeck
    ? { label: `Continue ${lastDeck.title}`, detail: `${lastDeck.cards.length} cards · ${dueCountForDeck(lastDeck.id)} due`, href: studyUrl(lastDeck.id) }
    : due.length
      ? { label: `Review ${due.length} due cards`, detail: `About ${estimateReviewTime(due.length)} minutes`, href: "/review" }
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
          <div className="mt-5 flex flex-wrap gap-3">
            {primaryAction ? <Button size="lg" className="hero-action" onClick={() => router.push(primaryAction.href)}>{primaryAction.label}<ArrowRight className="h-5 w-5" /></Button> : <Button size="lg" className="hero-action" onClick={() => setCreateOpen(true)}><Plus className="h-5 w-5" />Create your first deck</Button>}
            {!!decks.length && <Button size="lg" variant="secondary" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => setCreateOpen(true)}><Plus className="h-5 w-5" />New deck</Button>}
          </div>
        </div>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search your library"
      />

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Today at a glance
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Flame}
            label="Streak"
            value={`${streak}d`}
            hint={streak > 0 ? "Keep the chain going" : "Study once to start"}
          />
          <StatCard
            icon={Layers}
            label="Studied today"
            value={`${todayCount}`}
            hint="Cards reviewed"
          />
          <article className="stat-panel col-span-2 rounded-2xl border border-edge bg-surface p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted">Daily study goal</p>
                <p className="mt-3 font-display text-3xl tracking-tight text-ink">
                  {todayCount}
                  <span className="text-xl text-muted"> / {prefs.dailyGoal}</span>
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-accent">
                <Target className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <ProgressBar className="mt-4" value={goalProgress} label="Goal" />
          </article>
        </div>
      </section>

      <section className="review-panel space-y-4 rounded-3xl border border-edge p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-2xl">Due Today</h2><p className="mt-1 text-muted">{due.length} due cards · {due.length ? `about ${estimateReviewTime(due.length)} min` : "You’re up to date"}</p></div><a className="study-link" href="/review">{due.length ? "Start Review" : "View Review"}</a></div>
        <Metrics values={(["New", "Learning", "Familiar", "Mastered"] as const).map(level => [level, allCards.filter(card => card.masteryLevel === level).length])} />
      </section>
      <section aria-labelledby="continue-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 id="continue-heading" className="font-display text-2xl">
            Continue studying
          </h2>
        </div>
        {continueDecks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-edge bg-surface px-5 py-8 text-sm text-muted">
            {decks.length ? "No sessions yet. Choose a deck and begin when you’re ready." : "Create a deck to start studying."}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {continueDecks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                mastery={masteryForDeck(deck.id)}
                dueCount={dueCountForDeck(deck.id)}
                href={studyUrl(deck.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
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
            No decks match that search.
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

      <CreateDeckDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => router.push(`/library/${id}`)}
      />
    </div>
  );
}
