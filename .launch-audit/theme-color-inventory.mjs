import fs from 'node:fs';
const files=fs.readdirSync('src',{recursive:true}).filter(p=>/\.(tsx|css)$/.test(p));
const counts=new Map();let instances=0;
for(const file of files){const text=fs.readFileSync('src/'+file,'utf8');for(const m of text.matchAll(/(?:bg|text|border|ring|from|via|to|shadow|fill|stroke|divide|placeholder|accent)-(?:\[#[a-fA-F0-9]{3,8}\]|(?:slate|gray|zinc|neutral|stone|blue|cyan|emerald|red|rose|amber|yellow|green|teal|violet|purple|indigo|sky|pink|orange)-\d{2,3}|white|black)/g)){counts.set(m[0],(counts.get(m[0])??0)+1);instances++;}}
fs.writeFileSync('.launch-audit/theme-color-inventory.json',JSON.stringify({files:files.length,instances,colors:[...counts].sort((a,b)=>b[1]-a[1])},null,2));console.log(JSON.stringify({files:files.length,instances,unique:counts.size,top:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,50)},null,2));
