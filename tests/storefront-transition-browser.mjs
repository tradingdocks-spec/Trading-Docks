import { chromium, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
const origin="http://127.0.0.1:3017";
const browser=await chromium.launch({channel:"chrome",headless:true});
const results=[], errors=[], failedRequests=[];
for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740}]){
 const context=await browser.newContext({viewport});
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 page.on("response",r=>{if(r.url().startsWith(origin)&&r.status()>=400)failedRequests.push({url:r.url(),status:r.status()})});
 for(const path of ["/shop","/s/trading-docks"]){
  const response=await page.goto(origin+path+"?q=Sultai%20Charm");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).not.toContain("unsafe-eval");
  const card=page.locator("article").filter({has:page.getByRole("heading",{name:"Sultai Charm",exact:true})});
  await expect(card).toContainText("$0.24");
  await card.getByRole("button",{name:path==="/shop"?"Add to cart":"Add",exact:true}).click();
  await page.getByRole("button",{name:/Open cart|^Cart/}).click();
  await expect(page.getByText(/subtotal/i)).toBeVisible();
  await expect(page.locator("body")).toContainText("$0.24");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  results.push({viewport,path,load:true,price:0.24,cart:true,overflow:false});
  await page.getByRole("button",{name:"Close cart",exact:true}).click();
 }
 await page.goto(origin+"/shop?q=Serra%20Angel&set=w16");
 await expect(page.locator("article")).toHaveCount(1);
 await expect(page.locator("article")).toContainText("$0.48");
 await page.getByRole("button",{name:"View Serra Angel details"}).click();
 await expect(page.getByRole("dialog")).toContainText("Magic: The Gathering");
 await expect(page.getByRole("dialog")).toContainText("$0.48");
 await page.getByRole("button",{name:"Close product details"}).click();
 await page.goto(origin+"/shop?q=Prodigy%27s%20Prototype");
 await expect(page.locator("article")).toHaveCount(1);
 await expect(page.locator("article")).toContainText("$1.60");
 await page.goto(origin+"/shop?q=Aegar%2C%20the%20Freezing%20Flame");
 await expect(page.locator("article")).toHaveCount(0);
 await page.goto(origin+"/shop?q=Shark%20Shredder&set=tmt");
 const texts=await page.locator("article").allTextContents();
 expect(texts.some(t=>t.includes("$0.00"))).toBe(false);
 await page.goto(origin+"/shop?q=Sultai%20Charm");
 await page.reload();
 await page.getByRole("button",{name:/Open cart/}).click();
 await expect(page.getByText("Current storefront price:",{exact:false})).toContainText("$0.24");
 await page.screenshot({path:".local-fixtures/contract-"+viewport.width+".png",fullPage:true});
 await page.getByRole("button",{name:"Close cart"}).click();
 // Price filtering must use the snapshot (0.24), not the asking price (1.00).
 await page.goto(origin+"/shop?q=Sultai%20Charm&maxPrice=0.25");
 await expect(page.locator("article")).toHaveCount(1);
 await page.goto(origin+"/shop?q=Sultai%20Charm&minPrice=0.25");
 await expect(page.locator("article")).toHaveCount(0);
 results.push({viewport,conflicts:3,zerosHidden:2,taxonomy:true,detail:true,refreshCartPrice:0.24,snapshotFilters:true});
 await context.close();
}
const rollback=await browser.newPage({viewport:{width:390,height:844}});
rollback.on("pageerror",e=>errors.push(e.message));
for(const path of ["/shop","/s/trading-docks"]){
 const response=await rollback.goto("http://127.0.0.1:3018"+path+"?q=Sultai%20Charm");
 expect(response.status()).toBe(200);
 await expect(rollback.locator("article")).toContainText("$0.24");
 await expect(rollback.getByText("Cart planning is temporarily unavailable.",{exact:false})).toBeVisible();
 expect(await rollback.getByRole("button",{name:/cart|checkout|request|pay/i}).count()).toBe(0);
 await rollback.goto("http://127.0.0.1:3018"+path+"?q=Aegar%2C%20the%20Freezing%20Flame");
 await expect(rollback.locator("article")).toHaveCount(0);
 results.push({path,mode:"legacy",readOnly:true,price:0.24,zeroUnavailable:true});
}
await browser.close();
expect(errors).toEqual([]);
expect(failedRequests).toEqual([]);
writeFileSync("docs/storefront-v1a-price-contract-browser.json",JSON.stringify({results,errors,failedRequests},null,2)+"\n");
console.log(JSON.stringify({passed:true,viewports:3,routes:2,errors,failedRequests}));
