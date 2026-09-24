// Run daily in a trusted server job before enabling V2 in any hosted environment.
// Default is dry-run. Never ship its environment credentials with Scanner Bridge.
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

export async function expireScanAlbums(client, { execute = false, now = new Date() } = {}) {
  const { data: albums, error } = await client.from('chaos_scan_albums').select('id').eq('state', 'CLOSED').is('scans_purged_at', null).lte('expires_at', now.toISOString()).limit(100);
  if (error) throw error;
  let objects = 0;
  for (const album of albums ?? []) {
    const { data: captures, error: readError } = await client.from('chaos_scan_captures').select('capture_id,object_path').eq('album_id', album.id).neq('status', 'EXPIRED');
    if (readError) throw readError;
    for (const capture of captures ?? []) {
      // Exact generated path only; never recursive prefix deletion. Closed state
      // cannot revert, so unresolved/active review images are never selected.
      if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(capture.object_path) || capture.object_path.split('/')[1] !== album.id) throw new Error('Invalid retention object identity');
      if (execute) {
        const removed = await client.storage.from('chaos-scans').remove([capture.object_path]);
        if (removed.error) throw removed.error;
        const marked = await client.from('chaos_scan_captures').update({ status: 'EXPIRED' }).eq('capture_id', capture.capture_id).eq('album_id', album.id);
        if (marked.error) throw marked.error; // Next run safely retries an already absent object.
      }
      objects++;
    }
    if (execute) {
      const marked = await client.from('chaos_scan_albums').update({ scans_purged_at: now.toISOString() }).eq('id', album.id).eq('state', 'CLOSED');
      if (marked.error) throw marked.error;
    }
  }
  return { execute, albums: albums?.length ?? 0, objects };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.CHAOS_RETENTION_SUPABASE_URL, key = process.env.CHAOS_RETENTION_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Explicit retention target credentials required');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(JSON.stringify(await expireScanAlbums(client, { execute: process.argv.includes('--execute') })));
}
