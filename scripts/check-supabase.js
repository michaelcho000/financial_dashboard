import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function ensureEnvLoaded() {
  const hasUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const hasKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (hasUrl && hasKey) {
    return;
  }

  try {
    const envPath = resolve('.env');
    const raw = await readFile(envPath, 'utf8');
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
    // ignore missing .env
  }
}

await ensureEnvLoaded();

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Supabase 환경 변수가 없습니다. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하세요.');
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const APP_STATE_ID = 'app-state-primary';

async function main() {
  try {
    const { data, error } = await client
      .from('app_state')
      .select('id')
      .eq('id', APP_STATE_ID)
      .maybeSingle();

    if (error) {
      console.error('Supabase 연결 실패:', error.message ?? error);
      process.exit(1);
    }

    if (!data) {
      console.warn(`경고: app_state 테이블에 ${APP_STATE_ID} 행이 없어 기본 상태를 초기화합니다.`);
      const defaultPayload = { data: { initializedAt: new Date().toISOString() }, version: 1 };
      const { error: insertError } = await client
        .from('app_state')
        .upsert({ id: APP_STATE_ID, ...defaultPayload });

      if (insertError) {
        console.error('기본 상태 upsert 실패:', insertError.message ?? insertError);
        process.exit(1);
      }
    }

    const { error: baselineTableError } = await client
      .from('month_baselines')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (baselineTableError) {
      console.error('month_baselines 테이블 확인 실패:', baselineTableError.message ?? baselineTableError);
      process.exit(1);
    }

    const { error: procedureTableError } = await client
      .from('procedure_definitions')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (procedureTableError) {
      console.error('procedure_definitions 테이블 확인 실패:', procedureTableError.message ?? procedureTableError);
      process.exit(1);
    }

    console.log('Supabase 연결 및 코스트 관련 테이블이 정상입니다.');
  } catch (error) {
    console.error('Supabase 헬스체크 중 오류 발생:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

await main();
