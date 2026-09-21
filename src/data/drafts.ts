import { getDb } from '@/lib/db';
/** Unsubmitted answers are local recovery drafts, not graded study events. */
export async function saveDraft(key: string, value: unknown) {
  await getDb().syncMeta.put({ id: `draft:${key}`, value: JSON.stringify(value) });
}
export async function readDraft<T>(key: string): Promise<T | null> {
  const row = await getDb().syncMeta.get(`draft:${key}`);
  return row ? JSON.parse(row.value) as T : null;
}
