"use client";

import { Download } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { exportDeck } from "@/lib/deck-transfer";
import type { Deck } from "@/types";

export function ShareDeckDialog({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  return <Dialog title="Share a copy of this deck" onClose={onClose}>
    <div className="space-y-5">
      <p className="text-muted">The recipient gets the terms and definitions, but not your study progress.</p>
      <div className="panel-surface p-4">
        <p className="font-display text-xl">{deck.title}</p>
        <p className="mt-1 text-sm text-muted">{deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"} · {deck.subject}</p>
      </div>
      <p className="text-sm leading-6 text-muted">BrainBo creates a content-only deck file. Stars, mastery, schedules, history, and account information are left out.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => exportDeck(deck, "json")}><Download size={18} />Download BrainBo Deck</Button>
      </div>
    </div>
  </Dialog>;
}
