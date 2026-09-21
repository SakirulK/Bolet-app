"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function InstallPage() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null), [ready, setReady] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    function install(event: Event) { event.preventDefault(); setPrompt(event as InstallPrompt); }
    window.addEventListener("beforeinstallprompt", install);
    let active = true;
    if ("serviceWorker" in navigator) void navigator.serviceWorker.ready.then(() => { if (active) setReady(true); });
    return () => { active = false; window.removeEventListener("beforeinstallprompt", install); };
  }, []);
  return <div className="mx-auto max-w-2xl space-y-6"><PageHeader title="Install BrainBo" description="Your decks and study tools, one tap away." />
    <section className="space-y-4"><h2 className="font-display text-2xl">On iPad or iPhone</h2><ol className="list-inside list-decimal space-y-4 text-base"><li>Open BrainBo in Safari.</li><li>Tap the Share button.</li><li>Choose Add to Home Screen.</li><li>Tap Add.</li></ol><p className="text-sm text-muted">Safari uses this menu instead of an automatic install button.</p></section>
    <section className="space-y-4 border-t border-edge pt-5"><h2 className="font-display text-2xl">Other browsers</h2><p className="text-muted">Use the install option in your browser’s address bar or menu, when available.</p>{prompt && <Button onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>Install BrainBo</Button>}</section>
    <section className="space-y-3 border-t border-edge pt-5"><h2 className="font-display text-2xl">Offline access</h2><p role="status">{ready ? "Ready for offline study on this device." : "Preparing offline access. Keep this page open while the app saves its study tools."}</p><p className="text-sm text-muted">Decks stay in this browser. Export backups from your deck pages; clearing browser data also clears local decks. The first visit and app updates need a connection.</p>{!ready && <Button variant="secondary" onClick={async () => { try { await navigator.serviceWorker.register("/sw.js"); } catch { setError("Offline setup could not finish. Check your connection and try again."); } }}>Retry offline setup</Button>}{error && <p role="alert" className="text-danger">{error}</p>}</section><a className="study-link" href="/settings">Back to Settings</a></div>;
}
