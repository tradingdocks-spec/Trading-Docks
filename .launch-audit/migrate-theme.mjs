import fs from 'node:fs';
const root='src';
const files=fs.readdirSync(root,{recursive:true}).filter(f=>/\.(tsx|css)$/.test(f));
const changed=[];
function neutral(n){return n<=200?'primary':n<=400?'secondary':n<=700?'muted':'on-accent';}
function hue(hex){let h=hex.replace('#','');if(h.length===3)h=[...h].map(x=>x+x).join('');const rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));return {rgb,max:Math.max(...rgb),min:Math.min(...rgb),avg:rgb.reduce((a,b)=>a+b)/3};}
function hexToken(hex,role){const {rgb,max,min,avg}=hue(hex);if(role==='text'&&max<85)return 'on-accent';if(max<85){return max<22?'canvas':max<42?'surface':'raised';}if(max-min<55){if(role==='bg'||['from','via','to'].includes(role))return 'raised';return avg>185?'primary':'secondary';}const [r,g,b]=rgb;if(g>r*1.08&&b<g*.85)return 'success';if(r>g*1.35&&r>b*1.1)return 'danger';if(r>g*1.1&&g>b*1.25)return 'warning';if(b>g*1.2&&r>g*1.1)return 'violet';return role==='bg'||['from','via','to'].includes(role)?'accent':'accent-text';}
for(const file of files){let source=fs.readFileSync(root+'/'+file,'utf8');const original=source;
 // Utility variants and opacity modifiers are preserved by replacing only the color stem.
 source=source.replace(/\b(text|bg|border|ring|from|via|to|divide|placeholder|fill|stroke|accent)-(slate|gray|zinc|neutral|stone)-(\d{2,3})\b/g,(_,role,family,level)=>`${role}-td-${role==='text'||role==='placeholder'?neutral(+level):role==='bg'||['from','via','to'].includes(role)?(+level>=900?'canvas':+level>=700?'surface':'raised'):'line'}`);
 source=source.replace(/\b(text|bg|border|ring|from|via|to|divide|placeholder|fill|stroke|accent)-(cyan|blue|sky|teal|emerald|green|red|rose|amber|yellow|orange|violet|purple|indigo|pink)-(\d{2,3})\b/g,(_,role,family,level)=>{const tone=['cyan','blue','sky','teal'].includes(family)?'accent':['emerald','green'].includes(family)?'success':['red','rose'].includes(family)?'danger':['amber','yellow','orange'].includes(family)?'warning':['violet','purple','indigo'].includes(family)?'violet':'pink';return `${role}-td-${tone==='accent'&&(role==='text'||role==='placeholder')?'accent-text':tone==='accent'&&role==='bg'&&+level<=200?'accent-hover':tone}`;});
 source=source.replace(/\btext-white\b/g,'text-td-primary').replace(/\b(border|ring|divide)-white\b/g,'$1-td-ink').replace(/\bbg-white(?=\/)/g,'bg-td-ink');
 source=source.replace(/\b(bg|text|border|ring|from|via|to|fill|stroke)-\[(#[a-fA-F0-9]{3,8})\]/g,(full,role,hex)=>{if(![4,7].includes(hex.length))return full;return `${role}-td-${hexToken(hex,role)}`;});
 // On solid accent fills use a dedicated foreground; translucent status panels retain normal text.
 source=source.replace(/(["`])([^"`\n]*\bbg-td-accent(?:-hover)?(?![\w/])[^"`\n]*)\1/g,(full,quote,value)=>quote+value.replace(/text-td-primary/g,'text-td-on-accent')+quote);
 // CSS declarations and CSS-in-JS blocks: map fixed colors without touching imagery, URLs or print output.
 source=source.replace(/(^\s*(?:--[\w-]+|(?:background(?:-color)?|color|border(?:-color)?|box-shadow|text-shadow|fill|stroke))\s*:\s*([^;\n]+))/gm,(full)=>{
  if(full.trim().startsWith('--td-'))return full;
  const role=/^\s*color:/.test(full)?'text':/^\s*(?:background|--home-(?:bg|panel))/.test(full)?'bg':'border';
  return full.replace(/#[a-fA-F0-9]{3,8}\b/g,hex=>[4,7].includes(hex.length)?`var(--color-td-${hexToken(hex,role)})`:hex);
 });
 // Native controls inherit the selected browser scheme.
 source=source.replace(/color-scheme:\s*dark\s*;/g,'color-scheme: var(--td-color-scheme);');
 if(source!==original){fs.writeFileSync(root+'/'+file,source);changed.push(file);}
}
fs.writeFileSync('.launch-audit/theme-migrated-files.json',JSON.stringify(changed,null,2));console.log(`Migrated ${changed.length} web UI files`);
