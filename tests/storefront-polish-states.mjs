import {chromium,expect} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
const origin=process.env.STOREFRONT_TEST_ORIGIN??'http://127.0.0.1:3020';
const output='.local-fixtures/storefront-polish';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const results=[];
try {
 for(const theme of ['dark','light']){
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});
  await context.addInitScript(t=>localStorage.setItem('trading-docks-theme',t),theme);
  const page=await context.newPage();
  let finish;
  const wait=new Promise(resolve=>{finish=resolve;});
  await page.route('**/api/storefront/catalog?**',async route=>{await wait;await route.continue();});
  await page.goto(origin+'/shop?q=Sultai%20Charm');
  const add=page.locator('#catalog article').getByRole('button',{name:'Add to cart',exact:true});const before=await add.boundingBox();await add.click();
  await expect(page.getByRole('button',{name:'Checking…',exact:true})).toHaveAttribute('aria-busy','true');
  const during=await page.getByRole('button',{name:'Checking…',exact:true}).boundingBox();expect(Math.abs(during.width-before.width)).toBeLessThan(1);expect(Math.abs(during.height-before.height)).toBeLessThan(1);
  await page.waitForTimeout(1700);await expect(page.getByRole('button',{name:'Checking…',exact:true})).toBeVisible();finish();
  await expect(page.getByRole('button',{name:'Added',exact:true})).toBeVisible();
  await page.unroute('**/api/storefront/catalog?**');
  // Deliberate browser-only response failure; never sent to the server.
  await page.route('**/api/storefront/catalog?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Acceptance simulated failure'})}));
  await page.reload();await page.getByRole('button',{name:/Open cart/}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Your saved cart is preserved');await expect(page.getByRole('dialog')).toContainText('1 card');
  await page.screenshot({path:`${output}/${theme}-error.png`});
  await page.keyboard.press('Escape');await page.unroute('**/api/storefront/catalog?**');await page.reload();await page.getByRole('button',{name:/Open cart/}).click();await expect(page.getByRole('dialog').getByText('Current storefront price:',{exact:false})).toContainText('$0.24');
  await context.close();
  const images=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});await images.addInitScript(t=>localStorage.setItem('trading-docks-theme',t),theme);const imagePage=await images.newPage();
  let show;
  const imageWait=new Promise(resolve=>{show=resolve;});
  await imagePage.route('https://api.scryfall.com/**',async route=>{await imageWait;await route.fulfill({status:200,contentType:'image/png',body:'deliberately invalid browser-only image'});});
  await imagePage.route('https://cards.scryfall.io/**',route=>route.fulfill({status:200,contentType:'image/png',body:'deliberately invalid browser-only image'}));
  await imagePage.goto(origin+'/shop?q=Sultai%20Charm',{waitUntil:'domcontentloaded'});
  await expect(imagePage.locator('[class*="imageSkeleton"]')).toBeVisible();show();
  await expect(imagePage.getByText('Artwork unavailable')).toBeVisible();
  await expect(imagePage.locator('#catalog article')).toContainText('$0.24');
  await imagePage.getByRole('button',{name:'View Sultai Charm details'}).click();await expect(imagePage.getByRole('dialog')).toContainText('Sultai Charm');
  await images.close();results.push({theme,loading:true,stableButton:true,success:true,cartErrorPreservesState:true,recovery:true,imageSkeleton:true,imageFallback:true});
 }
 writeFileSync(`${output}/fault-states.json`,JSON.stringify({results,expectedFailures:'Browser-intercepted 503 and invalid image responses only'},null,2));console.log(JSON.stringify({passed:results.length,results}));
}finally{await browser.close();}
