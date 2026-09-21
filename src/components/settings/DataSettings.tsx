'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { liveQuery } from 'dexie';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useSync } from '@/providers/SyncProvider';
import { createBackup, downloadBackup, restoreBackup, validateBackup, type Backup } from '@/data/backup';
import { getDb } from '@/lib/db';
import { restoreDeck, permanentlyDeleteDeck } from '@/data/decks';
import type { DeckRecord } from '@/types';

export function DataSettings() {
  const sync = useSync();
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [trash, setTrash] = useState<DeckRecord[]>([]), [purge, setPurge] = useState<DeckRecord | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null), [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [safety, setSafety] = useState(false);
  useEffect(() => {
    const sub = liveQuery(async () => ({ decks: (await getDb().decks.toArray()).filter(deck => deck.deletedAt && !deck.purgedAt), safety: !!await getDb().syncMeta.get('beforeRestore') })).subscribe(({ decks, safety }) => { setTrash(decks); setSafety(safety); });
    return () => sub.unsubscribe();
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : String((error as {message?: string}).message ?? error)); }
    finally { setBusy(false); }
  }
  const field = 'mt-1 w-full rounded-xl border border-edge bg-canvas p-3 text-base';
  return <>
    <section className="space-y-3 rounded-2xl border border-edge bg-surface p-5">
      <h2 className="font-medium">Storage & data protection</h2>
      <p className="text-sm">Local storage protection: <strong>{sync.protection}</strong></p>
      <p className="text-sm text-muted">Extra protection from browser eviction, not a backup. Keep an exported backup of important material.</p>
      {sync.configured && <Link href="/profile" className="study-link">Open Profile & account</Link>}
    </section>
    <section className="space-y-3 rounded-2xl border border-edge bg-surface p-5"><h2 className="font-medium">Backup & restore</h2><p className="text-sm text-muted">A full backup includes decks, Trash, cards, stars, accepted answers, progress, schedules, history, and preferences. It contains no passwords or account tokens.</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void run(async () => downloadBackup(await createBackup()))}>Export BrainBo Backup</Button><label className="inline-flex min-h-12 cursor-pointer items-center rounded-xl border border-edge px-4 text-sm font-medium">Restore BrainBo Backup<input aria-label="Restore BrainBo Backup" type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(async () => { if (file.size > 50_000_000) throw new Error('Choose a backup smaller than 50 MB.'); setBackup(validateBackup(JSON.parse(await file.text()))); setMode('merge'); }); }} /></label></div>{safety && <Button variant="ghost" onClick={() => void run(async () => { const row = await getDb().syncMeta.get('beforeRestore'); if (row) downloadBackup(JSON.parse(row.value)); })}>Export safety copy from before last replacement</Button>}</section>
    <section className="space-y-3 rounded-2xl border border-edge bg-surface p-5"><h2 className="font-medium">Trash</h2><p className="text-sm text-muted">Trash never auto-deletes. Restore a deck with its cards, stars, and progress intact.</p>{!trash.length ? <p className="py-3 text-sm text-muted">Trash is empty.</p> : <ul className="divide-y divide-edge">{trash.map(deck => <li key={deck.id} className="flex flex-wrap items-center gap-2 py-3"><span className="mr-auto min-w-0 break-words">{deck.title}</span><Button variant="secondary" disabled={busy} onClick={() => void run(() => restoreDeck(deck.id))}>Restore</Button><Button variant="danger" disabled={busy} onClick={() => setPurge(deck)}>Delete Permanently</Button></li>)}</ul>}</section>
    {message && <p role="status" className="break-words text-sm">{message}</p>}
    {purge && <Dialog title="Permanently delete this deck?" busy={busy} onClose={() => setPurge(null)}><p>Delete “{purge.title}”, its cards, and related study history permanently from this device and your account when synced? This cannot be undone. Other devices will receive the deletion when they reconnect.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setPurge(null)}>Keep in Trash</Button><Button variant="danger" disabled={busy} onClick={() => void run(async () => { await permanentlyDeleteDeck(purge.id); setPurge(null); })}>Delete Permanently</Button></div></Dialog>}
    {backup && <Dialog title="Restore BrainBo Backup" busy={busy} onClose={() => setBackup(null)}><p>{backup.data.decks.filter(row => !row.purgedAt).length} decks · {backup.data.cards.filter(row => !row.purgedAt).length} cards · {backup.data.history.filter(row => !row.purgedAt).length} sessions</p><p className="mt-2 text-sm text-muted">Exported {new Date(backup.exportedAt).toLocaleString()}</p><label className="mt-4 block text-sm">Restore method<select className={field} value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="merge">Merge with existing data</option><option value="replace">Replace local data</option></select></label><p className="mt-3 text-sm text-muted">{mode === 'replace' ? 'Replaces local records after saving a safety copy. Pending uploads are kept. This does not delete unrelated cloud data; account records may return at the next sync.' : 'Combines records by ID and field version. Newer fields win; competing text revisions remain in the backup metadata.'} {sync.user ? 'Restored data will merge into your signed-in account. Previously permanent deletions remain deleted.' : 'Restored data stays on this device until you sign in and approve adding it to an account.'}</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setBackup(null)}>Cancel</Button><Button disabled={busy} onClick={() => void run(async () => { await restoreBackup(backup, mode); setBackup(null); setMessage('Backup restored.'); await sync.retry(); })}>Confirm restore</Button></div></Dialog>}
  </>;
}
