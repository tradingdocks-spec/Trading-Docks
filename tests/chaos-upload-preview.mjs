// Isolated UI rehearsal: simulated storage/recognition, no .env or production clients.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
const root = process.cwd(), dir = mkdtempSync(join(tmpdir(), 'td-chaos-upload-'));
const put = (name, text) => { mkdirSync(dirname(join(dir, name)), {recursive:true}); writeFileSync(join(dir,name),text); };
symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'junction');
put('package.json',JSON.stringify({private:true}));
put('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',jsx:'react-jsx',moduleResolution:'bundler',module:'esnext',paths:{'@/*':['./src/*']}}}));
put('next.config.mjs','export default {devIndicators:false};');
const files = ['postcss.config.mjs','src/app/globals.css','src/app/theme.css','src/components/dashboard/inventory/ChaosSortWorkspace.tsx','src/components/dashboard/inventory/UploadCardIntake.tsx','src/components/dashboard/inventory/LiveScanStation.tsx','src/components/dashboard/inventory/ScannerBridgeControls.tsx','src/components/dashboard/common/PageHeader.tsx','src/components/dashboard/common/WorkspaceFrame.tsx','src/components/dashboard/styles.module.css','src/components/design-system/td-primitives.tsx','src/lib/utils.ts','src/lib/csv-simple.ts','src/lib/chaos-sort/domain.ts','src/lib/chaos-sort/batch-queue.ts','src/lib/chaos-sort/live-intake.ts','src/lib/chaos-sort/scan-album-client.ts','src/lib/chaos-sort/scanner-provider.ts','src/lib/chaos-sort/local-scanner-provider.ts'];
for (const file of files) put(file,readFileSync(file,'utf8'));
put('src/app/layout.tsx',`import './globals.css'; export default function Layout({children}){return <html data-theme="dark"><body>{children}</body></html>}`);
put('src/app/page.tsx',`import {ChaosSortWorkspace} from '@/components/dashboard/inventory/ChaosSortWorkspace'; export default function Page(){return <ChaosSortWorkspace scannerBridgeEnabled={false} scanAlbumsEnabled/>}`);
put('src/lib/supabase/client.ts',`export function createClient(){return {auth:{getUser:async()=>({data:{user:{id:'fixture'}}})},from(name){const q={select(){return q},order(){return q},limit:async()=>({data:name==='inventory_locations'?[{id:'fixture-box',name:'Fixture Box',location_type:'box'}]:[]})};return q}}}`);
put('src/app/api/chaos-sort/scans/route.ts',`import {recoveredScanItem} from '@/lib/chaos-sort/scan-album-client';
const id='11111111-1111-4111-8111-111111111111';
function state(){return globalThis.__uploadFixture??={album:{id,workspace_id:'fixture',batch_code:'CS-000001',destination_id:'fixture-box',destination_label:'Fixture Box',state:'ACTIVE',intake_mode:'upload',settings:{title:'UI fixture'},settings_revision:0},captures:[],uploads:0,commits:0};}
export async function DELETE(){globalThis.__uploadFixture=undefined;return Response.json({ok:true});}
export async function GET(request){const url=new URL(request.url);if(url.searchParams.has('history'))return Response.json([]);if(url.searchParams.has('captureId')){const capture=state().captures.find(c=>c.capture_id===url.searchParams.get('captureId'));return new Response(capture?.bytes??null,{headers:{'Content-Type':'image/png'}});}return Response.json(state());}
export async function POST(request){const s=state();if(request.headers.get('content-type')?.includes('multipart/form-data')){const form=await request.formData(),captureId=String(form.get('captureId')),file=form.get('image');if(form.has('backImage'))throw Error('Front-only fixture expects no back');const item={...recoveredScanItem(id,captureId),intakeSource:'upload',sourceFileName:file.name};s.captures.push({capture_id:captureId,revision:0,source_kind:'image',status:'RECEIVED',item,bytes:new Uint8Array(await file.arrayBuffer())});s.uploads++;return Response.json({sourceImageUrl:'/api/chaos-sort/scans?captureId='+captureId,sides:1});}const {action,payload}=await request.json();if(action==='fixture-seed'){s.captures=payload.captures;return Response.json({ok:true});}if(action==='mode'){s.album.intake_mode=payload.intakeMode;return Response.json({intake_mode:payload.intakeMode});}if(action==='review'){const c=s.captures.find(c=>c.capture_id===payload.captureId);if(c.status!=='REMOVED'){c.item=payload.item;c.revision++;if(c.item.humanState==='removed')c.status='REMOVED';}return Response.json({revision:c.revision});}if(action==='settings'){s.album.settings=payload.settings;return Response.json({revision:++s.album.settings_revision});}if(action==='commit'){s.commits++;return Response.json({error:'Commit disabled in UI fixture'},{status:403});}return Response.json({});}
`);
put('src/app/api/purchasing/card-photo-scan/route.ts',`export async function POST(request){const form=await request.formData();return Response.json({identification:{name:'Fixture '+form.get('image').name,confidence:0.5},candidates:[],requiresConfirmation:true});}`);
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','4321'],{cwd:dir,stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
console.log('Simulated UI fixture: '+dir);
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill());
child.on('exit',code=>process.exit(code??0));
