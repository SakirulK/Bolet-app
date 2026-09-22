"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Settings2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsView } from "@/components/settings/SettingsView";
import { Button } from "@/components/ui/Button";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { updatePassword } from "@/data/sync/auth";
import { cn } from "@/lib/cn";
import { useStore } from "@/providers/StoreProvider";
import { useSync } from "@/providers/SyncProvider";

const field = "mt-1.5 h-12 w-full rounded-xl border border-edge bg-surface-2/45 px-4 text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20";

export function ProfileView({ initialSection = "profile" }: { initialSection?: "profile" | "settings" }) {
  const { ready, prefs, setProfile } = useStore();
  const sync = useSync();
  const [name, setName] = useState<string | null>(null), [goal, setGoal] = useState<string | null>(null), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [section, setSection] = useState(initialSection);
  if (!ready) return <ScreenSkeleton />;
  async function run(action: () => Promise<void>, success: string) { if (busy) return; setBusy(true); setError(""); setMessage(""); try { await action(); setMessage(success); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this change."); } finally { setBusy(false); } }
  async function save(event: FormEvent) { event.preventDefault(); const parsed = Number.parseInt(goal ?? String(prefs.dailyGoal), 10); if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) return setError("Choose a daily goal between 1 and 1,000 cards."); await run(() => setProfile(name ?? prefs.displayName, parsed), "Profile saved."); setName(null); setGoal(null); }
  const tabClass = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
  return <div className="mx-auto max-w-2xl space-y-7">
    <PageHeader eyebrow="Profile" title={prefs.displayName && prefs.displayName !== "there" ? prefs.displayName : "Your BrainBo profile"} description="Your account, preferences, and data controls in one place." />
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-edge bg-surface-2/70 p-1" aria-label="Profile sections">
      <button type="button" aria-pressed={section === "profile"} onClick={() => setSection("profile")} className={cn(tabClass, section === "profile" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}><UserRound size={18} />Account</button>
      <button type="button" aria-pressed={section === "settings"} onClick={() => setSection("settings")} className={cn(tabClass, section === "settings" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}><Settings2 size={18} />Settings</button>
    </div>
    {section === "settings" ? <SettingsView embedded /> : <div className="space-y-6">
      <section className="panel-surface space-y-3 p-5"><h2 className="font-medium">Account</h2><dl className="space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="break-all text-right">{sync.user?.email ?? "Local use only"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Account status</dt><dd>{sync.user ? "Signed in" : "Not signed in"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Sync</dt><dd>{sync.status}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Local storage protection</dt><dd>{sync.protection}</dd></div></dl>{sync.needsConsent && <div className="border-t border-edge pt-3"><p className="mb-3 text-sm text-muted">Local study data is waiting for your approval before it is added to this account.</p><Button disabled={busy} onClick={() => void run(() => sync.retry(true), "Your BrainBo data is protected and synced.")}>Add this data to my account</Button></div>}<div className="flex flex-wrap gap-2">{sync.user ? <><Button variant="secondary" disabled={busy} onClick={() => void run(() => sync.retry(), "Sync complete.")}>Sync now</Button><Button variant="ghost" disabled={busy} onClick={() => void run(sync.signOut, "Signed out.")}>Sign out</Button></> : sync.configured ? <Link className="study-link" href="/sign-in">Sign in to sync</Link> : null}</div></section>
      <form onSubmit={save} className="panel-surface space-y-4 p-5"><h2 className="font-medium">Study profile</h2><label className="block text-sm">Display name<input className={field} value={name ?? prefs.displayName} onChange={event => setName(event.target.value)} required /></label><label className="block text-sm">Daily study goal<input className={field} type="number" min={1} max={1000} value={goal ?? String(prefs.dailyGoal)} onChange={event => setGoal(event.target.value)} required /></label><Button type="submit" disabled={busy}>Save profile</Button></form>
      {sync.user && <section className="panel-surface space-y-4 p-5"><h2 className="font-medium">Change password</h2><label className="block text-sm">New password<input className={field} type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} /></label><Button disabled={busy || password.length < 8} onClick={() => void run(async () => { await updatePassword(password); setPassword(""); }, "Password updated.")}>Update password</Button></section>}
      {message && <p role="status" className="text-sm text-accent">{message}</p>}{(error || sync.error) && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error || sync.error}</p>}
    </div>}
  </div>;
}
