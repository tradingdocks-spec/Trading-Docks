import fs from 'node:fs';
for(const file of fs.readdirSync('src',{recursive:true}).filter(f=>/\.(tsx|css)$/.test(f)&&!f.replaceAll('\\','/').endsWith('app/theme.css'))){let text=fs.readFileSync('src/'+file,'utf8'),original=text;
 text=text.replace(/rgba\(0[, _]+0[, _]+0[, _]+([.\d]+)\)/g,(_,alpha)=>`rgb(var(--td-shadow-rgb)/calc(${alpha}*var(--td-shadow-strength)))`);
 text=text.replace(/#000([0-9a-f])\b/gi,(_,alpha)=>`rgb(var(--td-shadow-rgb)/calc(${(parseInt(alpha+alpha,16)/255).toFixed(3)}*var(--td-shadow-strength)))`);
 if(!file.includes('LabelStudioWorkspace'))text=text.replace(/text-\[(\d+(?:\.\d+)?)px\]/g,(full,size)=>+size<11?'text-[11px]':full);
 if(text!==original)fs.writeFileSync('src/'+file,text);
}
