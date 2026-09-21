"use client";
import { useState, type FormEvent } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ImportCardsDialog } from "./ImportCardsDialog";
import { useStore } from "@/providers/StoreProvider";
import type { Deck, CardInput } from "@/types";

type Props = { open: boolean; onClose: () => void; onCreated?: (id: string) => void; deck?: Deck };
export function CreateDeckDialog(props: Props) {
  return props.open ? <DeckEditor {...props} /> : null;
}
function DeckEditor({ onClose, onCreated, deck }: Props) {
  const { createDeck, updateDeck } = useStore();
  const [title, setTitle] = useState(deck?.title ?? "");
  const [description, setDescription] = useState(deck?.description ?? "");
  const [subject, setSubject] = useState(deck?.subject ?? "");
  const [cards, setCards] = useState<(CardInput & { key: string })[]>(deck?.cards.map(card => ({ ...card, original: { term: card.term, definition: card.definition, position: card.position, acceptedAnswers: card.acceptedAnswers, acceptedTermAnswers: card.acceptedTermAnswers }, key: card.id })) ?? []);
  const [removedCardIds, setRemovedCardIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const field = "mt-1.5 w-full rounded-2xl border border-edge bg-canvas px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
  function append(items: CardInput[]) { setCards(current => [...current, ...items.map(card => ({ ...card, key: crypto.randomUUID() }))]); }
  function move(index: number, direction: number) {
    setCards(current => { const next = [...current]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    try {
      const input = { title, description, subject, cards, removedCardIds, original: deck ? { title: deck.title, description: deck.description, subject: deck.subject } : undefined };
      const id = deck ? (await updateDeck(deck.id, input), deck.id) : await createDeck(input);
      onCreated?.(id); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your deck. Please try again."); }
    finally { setSaving(false); }
  }
  return <Dialog title={deck ? "Edit deck" : "Create deck"} onClose={onClose} busy={saving}>
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={saving} className="space-y-4">
        <label className="block text-sm font-medium">Title<input autoFocus required value={title} onChange={event => setTitle(event.target.value)} className={field} placeholder="e.g. French · Travel phrases" /></label>
        <label className="block text-sm font-medium">Subject / category<input value={subject} onChange={event => setSubject(event.target.value)} className={field} placeholder="Unsorted" /></label>
        <label className="block text-sm font-medium">Description <span className="text-muted">(optional)</span><textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} className={field} placeholder="What are you learning?" /></label>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Cards · {cards.length}</h3><Button variant="secondary" onClick={() => setImporting(true)}>Import cards</Button></div>
        {!cards.length && <p className="rounded-2xl border border-dashed border-edge p-6 text-center text-sm text-muted">Start with one idea. Add a card below or paste a whole list to import.</p>}
        {cards.map((card, index) => <div key={card.key} className="rounded-2xl border border-edge bg-canvas/50 p-3">
          <div className="flex items-center justify-between"><span className="text-sm text-muted">Card {index + 1}</span><div className="flex">
            <Button variant="ghost" size="icon" aria-label={`Move card ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /></Button>
            <Button variant="ghost" size="icon" aria-label={`Move card ${index + 1} down`} disabled={index === cards.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></Button>
            <Button variant="ghost" size="icon" aria-label={`Delete card ${index + 1}`} onClick={() => { if (card.id) setRemovedCardIds(ids => [...ids, card.id!]); setCards(current => current.filter(item => item.key !== card.key)); }}><Trash2 size={18} /></Button>
          </div></div>
          <div className="grid gap-3 sm:grid-cols-2">{(["term", "definition"] as const).map(name => <label key={name} className="text-sm capitalize">{name}<textarea required rows={3} className={field} value={card[name]} onChange={event => setCards(current => current.map(item => item.key === card.key ? { ...item, [name]: event.target.value } : item))} /></label>)}</div>
          <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-muted">Accepted answers (optional)</summary><p className="mb-3 text-sm text-muted">One explicit alias per line. Used only when Smart Grading is on.</p><div className="grid gap-3 sm:grid-cols-2">{(["acceptedTermAnswers", "acceptedAnswers"] as const).map(name => <label key={name} className="text-sm">{name === "acceptedAnswers" ? "Accepted definition answers" : "Accepted term answers"}<textarea rows={2} className={field} value={(card[name] ?? []).join("\n")} onChange={event => setCards(current => current.map(item => item.key === card.key ? { ...item, [name]: event.target.value.split("\n") } : item))} /></label>)}</div></details>
        </div>)}
        <Button variant="secondary" onClick={() => append([{ term: "", definition: "" }])}><Plus size={18} />Add card</Button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-edge bg-surface py-3"><Button variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !title.trim()}>{saving ? "Saving…" : deck ? "Save changes" : "Create deck"}</Button></div>
    </form>
    {importing && <ImportCardsDialog onClose={() => setImporting(false)} onImport={append} />}
  </Dialog>;
}
