import fs from 'node:fs';
for(const file of fs.readdirSync('src',{recursive:true}).filter(f=>f.endsWith('.tsx'))){let text=fs.readFileSync('src/'+file,'utf8'), original=text;
 text=text.replace(/(?:bg|shadow)-\[[^\]\n]+\]/g,match=>match.replace(/#[a-fA-F0-9]{6}(?![a-fA-F0-9])/g,hex=>{const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return Math.max(...values)<65?'var(--td-surface-default)':Math.min(...values)>190?'var(--td-text-primary)':'var(--td-action-primary)';}));
 text=text.replace(/(["`])([^"`\n]*bg-black\/(?:[6-9]\d|\[0\.[6-9]\])[^"`\n]*)\1/g,(full,quote,value)=>quote+value.replace(/text-td-(?:primary|secondary)/g,'text-white')+quote);
 text=text.replace('background: #0b1822; color: #e2e8f0;', 'background: var(--td-surface-default); color: var(--td-text-primary);');
 text=text.replace('color: "#f1fbff", WebkitTextFillColor: "#f1fbff"','color: "var(--td-text-primary)", WebkitTextFillColor: "var(--td-text-primary)"');
 if(text!==original)fs.writeFileSync('src/'+file,text);
}
