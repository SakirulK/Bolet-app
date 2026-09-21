"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({ title, onClose, children, busy = false }: {
  title: string; onClose: () => void; children: ReactNode; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-edge bg-surface p-5 text-ink shadow-xl backdrop:bg-black/40 sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 id={id} className="font-display text-2xl">{title}</h2>
      <button type="button" disabled={busy} onClick={onClose} aria-label="Close dialog" className="h-11 w-11 shrink-0 rounded-xl hover:bg-surface-2">✕</button>
    </div>
    {children}
  </dialog>;
}
