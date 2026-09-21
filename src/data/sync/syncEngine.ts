import type { RecallDB } from '@/lib/db';
import type { Envelope } from './model';
import { applyRemote, bindAccount } from './localRepository';
export interface CloudRepository {
  pull(): Promise<Envelope[]>;
  push(envelope: Envelope): Promise<Envelope>;
}
/** Acknowledgements remove only the exact sent revision: edits during fetch stay queued. */
export async function synchronize(db: RecallDB, cloud: CloudRepository, userId: string, consent = false) {
  if (!await bindAccount(db, userId, consent)) return { needsConsent: true };
  await applyRemote(db, await cloud.pull());
  const pending = await db.syncQueue.toArray();
  for (const item of pending) {
    try {
      const acknowledged = await cloud.push(item.envelope);
      await db.transaction('rw', db.syncQueue, async () => {
        const current = await db.syncQueue.get(item.id);
        if (current?.revision === item.revision) await db.syncQueue.delete(item.id);
      });
      await applyRemote(db, [acknowledged]);
    } catch (error) {
      await db.transaction('rw', db.syncQueue, async () => {
        const current = await db.syncQueue.get(item.id);
        if (current) await db.syncQueue.update(item.id, { attemptCount: current.attemptCount + 1 });
      });
      throw error;
    }
  }
  await applyRemote(db, await cloud.pull());
  return { needsConsent: false };
}
