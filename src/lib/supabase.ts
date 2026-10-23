import { createClient } from '@supabase/supabase-js';

const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  proc?.env?.VITE_SUPABASE_URL ||
  'https://zdygiubhmxuonzqchehp.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  proc?.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_zzlKCAxfsUya4_UePohgnA_QvR8Cz6Q';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables! Check .env file.');
}

// Tab-scoped storage provider: uses window.sessionStorage in browser environments.
// This preserves the authenticated session across page refreshes within the same tab,
// while ensuring the session is automatically discarded when the tab is closed.
const tabScopedStorage =
  typeof window !== 'undefined' && window.sessionStorage
    ? window.sessionStorage
    : undefined;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      storage: tabScopedStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
