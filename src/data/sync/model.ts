export const entityTypes = ['decks', 'cards', 'prefs', 'events', 'history', 'sessions', 'activity'] as const;
export type EntityType = typeof entityTypes[number];
export type Field = { stamp: string; value: unknown };
export type Envelope = { entityType: EntityType; entityId: string; fields: Record<string, Field>; versions: Record<string, Record<string, unknown>>; purged?: boolean };
export type SyncRow = { _sync?: Envelope; [key: string]: unknown };
export type QueueItem = { id: string; entityType: EntityType; entityId: string; operation: 'put' | 'purge'; updatedAt: number; attemptCount: number; revision: string; envelope: Envelope };
export type SyncMeta = { id: string; value: string };
export const remoteTransactions = new WeakSet<IDBTransaction>();
export function rowId(type: EntityType, row: SyncRow) { return String(row[type === 'activity' ? 'date' : 'id']); }
export function baseline(type: EntityType, row: SyncRow): Envelope {
  if (row._sync) return row._sync;
  const stamp = `${String(Number(row.updatedAt ?? row.createdAt ?? row.at ?? 0)).padStart(16, '0')}:legacy`;
  return { entityType: type, entityId: rowId(type, row), fields: Object.fromEntries(Object.entries(row).filter(([key, value]) => key !== '_sync' && value !== undefined).map(([key, value]) => [key, { stamp, value }])), versions: {} };
}
/** Field clocks preserve star and content edits. Content revisions retain losing text. */
export function mergeEnvelopes(a: Envelope, b: Envelope): Envelope {
  if (a.entityType !== b.entityType || a.entityId !== b.entityId) throw new Error('Mismatched sync identity');
  if (a.purged || b.purged) return { entityType: a.entityType, entityId: a.entityId, fields: {}, versions: {}, purged: true };
  const fields = { ...a.fields }, versions = structuredClone(a.versions);
  for (const [key, field] of Object.entries(b.fields)) {
    const old = fields[key];
    if (!old || field.stamp > old.stamp || (field.stamp === old.stamp && JSON.stringify(field.value) > JSON.stringify(old.value))) fields[key] = field;
  }
  for (const [key, values] of Object.entries(b.versions)) versions[key] = { ...versions[key], ...values };
  return { entityType: a.entityType, entityId: a.entityId, fields, versions };
}
export function materialize(envelope: Envelope): SyncRow {
  return envelope.purged ? { [envelope.entityType === 'activity' ? 'date' : 'id']: envelope.entityId, deletedAt: 1, purgedAt: 1, _sync: envelope }
    : { ...Object.fromEntries(Object.entries(envelope.fields).filter(([key, field]) => field.value !== null || key === 'deletedAt').map(([key, field]) => [key, field.value])), _sync: envelope };
}
export function revision(envelope: Envelope) { return JSON.stringify(envelope); }
export function queueItem(envelope: Envelope): QueueItem {
  return { id: `${envelope.entityType}:${envelope.entityId}`, entityType: envelope.entityType, entityId: envelope.entityId, operation: envelope.purged ? 'purge' : 'put', updatedAt: Date.now(), attemptCount: 0, revision: revision(envelope), envelope };
}
