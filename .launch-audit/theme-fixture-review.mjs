import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch();
const page=await browser.newPage({ignoreHTTPSErrors:true});
page.on('pageerror', error=>{throw error;});
await page.goto('https://127.0.0.1:4173/');
await page.emulateMedia({reducedMotion:'reduce'});
const styles=await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(link=>link.href));
await page.route('**/__theme-fixture', route => route.fulfill({contentType:'text/html',body:`<html><head>${styles.map(href=>`<link rel="stylesheet" href="${href}">`).join('')}<style>${fs.readFileSync('.launch-audit/theme-workspace.css','utf8')}</style></head><body><div id="theme-fixture"></div></body></html>`}));
await page.goto('https://127.0.0.1:4173/__theme-fixture');
await page.addScriptTag({content:fs.readFileSync('.launch-audit/theme-workspace.bundle.txt','utf8')});
await page.getByRole('heading',{name:'A clear view of your cards.'}).waitFor();
for(const mode of ['dark','light'])for(const width of [1440,390]){
 await page.setViewportSize({width,height:1000});
 await page.getByRole('combobox',{name:'Color theme'}).selectOption(mode);
 await page.waitForFunction(mode=>document.documentElement.dataset.theme===mode,mode);
 await page.waitForFunction(mode => getComputedStyle(document.querySelector('.td-button-primary')).backgroundColor === (mode === 'dark' ? 'rgb(53, 202, 250)' : 'rgb(0, 101, 217)'), mode);
 await page.screenshot({path:`.launch-audit/theme-workspace-${mode}-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Review sample item'}).first().click();
 await page.getByRole('dialog').waitFor();
 await page.waitForFunction(mode => getComputedStyle(document.querySelector('.td-button-primary')).backgroundColor === (mode === 'dark' ? 'rgb(53, 202, 250)' : 'rgb(0, 101, 217)'), mode);
 await page.screenshot({path:`.launch-audit/theme-dialog-${mode}-${width}.png`});
 await page.getByRole('button',{name:'Close sample review'}).click();
}
await browser.close();

