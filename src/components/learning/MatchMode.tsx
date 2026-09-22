"use client";
import { LocalLink } from "@/components/ui/LocalLink";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { filterCards, emptyContent, shuffled, studyUrl, type ContentFilter, type Side } from "@/lib/learning/content";
import { newHistory, commitAttempts } from "@/data/history";
import { ContentSelect, Section, Toggle, Metrics, fieldClass, durationLabel } from "./StudyControls";
import { StarButton } from "./StarButton";
import { useElapsed } from "./useElapsed";
import type { Deck, StudyHistory } from "@/types";
type Tile = { id: string; cardId: string; side: Side; text: string };
type Game = { tiles: Tile[]; history: StudyHistory; pairs: number; removed: string[]; selected: string | null; done: boolean };
export function MatchMode({ deck, initialFilter = "all" }: { deck: Deck; initialFilter?: ContentFilter }) {
  const [filter, setFilter] = useState(initialFilter), [shuffle, setShuffle] = useState(true), [pairs, setPairs] = useState("6");
  const [game, setGame] = useState<Game | null>(null), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(""), [error, setError] = useState("");
  const lock = useRef(false), started = useRef(0);
  const elapsed = useElapsed(game?.history.startedAt ?? 0, !game || game.done);
  const eligible = filterCards(deck.cards, filter);
  const count = pairs === "all" ? eligible.length : Math.min(Number(pairs), eligible.length);
  function start() {
    if (!eligible.length) return;
    const cards = (shuffle ? shuffled(eligible) : eligible).slice(0, count);
    const tiles = cards.flatMap(card => (["term", "definition"] as const).map(side => ({ id: `${card.id}-${side}`, cardId: card.id, side, text: card[side] })));
    setGame({ tiles: shuffled(tiles), history: newHistory(deck.id, deck.title, "match"), pairs: cards.length, removed: [], selected: null, done: false });
    setFeedback(""); setError(""); started.current = Date.now();
  }
  const handleSelect = useCallback(async (tile: Tile) => {
    if (!game || lock.current || game.done) return;
    if (!game.selected) { setGame({ ...game, selected: tile.id }); return; }
    if (game.selected === tile.id) { setGame({ ...game, selected: null }); return; }
    const first = game.tiles.find(item => item.id === game.selected)!;
    const term = first.side === "term" ? first : tile, definition = first.side === "definition" ? first : tile;
    // Identical terms remain interchangeable, so duplicate labels cannot trap a player.
    const correct = first.side !== tile.side && deck.cards.some(card => card.term === term.text && card.definition === definition.text);
    lock.current = true; setBusy(true); setError("");
    try {
      const removed = correct ? [...game.removed, first.id, tile.id] : game.removed;
      const done = removed.length === game.tiles.length;
      const history = await commitAttempts(game.history, [{ id: `${game.history.id}-${game.history.correct + game.history.incorrect}`, cardId: term.cardId, correct, rating: correct ? "hard" : "again", durationMs: Date.now() - started.current }], done);
      setFeedback(correct ? "Matched." : "Not a match. Try another pair.");
      if (!correct) await new Promise(resolve => setTimeout(resolve, 450));
      setGame({ ...game, removed, selected: null, done, history }); started.current = Date.now();
    } catch { setError("Could not save this attempt. Try the pair again."); }
    finally { lock.current = false; setBusy(false); }
  }, [game, deck]);
  if (!game) return <div className="mx-auto max-w-2xl space-y-6"><header><p className="text-sm text-accent">{deck.title}</p><h1 className="font-display text-3xl">Set up Match</h1><p className="mt-2 text-muted">Tap a term, then its definition. No dragging needed.</p></header><Section title="Content"><ContentSelect value={filter} onChange={setFilter} /></Section><Section title="Number of pairs"><label className="block text-sm">Pairs<select className={fieldClass} value={Number(pairs) > eligible.length ? "all" : pairs} onChange={e => setPairs(e.target.value)}>{[6, 8, 10].filter(n => n <= eligible.length).map(n => <option key={n} value={n}>{n}</option>)}<option value="all">All ({eligible.length})</option></select></label></Section><Toggle label="Shuffle" value={shuffle} onChange={setShuffle} />{!eligible.length && <p role="status">{emptyContent(filter)}</p>}<div className="flex gap-3"><Button size="lg" disabled={!eligible.length} onClick={start}>Start Match</Button><LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></div></div>;
  if (game.done) { const attempts = game.history.correct + game.history.incorrect; return <div className="mx-auto max-w-3xl space-y-6"><h1 className="font-display text-3xl">All pairs matched</h1><Metrics values={[["Completion time", durationLabel(game.history.durationMs)], ["Mistakes", game.history.incorrect], ["Pairs", game.pairs], ["Accuracy", `${Math.round(game.history.correct / attempts * 100)}%`]]} /><div className="flex flex-wrap gap-3"><Button onClick={start}>Play Again</Button><LocalLink className="study-link" href={studyUrl(deck.id, "match", undefined, "starred")}>Play Starred</LocalLink>{game.history.difficultIds.length > 0 && <LocalLink className="study-link" href={studyUrl(deck.id, "learn", game.history.difficultIds)}>Study Missed / Difficult</LocalLink>}<LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></div></div>; }
  return <div className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-accent">{deck.title}</p><h1 className="font-display text-3xl">Match</h1></div><LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></header><Metrics values={[["Remaining pairs", game.pairs - game.removed.length / 2], ["Mistakes", game.history.incorrect], ["Time", durationLabel(elapsed)]]} /><p role="status" className="min-h-6 text-sm text-muted">{feedback || "Choose two tiles that belong together."}</p>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{game.tiles.map(tile => { const card = deck.cards.find(card => card.id === tile.cardId); const removed = game.removed.includes(tile.id); return <article key={tile.id} className={`relative flex min-w-0 flex-col rounded-2xl border p-3 ${removed ? "border-edge bg-surface-2 opacity-50" : game.selected === tile.id ? "border-accent bg-accent/5" : "border-edge bg-surface"}`}><div className="flex items-center justify-between"><span className="text-xs text-muted">{removed ? "Matched" : tile.side === "term" ? "Term" : "Definition"}</span>{card && <StarButton card={card} />}</div><button type="button" disabled={busy || removed} aria-pressed={game.selected === tile.id} aria-label={`${tile.side}: ${tile.text}`} onClick={() => void handleSelect(tile)} className="min-h-24 flex-1 whitespace-pre-wrap break-words rounded-lg p-2 text-left text-base leading-relaxed focus-visible:outline-2 focus-visible:outline-accent">{tile.text}</button></article>; })}</div>{error && <p role="alert" className="text-danger">{error}</p>}</div>;
}
