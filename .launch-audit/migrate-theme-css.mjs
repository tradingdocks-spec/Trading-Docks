import fs from 'node:fs';
const aliases={'canvas':'background-primary','surface':'surface-default','raised':'surface-elevated','primary':'text-primary','secondary':'text-secondary','muted':'text-muted','on-accent':'on-accent','ink':'text-primary','line':'border-default','accent':'action-primary','accent-hover':'action-primary-hover','accent-text':'accent-text','success':'success','warning':'warning','danger':'danger','violet':'violet','pink':'pink'};
for(const file of fs.readdirSync('src',{recursive:true}).filter(f=>/\.(css|tsx)$/.test(f)&&f!=='app/theme.css')){
 let text=fs.readFileSync('src/'+file,'utf8'), original=text;
 text=text.replace(/var\(--color-td-([a-z-]+)\)/g,(m,key)=>aliases[key]?`var(--td-${aliases[key]})`:m);
 text=text.replace(/rgba\(\s*(\d+)[, _]+(\d+)[, _]+(\d+)[, _]+([.\d]+)\s*\)/g,(m,r,g,b,a)=>{r=+r;g=+g;b=+b;if(Math.max(r,g,b)<3)return m;let token;if(Math.min(r,g,b)>200)token='ink';else if(Math.max(r,g,b)<65)token='surface';else if(b>r&&g>r)token='accent';else return m;return `rgb(var(--td-${token}-rgb)/${a})`;});
 text=text.replace(/#([a-fA-F0-9]{8}|[a-fA-F0-9]{4})\b/g,(m,hex)=>{if(hex.length===4)hex=[...hex].map(c=>c+c).join('');const [r,g,b,a]=[0,2,4,6].map(i=>parseInt(hex.slice(i,i+2),16));if(r+g+b<5)return m;const token=Math.min(r,g,b)>190?'ink':Math.max(r,g,b)<65?'base':'accent';return `rgb(var(--td-${token}-rgb)/${(a/255).toFixed(3)})`;});
 if(file.endsWith('.css'))text=text.replace(/#([a-fA-F0-9]{6})\b/g,(m,hex)=>{const [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));if(Math.max(r,g,b)<65)return 'var(--td-background-primary)';if(Math.min(r,g,b)>200)return 'var(--td-text-primary)';if(b>r&&g>r)return 'var(--td-accent-text)';return m;});
 if(text!==original)fs.writeFileSync('src/'+file,text);
}
