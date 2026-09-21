'use client';
import { useSync } from '@/providers/SyncProvider';
export function SyncStatus() {
  const { user, status, error } = useSync();
  if (!user && !error) return null;
  return <a href="/settings" className="mb-3 block text-right text-xs text-muted underline-offset-4 hover:underline" aria-label={`Account sync: ${status}`}>{status}</a>;
}
