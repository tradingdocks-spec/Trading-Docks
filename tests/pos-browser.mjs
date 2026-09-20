// The production Register component talks to a loopback test HTTP adapter and
// the real disposable Postgres command. Supabase/Next session middleware is not
// emulated here; tenant/API boundary tests are separate.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { build } from '../.local-fixtures/pos-db/node_modules/esbuild/lib/main.js';
import { chromium, expect } from '@playwright/test';
import { renderReceipt } from '../src/lib/pos/receipt.ts';

export async function verifyBrowser({ admin, command, workspace, owner }) {
  const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {Register} from './src/components/pos/Register';createRoot(document.getElementById('app')).render(<Register data={window.bootstrap} workspaceId="${workspace}" actorId="${owner}"/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'test-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:"import React from 'react';export default function Link(props){return React.createElement('a',props)}",loader:'js',resolveDir:process.cwd()}));}}]});
  let loseResponse=false;
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://127.0.0.1:4199');
      if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
      if(url.pathname==='/api/pos'){
        let body=Object.fromEntries(url.searchParams);if(req.method==='POST'){let raw='';for await(const chunk of req) raw+=chunk;body=JSON.parse(raw);}
        const {action,...payload}=body;const result=await command(action,payload);
        if(action==='checkout'&&loseResponse){loseResponse=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Confirmation temporarily unavailable'}));return;}
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
      }
      if(url.pathname.endsWith('/receipt')){const id=url.pathname.split('/').at(-2);const r=await command('receipt',{saleId:id});res.setHeader('Content-Type','text/html');res.end(renderReceipt(r.receipt));return;}
      const bootstrap=await command('bootstrap',{});
      res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>POS local database QA</title><style>body{font-family:Arial;background:#f5f7f9;color:#16222a;--td-background-secondary:white;--td-text-primary:#16222a;--td-action-primary:#007d86;--td-on-accent:white} ${readFileSync('src/app/dashboard/pos/pos.css','utf8')}</style></head><body><main class="pos-workspace"><h1>Point of sale — local QA</h1><div id="app"></div></main><script>window.bootstrap=${JSON.stringify(bootstrap).replace(/</g,'\\u003c')}</script><script src="/bundle.js"></script></body></html>`);
    }catch(error){res.writeHead(409,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,code:error.message}));}
  });
  await new Promise(resolve=>server.listen(4199,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4199');await expect(page.getByRole('heading',{name:'Current sale'})).toBeVisible();
    await page.getByRole('button',{name:'Open register',exact:true}).click();await expect(page.getByRole('button',{name:'Close register',exact:true})).toBeVisible();
    // Global scanner needs no search focus. A keyboard-wedge emits Enter.
    await page.locator('h1').click();await page.keyboard.type('ROLLBACK',{delay:5});await page.keyboard.press('Enter');
    await expect(page.getByLabel('Quantity',{exact:true})).toHaveValue('1');
    await page.locator('h1').click();await page.keyboard.type('ROLLBACK',{delay:5});await page.keyboard.press('Enter');
    await expect(page.getByLabel('Quantity',{exact:true})).toHaveValue('2');
    await page.getByLabel('Quantity',{exact:true}).fill('3');await page.keyboard.press('Enter');await expect(page.getByLabel('Quantity',{exact:true})).toHaveValue('3');
    await page.getByLabel('Cash received').fill('10.00');
    await page.screenshot({path:'.local-fixtures/pos-db/register-desktop.png',fullPage:true});
    await page.getByRole('button',{name:'Complete cash sale',exact:true}).click();
    await expect(page.getByText('Paid $3.26 · Change $6.74')).toBeVisible();
    const receiptHref=await page.getByRole('link',{name:'Print receipt',exact:true}).getAttribute('href');
    const receiptPage=await browser.newPage();await receiptPage.goto('http://127.0.0.1:4199'+receiptHref);await expect(receiptPage.getByRole('button',{name:'Print receipt',exact:true})).toBeVisible();
    await receiptPage.pdf({path:'.local-fixtures/pos-db/receipt.pdf',width:'80mm',height:'200mm',printBackground:true});await receiptPage.close();
    console.log('PASS browser open register → scan twice → edit quantity → cash/change → receipt');
    await page.locator('h1').click();await page.keyboard.type('ROLLBACK',{delay:5});await page.keyboard.press('Enter');await expect(page.getByLabel('Quantity',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'New Sale',exact:true}).click();
    await page.locator('h1').click();await page.keyboard.type('UNKNOWN',{delay:5});await page.keyboard.press('Enter');await expect(page.getByRole('status').filter({hasText:'Barcode not found'})).toBeVisible();
    await page.getByLabel('Scan barcode or search inventory').fill('Rollback');await expect(page.getByRole('button').filter({hasText:'Rollback'})).toBeVisible();await page.getByRole('button').filter({hasText:'Rollback'}).click();
    await page.getByLabel('Cash received').fill('2.00');loseResponse=true;await page.getByRole('button',{name:'Complete cash sale',exact:true}).click();
    await expect(page.getByText('Checkout needs confirmation')).toBeVisible();await page.reload();await expect(page.getByText('Checkout needs confirmation')).toBeVisible();
    await page.getByRole('button',{name:'Check checkout status',exact:true}).click();await expect(page.getByText('Paid $1.09 · Change $0.91')).toBeVisible();
    console.log('PASS browser unknown scan, manual search and lost-response recovery after reload');
    await page.setViewportSize({width:768,height:1024});await page.screenshot({path:'.local-fixtures/pos-db/register-tablet.png',fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.getByRole('button',{name:'New Sale',exact:true}).click();
    await page.getByRole('button',{name:'Close register',exact:true}).click();await page.getByLabel('Counted cash').fill('4.35');await page.getByRole('button',{name:'Confirm drawer close',exact:true}).click();await expect(page.getByRole('button',{name:'Open register',exact:true})).toBeVisible();
    expect(errors).toEqual([]);console.log('PASS browser tablet width, register close, no page errors');
    const stock=(await admin.query("select quantity from inventory_items where id='rollback'")).rows[0].quantity;expect(stock).toBe(5);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
