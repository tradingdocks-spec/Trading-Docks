// Never print secret values, including on failure.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const keys = JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json', 'utf8').replace(/^\uFEFF/, ''));
const secrets = keys.filter(k => k.name === 'service_role' || k.type === 'secret').map(k => k.api_key);
const fixture = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
secrets.push(...Object.values(fixture.users).map(u => u.password));
const files = [];
function walk(dir) { for (const entry of readdirSync(dir)) { const path = join(dir, entry); if (statSync(path).isDirectory()) walk(path); else if (/\.(js|json|html|map|log)$/.test(path)) files.push(path); } }
walk('.next/static');
if (existsSync('.local-fixtures/phase7b-mobile-export')) walk('.local-fixtures/phase7b-mobile-export');
for (const name of readdirSync('.local-fixtures').filter(n => /^phase7b?-.*\.log$/.test(n))) files.push(join('.local-fixtures', name));
for (const args of [['diff', '--name-only', '--diff-filter=ACM'], ['ls-files', '--others', '--exclude-standard']]) {
  files.push(...execFileSync('git', args, { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean));
}
const findings = files.filter(file => { const text = readFileSync(file, 'utf8'); return secrets.some(value => value && text.includes(value)) || /sb_secret_[A-Za-z0-9_-]{20,}/.test(text); });
const result = { at: new Date().toISOString(), filesScanned: files.length, status: findings.length ? 'FAIL' : 'PASS', findings, scope: 'Exact staging privileged keys and fixture passwords plus secret-key pattern; changed/untracked nonignored files, static browser bundles, Expo export JS/JSON and Phase 7/7B local logs. No live Square tokens or deployed logs available.' };
writeFileSync('docs/pos-phase7b-secret-audit.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (findings.length) process.exitCode = 1;
