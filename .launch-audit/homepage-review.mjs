import { chromium } from '@playwright/test';
import fs from 'node:fs';
(async () => {
 const browser = await chromium.launch();
 const page = await browser.newPage({ignoreHTTPSErrors:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 const results=[];
 for(const width of [1728,1440,1024,768,390]) {
  await page.setViewportSize({width,height:900});
  await page.goto('https://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.locator('footer img').evaluate(img => img.decode());
  await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({path:`.launch-audit/homepage-after-${width}.png`,fullPage:true});
  results.push(await page.evaluate(() => ({width:innerWidth,height:document.body.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth,ctaBottom:document.querySelector('main > section a').getBoundingClientRect().bottom})));
 }
 console.log(JSON.stringify(results));fs.writeFileSync('.launch-audit/homepage-responsive.json',JSON.stringify(results,null,2));
 await browser.close();
})();


