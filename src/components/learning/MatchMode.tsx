"use client";
import { LocalLink } from "@/components/ui/LocalLink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { filterCards, emptyContent, shuffled, studyUrl, type ContentFilter, type Side } from "@/lib/learning/content";
import { newHistory, commitAttempts } from "@/data/history";
import { ContentSelect, Section, Toggle, Metrics, fieldClass, durationLabel } from "./StudyControls";
import { StarButton } from "./StarButton";
import { useElapsed } from "./useElapsed";
import type { Deck, StudyHistory } from "@/types";
import { deleteDraft, readDraft, saveDraft } from "@/data/drafts";
import { useActiveTimer } from "./useActiveTimer";
type Tile = { id: string; cardId: string; side: Side; text: string };
type Game = { tiles: Tile[]; history: StudyHistory; pairs: number; removed: string[]; selected: string | null; done: boolean };
type MatchDraft = { version: 1; game: Game; activeMs: number };
export function MatchMode({ deck, initialFilter = "all" }: { deck: Deck; initialFilter?: ContentFilter }) {
  const [filter, setFilter] = useState(initialFilter), [shuffle, setShuffle] = useState(true), [pairs, setPairs] = useState("6");
  const [game, setGame] = useState<Game | null>(null), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(""), [error, setError] = useState("");
  const [recovery, setRecovery] = useState<MatchDraft | null>(null), [restored, setRestored] = useState(false);
  const lock = useRef(false);
  const activeTimer = useActiveTimer();
  const draftKey = `match:${deck.id}`;
  const studyMeta = useMemo(() => ({ mode: "match" as const, deckId: deck.id, title: deck.title, href: studyUrl(deck.id, "match") }), [deck.id, deck.title]);
  const elapsed = useElapsed(game?.history.startedAt ?? 0, !game || game.done);
  const eligible = useMemo(() => filterCards(deck.cards, filter), [deck.cards, filter]);
  const playable = useMemo(() => {
    const terms = new Map<string, number>(), definitions = new Map<string, number>();
    const key = (text: string) => text.trim().toLocaleLowerCase();
    for (const card of eligible) {
      terms.set(key(card.term), (terms.get(key(card.term)) ?? 0) + 1);
      definitions.set(key(card.definition), (definitions.get(key(card.definition)) ?? 0) + 1);
    }
    return eligible.filter(card => terms.get(key(card.term)) === 1 && definitions.get(key(card.definition)) === 1);
  }, [eligible]);
  const omitted = eligible.length - playable.length;
  const count = pairs === "all" ? Math.min(12, playable.length) : Math.min(Number(pairs), playable.length);
  useEffect(() => { void readDraft<MatchDraft>(draftKey).then(draft => {
    if (draft?.version === 1 && draft.game && Array.isArray(draft.game.tiles) && !draft.game.done && draft.game.tiles.every(tile => deck.cards.some(card => card.id === tile.cardId))) setRecovery(draft);
  }).catch(() => setError("The saved Match board could not be opened. You can start a new game safely.")); }, [deck.cards, draftKey]);
  useEffect(() => {
    const flush = () => { if (game && !game.done) void saveDraft(draftKey, { version: 1, game, activeMs: activeTimer.read() } satisfies MatchDraft, studyMeta); };
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", flush); window.addEventListener("brainbo-before-navigate", flush);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", flush); window.removeEventListener("brainbo-before-navigate", flush); };
  }, [activeTimer, draftKey, game, studyMeta]);
  function start() {
    if (!eligible.length) return;
    const cards = (shuffle ? shuffled(playable) : playable).slice(0, count);
    const tiles = cards.flatMap(card => (["term", "definition"] as const).map(side => ({ id: `${card.id}-${side}`, cardId: card.id, side, text: card[side] })));
    const next = { tiles: shuffled(tiles), history: newHistory(deck.id, deck.title, "match"), pairs: cards.length, removed: [], selected: null, done: false };
    setGame(next); setRecovery(null); setRestored(false); setFeedback(""); setError(""); activeTimer.reset();
    void saveDraft(draftKey, { version: 1, game: next, activeMs: 0 } satisfies MatchDraft, studyMeta).catch(() => setError("Could not save this board. Your game is still visible; try again."));
  }
  const handleSelect = useCallback(async (tile: Tile) => {
    if (!game || lock.current || game.done) return;
    if (!game.selected) { const next = { ...game, selected: tile.id }; setGame(next); void saveDraft(draftKey, { version: 1, game: next, activeMs: activeTimer.read() } satisfies MatchDraft, studyMeta); return; }
    if (game.selected === tile.id) { const next = { ...game, selected: null }; setGame(next); void saveDraft(draftKey, { version: 1, game: next, activeMs: activeTimer.read() } satisfies MatchDraft, studyMeta); return; }
    const first = game.tiles.find(item => item.id === game.selected)!;
    const term = first.side === "term" ? first : tile, definition = first.side === "definition" ? first : tile;
    // Identical terms remain interchangeable, so duplicate labels cannot trap a player.
    const correct = first.side !== tile.side && deck.cards.some(card => card.term === term.text && card.definition === definition.text);
    lock.current = true; setBusy(true); setError("");
    try {
      const removed = correct ? [...game.removed, first.id, tile.id] : game.removed;
      const done = removed.length === game.tiles.length;
      const history = await commitAttempts(game.history, [{ id: `${game.history.id}-${game.history.correct + game.history.incorrect}`, cardId: term.cardId, correct, rating: correct ? "hard" : "again", durationMs: activeTimer.read() }], done);
      setFeedback(correct ? "Matched." : "Not a match. Try another pair.");
      if (!correct) await new Promise(resolve => setTimeout(resolve, 450));
      const next = { ...game, removed, selected: null, done, history };
      if (done) await deleteDraft(draftKey); else await saveDraft(draftKey, { version: 1, game: next, activeMs: 0 } satisfies MatchDraft, studyMeta);
      setGame(next); activeTimer.reset();
    } catch { setError("Could not save this attempt. Try the pair again."); }
    finally { lock.current = false; setBusy(false); }
  }, [activeTimer, deck, draftKey, game, studyMeta]);
  if (!game) return <div className="mx-auto max-w-2xl space-y-6"><header><p className="text-sm text-accent">{deck.title}</p><h1 className="font-display text-3xl">Set up Match</h1><p className="mt-2 text-muted">Tap a term, then its definition. No dragging needed.</p></header>{recovery && <div className="space-y-3 rounded-2xl border border-edge p-4"><p className="text-sm text-muted">An unfinished Match board is saved on this device.</p><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setGame(recovery.game); activeTimer.reset(recovery.activeMs); setRecovery(null); setRestored(true); }}>Resume saved Match</Button><Button variant="ghost" onClick={() => { void deleteDraft(draftKey); setRecovery(null); }}>Discard saved game</Button></div></div>}<Section title="Content"><ContentSelect value={filter} onChange={setFilter} /></Section><Section title="Number of pairs"><label className="block text-sm">Pairs<select className={fieldClass} value={Number(pairs) > playable.length ? "all" : pairs} onChange={e => setPairs(e.target.value)}>{[6, 8, 10].filter(n => n <= playable.length).map(n => <option key={n} value={n}>{n}</option>)}<option value="all">{playable.length > 12 ? `One board (12 of ${playable.length})` : `All (${playable.length})`}</option></select></label></Section><Toggle label="Shuffle card selection" value={shuffle} onChange={setShuffle} />{omitted > 0 && <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm text-muted">{omitted} ambiguous {omitted === 1 ? "card was" : "cards were"} left out because its term or definition is duplicated.</p>}{!eligible.length && <p role="status">{emptyContent(filter)}</p>}<div className="flex gap-3"><Button size="lg" disabled={!playable.length} onClick={start}>Start Match</Button><LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></div></div>;
  if (game.done) { const attempts = game.history.correct + game.history.incorrect; return <div className="mx-auto max-w-3xl space-y-6"><h1 className="font-display text-3xl">All pairs matched</h1><Metrics values={[["Completion time", durationLabel(game.history.durationMs)], ["Mistakes", game.history.incorrect], ["Pairs", game.pairs], ["Accuracy", `${Math.round(game.history.correct / attempts * 100)}%`]]} /><div className="flex flex-wrap gap-3"><Button onClick={start}>Play Again</Button><LocalLink className="study-link" href={studyUrl(deck.id, "match", undefined, "starred")}>Play Starred</LocalLink>{game.history.difficultIds.length > 0 && <LocalLink className="study-link" href={studyUrl(deck.id, "learn", game.history.difficultIds)}>Study Missed / Difficult</LocalLink>}<LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></div></div>; }
  return <div className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-accent">{deck.title}</p><h1 className="font-display text-3xl">Match</h1></div><LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></header>{restored && <p role="status" className="text-sm text-accent">Restored where you left off.</p>}<Metrics values={[["Remaining pairs", game.pairs - game.removed.length / 2], ["Mistakes", game.history.incorrect], ["Time", durationLabel(Math.max(game.history.durationMs, elapsed))]]} /><p role="status" className="min-h-6 text-sm text-muted">{feedback || "Choose two tiles that belong together."}</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{game.tiles.map(tile => { const card = deck.cards.find(card => card.id === tile.cardId); const removed = game.removed.includes(tile.id); return <article key={tile.id} className={`relative flex min-w-0 flex-col rounded-2xl border p-3 ${removed ? "border-edge bg-surface-2 opacity-50" : game.selected === tile.id ? "border-accent bg-accent/5" : "border-edge bg-surface"}`}><div className="flex items-center justify-between"><span className="text-xs text-muted">{removed ? "Matched" : tile.side === "term" ? "Term" : "Definition"}</span>{card && <StarButton card={card} />}</div><button type="button" disabled={busy || removed} aria-pressed={game.selected === tile.id} aria-label={`${tile.side}: ${tile.text}`} onClick={() => void handleSelect(tile)} className="min-h-24 flex-1 whitespace-pre-wrap break-words rounded-lg p-2 text-left text-base leading-relaxed focus-visible:outline-2 focus-visible:outline-accent">{tile.text}</button></article>; })}</div>{error && <p role="alert" className="text-danger">{error}</p>}</div>;
}
