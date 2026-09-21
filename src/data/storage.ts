import { getDb } from '@/lib/db';
export async function storageProtection(request = false): Promise<string> {
  if (!navigator.storage?.persisted) return 'Unavailable in this browser';
  try {
    if (await navigator.storage.persisted()) return 'Protected';
    const db = getDb();
    if (request && navigator.storage.persist && !(await db.syncMeta.get('persistenceRequested'))) {
      await db.syncMeta.put({ id: 'persistenceRequested', value: String(Date.now()) });
      return await navigator.storage.persist() ? 'Protected' : 'Browser managed';
    }
    return 'Browser managed';
  } catch { return 'Browser managed'; }
}
