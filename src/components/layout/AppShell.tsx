"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { SyncStatus } from "@/components/layout/SyncStatus";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const studying = /^\/study\/[^/]+$/.test(pathname) || pathname === "/practice" || pathname === "/review" || pathname === "/offline";
  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      {!studying && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <main
          id="main"
          className={studying ? "mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-6" : "mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 sm:pt-8 lg:px-10 lg:pb-10"}
        >
          {!studying && <SyncStatus />}
          {children}
        </main>
        {!studying && <BottomNav />}
      </div>
    </div>
  );
}
