"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { useSync } from "@/providers/SyncProvider";

export function WelcomeScreen() {
  const sync = useSync();
  const router = useRouter();
  return (
    <AuthFrame title="Study anywhere." description="Keep your decks protected and synced across your devices.">
      {sync.localData && (
        <div className="rounded-2xl border border-edge bg-surface p-4 text-sm leading-6">
          <p className="font-medium">BrainBo found study data saved on this device.</p>
          <p className="mt-1 text-muted">Sign in or create an account to protect it and sync it across your devices.</p>
        </div>
      )}
      <div className="grid gap-3">
        <Button size="lg" onClick={() => router.push("/sign-in")}>Sign In</Button>
        <Link href="/sign-up" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-edge bg-surface px-4 text-sm font-medium">Create Account</Link>
        <button type="button" onClick={() => { sync.continueLocal(); router.replace("/"); }} className="min-h-11 rounded-xl px-4 text-sm text-muted underline underline-offset-4">
          Continue on this device
        </button>
      </div>
      {sync.localData && <p className="text-center text-sm text-muted">Study data is still stored on this device.</p>}
    </AuthFrame>
  );
}
