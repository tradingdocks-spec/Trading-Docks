const fs=require('fs');const postcss=require('postcss');const p='src/components/landing/Homepage.module.css';const root=postcss.parse(fs.readFileSync(p,'utf8'));function set(selector,values){let rules=root.nodes.filter(n=>n.type==='rule'&&n.selector===selector);let r=rules.at(-1);if(!r){r=postcss.rule({selector});root.append(r);}for(const [prop,value] of Object.entries(values)){r.nodes.filter(n=>n.type==='decl'&&n.prop===prop).forEach(n=>n.remove());r.append({prop,value});}}
set('.hero',{'grid-template-columns':'1.06fr 1fr',gap:'48px','padding-top':'44px','padding-bottom':'52px'});
set('.hero h1',{'font-size':'clamp(48px, 5.1vw, 74px)','line-height':'1.035','letter-spacing':'-.06em',margin:'22px 0'});
set('.heroDescription',{'font-size':'17px','line-height':'1.7','max-width':'440px'});
set('.heroCopy > .eyebrow',{'border':'0','background':'none',padding:'0','border-radius':'0'});
set('.heroStatement',{'margin-top':'30px','font-size':'12px'});
set('.productStage',{padding:'0'});
set('.productStage::after',{display:'none'});
set('.productStage::before',{inset:'34px -9px 10px 15px',transform:'rotate(2deg)',opacity:'.65'});
set('.record',{padding:'20px 22px 0'});set('.recordMeta',{padding:'14px 0','font-size':'11px'});
set('.journeyDetail',{'min-height':'218px','padding-top':'16px'});set('.detailNote',{'font-size':'12px','line-height':'1.65'});set('.journeyDetail h3',{'font-size':'13px'});
set('.recordRule',{margin:'14px 0 12px'});set('.recordHistory',{padding:'14px 0'});set('.setTile',{width:'64px',height:'82px'});
set('.stageCaption',{margin:'0 4px 12px','font-size':'10px','letter-spacing':'.11em'});
set('.audienceStrip',{'background':'rgb(var(--td-accent-rgb) / .025)','padding-top':'22px','padding-bottom':'22px'});
set('.lifecycle',{gap:'20px','margin-top':'42px'});
set('.lifecycle li',{border:'0','border-radius':'0',padding:'0 10px 0 0',background:'none'});
set('.lifecycle li:nth-child(2n)',{background:'none'});
set('.lifecycle li > span',{position:'static',display:'block','margin-bottom':'12px',color:'var(--home-muted)'});
set('.lifecycleIcon',{position:'relative','z-index':'1',display:'grid','place-items':'center',width:'48px',height:'48px',margin:'0 0 16px',border:'1px solid rgb(var(--td-accent-rgb) / .24)','border-radius':'14px',background:'var(--home-panel)'});
set('.lifecycle li::before',{content:'""',position:'absolute',left:'48px',right:'-20px',top:'50px',height:'1px',background:'linear-gradient(90deg, rgb(var(--td-accent-rgb) / .45), rgb(var(--td-accent-rgb) / .12))'});
set('.lifecycle li:last-child::before',{display:'none'});
set('.lifecycle li:hover',{transform:'none'});set('.lifecycle li:hover .lifecycleIcon',{'background':'rgb(var(--td-accent-rgb) / .15)'});
set('.featureRow',{'border-top':'0','border-radius':'24px',padding:'44px',gap:'64px','margin-top':'24px',background:'linear-gradient(125deg, rgb(var(--td-brand-blue-rgb) / .1), rgb(var(--td-accent-rgb) / .025))'});
set('.featureRow:last-child',{'padding-bottom':'44px'});
set('.featureRow.reverse',{background:'linear-gradient(245deg, rgb(var(--td-accent-rgb) / .1), rgb(var(--td-brand-blue-rgb) / .025))'});
set('.featureCopy h2',{'font-size':'44px','font-weight':'550'});
set('.featureCopy > p:not(.eyebrow)',{'max-width':'330px','line-height':'1.75'});
set('.trustColumns > div',{border:'0',background:'none',padding:'0 28px 0 0','border-radius':'0'});
set('.trustColumns > div + div',{'border-left':'1px solid var(--home-line)','padding-left':'28px'});
set('.closing',{'max-width':'1240px',margin:'52px auto',padding:'64px 40px',border:'1px solid rgb(var(--td-accent-rgb) / .2)','border-radius':'28px',overflow:'hidden'});
set('.closing h2',{'font-size':'clamp(36px, 4.6vw, 64px)','font-weight':'550','letter-spacing':'-.05em'});
root.append(postcss.parse(`
@media (min-width: 1600px) { .hero { padding-top:64px; padding-bottom:64px; } }
@media (max-width: 1100px) { .hero { gap:32px; } .hero h1 { font-size:54px; } .featureRow { padding:30px; gap:32px; } .featureRow:last-child { padding-bottom:30px; } .featureCopy h2 { font-size:36px; } .lifecycle li::before { display:none; } .closing { margin-inline:40px; } }
@media (max-width: 850px) { .hero { grid-template-columns:1fr; gap:32px; padding-top:40px; } .hero h1 { font-size:64px; } .heroCopy { max-width:580px; } .featureRow,.reverse { grid-template-columns:1fr; } .reverse .featureCopy { order:0; } .featureCopy > p:not(.eyebrow) { max-width:520px; } .trustColumns { gap:20px; } .trustColumns > div + div { padding-left:20px; } }
@media (max-width: 600px) { .hero { padding-top:32px; padding-bottom:36px; gap:30px; } .hero h1 { font-size:46px; margin:18px 0; } .heroCopy > .eyebrow { padding:0; font-size:9px; } .heroDescription { font-size:15px; } .productStage { padding:0; } .record { padding:18px 16px 0; } .journeyDetail { min-height:242px; } .recordMeta { font-size:10px; gap:12px; } .lifecycle { gap:26px 18px; } .lifecycle li { padding:0; } .lifecycle li:last-child { grid-column:auto; } .featureRow { padding:26px 20px; gap:26px; margin-top:18px; border-radius:18px; } .featureRow:last-child { padding-bottom:26px; } .featureCopy h2 { font-size:32px; } .platform { padding-inline:12px; } .trustColumns > div, .trustColumns > div + div { border:0; border-top:1px solid var(--home-line); padding:22px 0 0; } .closing { margin:28px 12px; padding:44px 24px; border-radius:22px; } .closing h2 { font-size:36px; } }
`).nodes);
fs.writeFileSync(p,root.toString());
let f='src/components/landing/Hero.tsx';let s=fs.readFileSync(f,'utf8').replace('YOUR CARD, CONNECTED','EXPLORE THE CARD JOURNEY').replace(/        <div className={styles.stageRail}[\s\S]*?<\/div>\r?\n/,'');fs.writeFileSync(f,s);
f='src/components/landing/PricingSection.tsx';s=fs.readFileSync(f,'utf8').replace('import Link from "next/link";','import Link from "next/link";\nimport styles from "./Homepage.module.css";').replace('className="grid border-y border-td-ink/[0.08] sm:grid-cols-2 lg:grid-cols-4"','className={styles.planGrid}').replace('key={plan.id}\n','key={plan.id}\n').replace(/key={plan.id}\r?\n\s+className="flex flex-col border-b[^\"]*"/, 'key={plan.id}\n                  data-recommended={plan.recommended || undefined}\n                  data-free={plan.id === "free" || undefined}\n                  className={styles.planCard}');fs.writeFileSync(f,s);
