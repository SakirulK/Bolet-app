"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Settings2, SkipBack, SkipForward, Star, Trophy } from "lucide-react";
import { StarButton } from "@/components/learning/StarButton";
import { ContentSelect } from "@/components/learning/StudyControls";
import { filterCards, emptyContent, type ContentFilter } from "@/lib/learning/content";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { Flashcard } from "./Flashcard";
import { useStore } from "@/providers/StoreProvider";
import { defaultStudyOptions, sessionStats, startSession, type StudyOptions } from "@/lib/study-session";
import { finishSession, recordAnswer } from "@/data/study";
import type { Deck } from "@/types";
import { getDb } from "@/lib/db";
import type { Session as StudySessionState } from "@/lib/study-session";

export function StudySession({ deckId, ids, filter = "all" }: { deckId: string; ids?: string[]; filter?: ContentFilter }) {
  const { ready, decks } = useStore();
  const router = useRouter();
  const [recovery, setRecovery] = useState<StudySessionState | null | undefined>(undefined);
  const [resumed, setResumed] = useState<StudySessionState | null>(null);
  useEffect(() => {
    let active = true;
    if (!ready || ids || filter !== "all") {
      void Promise.resolve().then(() => { if (active) setRecovery(null); });
      return () => { active = false; };
    }
    void getDb().sessions.where("deckId").equals(deckId).filter(item => !item.endedAt && item.correct + item.incorrect > 0).reverse().sortBy("updatedAt")
      .then(items => { if (active) setRecovery(items[0] ?? null); })
      .catch(() => { if (active) setRecovery(null); });
    return () => { active = false; };
  }, [deckId, filter, ids, ready]);
  if (!ready) return <ScreenSkeleton />;
  const deck = decks.find(deck => deck.id === deckId);
  if (!deck) return <div className="space-y-4"><h1 className="font-display text-3xl">Deck not found</h1><Button onClick={() => router.push("/library")}>Back to library</Button></div>;
  if (recovery === undefined) return <ScreenSkeleton />;
  const scopedDeck = { ...deck, cards: ids ? deck.cards.filter(card => ids.includes(card.id)) : deck.cards };
  if (recovery) return <div className="mx-auto max-w-xl space-y-5 py-10"><p className="text-sm font-medium text-accent">{deck.title} · Flashcards</p><h1 className="font-display text-3xl">Continue where you left off?</h1><p className="text-muted">{recovery.studiedIds.length} of {recovery.cardIds.length} cards reviewed. Your answers are saved on this device.</p><div className="flex flex-wrap gap-3"><Button size="lg" onClick={() => { setResumed(recovery); setRecovery(null); }}>Resume session</Button><Button size="lg" variant="secondary" onClick={() => { void finishSession(recovery).finally(() => setRecovery(null)); }}>Start fresh</Button><Button variant="ghost" onClick={() => router.push(`/library/${deck.id}`)}>Back to Deck</Button></div></div>;
  return <Session key={`${deckId}-${ids?.join()}-${filter}-${resumed?.id ?? "new"}`} deck={scopedDeck} initialFilter={filter} initialSession={resumed} />;
}

function Session({ deck, initialFilter, initialSession }: { deck: Deck; initialFilter: ContentFilter; initialSession: StudySessionState | null }) {
  const router = useRouter();
  const { toggleStarCard } = useStore();
  const [session, setSession] = useState(() => initialSession ?? startSession(deck.id, deck.cards, { ...defaultStudyOptions, filter: initialFilter }));
  const [flipped, setFlipped] = useState(false);
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState<StudyOptions>(defaultStudyOptions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [browseHistory, setBrowseHistory] = useState<string[]>([]);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const stats = sessionStats(session);
  const card = deck.cards.find(card => card.id === session.queue[0]);
  const completed = !!session.endedAt;
  // Persist a newly configured session (and any pre-answer browsing) once. After
  // the first graded attempt, recordAnswer owns the transactional checkpoint.
  useEffect(() => { if (session.cardIds.length && !session.endedAt && session.revision === 0) void getDb().sessions.put(session); }, [session]);
  let hash = 2166136261;
  for (const char of `${session.id}-${session.revision}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const firstSide = session.options.direction === "random" ? (hash & 1 ? "term" : "definition") : session.options.direction;

  const grade = useCallback(async (known: boolean) => {
    if (lock.current || settings || session.endedAt || !session.queue.length) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const next = await recordAnswer(session, known);
      if (!mounted.current) return;
      setSession(next); setFlipped(false);
      setFeedback(known ? (next.streaks[session.queue[0]] >= 2 ? "Card mastered. Nicely done." : "Good recall. You’ll see it once more.") : "No rush. This card will come back for another try.");
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "Could not save your answer. Please try again."); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [session, settings]);

  useEffect(() => {
    function key(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (settings || completed || !card || event.repeat || event.altKey || event.ctrlKey || event.metaKey || target.closest("input, textarea, select, [contenteditable=true], dialog")) return;
      if (event.code === "Space") {
        if (target.closest("button, a")) return;
        event.preventDefault(); if (!lock.current) setFlipped(value => !value);
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault(); void toggleStarCard(card.id).catch(() => setError("Could not save star. Please try again."));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (target.closest("button, a")) return;
        event.preventDefault(); void grade(event.key === "ArrowRight");
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [grade, settings, completed, card, toggleStarCard]);

  function browse(next: boolean) {
    if (!card || busy || session.queue.length < 2) return;
    setFlipped(false); setFeedback("");
    if (next) {
      setBrowseHistory(items => [...items, card.id]);
      setSession(current => ({ ...current, queue: [...current.queue.slice(1), current.queue[0]], updatedAt: Date.now() }));
      return;
    }
    const previous = browseHistory.at(-1);
    if (!previous) return;
    setBrowseHistory(items => items.slice(0, -1));
    setSession(current => ({ ...current, queue: [previous, ...current.queue.filter((id, index) => id !== previous || index !== current.queue.indexOf(previous))], updatedAt: Date.now() }));
  }

  async function restart(options: StudyOptions, missedOnly = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (!completed && stats.attempts) await finishSession(session);
      const cards = missedOnly ? deck.cards.filter(card => session.missedIds.includes(card.id)) : deck.cards;
      const next = startSession(deck.id, cards, options);
      setSession(next); setFlipped(false); setFeedback(""); setSettings(false);
    } catch { setError("Could not save your session. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function finish(exit = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (stats.attempts && !completed) setSession(await finishSession(session));
      if (exit) router.push(`/library/${deck.id}`);
      else setSettings(false);
    } catch { setError("Could not save your session. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  function openSettings() { setDraft(session.options); setSettings(true); }
  const seconds = Math.floor(stats.durationMs / 1000);
  return <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-4xl flex-col gap-5 pb-3 sm:gap-6">
    <header className="flex items-center gap-3">
      <Button variant="secondary" size="icon" aria-label="Back to deck" disabled={busy} onClick={() => void finish(true)}><ArrowLeft size={20} /></Button>
      <div className="min-w-0 flex-1"><p className="text-xs font-medium tracking-widest text-accent uppercase">Flashcards</p><h1 className="truncate font-display text-xl sm:text-2xl">{deck.title}</h1></div>
      <span className="shrink-0 text-sm tabular-nums text-muted" aria-label={`${stats.studied} of ${session.cardIds.length} cards reviewed`}>{stats.studied} / {session.cardIds.length}</span>
      <Button variant="secondary" size="icon" aria-label="Study settings" disabled={busy} onClick={openSettings}><Settings2 size={20} /></Button>
    </header>

    {completed ? <section className="my-auto space-y-6 rounded-3xl border border-edge bg-surface p-6 text-center sm:p-10">
      <Trophy className="mx-auto h-10 w-10 text-accent" aria-hidden />
      <div><p className="mb-2 text-sm text-accent">A little practice, a little more confidence.</p><h2 className="font-display text-3xl sm:text-4xl">Session Complete</h2></div>
      <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">{[
        ["Cards studied", stats.studied], ["Accuracy", `${stats.accuracy}%`], ["Known", stats.known],
        ["Still learning", stats.stillLearning], ["Unseen", stats.unseen], ["Total study time", `${Math.floor(seconds / 60)}m ${seconds % 60}s`],
      ].map(([label, value]) => <div key={label} className="rounded-2xl bg-canvas p-4"><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 font-display text-2xl tabular-nums">{value}</dd></div>)}</dl>
      <p className="text-sm text-muted">Known and Still learning include cards you assessed. Unseen cards are never counted as Known.</p>
      <div className="flex flex-wrap justify-center gap-3"><Button size="lg" disabled={busy} onClick={() => void restart(session.options)}>Study Again</Button><Button size="lg" variant="secondary" disabled={busy || !session.missedIds.length} onClick={() => void restart({ ...session.options, filter: "all" }, true)}>Study {session.missedIds.length} Again</Button><Button size="lg" variant="ghost" disabled={busy} onClick={() => void finish(true)}>Back to Deck</Button></div>
    </section> : !card ? <section className="my-auto space-y-4 rounded-3xl border border-dashed border-edge bg-surface p-10 text-center">
      <Star className="mx-auto h-8 w-8 text-accent" aria-hidden /><h2 className="font-display text-3xl">{session.options.filter !== "all" ? emptyContent(session.options.filter) : "Nothing to study yet"}</h2>
      <p className="text-muted">{session.options.filter !== "all" ? "Star cards while studying or from the deck page to study them here." : "Add cards to your deck to begin. If a card was deleted, start a new session in settings."}</p>
      {session.options.filter !== "all" && <Button onClick={() => void restart({ ...session.options, filter: "all" })}>Study all cards</Button>}
      <Button variant="secondary" onClick={() => void finish(true)}>Back to Deck</Button>
    </section> : <>
      <ProgressBar value={session.cardIds.length ? stats.mastered / session.cardIds.length * 100 : 0} label="Session mastery" size="sm" />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div className="flex items-center justify-between text-xs text-muted"><span>{session.options.direction === "random" ? "Mixed direction" : session.options.direction === "definition" ? "Definition first" : "Term first"} · {(session.streaks[card.id] ?? 0)}/2 recalls</span>
          <StarButton card={card} />
        </div>
        <Flashcard key={`${session.id}-${session.revision}`} card={card} firstSide={firstSide} direction={session.options.direction} flipped={flipped} onFlip={() => setFlipped(value => !value)} onGrade={known => void grade(known)} disabled={busy || settings} />
        <p role="status" className="min-h-10 text-center text-sm text-muted">{feedback || "Take your time. Swipe left to practice again, right if you know it."}</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4">
        <Button variant="secondary" size="lg" disabled={busy} onClick={() => void grade(false)} className="!px-3"><ArrowLeft size={18} className="hidden sm:block" />Still Learning</Button>
        <Button variant="secondary" size="lg" disabled={busy} onClick={() => setFlipped(value => !value)} aria-label="Flip card" className="!px-4"><RotateCcw size={18} /><span className="hidden sm:inline">Flip</span></Button>
        <Button size="lg" disabled={busy} onClick={() => void grade(true)}><Check size={18} />Know<ArrowRight size={18} className="hidden sm:block" /></Button>
      </div>
      <div className="flex justify-center gap-2"><Button variant="ghost" disabled={busy || !browseHistory.length} onClick={() => browse(false)}><SkipBack size={17} />Previous</Button><Button variant="ghost" disabled={busy || session.queue.length < 2} onClick={() => browse(true)}>Browse next<SkipForward size={17} /></Button></div>
      <dl className="grid grid-cols-4 gap-2 text-center">{[["Correct", session.correct], ["Incorrect", session.incorrect], ["Remaining", stats.remaining], ["Accuracy", `${stats.accuracy}%`]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd></div>)}</dl>
      <p className="text-center text-xs text-muted">Space to flip · ← Still Learning · → Know · S to star</p>
    </>}
    {error && <p role="alert" className="rounded-xl border border-danger p-3 text-sm text-danger">{error}</p>}
    {settings && <Dialog title="Study settings" onClose={() => setSettings(false)} busy={busy}>
      <div className="space-y-5">
        <p className="text-sm text-muted">Set up your next round. Applying options starts a fresh session and saves this round’s statistics.</p>
        <label className="flex min-h-12 items-center justify-between gap-4 rounded-2xl border border-edge p-4">Shuffle cards (off = normal order)<input type="checkbox" checked={draft.shuffle} onChange={event => setDraft({ ...draft, shuffle: event.target.checked })} className="h-6 w-6 accent-accent" /></label>
        <label className="block text-sm font-medium">Card direction<select className="mt-2 min-h-12 w-full rounded-2xl border border-edge bg-canvas px-4 text-base" value={draft.direction} onChange={event => setDraft({ ...draft, direction: event.target.value as StudyOptions["direction"] })}><option value="term">Term first</option><option value="definition">Definition first</option><option value="random">Random direction</option></select></label>
        <ContentSelect value={draft.filter} onChange={filter => setDraft({ ...draft, filter })} />
        <p className="text-sm text-muted">{filterCards(deck.cards, draft.filter).length} cards in this round. Missed cards return later; two consecutive correct recalls master a card.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">{!completed && stats.attempts > 0 && <Button variant="ghost" disabled={busy} onClick={() => void finish()}>Finish session now</Button>}<Button variant="secondary" disabled={busy} onClick={() => setSettings(false)}>Cancel</Button><Button disabled={busy} onClick={() => void restart(draft)}>Apply & restart</Button></div>
      </div>
    </Dialog>}
  </div>;
}
