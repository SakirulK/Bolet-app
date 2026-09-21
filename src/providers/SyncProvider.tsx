'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import type { User } from '@supabase/supabase-js';
import { getDb } from '@/lib/db';
import { cloudRepository, getCloudClient } from '@/data/sync/cloudRepository';
import { synchronize } from '@/data/sync/syncEngine';
import { storageProtection } from '@/data/storage';

type State = { user: User | null; configured: boolean; status: string; error: string; needsConsent: boolean; pending: number; protection: string; retry: (consent?: boolean) => Promise<void>; signOut: () => Promise<void> };
const Context = createContext<State | null>(null);
export function SyncProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState('Saved on this device');
  const [error, setError] = useState('');
  const [needsConsent, setNeedsConsent] = useState(false);
  const [pending, setPending] = useState(0);
  const [protection, setProtection] = useState('Checking…');
  const running = useRef<Promise<void> | null>(null);
  const identity = useRef<User | null>(null);
  const stopped = useRef(false);
  const retry = useCallback(async (consent = false) => {
    if (running.current || stopped.current) return;
    const work = async () => {
      const db = getDb();
      const count = await db.syncQueue.count(); setPending(count);
      if (!navigator.onLine) { setStatus('Offline — changes saved on this device'); return; }
      const client = getCloudClient(), current = identity.current;
      if (!client || !current) { setStatus(count ? `${count} changes saved on this device` : 'Saved on this device'); return; }
      try {
        setStatus('Saving…'); setError('');
        const result = await synchronize(db, await cloudRepository(client, current.id), current.id, consent);
        setNeedsConsent(result.needsConsent);
        const left = await db.syncQueue.count(); setPending(left);
        setStatus(result.needsConsent ? 'Local data waiting for your approval' : left ? `${left} changes waiting to sync` : 'Synced');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String((cause as { message?: string }).message ?? 'Could not reach your account. Your local data is safe to keep using.'));
        setStatus('Sync problem — retry');
      }
    };
    running.current = work();
    try { await running.current; } finally { running.current = null; }
  }, []);
  useEffect(() => {
    stopped.current = false;
    void storageProtection(true).then(setProtection);
    let unsubscribe: (() => void) | undefined;
    try {
      const client = getCloudClient();
      if (client) {
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          identity.current = session?.user ?? null;
          setUser(identity.current); setNeedsConsent(false);
          // Leave the Auth callback before issuing another Supabase request.
          setTimeout(() => void retry(), 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        void client.auth.getSession().then(({ data, error }) => {
          if (error) setError(error.message);
          identity.current = data.session?.user ?? null; setUser(identity.current); setConfigured(true); void retry();
        });
      }
    } catch (cause) { setTimeout(() => setError(String(cause)), 0); }
    let signature = '', debounce: ReturnType<typeof setTimeout> | undefined;
    const queue = liveQuery(() => getDb().syncQueue.toArray()).subscribe(items => {
      setPending(items.length);
      const next = items.map(item => item.revision).join('|');
      if (next === signature) return;
      signature = next;
      clearTimeout(debounce);
      debounce = setTimeout(() => void retry(), 500);
    });
    const localWrite = () => { clearTimeout(debounce); debounce = setTimeout(() => void retry(), 500); };
    window.addEventListener('bolet-local-write', localWrite);
    const interval = window.setInterval(() => void retry(), 10_000);
    const online = () => void retry();
    window.addEventListener('online', online); window.addEventListener('offline', online); window.addEventListener('focus', online);
    return () => { stopped.current = true; unsubscribe?.(); queue.unsubscribe(); window.removeEventListener('bolet-local-write', localWrite); clearTimeout(debounce); clearInterval(interval); window.removeEventListener('online', online); window.removeEventListener('offline', online); window.removeEventListener('focus', online); };
  }, [retry]);
  const signOut = async () => {
    stopped.current = true;
    try {
      await running.current;
      const result = await getCloudClient()?.auth.signOut({ scope: 'local' });
      if (result?.error) throw result.error;
      identity.current = null; setUser(null); setNeedsConsent(false); setStatus('Signed out — data remains on this device');
    } finally { stopped.current = false; }
  };
  return <Context.Provider value={{ user, configured, status, error, needsConsent, pending, protection, retry, signOut }}>{children}</Context.Provider>;
}
export function useSync() { const value = useContext(Context); if (!value) throw new Error('Missing SyncProvider'); return value; }
