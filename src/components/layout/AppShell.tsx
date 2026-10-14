"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { LibraryRecovery, LocalDataConsent, MigrationComplete, ProfileSetup, RecoveryProblem } from "@/components/auth/AccountOnboarding";
import { BottomNav } from "@/components/layout/BottomNav";
import { SyncStatus } from "@/components/layout/SyncStatus";
import { Sidebar } from "@/components/layout/Sidebar";
import { useStore } from "@/providers/StoreProvider";
import { useSync } from "@/providers/SyncProvider";
import { readDraft, saveDraft } from "@/data/drafts";

const AUTH_ROUTES = new Set(["/welcome", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"]);

function AuthLoading() {
  return <AuthFrame title="Opening BrainBo…" description="Checking your account and the study data saved on this device."><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full w-1/2 animate-pulse rounded-full bg-accent" /></div></AuthFrame>;
}

function useScrollRecovery(pathname: string) {
  useEffect(() => {
    if (AUTH_ROUTES.has(pathname)) return;
    const key = `navigation-scroll:${pathname}`;
    let active = true;
    let timer: number | undefined;
    const save = () => void saveDraft(key, { version: 1, y: window.scrollY }).catch(() => undefined);
    const onScroll = () => { window.clearTimeout(timer); timer = window.setTimeout(save, 250); };
    const onHidden = () => { if (document.visibilityState === "hidden") save(); };
    void readDraft<{ version: 1; y: number }>(key).then(draft => {
      if (!active || draft?.version !== 1 || !Number.isFinite(draft.y) || draft.y <= 0) return;
      // Content backed by IndexedDB can render just after the route itself.
      let attempts = 0;
      const restore = () => {
        if (!active) return;
        window.scrollTo({ top: draft.y, behavior: "instant" });
        if (window.scrollY + 2 < draft.y && attempts++ < 8) window.setTimeout(restore, 50);
      };
      window.requestAnimationFrame(restore);
    }).catch(() => undefined);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save); window.addEventListener("brainbo-before-navigate", save);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      active = false; window.clearTimeout(timer); save();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save); window.removeEventListener("brainbo-before-navigate", save);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [pathname]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sync = useSync();
  const { ready, prefs } = useStore();
  const [ignoreRecoveryError, setIgnoreRecoveryError] = useState(false);
  const authRoute = AUTH_ROUTES.has(pathname);
  useScrollRecovery(pathname);
  const profileConfigured = !!prefs.profileConfigured || (prefs.displayName.trim() !== "" && prefs.displayName !== "there");
  useEffect(() => {
    if (!sync.configured || !sync.authReady) return;
    if (!sync.user && !sync.continuedLocal && !authRoute) router.replace("/welcome");
    if (sync.user && authRoute && pathname !== "/reset-password") router.replace("/");
  }, [authRoute, pathname, router, sync.authReady, sync.configured, sync.continuedLocal, sync.user]);

  if (sync.configured && !sync.authReady) return <AuthLoading />;
  if (sync.configured && !sync.user && !sync.continuedLocal) return authRoute ? children : <AuthLoading />;
  if (sync.configured && sync.user && pathname === "/reset-password") return children;
  if (sync.configured && sync.user && !sync.initialSyncComplete) return <LibraryRecovery />;
  if (sync.configured && sync.user && sync.error && !sync.localData && !ignoreRecoveryError) return <RecoveryProblem onContinue={() => setIgnoreRecoveryError(true)} />;
  if (sync.configured && sync.user && sync.needsConsent && !sync.consentDeferred) return <LocalDataConsent />;
  if (sync.configured && sync.user && sync.migrationComplete) return <MigrationComplete />;
  if (sync.configured && sync.user && ready && !profileConfigured) return <ProfileSetup />;
  if (sync.configured && sync.user && authRoute) return <AuthLoading />;
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
