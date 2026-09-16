import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch();
const page=await browser.newPage({ignoreHTTPSErrors:true});
const results=[];
page.on('pageerror', error => { throw error; });
for(const theme of ['dark','light'])for(const width of [1440,390])for(const route of ['/','/pricing','/sign-in','/sign-up','/forgot-password','/privacy']){
 await page.setViewportSize({width,height:900});
 await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
 await page.goto('https://127.0.0.1:4173'+route,{waitUntil:'networkidle'});
 await page.getByRole('combobox',{name:'Color theme'}).first().selectOption(theme);
 await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme);
 await page.locator('main').first().waitFor({state:'visible'});
 const name=route==='/'?'home':route.slice(1);
 await page.screenshot({path:`.launch-audit/theme-${theme}-${name}-${width}.png`,fullPage:true});
 results.push(await page.evaluate(({route,theme,width})=>({route,theme,width,overflow:document.documentElement.scrollWidth>innerWidth,bg:getComputedStyle(document.body).backgroundColor,fg:getComputedStyle(document.body).color,themeAttribute:document.documentElement.dataset.theme}),{route,theme,width}));
}
fs.writeFileSync('.launch-audit/theme-review-results.json',JSON.stringify(results,null,2));console.log(results);await browser.close();

