import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import DatabaseService from '../src/services/DatabaseService';

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
  // ignore missing env
}

const TEST_IDS = [
  'dcb66276-e444-4e8e-bd14-67a615f34aec',
  'ccbb69ce-4d88-44ed-9ae4-f1670c8bca64',
];

async function run() {
  await DatabaseService.init();
  TEST_IDS.forEach(id => {
    const removed = DatabaseService.deleteTenant(id);
    if (removed) {
      console.log(`Removed test tenant ${id}`);
    }
  });
}

run().catch(error => {
  console.error('Cleanup failed', error);
  process.exit(1);
});
