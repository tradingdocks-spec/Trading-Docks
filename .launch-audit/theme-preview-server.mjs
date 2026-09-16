// Local test transport only. Keep production CSP/HSTS intact while WebKit loads
// the production build over HTTPS. Nothing listens beyond loopback.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { spawn, spawnSync } from 'node:child_process';

const directory = path.resolve('.local-fixtures/playwright-tls');
fs.mkdirSync(directory, { recursive: true });
const key = path.join(directory, 'localhost.key');
const cert = path.join(directory, 'localhost.crt');
const gitOpenSSL = 'C:/Program Files/Git/usr/bin/openssl.exe';
const openssl = process.platform === 'win32' && fs.existsSync(gitOpenSSL) ? gitOpenSSL : 'openssl';
const generated = spawnSync(openssl, [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
  '-keyout', key, '-out', cert, '-subj', '/CN=localhost',
  '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
], { stdio: 'ignore', windowsHide: true });
if (generated.status !== 0) throw new Error('Local HTTPS tests require OpenSSL from an official installation.');

const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '4174'], {
  stdio: 'inherit', windowsHide: true,
});
const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (request, response) => {
  const upstream = http.request({
    hostname: '127.0.0.1', port: 4174, method: request.method, path: request.url,
    headers: { ...request.headers, 'x-forwarded-proto': 'https' },
  }, result => {
    response.writeHead(result.statusCode ?? 502, result.headers);
    result.pipe(response);
  });
  upstream.on('error', () => { response.writeHead(503); response.end('Local app is starting.'); });
  request.pipe(upstream);
});
server.listen(4173, '127.0.0.1');
function stop() { server.close(); next.kill(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
next.on('exit', code => { server.close(); process.exitCode = code ?? 1; });

