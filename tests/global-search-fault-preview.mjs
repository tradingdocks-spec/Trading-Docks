// Local-only UI fault rehearsal. Copies the production component unchanged
// except its three data imports. No application environment files or credentials.
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
const root=process.cwd();
const dir=mkdtempSync(join(tmpdir(),'td-search-fault-'));
mkdirSync(join(dir,'app'));
symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'junction');
writeFileSync(join(dir,'package.json'),JSON.stringify({private:true,scripts:{dev:'next dev'},dependencies:{next:'16.3.4',react:'19.2.4','react-dom':'19.2.4'}}));
writeFileSync(join(dir,'next.config.mjs'),'export default { devIndicators: false };');
writeFileSync(join(dir,'app/layout.tsx'),`export default function Layout({children}) { return <html><body>{children}</body></html> }`);
writeFileSync(join(dir,'app/page.tsx'),`import {GlobalSearch} from './GlobalSearch'; export default function Page() { return <><h1>Local search failure rehearsal</h1><GlobalSearch /></> }`);
let component=readFileSync('src/components/dashboard/search/GlobalSearch.tsx','utf8');
for(const name of ['@/lib/deck-vault/persistence','@/lib/collector-workspace-client-data','@/lib/collector-workspace']) component=component.replaceAll(name,'./fixtures');
writeFileSync(join(dir,'app/GlobalSearch.tsx'),component);
writeFileSync(join(dir,'app/fixtures.ts'),`
export type WebInventoryProvenance = never;
export async function searchWebInventory() { throw new Error('INTENTIONAL_LOCAL_INVENTORY_FAILURE'); }
export async function loadDeckVault() { return [{id:'local-deck',name:'Healthy deck fixture',cards:[{id:'card-1',name:'Dreadwing Scavenger',quantity:2,board:'main',setCode:'FDN',collectorNumber:'118',price:0.25}]}]; }
export function buildCollectionCards() { throw new Error('Inventory must fail before mapping'); }
`);
console.log('Local-only component fixture: http://127.0.0.1:4318');
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','4318'],{cwd:dir,stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill());
child.on('exit',code=>process.exit(code??0));
