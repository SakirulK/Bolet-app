import Dexie, { type Transaction } from 'dexie';
import { baseline, entityTypes, queueItem, remoteTransactions, type EntityType, type SyncRow } from './model';

/** Capture each local write AND its outbox item in the same native IDB transaction.
 * Extending native transaction scope avoids changing every study-mode transaction.
 * Any outbox failure aborts the user write too: there is no write/queue crash gap.
 */
export function installJournal(db: Dexie) {
  const notified = new WeakSet<IDBTransaction>();
  db.use({ stack: 'dbcore', name: 'bolet-durable-outbox', create: down => ({
    ...down,
    transaction(stores, mode, options) {
      const names = mode === 'readwrite' && down.schema.tables.some(t => t.name === 'syncQueue')
        ? [...new Set([...stores, 'syncQueue'])] : stores;
      return down.transaction(names, mode, options);
    },
  }) });
  for (const type of entityTypes) {
    const table = db.table(type);
    const capture = (row: SyncRow, old: SyncRow | undefined, tx: Transaction) => {
      if (remoteTransactions.has(tx.idbtrans) || !tx.idbtrans.objectStoreNames.contains('syncQueue')) return row._sync;
      const previous = baseline(type, old ?? row);
      if (previous.purged) throw new Error('This item was permanently deleted.');
      const envelope = structuredClone(previous);
      const maximum = Math.max(0, ...Object.values(previous.fields).map(field => Number(field.stamp.split(':')[0]) || 0));
      const stamp = `${String(Math.max(Date.now(), maximum + 1)).padStart(16, '0')}:${crypto.randomUUID()}`;
      for (const [key, value] of Object.entries(row)) {
        if (key === '_sync' || (old && JSON.stringify(value) === JSON.stringify(old[key]))) continue;
        envelope.fields[key] = { stamp, value: value ?? null };
        if (['term', 'definition', 'notes', 'title', 'description', 'acceptedAnswers', 'acceptedTermAnswers'].includes(key)) {
          const prior = previous.fields[key];
          envelope.versions[key] = { ...envelope.versions[key], ...(prior ? { [prior.stamp]: prior.value } : {}), [stamp]: value ?? null };
        }
      }
      if (row.purgedAt) { envelope.purged = true; envelope.fields = {}; envelope.versions = {}; }
      tx.idbtrans.objectStore('syncQueue').put(queueItem(envelope));
      if (!notified.has(tx.idbtrans)) {
        notified.add(tx.idbtrans);
        tx.on('complete', () => {
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('bolet-local-write'));
        });
      }
      return envelope;
    };
    table.hook('creating', (_key, row, tx) => { row._sync = capture(row, undefined, tx); });
    table.hook('updating', (mods, _key, old, tx) => {
      if (remoteTransactions.has(tx.idbtrans)) return;
      const row = structuredClone(old);
      for (const [key, value] of Object.entries(mods)) Dexie.setByKeyPath(row, key, value);
      return { _sync: capture(row, old, tx) };
    });
    table.hook('deleting', (_key, _row, tx) => {
      if (!remoteTransactions.has(tx.idbtrans)) throw new Error(`Use an explicit tombstone to delete ${type as EntityType}.`);
    });
  }
}
