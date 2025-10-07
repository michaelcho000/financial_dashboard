import { createClient, SupabaseClient } from '@supabase/supabase-js';

type EnvLike = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

const readEnv = (): EnvLike => {
  const env: EnvLike = {};

  try {
    if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: EnvLike })?.env) {
      return (import.meta as unknown as { env: EnvLike }).env;
    }
  } catch {
    // ignore - access may throw in non-module environments
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env as unknown as EnvLike;
  }

  return env;
};

let cachedClient: SupabaseClient | null = null;
let cachedConfigSignature: string | null = null;

const resolveConfig = () => {
  const env = readEnv();
  const url = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? '';
  const anonKey = env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY ?? '';
  return { url, anonKey };
};

const buildSignature = (url: string, anonKey: string) => `${url}::${anonKey}`;

export const hasSupabaseConfig = (): boolean => {
  const { url, anonKey } = resolveConfig();
  return Boolean(url && anonKey);
};

export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, anonKey } = resolveConfig();
  if (!url || !anonKey) {
    return null;
  }

  const signature = buildSignature(url, anonKey);
  if (!cachedClient || cachedConfigSignature !== signature) {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigSignature = signature;
  }

  return cachedClient;
};
