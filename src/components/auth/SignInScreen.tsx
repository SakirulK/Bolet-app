"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthFrame, authField } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/Button";
import { signIn } from "@/data/sync/auth";

export function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try { await signIn(email.trim(), password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in. Please try again."); }
    finally { setBusy(false); }
  }
  return <AuthFrame title="Welcome back" description="Sign in to open your BrainBo library on this device.">
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">Email<input className={authField} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="block text-sm font-medium">Password<input className={authField} type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" size="lg" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</Button>
    </form>
    <div className="flex flex-wrap justify-between gap-3 text-sm"><Link className="underline" href="/forgot-password">Forgot Password?</Link><Link className="underline" href="/sign-up">Create Account</Link></div>
  </AuthFrame>;
}
