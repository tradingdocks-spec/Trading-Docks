import https from 'node:https';
import { readFileSync } from 'node:fs';
import next from 'next';
// Direct HTTPS avoids a loopback proxy changing Next's canonical request port.
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://ukrcbmujzdyclrkghbvo.supabase.co') throw Error('Staging required');
const app = next({ dev: false, hostname: '127.0.0.1', port: 4173 });
await app.prepare();
const handler = app.getRequestHandler();
const server = https.createServer({ key: readFileSync('.local-fixtures/playwright-tls/localhost.key'), cert: readFileSync('.local-fixtures/playwright-tls/localhost.crt') }, (req, res) => {
  if (req.url === '/__phase7-health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ project: 'ukrcbmujzdyclrkghbvo', buildId: readFileSync('.next/BUILD_ID', 'utf8').trim() }));
    return;
  }
  req.headers['x-forwarded-proto'] = 'https';
  handler(req, res);
});
server.listen(4173, '127.0.0.1', () => console.log('Staging acceptance HTTPS ready on loopback 4173'));
const stop = () => server.close(() => app.close());
process.on('SIGINT', stop); process.on('SIGTERM', stop);
