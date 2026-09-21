// Build and serve on loopback with explicit staging credentials. No dotenv edits.
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
const keys = JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json', 'utf8').replace(/^\uFEFF/, ''));
const tls = resolve('.local-fixtures/playwright-tls');
mkdirSync(tls, { recursive: true });
const openssl = process.platform === 'win32' && existsSync('C:/Program Files/Git/usr/bin/openssl.exe') ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
const certificate = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-keyout', resolve(tls, 'localhost.key'), '-out', resolve(tls, 'localhost.crt'), '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore', windowsHide: true });
if (certificate.status !== 0) throw Error('Local staging HTTPS requires OpenSSL');
const env = { ...process.env, NODE_EXTRA_CA_CERTS: resolve(tls, 'localhost.crt'), APP_ENV: 'staging', VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'https://ukrcbmujzdyclrkghbvo.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: keys.find(k => k.type === 'publishable').api_key, SUPABASE_SERVICE_ROLE_KEY: keys.find(k => k.name === 'service_role').api_key };
function run(args) { return new Promise((resolve, reject) => { const p = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true }); p.on('exit', code => code === 0 ? resolve() : reject(Error(`Process exit ${code}`))); }); }
if (!process.argv.includes('--skip-build')) await run(['node_modules/next/dist/bin/next', 'build']);
await run(['tests/pos-staging-https.mjs']);
