import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createInitialDatabaseSnapshot } from '../src/services/DatabaseService';

const loadEnv = () => {
  const envPath = resolve('.env');
  try {
    const raw = readFileSync(envPath, 'utf8');
    raw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .forEach(line => {
        const [key, ...rest] = line.split('=');
        if (!key || rest.length === 0) return;
        const value = rest.join('=').trim().replace(/^"|"$/g, '');
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      });
  } catch {
    // ignore missing .env files
  }
};

loadEnv();

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const allowSeed = process.env.ALLOW_SUPABASE_SEED === 'true' || process.env.ALLOW_SUPABASE_SEED === '1';

if (!url || !anonKey) {
  console.error('Supabase 환경 변수가 없습니다. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하세요.');
  process.exit(1);
}

if (!allowSeed) {
  console.error('시드 스크립트가 차단되었습니다. 환경 변수 ALLOW_SUPABASE_SEED=true 를 설정한 상태에서만 실행할 수 있습니다.');
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const APP_STATE_ID = 'app-state-primary';

async function main() {
  const snapshot = createInitialDatabaseSnapshot();
  const { error } = await client
    .from('app_state')
    .upsert({ id: APP_STATE_ID, data: snapshot, version: 1 });

  if (error) {
    console.error('기본 데이터 업서트 실패:', error.message ?? error);
    process.exit(1);
  }

  console.log('Supabase app_state 를 초기 데이터로 갱신했습니다.');
}

main().catch(error => {
  console.error('Supabase 시드 중 오류가 발생했습니다:', error instanceof Error ? error.message : error);
  process.exit(1);
});
