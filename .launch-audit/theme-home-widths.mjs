import {chromium} from '@playwright/test';
import fs from 'node:fs';
const b=await chromium.launch();const p=await b.newPage({ignoreHTTPSErrors:true});const results=[];
for(const mode of ['dark','light'])for(const width of [1728,1440,1024,768,390]){
 await p.setViewportSize({width,height:1000});await p.emulateMedia({colorScheme:mode,reducedMotion:'reduce'});await p.goto('https://127.0.0.1:4173/',{waitUntil:'networkidle'});await p.getByRole('combobox',{name:'Color theme'}).first().selectOption(mode);await p.waitForFunction(mode=>document.documentElement.dataset.theme===mode,mode);await p.screenshot({path:'.launch-audit/theme-'+mode+'-hero-'+width+'.png'});results.push({mode,width,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
}fs.writeFileSync('.launch-audit/theme-home-widths.json',JSON.stringify(results,null,2));await b.close();
