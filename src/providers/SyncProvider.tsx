'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import type { User } from '@supabase/supabase-js';
import { getDb } from '@/lib/db';
import { cloudRepository, getCloudClient } from '@/data/sync/cloudRepository';
import { synchronize } from '@/data/sync/syncEngine';
import { storageProtection } from '@/data/storage';

type State = {
  user: User | null;
  configured: boolean;
  authReady: boolean;
  initialSyncComplete: boolean;
  localData: boolean;
  continuedLocal: boolean;
  consentDeferred: boolean;
  migrationComplete: boolean;
  status: string;
  error: string;
  needsConsent: boolean;
  pending: number;
  protection: string;
  retry: (consent?: boolean) => Promise<void>;
  continueLocal: () => void;
  deferConsent: () => void;
  acknowledgeMigration: () => void;
  signOut: () => Promise<void>;
};
const Context = createContext<State | null>(null);
const LOCAL_MODE_KEY = 'brainbo-continue-local';
const consentKey = (userId: string) => `brainbo-sync-consent-deferred:${userId}`;
export function SyncProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [configured] = useState(() => !!getCloudClient());
  const [authReady, setAuthReady] = useState(() => !configured);
  const [initialSyncComplete, setInitialSyncComplete] = useState(() => !configured);
  const [localData, setLocalData] = useState(false);
  const [continuedLocal, setContinuedLocal] = useState(false);
  const [consentDeferred, setConsentDeferred] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
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
      if (!navigator.onLine) { setStatus('Offline — changes saved on this device'); setInitialSyncComplete(true); return; }
      const client = getCloudClient(), current = identity.current;
      if (!client || !current) { setStatus(count ? `${count} changes saved on this device` : 'Saved on this device'); setInitialSyncComplete(true); return; }
      try {
        setStatus('Saving…'); setError('');
        const result = await synchronize(db, await cloudRepository(client, current.id), current.id, consent);
        setNeedsConsent(result.needsConsent);
        const left = await db.syncQueue.count(); setPending(left);
        setStatus(result.needsConsent ? 'Local data waiting for your approval' : left ? `${left} changes waiting to sync` : 'Synced');
        if (consent && !result.needsConsent) {
          window.localStorage.removeItem(consentKey(current.id));
          setConsentDeferred(false);
          setMigrationComplete(true);
        }
        setInitialSyncComplete(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String((cause as { message?: string }).message ?? 'Could not reach your account. Your local data is safe to keep using.'));
        setStatus('Sync problem — retry');
        setInitialSyncComplete(true);
      }
    };
    running.current = work();
    try { await running.current; } finally { running.current = null; }
  }, []);
  useEffect(() => {
    stopped.current = false;
    setContinuedLocal(window.localStorage.getItem(LOCAL_MODE_KEY) === 'true');
    void storageProtection(true).then(setProtection);
    let unsubscribe: (() => void) | undefined;
    try {
      const client = getCloudClient();
      if (client) {
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          const previousId = identity.current?.id;
          identity.current = session?.user ?? null;
          setUser(identity.current); setNeedsConsent(false);
          setConsentDeferred(identity.current ? window.localStorage.getItem(consentKey(identity.current.id)) === 'true' : false);
          if (previousId !== identity.current?.id) setMigrationComplete(false);
          setInitialSyncComplete(!identity.current);
          // Leave the Auth callback before issuing another Supabase request.
          setTimeout(() => void retry(), 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        void client.auth.getSession().then(({ data, error }) => {
          if (error) setError(error.message);
          identity.current = data.session?.user ?? null; setUser(identity.current);
          setConsentDeferred(identity.current ? window.localStorage.getItem(consentKey(identity.current.id)) === 'true' : false);
          setAuthReady(true); setInitialSyncComplete(!identity.current); void retry();
        });
      }
    } catch (cause) { setTimeout(() => { setError(String(cause)); setAuthReady(true); setInitialSyncComplete(true); }, 0); }
    let signature = '', debounce: ReturnType<typeof setTimeout> | undefined;
    const queue = liveQuery(() => getDb().syncQueue.toArray()).subscribe(items => {
      setPending(items.length);
      const next = items.map(item => item.revision).join('|');
      if (next === signature) return;
      signature = next;
      clearTimeout(debounce);
      debounce = setTimeout(() => void retry(), 500);
    });
    const local = liveQuery(async () => (await Promise.all([
      getDb().decks.filter(deck => !deck.purgedAt).count(),
      getDb().cards.filter(card => !card.purgedAt).count(),
      getDb().history.count(),
      getDb().events.count(),
    ])).some(Boolean)).subscribe(setLocalData);
    const localWrite = () => { clearTimeout(debounce); debounce = setTimeout(() => void retry(), 500); };
    window.addEventListener('bolet-local-write', localWrite);
    const interval = window.setInterval(() => void retry(), 10_000);
    const online = () => void retry();
    window.addEventListener('online', online); window.addEventListener('offline', online); window.addEventListener('focus', online);
    return () => { stopped.current = true; unsubscribe?.(); queue.unsubscribe(); local.unsubscribe(); window.removeEventListener('bolet-local-write', localWrite); clearTimeout(debounce); clearInterval(interval); window.removeEventListener('online', online); window.removeEventListener('offline', online); window.removeEventListener('focus', online); };
  }, [retry]);
  const signOut = async () => {
    stopped.current = true;
    try {
      await running.current;
      if (identity.current) window.localStorage.removeItem(consentKey(identity.current.id));
      const result = await getCloudClient()?.auth.signOut({ scope: 'local' });
      if (result?.error) throw result.error;
      identity.current = null; setUser(null); setNeedsConsent(false); setStatus('Signed out — data remains on this device');
      window.localStorage.removeItem(LOCAL_MODE_KEY);
      setContinuedLocal(false); setConsentDeferred(false); setMigrationComplete(false); setInitialSyncComplete(true);
    } finally { stopped.current = false; }
  };
  return <Context.Provider value={{
    user, configured, authReady, initialSyncComplete, localData, continuedLocal,
    consentDeferred, migrationComplete, status, error, needsConsent, pending, protection, retry,
    continueLocal: () => { window.localStorage.setItem(LOCAL_MODE_KEY, 'true'); setContinuedLocal(true); },
    deferConsent: () => {
      if (identity.current) window.localStorage.setItem(consentKey(identity.current.id), 'true');
      setConsentDeferred(true);
    },
    acknowledgeMigration: () => setMigrationComplete(false),
    signOut,
  }}>{children}</Context.Provider>;
}
export function useSync() { const value = useContext(Context); if (!value) throw new Error('Missing SyncProvider'); return value; }
