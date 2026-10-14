"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { deleteDraft, readDraft, saveDraft } from "@/data/drafts";
import { parseCards, type Delimiter } from "@/lib/deck-transfer";
import { detectFlashcards, applyDuplicateIssues, type DetectionIssue, type SkippedImportText } from "@/lib/flashcard-detection";
import type { CardInput } from "@/types";

type ManualDelimiter = Exclude<Delimiter, "auto">;
type PreviewCard = CardInput & { key: string; issues: DetectionIssue[] };
type ImportDraftV1 = { version: 1; text: string; delimiter: Delimiter };
type ImportDraft = { version: 2; text: string; delimiter: ManualDelimiter; cards: PreviewCard[] | null; skipped: SkippedImportText[]; detectedText: string };

const emptyDraft = (): ImportDraft => ({ version: 2, text: "", delimiter: "\t", cards: null, skipped: [], detectedText: "" });

export function ImportCardsDialog({ draftKey, onClose, onImport }: { draftKey: string; onClose: () => void; onImport: (cards: CardInput[]) => void | Promise<void> }) {
  const [draft, setDraft] = useState<ImportDraft>(emptyDraft);
  const [ready, setReady] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const latest = useRef<ImportDraft>(emptyDraft());
  const interacted = useRef(false);
  const cards = draft.cards ? applyDuplicateIssues(draft.cards) : null;
  const validCards = cards?.filter(card => card.term.trim() && card.definition.trim()) ?? [];
  const incomplete = cards?.some(card => !card.term.trim() || !card.definition.trim()) ?? false;
  const previewIsCurrent = draft.detectedText === draft.text;

  function update(next: ImportDraft) {
    interacted.current = true;
    latest.current = next;
    setDraft(next);
    setDraftStatus("saving");
  }

  const persist = useCallback(async (current = latest.current) => {
    try {
      if (current.text || current.cards) await saveDraft(draftKey, current);
      else await deleteDraft(draftKey);
      if (latest.current === current) setDraftStatus("saved");
    } catch {
      setDraftStatus("error");
    }
  }, [draftKey]);

  useEffect(() => {
    let active = true;
    void readDraft<ImportDraft | ImportDraftV1>(draftKey).then(saved => {
      if (!active || interacted.current || !saved) return;
      let restored: ImportDraft;
      if (saved.version === 2 && typeof saved.text === "string" && Array.isArray(saved.skipped) && (saved.cards === null || Array.isArray(saved.cards))) restored = saved;
      else if (saved.version === 1 && typeof saved.text === "string") restored = { ...emptyDraft(), text: saved.text, delimiter: saved.delimiter === "auto" ? "\t" : saved.delimiter };
      else { setError("The saved import could not be opened. Your decks are unchanged."); return; }
      latest.current = restored;
      setDraft(restored);
      setRecovered(!!restored.text || !!restored.cards);
    }).catch(() => setError("Could not restore the previous import.")).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [draftKey]);

  useEffect(() => {
    if (!ready || !interacted.current) return;
    const timer = window.setTimeout(() => void persist(), 200);
    return () => window.clearTimeout(timer);
  }, [draft, persist, ready]);

  useEffect(() => {
    const flush = () => {
      const current = latest.current;
      if (current.text || current.cards) void persist(current);
    };
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush); window.addEventListener("brainbo-before-navigate", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush); window.removeEventListener("brainbo-before-navigate", flush);
    };
  }, [draftKey, persist]);

  function previewAutomatically() {
    const result = detectFlashcards(draft.text);
    update({ ...draft, detectedText: draft.text, cards: result.cards.map(card => ({ ...card, key: crypto.randomUUID() })), skipped: result.skipped });
  }

  function previewWithDelimiter() {
    const result = parseCards(draft.text, draft.delimiter);
    const lines = draft.text.replace(/\r\n?/g, "\n").split("\n");
    const skipped: SkippedImportText[] = result.invalid.map(line => ({ line, text: lines[line - 1]?.trim() || "Empty row", reason: "unmatched" }));
    if (result.quoted) skipped.push({ line: lines.length, text: "Unfinished quotation mark", reason: "unmatched" });
    update({ ...draft, detectedText: draft.text, cards: result.cards.map(card => ({ ...card, key: crypto.randomUUID(), issues: [] })), skipped });
  }

  function editCard(key: string, field: "term" | "definition", value: string) {
    const nextCards = (cards ?? []).map(card => card.key === key ? { ...card, [field]: value, issues: card.issues.filter(issue => issue !== "ambiguous") } : card);
    update({ ...draft, cards: nextCards });
  }

  async function importCards() {
    if (saving || !previewIsCurrent || incomplete || !validCards.length) return;
    setSaving(true); setError("");
    try {
      await onImport(validCards.map(({ term, definition, notes, acceptedAnswers, acceptedTermAnswers }) => ({ term: term.trim(), definition: definition.trim(), notes, acceptedAnswers, acceptedTermAnswers })));
      onClose();
    } catch {
      setError("Could not add these cards. Your pasted text and edits are still saved.");
      setSaving(false);
    }
  }

  return <Dialog title="Import cards" onClose={onClose} busy={saving}>
    <p className="mb-4 text-sm text-muted">Paste text from slides or notes. BrainBo will find clear term and definition pairs without changing their meaning.</p>
    {recovered && <div role="status" className="mb-4 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-sm">Restored where you left off.</div>}
    <label className="block text-sm font-medium">Paste your notes
      <textarea autoFocus rows={9} value={draft.text} onChange={event => update({ ...draft, text: event.target.value })} placeholder={"Operating activities\nCash flows from the main activities of the business.\n\nCPU: Central Processing Unit"} className="mt-2 w-full rounded-xl border border-edge bg-surface-2/45 p-3 text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20" />
    </label>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <span className={`text-xs ${draftStatus === "error" ? "text-danger" : "text-muted"}`}>{draftStatus === "saved" ? "Draft saved on this device." : draftStatus === "saving" ? "Saving draft…" : draftStatus === "error" ? "Draft could not be saved." : ""}</span>
      {draftStatus === "error" && <Button variant="ghost" className="min-h-9 px-2 text-xs" onClick={() => void persist()}>Retry save</Button>}
      <Button disabled={!draft.text.trim() || saving} onClick={previewAutomatically}>Preview cards</Button>
    </div>

    <details className="mt-4 rounded-xl border border-edge px-4 py-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Having trouble?</summary>
      <div className="flex flex-wrap items-end gap-3 pb-3">
        <label className="text-sm text-muted">Separate term and definition with
          <select className="mt-1 block min-h-11 rounded-xl border border-edge bg-canvas px-3 text-ink" value={draft.delimiter} onChange={event => update({ ...draft, delimiter: event.target.value as ManualDelimiter })}>
            <option value={"\t"}>Tab</option><option value=",">Comma</option><option value=";">Semicolon</option>
          </select>
        </label>
        <Button variant="secondary" disabled={!draft.text.trim() || saving} onClick={previewWithDelimiter}>Use this separator</Button>
      </div>
    </details>

    {cards && <section className="mt-6" aria-labelledby="import-preview-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h3 id="import-preview-heading" className="font-display text-xl">Preview · {cards.length} cards</h3><p className="mt-1 text-sm text-muted">Edit anything that does not look right.</p></div>
        {!previewIsCurrent && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">Your pasted text changed. Preview it again.</p>}
      </div>
      <div className="mt-3 max-h-[42dvh] space-y-3 overflow-y-auto pr-1">
        {cards.map((card, index) => <div key={card.key} className="rounded-xl border border-edge bg-surface-2/30 p-3">
          <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted">Card {index + 1}</span>
              {(card.issues.includes("ambiguous") || !card.term.trim() || !card.definition.trim()) && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">Check this card</span>}
              {card.issues.includes("exact-duplicate") && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">Duplicate</span>}
              {card.issues.includes("conflicting-definition") && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">Same term, different definition</span>}
            </div>
            <Button variant="ghost" className="min-h-9 px-2 text-xs" onClick={() => update({ ...draft, cards: cards.filter(item => item.key !== card.key) })}>Remove</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Term<textarea rows={3} value={card.term} onChange={event => editCard(card.key, "term", event.target.value)} className="mt-1 w-full rounded-xl border border-edge bg-canvas p-3 text-base" /></label>
            <label className="text-sm">Definition<textarea rows={3} value={card.definition} onChange={event => editCard(card.key, "definition", event.target.value)} className="mt-1 w-full rounded-xl border border-edge bg-canvas p-3 text-base" /></label>
          </div>
        </div>)}
        {!cards.length && <p className="rounded-xl border border-dashed border-edge p-5 text-center text-sm text-muted">No clear cards found. Adjust the text or try a separator under Having trouble?</p>}
      </div>
    </section>}

    {!!draft.skipped.length && <details className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-2" open={!cards?.length}>
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Text not added · {draft.skipped.length}</summary>
      <p className="mb-2 text-sm text-muted">BrainBo could not safely match this text. It has not been discarded.</p>
      <ul className="max-h-36 space-y-2 overflow-y-auto pb-3 text-sm">{draft.skipped.map((item, index) => <li key={`${item.line}-${index}`} className="whitespace-pre-wrap rounded-lg bg-surface/70 px-3 py-2"><span className="mr-2 text-xs text-muted">Line {item.line}</span>{item.text}</li>)}</ul>
    </details>}

    {incomplete && <p role="alert" className="mt-3 text-sm text-amber-700 dark:text-amber-300">Complete or remove every marked card before importing.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4">
      <Button variant="ghost" className="text-xs" disabled={saving} onClick={() => { const next = emptyDraft(); setRecovered(false); update(next); }}>Discard import</Button>
      <div className="flex gap-2"><Button variant="secondary" disabled={saving} onClick={onClose}>Close</Button><Button disabled={saving || !previewIsCurrent || incomplete || !validCards.length} onClick={importCards}>{saving ? "Importing…" : `Import ${validCards.length} cards`}</Button></div>
    </div>
  </Dialog>;
}
