import fs from 'node:fs';
for(const file of fs.readdirSync('src',{recursive:true}).filter(f=>f.endsWith('.tsx'))){let text=fs.readFileSync('src/'+file,'utf8'), original=text;
 text=text.replace(/(?:bg|shadow)-\[[^\]\n]+\]/g,match=>match.replace(/#[a-fA-F0-9]{6}\b/g,hex=>{const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return Math.max(...values)<65?'var(--td-surface-default)':Math.min(...values)>190?'var(--td-text-primary)':'var(--td-action-primary)';}));
 text=text.replace(/ring-offset-\[#[a-fA-F0-9]{6}\]/g,'ring-offset-td-canvas');
 if(text!==original)fs.writeFileSync('src/'+file,text);
}
