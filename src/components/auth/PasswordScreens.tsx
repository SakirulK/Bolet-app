"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthFrame, authField } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/Button";
import { resetPassword, updatePassword } from "@/data/sync/auth";

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await resetPassword(email.trim()); setMessage("Check your email for a password reset link."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send the reset link."); } finally { setBusy(false); } }
  return <AuthFrame title="Reset your password" description="We’ll send a secure reset link to your email."><form className="space-y-4" onSubmit={submit}><label className="block text-sm font-medium">Email<input className={authField} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>{message && <p role="status" className="text-sm text-accent">{message}</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button className="w-full" size="lg" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button></form><Link className="study-link" href="/sign-in">Return to Sign In</Link></AuthFrame>;
}

export function ResetPasswordScreen() {
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); if (password.length < 8) return setError("Use at least 8 characters for your password."); if (password !== confirm) return setError("Passwords do not match."); setBusy(true); try { await updatePassword(password); setMessage("Password updated. You can continue to BrainBo."); setPassword(""); setConfirm(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "This reset link is invalid or expired."); } finally { setBusy(false); } }
  return <AuthFrame title="Choose a new password" description="Set a new password for your BrainBo account."><form className="space-y-4" onSubmit={submit}><label className="block text-sm font-medium">New password<input className={authField} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label><label className="block text-sm font-medium">Confirm password<input className={authField} type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} /></label>{message && <p role="status" className="text-sm text-accent">{message}</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button className="w-full" size="lg" type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button></form>{message && <Link className="study-link" href="/">Continue to BrainBo</Link>}</AuthFrame>;
}
