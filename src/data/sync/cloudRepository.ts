import { cloudFetch } from './fetch';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CloudRepository } from './syncEngine';
import type { Envelope } from './model';
let client: SupabaseClient | undefined;
export function getCloudClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Browser clients must never receive privileged keys.
  if (key.startsWith('sb_secret_')) throw new Error('Use the public Supabase publishable key, never a secret key.');
  if (key.split('.').length === 3) {
    try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role') throw new Error('Use the public anon key, never service_role.'); }
    catch (error) { if (error instanceof Error && error.message.includes('service_role')) throw error; }
  }
  if (!client) client = createClient(url, key, { global: { fetch: cloudFetch } });
  return client;
}
export async function cloudRepository(client: SupabaseClient, userId: string): Promise<CloudRepository> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session || data.session.user.id !== userId) throw new Error('Account changed. Sign in again before syncing.');
  // Pin this run to its authenticated owner. A sign-in in another tab must never
  // redirect queued records to a different account partway through a request.
  const token = data.session.access_token;
  const transport = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, { accessToken: async () => token, global: { fetch: cloudFetch } });
  return {
    async pull() {
      const result: Envelope[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await transport.from('bolet_records').select('payload').eq('user_id', userId).order('entity_type').order('entity_id').range(offset, offset + 499);
        if (error) throw error;
        result.push(...data.map(row => row.payload as Envelope));
        if (data.length < 500) break;
      }
      return result;
    },
    async push(envelope) {
      const { data, error } = await transport.rpc('bolet_merge_record', { incoming: envelope });
      if (error) throw error;
      return data as Envelope;
    },
  };
}
