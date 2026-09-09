import Link from "next/link";
import {
  ArrowRight,
  Check,
  MapPin,
  ShieldCheck,
  FileCheck2,
  Database,
  ScanLine,
  ShoppingBag,
  TrendingUp,
  Package,
  Tag,
  Truck,
  ChartNoAxesCombined,
} from "lucide-react";
import styles from "./Homepage.module.css";

export function LifecycleStory() {
  return (
    <>
      <div className={styles.audienceStrip}>
        <span>From your first binder to your store’s inventory.</span>
        <div>
          <span>Collectors</span>
          <span>Online sellers</span>
          <span>Local game stores</span>
        </div>
      </div>
      <section id="experience" className={styles.storySection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>The card is the connection</p>
            <h2>
              Less piecing it together.
              <br />
              More moving it forward.
            </h2>
          </div>
          <p>
            A scan is only the beginning. Carry the details you need into the
            next decision, from buying a collection to finding a card for an
            order.
          </p>
        </div>
        <ol className={styles.lifecycle}>
          {[
            ["Acquire", "Evaluate the buy"],
            ["Recognize", "Confirm the printing"],
            ["Value", "Understand the price"],
            ["Organize", "Give it a home"],
            ["List", "Prepare to sell"],
            ["Sell", "Pick and fulfill"],
            ["Analyze", "Review the return"],
          ].map(([title, description], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div className={styles.lifecycleIcon}>
                {(() => {
                  const Icon = [
                    ShoppingBag,
                    ScanLine,
                    TrendingUp,
                    Package,
                    Tag,
                    Truck,
                    ChartNoAxesCombined,
                  ][index];
                  return <Icon size={22} aria-hidden="true" />;
                })()}
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>
      <section id="platform" className={styles.platform}>
        <div className={styles.featureRow}>
          <div className={styles.featureCopy}>
            <p className={styles.eyebrow}>01 / Inventory & storage</p>
            <h2>
              Know the card.
              <br />
              Find the copy.
            </h2>
            <p>
              The printing, condition, and quantity are only half the story.
              Connect your inventory to the boxes, binders, and shelves it
              actually lives in.
            </p>
            <p>
              Chaos Sort gives your storage a searchable home in your workspace.
            </p>
            <a className={styles.textLink} href="#card-demo">
              Explore the example card <ArrowRight size={15} />
            </a>
          </div>
          <div className={styles.storageDemo}>
            <div className={styles.demoTitle}>
              <span>
                <MapPin size={16} /> Inventory / Storage
              </span>
              <span className={styles.sample}>Example data</span>
            </div>
            <div className={styles.storageBody}>
              <div className={styles.storageHeader}>
                <div>
                  <p className={styles.smallLabel}>Chaos Sort</p>
                  <h3>Box 04</h3>
                </div>
                <span>3 example records</span>
              </div>
              <div
                className={styles.boxSlots}
                aria-label="Selected storage row B"
              >
                {["A", "B", "C", "D"].map((s) => (
                  <span data-selected={s === "B"} key={s}>
                    {s}
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                ))}
              </div>
              <div className={styles.inventoryRows}>
                {[
                  ["Lightning Greaves", "2XM · NM · Nonfoil", "B / 018"],
                  ["Sol Ring", "CMM · NM · Nonfoil", "B / 019"],
                  ["Arcane Signet", "CMM · LP · Nonfoil", "B / 020"],
                ].map(([name, detail, location], i) => (
                  <div key={name} data-selected={i === 0}>
                    <ScanLine size={16} />
                    <span>
                      <strong>{name}</strong>
                      <small>{detail}</small>
                    </span>
                    <span>{location}</span>
                  </div>
                ))}
              </div>
              <div className={styles.storageMatch}>
                <Check size={15} /> Lightning Greaves <ArrowRight size={13} />
                <strong>Box 04 / B / 018</strong>
              </div>
            </div>
          </div>
        </div>
        <div className={`${styles.featureRow} ${styles.reverse}`}>
          <div className={styles.featureCopy}>
            <p className={styles.eyebrow}>02 / Deal Desk</p>
            <h2>
              A better buy starts
              <br />
              with the numbers.
            </h2>
            <p>
              Evaluate a collection with cost, market value, and selling
              expenses in view. Set an offer with room for the work that comes
              after the purchase.
            </p>
            <p className={styles.featureFoot}>
              Buying tools for Seller and Store plans.
            </p>
            <a className={styles.textLink} href="#pricing">
              Find your plan <ArrowRight size={15} />
            </a>
          </div>
          <div className={styles.dealDemo}>
            <div className={styles.demoTitle}>
              <span>Deal Desk / Collection review</span>
              <span className={styles.sample}>Example data</span>
            </div>
            <div className={styles.dealBody}>
              <div className={styles.storageHeader}>
                <div>
                  <p className={styles.smallLabel}>Buying session</p>
                  <h3>Saturday collection</h3>
                </div>
                <span>24 cards</span>
              </div>
              <div className={styles.dealNumbers}>
                <div>
                  <span>Estimated resale</span>
                  <strong>$420.00</strong>
                </div>
                <div>
                  <span>Proposed offer</span>
                  <strong>$252.00</strong>
                </div>
              </div>
              <div
                className={styles.costBar}
                aria-label="Example resale breakdown: offer 60 percent, expenses 15 percent, remaining margin 25 percent"
              >
                <span />
                <span />
                <span />
              </div>
              <div className={styles.costLegend}>
                <span>Offer · 60%</span>
                <span>Expenses · 15%</span>
                <span>Margin · 25%</span>
              </div>
              <dl className={styles.dealCalculation}>
                <div>
                  <dt>Estimated fees & shipping</dt>
                  <dd>−$63.00</dd>
                </div>
                <div>
                  <dt>Potential profit</dt>
                  <dd>$105.00</dd>
                </div>
              </dl>
              <p className={styles.demoNote}>
                Illustrative calculation. Actual prices, costs, and sale
                outcomes vary.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

const TRUST_ITEMS = [
  {
    icon: FileCheck2,
    title: "Review before you commit",
    copy: "Confirm card identity and review imports before bringing them into your inventory.",
  },
  {
    icon: Database,
    title: "Keep the source in sight",
    copy: "Market values are estimates. Source context helps you judge the information behind a decision.",
  },
  {
    icon: ShieldCheck,
    title: "A workspace of your own",
    copy: "Collection and business records stay tied to your account, with tools determined by your plan.",
  },
];

export function ConfidenceSection() {
  return (
    <section className={styles.confidence}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Your collection. Your context.</p>
          <h2>
            Built for the details
            <br />
            you need to trust.
          </h2>
        </div>
        <Link href="/security" className={styles.textLink}>
          Security & data practices <ArrowRight size={15} />
        </Link>
      </div>
      <div className={styles.trustColumns}>
        {TRUST_ITEMS.map(({ icon: Icon, title, copy }) => (
          <div key={title}>
            <Icon size={20} />
            <h3>{title}</h3>
            <p>{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomepageClosing() {
  return (
    <section className={styles.closing}>
      <p className={styles.eyebrow}>Start with the cards you have</p>
      <h2>
        Your next card deserves
        <br />a better home.
      </h2>
      <Link href="/sign-up?plan=free" className={`${styles.primary} td-button-primary h-12 px-5 text-sm`}>
        Create your free account <ArrowRight size={16} />
      </Link>
      <p>500 cards. 5 decks. Room to grow.</p>
    </section>
  );
}
