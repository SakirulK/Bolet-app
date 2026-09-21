"use client";

import { useState, type FormEvent } from "react";
import { AuthFrame, authField } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/providers/StoreProvider";
import { useSync } from "@/providers/SyncProvider";

export function LibraryRecovery() {
  return <AuthFrame title="Getting your BrainBo library…" description="Restoring your account data to this device so it will be available offline."><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full w-1/2 animate-pulse rounded-full bg-accent" /></div></AuthFrame>;
}

export function RecoveryProblem({ onContinue }: { onContinue: () => void }) {
  const sync = useSync();
  const [busy, setBusy] = useState(false);
  return <AuthFrame title="We couldn’t reach your library" description="Your local data is safe. Retry when your connection is available, or continue with what is stored on this device.">
    {sync.error && <p role="alert" className="rounded-2xl border border-edge bg-surface p-4 text-sm text-danger">{sync.error}</p>}
    <div className="grid gap-3"><Button disabled={busy} onClick={() => { setBusy(true); void sync.retry().finally(() => setBusy(false)); }}>{busy ? "Retrying…" : "Retry"}</Button><Button variant="secondary" onClick={onContinue}>Continue on this device</Button></div>
  </AuthFrame>;
}

export function LocalDataConsent() {
  const sync = useSync();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <AuthFrame title="BrainBo found study data on this device" description="Add these decks, cards, stars, progress, preferences, and study history to your account?">
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="grid gap-3"><Button disabled={busy} onClick={() => { setBusy(true); setError(""); void sync.retry(true).catch(cause => setError(cause instanceof Error ? cause.message : "Could not sync your data.")).finally(() => setBusy(false)); }}>{busy ? "Adding your data…" : "Add this data to my account"}</Button><Button variant="secondary" disabled={busy} onClick={sync.deferConsent}>Not now</Button></div>
    <p className="text-sm text-muted">Nothing on this device will be discarded.</p>
  </AuthFrame>;
}

export function MigrationComplete() {
  const sync = useSync();
  return <AuthFrame title="Your BrainBo data is protected and synced." description="Your existing study data is now connected to your account and remains available offline."><Button className="w-full" size="lg" onClick={sync.acknowledgeMigration}>Continue</Button></AuthFrame>;
}

export function ProfileSetup() {
  const { prefs, setProfile } = useStore();
  const [name, setName] = useState(prefs.displayName === "there" ? "" : prefs.displayName);
  const [goal, setGoal] = useState(String(prefs.dailyGoal || 20));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number.parseInt(goal, 10);
    if (!name.trim()) return setError("Enter the name you’d like BrainBo to use.");
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) return setError("Choose a daily goal between 1 and 1,000 cards.");
    setBusy(true); setError("");
    try { await setProfile(name, parsed); }
    catch { setError("Could not save your profile. Please try again."); }
    finally { setBusy(false); }
  }
  return <AuthFrame title="Welcome to BrainBo" description="Set up a simple study profile. You can change this later."><form className="space-y-4" onSubmit={submit}><label className="block text-sm font-medium">What should we call you?<input autoFocus className={authField} value={name} onChange={event => setName(event.target.value)} /></label><label className="block text-sm font-medium">Daily goal<input className={authField} type="number" inputMode="numeric" min={1} max={1000} value={goal} onChange={event => setGoal(event.target.value)} /><span className="mt-1 block text-xs text-muted">Cards per day</span></label>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button className="w-full" size="lg" type="submit" disabled={busy}>{busy ? "Saving…" : "Continue"}</Button></form></AuthFrame>;
}
