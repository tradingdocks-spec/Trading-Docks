import test from 'node:test';
import assert from 'node:assert/strict';
import { addScan, parseMinor, previewLine, type PosItem, type Receipt } from '../src/lib/pos/domain.ts';
import { createScanner } from '../src/lib/pos/scanner.ts';
import { renderReceipt } from '../src/lib/pos/receipt.ts';

test('decimal entry converts without floating point rounding', () => {
  assert.equal(parseMinor('12.99'),1299); assert.equal(parseMinor('0.01'),1); assert.equal(parseMinor('37.84'),3784);
  for (const bad of ['-1','1e3','NaN','Infinity','1.999','','.2']) assert.equal(parseMinor(bad),null);
});
test('tax rounds half up after the line discount, in integer units', () => {
  assert.deepEqual(previewLine(1299,1,0,850),{subtotal:1299,discount:0,tax:110,total:1409});
  assert.deepEqual(previewLine(101,1,5000,1000),{subtotal:101,discount:51,tax:5,total:55});
  assert.equal(previewLine(1299,3,10000,850).total,0);
  assert.equal(previewLine(100000000,1000,0,2500).total,125000000000);
});
test('unsafe money, quantities and rates rejected', () => {
  for (const values of [[NaN,1,0,0],[100,0,0,0],[100,1.5,0,0],[100,1,10001,0],[100,1,0,2501],[100000001,1,0,0]]) assert.throws(()=>previewLine(...values as [number,number,number,number]));
});
test('repeated barcode increments one cart line and preserves known price', () => {
  const item: PosItem={id:'one',name:'Bolt',sku:'TD-AAAA-BBBB',set_code:'M11',collector_number:'1',condition:'NM',finish:'nonfoil',language:'EN',location_id:'case',location:'Case',unit_price_minor:1299,available:2,taxable:true,positions:[]};
  const lines=addScan(addScan([],item),item); assert.equal(lines.length,1); assert.equal(lines[0].quantity,2);
  assert.throws(()=>addScan(lines,item),/No more/); assert.throws(()=>addScan([],{...item,unit_price_minor:null}),/asking price/);
});
test('keyboard wedge terminator, typing exclusion and slow human typing', () => {
  const scans: string[]=[]; const scan=createScanner(s=>scans.push(s)); let now=0;
  const type=(value:string,delay:number,editing=false)=>{for(const key of [...value,'Enter']){now+=delay;scan({key,timeStamp:now},editing);}};
  type('TD-AAAA-BBBB',10); type('TD-AAAA-BBBB',10); type('1299',10,true);type('typing',150);
  assert.deepEqual(scans,['TD-AAAA-BBBB','TD-AAAA-BBBB']);
  scan({key:'a',timeStamp:now+1,ctrlKey:true},false);scan({key:'Enter',timeStamp:now+2},false);assert.equal(scans.length,2);
});

test('500 distinct cart lines preserve quantities and reject a 501st identity', () => {
  const item: PosItem = { id: '0', name: 'Scale', sku: 'scale', set_code: null, collector_number: null, condition: null, finish: null, language: null, location_id: 'case', location: 'Case', unit_price_minor: 101, available: 3, taxable: true, positions: [] };
  let cart = Array.from({ length: 499 }, (_, i) => ({ item: { ...item, id: String(i) }, quantity: 1, discountBps: 0 }));
  cart = addScan(cart, { ...item, id: '499' });
  assert.equal(cart.length, 500);
  assert.throws(() => addScan(cart, { ...item, id: '500' }), /500 distinct/);
  assert.equal(addScan(cart, item)[0].quantity, 2);
});
test('receipt escapes product/customer-controlled text and preserves recorded totals', () => {
  const r: Receipt={version:1,number:'TD-1',site:'<script>bad()</script>',register:'Front',actorId:'owner',createdAt:'2026-09-20',currency:'USD',lines:[{itemId:'one',name:'<img src=x onerror=alert(1)>',sku:'S',quantity:1,unitPriceMinor:1299,discountMinor:0,taxMinor:110,lineTotalMinor:1409,setCode:'M11',collectorNumber:'1',condition:'NM',finish:'nonfoil',language:'EN',locationId:'case'}],subtotalMinor:1299,discountMinor:0,taxMinor:110,totalMinor:1409,cashMinor:2000,changeMinor:591};
  const html=renderReceipt(r); assert.ok(!html.includes('<img src=x')); assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('Change $5.91'));assert.ok(html.includes('Total $14.09'));
});
