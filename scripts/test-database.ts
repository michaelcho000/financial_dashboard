import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  // ignore
}
import DatabaseService from '../src/services/DatabaseService';

async function run() {
  await DatabaseService.init();
  console.log('Loaded tenants:', DatabaseService.getTenants().map(t => t.name));
  const tenantId = DatabaseService.addTenant(`테스트병원-${Date.now()}`);
  console.log('Created tenant', tenantId);
  await DatabaseService.init(); // re-init not necessary but ensure no crash
}

run().catch(error => {
  console.error('Script failed', error);
  process.exit(1);
});
