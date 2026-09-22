"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { MAX_BRAINBO_DECK_BYTES, parseBrainBoDeck, sharedDeckInput, type BrainBoDeckFile } from "@/lib/deck-share";
import { useStore } from "@/providers/StoreProvider";

export function ImportDeckDialog({ onClose, onImported }: { onClose: () => void; onImported: (id: string, title: string) => void }) {
  const { createDeck } = useStore();
  const [preview, setPreview] = useState<BrainBoDeckFile | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "mt-1.5 h-12 w-full rounded-xl border border-edge bg-surface-2/45 px-4 text-base";

  async function choose(file?: File) {
    setError(""); setPreview(null); setLegacy(false);
    if (!file) return;
    if (file.size > MAX_BRAINBO_DECK_BYTES) return setError("Choose a BrainBo deck file smaller than 5 MB.");
    try {
      const result = parseBrainBoDeck(await file.text());
      setPreview(result.file); setLegacy(result.legacy); setTitle(result.file.deck.title);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this BrainBo deck file.");
    }
  }

  async function add() {
    if (!preview || busy) return;
    if (!title.trim()) return setError("Give the imported deck a title.");
    setBusy(true); setError("");
    try {
      const id = await createDeck(sharedDeckInput(preview.deck, title));
      onImported(id, title.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this deck. Please try again.");
      setBusy(false);
    }
  }

  return <Dialog title="Import BrainBo Deck" onClose={onClose} busy={busy}>
    <div className="space-y-5">
      <div><p className="text-muted">This adds one new deck to your library. Your existing decks and account data will not be changed.</p><p className="mt-2 text-sm text-muted">For an entire-library recovery, use Backup & Restore in Profile → Settings.</p></div>
      {!preview ? <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-edge-strong bg-surface-2/35 p-5 text-center transition-colors hover:border-accent hover:bg-accent/5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-accent shadow-sm"><FileUp size={21} /></span>
        <span className="font-medium">Choose a BrainBo deck file</span>
        <span className="text-sm text-muted">JSON · up to 5 MB</span>
        <input autoFocus className="sr-only" type="file" accept=".json,.brainbo-deck,application/json" aria-label="Choose BrainBo deck file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void choose(file); }} />
      </label> : <div className="space-y-4">
        <div className="panel-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-display text-xl">{preview.deck.title}</p><p className="mt-1 text-sm text-muted">{preview.deck.subject} · {preview.deck.cards.length} {preview.deck.cards.length === 1 ? "card" : "cards"}</p></div><span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{legacy ? "Legacy BrainBo JSON" : `BrainBo Deck v${preview.version}`}</span></div>
          {!!preview.deck.cards.length && <ul className="mt-4 divide-y divide-edge border-t border-edge text-sm">{preview.deck.cards.slice(0, 4).map((card, index) => <li key={`${card.term}-${index}`} className="flex gap-3 py-2.5"><span className="min-w-0 flex-1 truncate font-medium">{card.term}</span><span className="min-w-0 flex-1 truncate text-muted">{card.definition}</span></li>)}</ul>}
        </div>
        <label className="block text-sm font-medium">Deck title<input className={field} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <Button variant="ghost" onClick={() => { setPreview(null); setTitle(""); }}>Choose another file</Button>
      </div>}
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>{preview && <Button disabled={busy || !title.trim()} onClick={() => void add()}>{busy ? "Adding…" : "Add to Library"}</Button>}</div>
    </div>
  </Dialog>;
}
