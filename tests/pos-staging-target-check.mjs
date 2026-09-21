import https from 'node:https';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export default async function checkStagingServer() {
  const value = await new Promise((resolve, reject) => {
    https.get('https://localhost:4173/__phase7-health', { rejectUnauthorized: false }, response => {
      let raw = ''; response.on('data', chunk => { raw += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(Error('Verified loopback staging server required')); } });
    }).on('error', reject);
  });
  assert.equal(value.project, 'ukrcbmujzdyclrkghbvo');
  assert.equal(value.buildId, readFileSync('.next/BUILD_ID', 'utf8').trim());
}
