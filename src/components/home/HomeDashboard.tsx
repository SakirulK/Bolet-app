"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Flame, Layers, Plus, Target } from "lucide-react";
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
  if (!ready) return <ScreenSkeleton />;

  return (
    <div className="space-y-8">
      <div className="dashboard-hero">
        <div className="relative z-10 max-w-xl">
          <p className="hero-eyebrow">Your space to grow · {greeting}</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
            {prefs.displayName && prefs.displayName !== "there" ? `Ready when you are, ${prefs.displayName}.` : "Ready when you are."}
          </h1>
          <p className="mt-4 max-w-sm text-base leading-7 text-white/75">
            A little curiosity. A little practice. Make room for what you’ll learn next.
          </p>
        <Button size="lg" className="hero-action mt-6" onClick={() => setCreateOpen(true)}>
          <Plus className="h-5 w-5" aria-hidden />
          Create deck
        </Button>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="hero-orbit" /><div className="hero-paper hero-paper-back" /><div className="hero-paper hero-paper-front"><span>Small steps.</span><strong>Big ideas.</strong><span className="hero-paper-star">✳</span></div></div>
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
            No sessions yet. Open Study and run through a few cards.
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
