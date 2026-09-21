"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthFrame, authField } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/Button";
import { signUp } from "@/data/sync/auth";

export function SignUpScreen() {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sent, setSent] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const data = await signUp(email.trim(), password);
      if (!data.session) setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create your account."); }
    finally { setBusy(false); }
  }
  if (sent) return <AuthFrame title="Check your email" description="Check your email to confirm your BrainBo account."><Link className="study-link" href="/sign-in">Return to Sign In</Link></AuthFrame>;
  return <AuthFrame title="Create your account" description="Protect your study data and use it across your devices.">
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">Email<input className={authField} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="block text-sm font-medium">Password<input className={authField} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label className="block text-sm font-medium">Confirm password<input className={authField} type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
      <p className="text-sm text-muted">Use at least 8 characters.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" size="lg" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create Account"}</Button>
    </form>
    <p className="text-sm text-muted">Already have an account? <Link className="text-ink underline" href="/sign-in">Sign In</Link></p>
  </AuthFrame>;
}
