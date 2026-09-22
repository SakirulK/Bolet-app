"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function AuthFrame({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-backdrop flex min-h-dvh items-center justify-center bg-canvas px-4 py-[max(2rem,env(safe-area-inset-top))] text-ink">
      <div className="auth-panel w-full max-w-md space-y-7 rounded-[2rem] border border-edge bg-surface p-6 sm:p-9">
        <Link href="/welcome" className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
          <span className="brand-mark flex h-11 w-11 items-center justify-center rounded-xl bg-accent font-display text-xl text-accent-fg">B</span>
          <span className="font-display text-2xl">BrainBo</span>
        </Link>
        <header>
          <h1 className="font-display text-3xl tracking-tight">{title}</h1>
          <p className="mt-2 leading-7 text-muted">{description}</p>
        </header>
        {children}
      </div>
    </main>
  );
}

export const authField = "mt-1.5 h-12 w-full rounded-2xl border border-edge bg-surface px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
