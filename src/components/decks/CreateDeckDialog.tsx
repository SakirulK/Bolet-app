"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ImportCardsDialog } from "./ImportCardsDialog";
import { useStore } from "@/providers/StoreProvider";
import type { Deck, CardInput } from "@/types";
import { deleteDraft, readDraft, saveDraft } from "@/data/drafts";

type Props = { open: boolean; onClose: () => void; onCreated?: (id: string) => void; deck?: Deck };
type EditorCard = CardInput & { key: string };
type EditorDraft = { version: 1; title: string; description: string; subject: string; cards: EditorCard[]; removedCardIds: string[] };
export function CreateDeckDialog(props: Props) {
  return props.open ? <DeckEditor {...props} /> : null;
}
function DeckEditor({ onClose, onCreated, deck }: Props) {
  const { createDeck, updateDeck } = useStore();
  const [title, setTitle] = useState(deck?.title ?? "");
  const [description, setDescription] = useState(deck?.description ?? "");
  const [subject, setSubject] = useState(deck?.subject ?? "");
  const [cards, setCards] = useState<EditorCard[]>(deck?.cards.map(card => ({ ...card, original: { term: card.term, definition: card.definition, position: card.position, acceptedAnswers: card.acceptedAnswers, acceptedTermAnswers: card.acceptedTermAnswers }, key: card.id })) ?? []);
  const [removedCardIds, setRemovedCardIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<EditorDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<{ card: EditorCard; index: number } | null>(null);
  const draftKey = `editor:${deck?.id ?? "new"}`;
  const initialSignature = JSON.stringify({ title: deck?.title ?? "", description: deck?.description ?? "", subject: deck?.subject ?? "", cards: deck?.cards.map(card => ({ id: card.id, term: card.term, definition: card.definition, acceptedAnswers: card.acceptedAnswers, acceptedTermAnswers: card.acceptedTermAnswers })) ?? [] });
  const currentSignature = JSON.stringify({ title, description, subject, cards: cards.map(card => ({ id: card.id, term: card.term, definition: card.definition, acceptedAnswers: card.acceptedAnswers, acceptedTermAnswers: card.acceptedTermAnswers })) });
  const field = "mt-1.5 w-full rounded-xl border border-edge bg-surface-2/45 px-4 py-3 text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20";
  function append(items: CardInput[]) { setCards(current => [...current, ...items.map(card => ({ ...card, key: crypto.randomUUID() }))]); }
  useEffect(() => {
    let active = true;
    void readDraft<EditorDraft>(draftKey).then(draft => {
      if (!active) return;
      if (draft?.version === 1) setRecovery(draft);
      else setDraftReady(true);
    }).catch(() => setDraftReady(true));
    return () => { active = false; };
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady || (initialSignature === currentSignature && !removedCardIds.length)) return;
    const timer = window.setTimeout(() => void saveDraft(draftKey, { version: 1, title, description, subject, cards, removedCardIds } satisfies EditorDraft), 250);
    return () => window.clearTimeout(timer);
  }, [cards, currentSignature, description, draftKey, draftReady, initialSignature, removedCardIds, subject, title]);
  function move(index: number, direction: number) {
    setCards(current => { const next = [...current]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    try {
      const input = { title, description, subject, cards, removedCardIds, original: deck ? { title: deck.title, description: deck.description, subject: deck.subject } : undefined };
      const id = deck ? (await updateDeck(deck.id, input), deck.id) : await createDeck(input);
      await deleteDraft(draftKey); onCreated?.(id); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your deck. Please try again."); }
    finally { setSaving(false); }
  }
  return <Dialog title={deck ? "Edit deck" : "Create deck"} onClose={onClose} busy={saving}>
    <form onSubmit={submit} className="space-y-4">
      {recovery && <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4"><p className="font-medium">Continue your unsaved draft?</p><p className="mt-1 text-sm text-muted">Saved on this device while you were editing.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setTitle(recovery.title); setDescription(recovery.description); setSubject(recovery.subject); setCards(recovery.cards); setRemovedCardIds(recovery.removedCardIds); setRecovery(null); setDraftReady(true); }}>Restore draft</Button><Button variant="ghost" onClick={() => { void deleteDraft(draftKey); setRecovery(null); setDraftReady(true); }}>Discard draft</Button></div></div>}
      <fieldset disabled={saving} className="space-y-4">
        <label className="block text-sm font-medium">Title<input autoFocus required value={title} onChange={event => setTitle(event.target.value)} className={field} placeholder="e.g. French · Travel phrases" /></label>
        <label className="block text-sm font-medium">Subject / category<input value={subject} onChange={event => setSubject(event.target.value)} className={field} placeholder="Unsorted" /></label>
        <label className="block text-sm font-medium">Description <span className="text-muted">(optional)</span><textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} className={field} placeholder="What are you learning?" /></label>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Cards · {cards.length}</h3><Button variant="secondary" onClick={() => setImporting(true)}>Import cards</Button></div>
        {!cards.length && <p className="rounded-2xl border border-dashed border-edge p-6 text-center text-sm text-muted">Start with one idea. Add a card below or paste a whole list to import.</p>}
        {cards.map((card, index) => <div key={card.key} className="rounded-xl border border-edge bg-surface-2/35 p-3">
          <div className="flex items-center justify-between"><span className="text-sm text-muted">Card {index + 1}</span><div className="flex">
            <Button variant="ghost" size="icon" aria-label={`Move card ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /></Button>
            <Button variant="ghost" size="icon" aria-label={`Move card ${index + 1} down`} disabled={index === cards.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></Button>
            <Button variant="ghost" size="icon" aria-label={`Delete card ${index + 1}`} onClick={() => { if (card.id) setRemovedCardIds(ids => [...ids, card.id!]); setLastRemoved({ card, index }); setCards(current => current.filter(item => item.key !== card.key)); }}><Trash2 size={18} /></Button>
          </div></div>
          <div className="grid gap-3 sm:grid-cols-2">{(["term", "definition"] as const).map(name => <label key={name} className="text-sm capitalize">{name}<textarea required rows={3} className={field} value={card[name]} onChange={event => setCards(current => current.map(item => item.key === card.key ? { ...item, [name]: event.target.value } : item))} /></label>)}</div>
          <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-muted">Accepted answers (optional)</summary><p className="mb-3 text-sm text-muted">One explicit alias per line. Used only when Smart Grading is on.</p><div className="grid gap-3 sm:grid-cols-2">{(["acceptedTermAnswers", "acceptedAnswers"] as const).map(name => <label key={name} className="text-sm">{name === "acceptedAnswers" ? "Accepted definition answers" : "Accepted term answers"}<textarea rows={2} className={field} value={(card[name] ?? []).join("\n")} onChange={event => setCards(current => current.map(item => item.key === card.key ? { ...item, [name]: event.target.value.split("\n") } : item))} /></label>)}</div></details>
        </div>)}
        {lastRemoved && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm"><span>Card removed from this draft.</span><Button variant="ghost" onClick={() => { const removed = lastRemoved; setCards(current => { const next = [...current]; next.splice(removed.index, 0, removed.card); return next; }); if (removed.card.id) setRemovedCardIds(ids => ids.filter(id => id !== removed.card.id)); setLastRemoved(null); }}>Undo</Button></div>}
        <Button variant="secondary" onClick={() => append([{ term: "", definition: "" }])}><Plus size={18} />Add card</Button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-edge bg-surface py-3"><Button variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !title.trim()}>{saving ? "Saving…" : deck ? "Save changes" : "Create deck"}</Button></div>
    </form>
    {importing && <ImportCardsDialog onClose={() => setImporting(false)} onImport={append} />}
  </Dialog>;
}
