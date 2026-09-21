// Actual production Label Studio React component/renderer, real local SQL;
// loopback API adapter, not hosted Next/Supabase session or PostgREST testing.
import http from 'node:http';
import {mkdirSync} from 'node:fs';
import {build} from '../.local-fixtures/pos-db/node_modules/esbuild/lib/main.js';
import {chromium,expect} from '@playwright/test';
import {createDefaultLabelTemplate} from '../src/lib/label-studio/label-templates.ts';
import {buildLabelDocument} from '../src/lib/label-studio/print-document.ts';
export async function verifyMinimalLabelBrowser({db,pg,owner,workspace,platformOwner,platformWorkspace,report,expectOwnerPass=false}){
 mkdirSync('.local-fixtures/label-repair',{recursive:true});
 const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {LabelStudioWorkspace} from './src/components/dashboard/label-studio/LabelStudioWorkspace';createRoot(document.getElementById('app')).render(<LabelStudioWorkspace/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'.local-fixtures/label-repair/bundle',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'test-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:"import React from 'react';export default function Link(p){return React.createElement('a',p)}",loader:'js',resolveDir:process.cwd()}));}}]});
 const a=pg.getPgClient('rehearsal','127.0.0.1');await a.connect();await a.query('set role authenticated');
 let actor=owner,w=workspace;const errors=[];
 const targets=async(ids=[],issue=false,query='')=>(await a.query('select label_targets($1,$2,null,$3,$4) result',[w,ids,query,issue])).rows[0].result;
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1:4329');let body={};if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;body=JSON.parse(raw);}
   const json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
   if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles.find(f=>f.path.endsWith('.js')).text);return;}
   if(url.pathname==='/bundle.css'){res.setHeader('Content-Type','text/css');res.end(bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'');return;}
   if(url.pathname==='/api/label-studio'){
    // Execute the schema-dependent GET reads, including the original failing
    // identity predicate; capabilities mirror the tested owner's app access.
    await a.query('select id,name,width,height from label_templates where workspace_id=$1 and archived_at is null',[w]);
    const inventory=await a.query('select id from inventory_items where workspace_id=$1 and user_id=$2 order by updated_at desc limit 24',[w,actor]);
    await a.query("select id from inventory_price_reviews where workspace_id=$1 and status='pending' limit 50",[w]);
    if(inventory.rowCount)await a.query('select id from inventory_label_identities where workspace_id=$1 and inventory_user_id=$2 and inventory_position_id is null and inventory_item_id=any($3)',[w,actor,inventory.rows.map(r=>r.id)]);
    json({workspaceId:w,templates:[createDefaultLabelTemplate({workspaceId:w,id:'local-default-single',name:'Singles 2 x 1',category:'single',sizePresetId:'2x1'})],items:[],priceReviews:[],capabilities:{canPrint:true,canManageTemplates:true,canReprice:true}});return;
   }
   if(url.pathname==='/api/label-studio/targets'){json(await targets(body.ids??[],req.method==='POST',url.searchParams.get('query')??''));return;}
   if(url.pathname==='/api/label-studio/print'){
    const rows=await targets(body.queue.map(r=>r.key),true);
    const queue=body.queue.map(r=>({target:rows.find(t=>t.key===r.key),copies:r.copies}));
    res.setHeader('Content-Type','text/html');res.end(await buildLabelDocument(body.template,queue,body.preview===true));return;
   }
   res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/bundle.css"></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>');
  }catch(e){errors.push({actor:actor===owner?'store':'platform-owner',path:req.url,code:e.code,message:e.message});res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
 });
 await new Promise(r=>server.listen(4329,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  await a.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:4329/dashboard/label-studio');await expect(page.getByText('Choose inventory, confirm the preview, then print.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add results',exact:true}).click();await expect(page.getByRole('button',{name:'Prepare 1 labels',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Refresh prices / identities',exact:true}).click();
  const rows=await targets([],false);assertOne(rows);
  await expect(page.getByText(rows[0].sku,{exact:false}).first()).toBeVisible();
  const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Prepare 1 labels',exact:true}).click();const popup=await popupPromise;await expect(popup.locator('.label')).toHaveCount(1);await popup.close();
  await page.screenshot({path:'.local-fixtures/label-repair/store-label-studio.png',fullPage:true});
  report.browserStore={status:'PASS',scope:'production component + local SQL adapter',targets:rows.length,preparedLabels:1,pageErrors};
  actor=platformOwner;w=platformWorkspace;await a.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
  await page.reload();
  if(expectOwnerPass){
   await expect(page.getByText('Choose inventory, confirm the preview, then print.',{exact:true})).toBeVisible();
   const ownerTargets=await targets([],false);
   if(!ownerTargets.length){
    report.browserPlatformOwner={status:'ACCESS PASS / INVENTORY SCOPE BLOCKED',targets:0,reason:'Positive production inventory has no workspace association',scope:'production component + local SQL adapter'};
   }else{
   const exact=ownerTargets.find(t=>t.positionId);
   if(!exact)throw new Error('Expected exact-position owner target');
   const issued=await targets([exact.key],true);
   if(issued.length!==1||issued[0].positionId!==exact.positionId||!issued[0].sku)throw new Error('Exact-position issuance failed');
   await expect(page.getByText('POS_FORBIDDEN',{exact:true})).toHaveCount(0);
   report.browserPlatformOwner={status:'PASS',targets:ownerTargets.length,exactPositionLabel:true,scope:'production component + local SQL adapter'};
   }
  }else{
   await expect(page.getByText('POS_FORBIDDEN',{exact:true})).toBeVisible();
   report.browserPlatformOwner={status:'FAIL',reason:'POS_FORBIDDEN from label_targets despite platform-owner app access',scope:'production component + local SQL adapter'};
  }
  await page.screenshot({path:'.local-fixtures/label-repair/platform-owner-label-studio.png',fullPage:true});
  report.browserErrors=errors;console.log('BROWSER',JSON.stringify({store:report.browserStore,platformOwner:report.browserPlatformOwner}));
 }finally{await browser.close();await new Promise(r=>server.close(r));await a.end();}
}
function assertOne(rows){if(rows.length!==1||!rows[0].sku)throw new Error('Expected one canonical store fixture target with a barcode');}
