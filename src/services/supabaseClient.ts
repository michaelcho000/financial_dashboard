import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta?.env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta?.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

let cachedClient: SupabaseClient | null | undefined;

const canCreateClient = (): boolean => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!canCreateClient()) {
    return null;
  }

  if (typeof cachedClient === 'undefined') {
    cachedClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedClient ?? null;
};

export const hasSupabaseConfig = (): boolean => canCreateClient();
