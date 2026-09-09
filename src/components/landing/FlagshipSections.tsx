"use client";

import { useState } from "react";
import { ArrowRight, Check, MapPin, ScanLine } from "lucide-react";
import Link from "next/link";
import styles from "./FlagshipSections.module.css";

const trace = ["Scanned", "Printing verified", "Value attached", "Bin C04", "Listed", "Order received", "Profit recorded"];
const personas = {
  Collector: ["Collection value", "$8,740", "Decks", "14", "Binders", "06", "Wishlist", "42"],
  Seller: ["Inventory value", "$42,680", "Active listings", "3,214", "Open orders", "17", "7-day profit", "$1,184"],
  Store: ["Inventory value", "$184,260", "Staff tasks", "09", "Open orders", "43", "Weekly revenue", "$18,420"],
} as const;

export function CardTrace() {
  return <div className={styles.trace} aria-label="Card lifecycle trace">{trace.map((item, i) => <div className={styles.traceNode} key={item}><span data-done={i < 4 || i === 6}>{i < 4 || i === 6 ? "✓" : "○"}</span><small>{item}</small>{i < trace.length - 1 && <i />}</div>)}</div>;
}

export function FlagshipSections() {
  const [persona, setPersona] = useState<keyof typeof personas>("Seller");
  const data = personas[persona];
  return <>
    <section className={styles.traceSection} id="experience">
      <div className={styles.sectionIntro}><p className={styles.kicker}>The card trace</p><h2>One record. Every move.</h2><p>A physical card should never disappear into a spreadsheet. Trading Docks carries its identity, location, value, and selling context forward.</p></div>
      <CardTrace />
      <div className={styles.recordStrip}><span><ScanLine size={16}/> Sample record · Lightning Greaves</span><span>Last event · Order received · 11:18 AM</span><strong>BIN C04 / 018</strong></div>
    </section>
    <section className={styles.commandSection} id="platform">
      <div className={styles.sectionIntro}><p className={styles.kicker}>01 / Operating command center</p><h2>Know what needs to move next.</h2><p>Sample seller workspace. Every number is illustrative demo data.</p></div>
      <div className={styles.commandGrid}>{["Inventory value|$42,680|+8.4% this month", "Active listings|3,214|62 repriced today", "Open orders|17|11 TCGplayer · 6 eBay", "7-day profit|$1,184|After fees and COGS", "Repricing opportunities|86|12 high confidence", "Cards missing locations|412|Chaos Sort queue"].map((item) => { const [label,value,detail]=item.split("|"); return <div className={styles.metric} key={label}><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>; })}<div className={styles.statusPanel}><div><span className={styles.liveDot}/> Marketplace status</div><strong>All systems synced</strong><span>TCGplayer · eBay · Scanner</span><div className={styles.progress}><i/></div></div></div>
    </section>
    <section className={styles.chaosSection}><div className={styles.chaosCopy}><p className={styles.kicker}>02 / Chaos Sort</p><h2>Drop 100 cards on the table.<br/><span>We turn chaos into inventory.</span></h2><p>Recognize the exact printing, review the edge cases, batch the work, then give every card a home.</p><Link href="/sign-up?plan=free" className={styles.action}>Try the workspace <ArrowRight size={16}/></Link></div><div className={styles.sortBoard}><div className={styles.cardScatter}>{["A", "K", "Q", "7", "2", "9", "J"].map((x,i)=><span key={x} style={{"--r": `${i * 9 - 18}deg`, "--x": `${(i%4)*18}px`} as React.CSSProperties}>{x}</span>)}</div><div className={styles.sortResult}><div><small>Batch 0142</small><strong>84 / 100</strong></div><div><small>Location</small><strong>BIN C04</strong></div><div className={styles.ready}><Check size={14}/>82 READY · 2 REVIEW</div></div></div></section>
    <section className={styles.personaSection}><div className={styles.sectionIntro}><p className={styles.kicker}>03 / One platform, your way</p><h2>Built for the operator you are today.</h2></div><div className={styles.personaTabs}>{(Object.keys(personas) as Array<keyof typeof personas>).map(p=><button key={p} aria-pressed={persona===p} onClick={()=>setPersona(p)}>{p}</button>)}</div><div className={styles.workspace}><div className={styles.workspaceRail}><span>TRADING DOCKS</span>{(persona === "Collector" ? ["Collection", "Deck Vault", "Binders", "Wishlist"] : persona === "Seller" ? ["Inventory", "Deal Desk", "Listings", "Orders"] : ["Command Center", "Inventory", "Staff", "Shows"]).map((x,i)=><div key={x} data-active={i===0}>{x}</div>)}</div><div className={styles.workspaceMain}><div className={styles.workspaceTop}><span><span className={styles.liveDot}/> {persona} workspace · sample data</span><MapPin size={16}/> <span>Warehouse / C04</span></div><div className={styles.workspaceMetrics}>{[0,2,4,6].map(i=><div key={data[i]}><small>{data[i]}</small><strong>{data[i+1]}</strong></div>)}</div><div className={styles.workspaceChart}><span>OPERATING PULSE</span><svg viewBox="0 0 500 100" role="img" aria-label="Illustrative operating pulse"><path d="M0 78 L52 66 L93 72 L142 38 L192 56 L240 30 L290 45 L338 22 L390 36 L438 16 L500 28" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M0 78 L52 66 L93 72 L142 38 L192 56 L240 30 L290 45 L338 22 L390 36 L438 16 L500 28 V100 H0Z" fill="currentColor" opacity=".08"/></svg></div></div></div></section>
    <section className={styles.flowSection}><div className={styles.sectionIntro}><p className={styles.kicker}>04 / Connected commerce</p><h2>Integrations feed the system.<br/><span>They do not become the system.</span></h2></div><div className={styles.flow}><div>{["TCGplayer", "eBay", "Shopify", "Scanner", "CSV", "Scryfall"].map(x=><span key={x}>{x}<i>→</i></span>)}</div><strong>TRADING<br/>DOCKS</strong><div>{["Inventory", "Orders", "Analytics", "Fulfillment"].map(x=><span key={x}><i>→</i>{x}</span>)}</div></div></section>
    <section className={styles.editorial}><p>Know what it is.</p><p>Know what it&apos;s worth.</p><p>Know where it is.</p><p>Know what happened to it.</p><strong>That&apos;s Trading Docks.</strong></section>
  </>;
}
