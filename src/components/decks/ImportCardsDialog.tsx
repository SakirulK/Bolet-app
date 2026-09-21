"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { parseCards, type Delimiter } from "@/lib/deck-transfer";
import type { CardInput } from "@/types";

export function ImportCardsDialog({ onClose, onImport }: { onClose: () => void; onImport: (cards: CardInput[]) => void }) {
  const [text, setText] = useState("");
  const [delimiter, setDelimiter] = useState<Delimiter>("auto");
  const preview = parseCards(text, delimiter);
  return <Dialog title="Import cards" onClose={onClose}>
    <p className="mb-4 text-sm text-muted">Paste one term and definition per line. Tabs, commas, and semicolons are supported, including quoted CSV fields.</p>
    <label className="block text-sm">Card data<textarea autoFocus rows={6} value={text} onChange={event => setText(event.target.value)} placeholder={"Apple\tAn edible fruit\nCPU\tCentral Processing Unit"} className="mt-2 w-full rounded-2xl border border-edge bg-canvas p-3 text-base" /></label>
    <label className="my-4 flex flex-wrap items-center gap-3 text-sm">Separate with
      <select className="min-h-11 rounded-xl border border-edge bg-canvas px-3" value={delimiter} onChange={event => setDelimiter(event.target.value as Delimiter)}>
        <option value="auto">Detect automatically</option><option value={"\t"}>Tab</option><option value=",">Comma</option><option value=";">Semicolon</option>
      </select>
      {text && <span className="text-muted">Using {preview.delimiter === "\t" ? "tab" : preview.delimiter === "," ? "comma" : "semicolon"}</span>}
    </label>
    <h3 className="mb-2 font-medium">Preview · {preview.cards.length} cards</h3>
    <div className="max-h-60 overflow-auto rounded-xl border border-edge">
      {preview.cards.length ? preview.cards.map((card, index) => <div key={index} className="grid gap-2 border-b border-edge p-3 text-sm sm:grid-cols-2"><span className="whitespace-pre-wrap break-words font-medium">{card.term}</span><span className="whitespace-pre-wrap break-words text-muted">{card.definition}</span></div>) : <p className="p-4 text-sm text-muted">Your cards will appear here before you import.</p>}
    </div>
    {(preview.invalid.length > 0 || preview.quoted) && <p role="alert" className="mt-3 text-sm text-danger">{preview.quoted ? "Close the unfinished quotation mark. " : ""}{preview.invalid.length > 0 ? `Rows ${preview.invalid.join(", ")} need exactly two nonempty fields. Check the delimiter or quote fields containing it.` : ""}</p>}
    <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!preview.cards.length || !!preview.invalid.length || preview.quoted} onClick={() => { onImport(preview.cards); onClose(); }}>Import {preview.cards.length} cards</Button></div>
  </Dialog>;
}
