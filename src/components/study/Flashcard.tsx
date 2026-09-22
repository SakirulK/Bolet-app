"use client";
import { useRef, useState, type PointerEvent } from "react";
import type { Card } from "@/types";
import type { StudyOptions } from "@/lib/study-session";

export function Flashcard({ card, direction, firstSide, flipped, onFlip, onGrade, disabled }: {
  firstSide?: "term" | "definition";
  card: Card; direction: StudyOptions["direction"]; flipped: boolean;
  onFlip: () => void; onGrade: (known: boolean) => void; disabled: boolean;
}) {
  const definitionFirst = firstSide ? firstSide === "definition" : direction === "definition";
  const [drag, setDrag] = useState(0);
  const gesture = useRef<{ id: number; x: number; y: number; moved: boolean; horizontal: boolean } | null>(null);
  const suppressClick = useRef(false);
  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, horizontal: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) current.moved = true;
    if (!current.horizontal && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4) current.horizontal = true;
    if (current.horizontal) setDrag(Math.max(-180, Math.min(180, dx)));
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    suppressClick.current = current.moved;
    gesture.current = null; setDrag(0);
    if (current.horizontal && Math.abs(dx) >= Math.min(90, event.currentTarget.clientWidth * 0.22) && Math.abs(dx) > Math.abs(dy) * 1.4) onGrade(dx > 0);
  }
  const front = definitionFirst ? "Definition" : "Term";
  const back = definitionFirst ? "Term" : "Definition";
  return <div className="study-card-stage">
    <div className="study-swipe" style={{ transform: `translateX(${drag}px) rotate(${drag / 35}deg)` }}>
      <div role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
        aria-label={`${flipped ? back : front}: ${flipped ? (definitionFirst ? card.term : card.definition) : (definitionFirst ? card.definition : card.term)}. Tap to flip.`}
        aria-pressed={flipped} data-testid="flashcard" className="study-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onPointerDown={down} onPointerMove={move} onPointerUp={up}
        onPointerCancel={() => { gesture.current = null; suppressClick.current = true; setDrag(0); }}
        onClick={() => { if (!disabled && !suppressClick.current) onFlip(); suppressClick.current = false; }}
        onKeyDown={event => { if (event.key === "Enter" || event.code === "Space") { event.preventDefault(); event.stopPropagation(); if (!disabled && !event.repeat) onFlip(); } }}>
        <div className={`study-card-inner ${flipped ? "is-flipped" : ""}`}>
          {[false, true].map(isBack => {
            const showDefinition = isBack ? !definitionFirst : definitionFirst;
            return <div key={String(isBack)} aria-hidden={isBack !== flipped} className={`study-card-face ${isBack ? "study-card-back" : ""}`}>
              <span className="text-xs font-medium tracking-[0.18em] text-muted uppercase">{showDefinition ? "Definition" : "Term"}</span>
              <div className="study-card-content">
                <p className={`${showDefinition ? "text-2xl sm:text-3xl" : "font-display text-3xl sm:text-5xl"} whitespace-pre-wrap break-words leading-snug`}>{showDefinition ? card.definition : card.term}</p>
                {showDefinition && card.notes && <p className="mt-6 whitespace-pre-wrap break-words border-t border-edge pt-4 text-base leading-relaxed text-muted">{card.notes}</p>}
              </div>
              <span className="text-xs text-muted">Tap anywhere to flip</span>
            </div>;
          })}
        </div>
      </div>
      {!!drag && <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-5 text-center text-sm font-semibold ${drag > 0 ? "text-accent" : "text-danger"}`}>{drag > 0 ? "Know →" : "← Still Learning"}</div>}
    </div>
  </div>;
}
