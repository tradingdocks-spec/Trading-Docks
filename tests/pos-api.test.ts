import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { POS_ERRORS } from '../src/lib/pos/domain.ts';
import * as limits from '../src/lib/pos/limits.ts';

function load(path: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<Response>> = {};
  const js = ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(js,{exports,Response,URL,TextDecoder,console:{warn(){}},require:(name: string)=>{
    if (name === '@/lib/pos/limits') return limits;
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }});
  return exports;
}
const origin='http://localhost:3000';
test('POS mutation refuses cross-origin requests before executing commands',async()=>{
  let calls=0;const api=load('src/app/api/pos/route.ts',{'@/lib/pos/server':{posCommand:async()=>{calls++;return {data:{}};}}});
  const result=await api.POST(new Request(origin+'/api/pos',{method:'POST',headers:{origin:'https://attacker.test'},body:'{"action":"checkout"}'}));
  assert.equal(result.status,403);assert.equal(calls,0);
});
test('POS body limit checks actual stream length without Content-Length',async()=>{
  const api=load('src/app/api/pos/route.ts',{'@/lib/pos/server':{posCommand:async()=>{throw new Error('must not run');}}});
  const result=await api.POST(new Request(origin+'/api/pos',{method:'POST',headers:{origin},body:'x'.repeat(limits.POS_MAX_REQUEST_BYTES+1)}));assert.equal(result.status,413);
});
test('500-line HTTP request exceeds the old 32 KiB ceiling and reaches authoritative SQL intact',async()=>{
  let received: unknown;
  const api=load('src/app/api/pos/route.ts',{'@/lib/pos/server':{posCommand:async(_action: string,body: unknown)=>{received=body;return {data:{}};}}});
  const lines=Array.from({length:500},(_,i)=>({ownerId:'11111111-1111-4111-8111-111111111111',itemId:`500-line-acceptance-${i}`,quantity:1,discountBps:1250}));
  const payload=JSON.stringify({action:'checkout',key:'same-key',lines});
  assert.ok(Buffer.byteLength(payload)>32768);
  assert.equal((await api.POST(new Request(origin+'/api/pos',{method:'POST',headers:{origin},body:payload}))).status,200);
  assert.deepEqual(JSON.parse(JSON.stringify(received)),{key:'same-key',lines});
});
test('POS API rejects malformed JSON and read-side mutation attempts',async()=>{
  const api=load('src/app/api/pos/route.ts',{'@/lib/pos/server':{posCommand:async()=>{throw new Error('must not run');}}});
  assert.equal((await api.POST(new Request(origin+'/api/pos',{method:'POST',headers:{origin},body:'{'}))).status,400);
  assert.equal((await api.GET(new Request(origin+'/api/pos?action=checkout'))).status,400);
});
test('POS API forwards exact intent and disables response caching',async()=>{
  let received: unknown;const api=load('src/app/api/pos/route.ts',{'@/lib/pos/server':{posCommand:async(action: string,body: unknown)=>{received={action,body};return {data:{saleId:'one'}};}}});
  const result=await api.POST(new Request(origin+'/api/pos',{method:'POST',headers:{origin},body:JSON.stringify({action:'checkout',key:'same-key',lines:[]})}));
  assert.deepEqual(JSON.parse(JSON.stringify(received)),{action:'checkout',body:{key:'same-key',lines:[]}});assert.equal(result.headers.get('cache-control'),'no-store');
});
test('POS server uses trusted workspace and maps SQL failure to safe domain error',async()=>{
  let args: unknown;const server=load('src/lib/pos/server.ts',{'./domain':{POS_ERRORS},'@/lib/platform/server-access':{requireApiCapability:async()=>({ok:true,access:{workspaceId:'trusted'},supabase:{rpc:async(_name: string,input: unknown)=>{args=input;return {error:{message:'POS_STOCK_UNAVAILABLE: private SQL detail',code:'P0001'}};}}})}});
  const result=await server.posCommand('checkout',{workspaceId:'forged'}) as unknown as {response: Response};
  assert.equal((args as {p_workspace_id: string}).p_workspace_id,'trusted');assert.equal(result.response.status,409);assert.equal((await result.response.json()).error,POS_ERRORS.POS_STOCK_UNAVAILABLE);
});
test('POS server honors authentication rejection without touching database',async()=>{
  const server=load('src/lib/pos/server.ts',{'./domain':{POS_ERRORS},'@/lib/platform/server-access':{requireApiCapability:async()=>({ok:false,response:Response.json({error:'Sign in'},{status:401})})}});
  const result=await server.posCommand('checkout',{}) as unknown as {response: Response};assert.equal(result.response.status,401);
});
