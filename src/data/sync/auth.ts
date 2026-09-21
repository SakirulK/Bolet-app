import { getCloudClient } from './cloudRepository';
function client() { const client = getCloudClient(); if (!client) throw new Error('Cloud sync is not configured. Local data and backups still work.'); return client; }
export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password }); if (error) throw error;
}
export async function signUp(email: string, password: string) {
  const { error } = await client().auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/settings` } }); if (error) throw error;
}
export async function resetPassword(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/settings` }); if (error) throw error;
}
export async function updatePassword(password: string) {
  const { error } = await client().auth.updateUser({ password }); if (error) throw error;
}
