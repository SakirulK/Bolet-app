"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/providers/StoreProvider";
import type { Card } from "@/types";
import type { Side } from "@/lib/learning/content";
export function StarButton({ card, side }: { card: Card; side: Side }) {
  const { toggleStarCard } = useStore();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const starred = side === "term" ? card.termStarred : card.definitionStarred;
  return <span className="inline-flex flex-col items-end"><Button variant="ghost" size="icon" disabled={busy} aria-pressed={!!starred} aria-label={`${starred ? "Unstar" : "Star"} ${side}`} onClick={async event => {
    event.stopPropagation(); setBusy(true); setError("");
    try { await toggleStarCard(card.id, side); } catch { setError("Could not save star. Try again."); } finally { setBusy(false); }
  }}><Star size={20} className={starred ? "fill-accent text-accent" : "text-muted"} /></Button>{error && <span role="alert" className="max-w-44 text-xs text-danger">{error}</span>}</span>;
}
