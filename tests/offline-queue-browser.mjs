// Two same-origin isolated page runtimes: real localStorage + Web Locks.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync('mobile/services/storage/offline-core.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Local queue acceptance</title>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext();const a=await context.newPage(),b=await context.newPage();
 const url=`http://127.0.0.1:${server.address().port}`;
 for(const page of [a,b]) {
  await page.goto(url);
  await page.evaluate(source=>{const exports={};new Function('exports',source)(exports);window.queue=exports.createOfflineQueue({storage:{getItem:async key=>localStorage.getItem(key),setItem:async(key,value)=>localStorage.setItem(key,value)},lock:(name,work)=>navigator.locks.request(name,work),runtimeId:crypto.randomUUID(),newId:()=>crypto.randomUUID()});},source);
 }
 await a.evaluate(()=>window.queue.enqueue('scanner',{quantity:1},{userId:'fixture',operationId:'A'}));
 const first=a.evaluate(()=>window.queue.process('A','fixture','scanner',async()=>{window.entered=true;await new Promise(resolve=>window.release=resolve);localStorage.setItem('commits',String(Number(localStorage.getItem('commits')||0)+1));},{retrySafe:true}));
 await a.waitForFunction(()=>window.entered===true);
 await b.evaluate(()=>window.queue.enqueue('location',{location:'fixture'},{userId:'fixture',operationId:'B'}));
 const second=b.evaluate(()=>window.queue.process('A','fixture','scanner',async()=>{localStorage.setItem('commits',String(Number(localStorage.getItem('commits')||0)+1));},{retrySafe:true}));
 await a.evaluate(()=>window.release());
 assert.equal((await first).status,'committed');assert.equal((await second).status,'skipped');
 assert.equal(await b.evaluate(()=>localStorage.getItem('commits')),'1');
 assert.deepEqual(await b.evaluate(async()=>(await window.queue.list()).map(r=>r.id)),['B']);
 await b.reload();
 assert.equal(await b.evaluate(()=>JSON.parse(localStorage.getItem('td-offline-operation-queue-v1')).find(r=>r.id==='B').status),'pending');
 console.log('PASS cross-tab A replay/B enqueue, overlapping worker exclusion, reload persistence (real Web Locks/localStorage).');
}finally{await browser.close();await new Promise(r=>server.close(r));}
