"use client";

import { useState } from "react";
import { ArrowRight, Check, ScanLine, MapPin, Layers3 } from "lucide-react";
import styles from "./Homepage.module.css";

const STEPS = [
  {
    name: "Scan",
    title: "The right card. The right printing.",
    status: "Identity confirmed",
    label: "Printing",
    value: "2XM · #267",
    detail: "Near mint · English · Nonfoil",
    note: "Review the printing and condition before adding a copy to inventory.",
    event: "Printing confirmed",
    icon: ScanLine,
  },
  {
    name: "Value",
    title: "Know what you own. And what you paid.",
    status: "Value reviewed",
    label: "Example market value",
    value: "$28.00",
    detail: "$18.00 cost basis · $10.00 spread",
    note: "Keep purchase cost beside market context. Market values are estimates, not guaranteed sale prices.",
    event: "Cost basis recorded",
    icon: Layers3,
  },
  {
    name: "Store",
    title: "A digital record. A physical address.",
    status: "Location assigned",
    label: "Storage location",
    value: "Box 04 / B / 018",
    detail: "Chaos Sort · 1 copy in storage",
    note: "Give every copy a searchable location so you can find it when it is time to pick an order.",
    event: "Moved to Box 04",
    icon: MapPin,
  },
  {
    name: "List",
    title: "Put the right copy into the selling queue.",
    status: "Export prepared",
    label: "Example asking price",
    value: "$28.00",
    detail: "1 copy · Near mint · CSV export",
    note: "Prepare marketplace inventory exports. Publishing and synchronization depend on the channel and account setup.",
    event: "Listing export prepared",
    icon: Layers3,
  },
  {
    name: "Sell",
    title: "From the order to the right box.",
    status: "Ready to pick",
    label: "Pick location",
    value: "Box 04 / B / 018",
    detail: "Example order TD-1042 · 1 copy",
    note: "Use the order and its storage context to pick, pack, and record fulfillment.",
    event: "Order ready to fulfill",
    icon: MapPin,
  },
  {
    name: "Analyze",
    title: "See what the sale actually earned.",
    status: "Sale reviewed",
    label: "Example net profit",
    value: "$5.50",
    detail: "$28 sale − $18 cost − $4.50 fees & shipping",
    note: "Review proceeds against cost and selling expenses. These sample amounts illustrate a single sale.",
    event: "Sale costs reviewed",
    icon: Check,
  },
] as const;

export function CardJourney() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  const Icon = step.icon;
  return (
    <div className={styles.product} id="card-demo">
      <div className={styles.productBar}>
        <span>
          <Layers3 size={15} /> Trading Docks{" "}
          <span className={styles.productCrumb}>/ Card record</span>
        </span>
        <span className={styles.sample}>Interactive demo</span>
      </div>
      <div className={styles.record}>
        <div className={styles.recordHeading}>
          <div className={styles.setTile}>
            <ScanLine size={26} aria-hidden="true" />
            2XM<span>267</span>
          </div>
          <div>
            <p className={styles.smallLabel}>Magic: The Gathering</p>
            <h2>Lightning Greaves</h2>
            <p>Double Masters · Artifact — Equipment</p>
          </div>
        </div>
        <div className={styles.recordMeta}>
          <span>
            <Check size={13} /> Near mint
          </span>
          <span>Nonfoil</span>
          <span>English</span>
          <span>1 copy</span>
        </div>
        <div
          className={styles.journeyControls}
          role="group"
          aria-label="Explore the card lifecycle"
        >
          {STEPS.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={active === index}
              aria-controls="journey-detail"
              onClick={() => setActive(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.name}
            </button>
          ))}
        </div>
        <div
          id="journey-detail"
          className={styles.journeyDetail}
          aria-live="polite"
          aria-atomic="true"
        >
          <div key={step.name} className={styles.detailContent}>
            <div className={styles.detailTop}>
              <Icon size={18} />
              <span>{step.status}</span>
            </div>
            <p className={styles.smallLabel}>{step.label}</p>
            <p className={styles.recordValue}>{step.value}</p>
            <p className={styles.valueDetail}>{step.detail}</p>
            <div className={styles.recordRule} />
            <h3>{step.title}</h3>
            <p className={styles.detailNote}>{step.note}</p>
          </div>
        </div>
        <div className={styles.recordHistory}>
          <span>
            <span className={styles.statusDot} /> {step.event}
          </span>
          <span>TD-0018</span>
        </div>
      </div>
      <div className={styles.productFoot}>
        <span>Example data · Not a live account</span>
        <button
          type="button"
          onClick={() => setActive((active + 1) % STEPS.length)}
        >
          {active === STEPS.length - 1 ? "Back to scan" : "Follow this card"}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
