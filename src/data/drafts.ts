import { getDb } from '@/lib/db';

export type StudyDraftMeta = {
  mode: 'flashcards' | 'learn' | 'match' | 'test' | 'review';
  deckId: string;
  title: string;
  href: string;
};

type DraftEnvelope<T = unknown> = {
  format: 'brainbo-draft';
  version: 1;
  owner: string;
  revision: string;
  savedAt: number;
  value: T;
  study?: StudyDraftMeta;
};

export type SavedStudyDraft = StudyDraftMeta & { key: string; savedAt: number };

let owner = 'local';
let sequence = 0;
const tabId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const pending = new Map<string, Promise<unknown>>();

export function setDraftOwner(next: string | null | undefined) {
  owner = next || 'local';
}

function rowId(key: string) {
  return owner === 'local' ? `draft:${key}` : `draft:${owner}:${key}`;
}

function revision() {
  sequence += 1;
  return `${String(Date.now()).padStart(16, '0')}:${tabId}:${String(sequence).padStart(8, '0')}`;
}

function parseEnvelope<T>(raw: string): DraftEnvelope<T> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<DraftEnvelope<T>>;
    return candidate.format === 'brainbo-draft' && candidate.version === 1 && typeof candidate.savedAt === 'number' && typeof candidate.revision === 'string'
      ? candidate as DraftEnvelope<T>
      : null;
  } catch {
    return null;
  }
}

function enqueue<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const next = (pending.get(id) ?? Promise.resolve()).catch(() => undefined).then(operation);
  pending.set(id, next);
  void next.finally(() => { if (pending.get(id) === next) pending.delete(id); }).catch(() => undefined);
  return next;
}

/**
 * Drafts are local recovery state, never committed study events. Writes for a
 * key are serialized and revision checked so an older async write cannot land
 * after a newer one.
 */
export async function saveDraft(key: string, value: unknown, study?: StudyDraftMeta) {
  const id = rowId(key), nextRevision = revision(), savedAt = Date.now(), currentOwner = owner;
  return enqueue(id, async () => {
    const db = getDb();
    await db.transaction('rw', db.syncMeta, async () => {
      const existing = await db.syncMeta.get(id);
      const envelope = existing ? parseEnvelope(existing.value) : null;
      if (envelope && envelope.revision > nextRevision) return;
      const next: DraftEnvelope = { format: 'brainbo-draft', version: 1, owner: currentOwner, revision: nextRevision, savedAt, value, ...(study ? { study } : {}) };
      await db.syncMeta.put({ id, value: JSON.stringify(next) });
    });
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brainbo-draft-change'));
    return { savedAt, revision: nextRevision };
  });
}

export async function readDraft<T>(key: string): Promise<T | null> {
  const currentOwner = owner;
  const id = rowId(key);
  await pending.get(id)?.catch(() => undefined);
  const db = getDb();
  let row = await db.syncMeta.get(id);
  // Drafts written before ownership envelopes used a shared key. Migrate one
  // only when the database itself is already bound to this account.
  if (!row && currentOwner !== 'local') {
    const [legacy, databaseOwner] = await Promise.all([
      db.syncMeta.get(`draft:${key}`),
      db.syncMeta.get('owner'),
    ]);
    if (legacy && databaseOwner?.value === currentOwner) {
      try {
        const envelope = parseEnvelope<T>(legacy.value);
        if (envelope && envelope.owner !== 'local' && envelope.owner !== currentOwner) return null;
        const value = envelope ? envelope.value : JSON.parse(legacy.value) as T;
        await saveDraft(key, value);
        await db.syncMeta.delete(`draft:${key}`);
        row = await db.syncMeta.get(id);
      } catch {
        return null;
      }
    }
  }
  if (!row || currentOwner !== owner) return null;
  const envelope = parseEnvelope<T>(row.value);
  if (envelope) return envelope.owner === currentOwner ? envelope.value : null;
  // Local-only legacy drafts predate ownership envelopes. Signed-in accounts
  // never consume them, preventing one account from seeing another's draft.
  if (currentOwner !== 'local') return null;
  try { return JSON.parse(row.value) as T; } catch { return null; }
}

export async function deleteDraft(key: string) {
  const id = rowId(key);
  return enqueue(id, async () => {
    await getDb().syncMeta.delete(id);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brainbo-draft-change'));
  });
}

export async function latestStudyDraft(): Promise<SavedStudyDraft | null> {
  const prefix = owner === 'local' ? 'draft:' : `draft:${owner}:`;
  const rows = await getDb().syncMeta.filter(row => row.id.startsWith(prefix)).toArray();
  const drafts = rows.flatMap(row => {
    const envelope = parseEnvelope(row.value);
    if (!envelope?.study || envelope.owner !== owner) return [];
    return [{ ...envelope.study, key: row.id.slice(prefix.length), savedAt: envelope.savedAt }];
  });
  return drafts.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}
