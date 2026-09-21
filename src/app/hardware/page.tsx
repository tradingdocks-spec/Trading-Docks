import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import {
  HardwareCatalog,
  ConsumableRecommendations,
} from "@/components/hardware/HardwareCatalog";
import { certifications } from "@/lib/hardware/catalog";
import { hardwareViews } from "@/lib/hardware/server";
import styles from "@/components/hardware/hardware.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trading Docks Compatible POS Hardware",
  description:
    "Choose barcode scanners, label printers, receipt printers and Square Terminal for trading card stores. Compare compatibility and follow setup guides.",
  alternates: { canonical: "/hardware" },
  openGraph: {
    title: "Trading Docks Compatible POS Hardware",
    url: "/hardware",
  },
};
export default function HardwarePage() {
  const views = hardwareViews();
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Hardware compatibility center</p>
          <h1>Trading Docks Compatible Hardware</h1>
          <p className={styles.intro}>
            Build a counter setup that works with Trading Docks.
          </p>
          <p>
            Start with the job each device needs to do. Compare our reference
            models, check the exact configuration, and use the setup guides to
            test your own counter.
          </p>
          <p className={styles.notice}>
            Physical certification is pending for this reference stack. No model
            below is Trading Docks Tested yet. Validate your hardware before
            opening a pilot register.
          </p>
          <a href="#recommended-setup">View Recommended Setup →</a>
        </header>
        <section className={styles.section} aria-labelledby="tiers">
          <h2 id="tiers">Know what compatibility means</h2>
          <div className={styles.tiers}>
            {(["TESTED", "COMPATIBLE", "BEST_EFFORT"] as const).map((tier) => (
              <div className={styles.tier} key={tier}>
                <span className={styles.badge} data-tier={tier}>
                  {certifications[tier].label}
                </span>
                <p>{certifications[tier].description}</p>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.section} id="recommended-setup">
          <p className={styles.eyebrow}>Four jobs. One counter.</p>
          <h2>Trading Docks Recommended Register Setup</h2>
          <p>
            Scan inventory, print labels, hand over a receipt and take payment.
            These are reference selections awaiting physical acceptance, not a
            guarantee for every driver, browser or device variant.
          </p>
          <div className={styles.kit}>
            {views
              .filter((v) => v.item.recommended)
              .map(({ item }) => (
                <a href={`#${item.id}`} key={item.id}>
                  {item.displayName} ↓
                </a>
              ))}
          </div>
          <div className={styles.section}>
            <HardwareCatalog views={views} />
          </div>
        </section>
        <ConsumableRecommendations views={views} />
        <section className={styles.section}>
          <h2>Already have hardware?</h2>
          <p>
            Use the scanner input, Label Studio test print and receipt workflow
            to check your existing equipment. Catalog certification never marks
            a store’s device as connected or tested.
          </p>
          <Link className={styles.button} href="/dashboard/pos/hardware">
            Open POS Hardware →
          </Link>
        </section>
        <p className={styles.footnote}>
          Product photos and specifications come from the linked manufacturers;
          configurations may differ. Trading Docks is independent and is not
          endorsed by Zebra, Epson, Square or Amazon. Cash drawers and
          accessories will be listed after a specific reference configuration is
          selected.
        </p>
      </main>
      <Footer />
    </div>
  );
}
