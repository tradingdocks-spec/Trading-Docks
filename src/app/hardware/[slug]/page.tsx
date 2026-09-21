import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import {
  CertificationBadge,
  PurchaseAction,
  ConsumableRecommendations,
} from "@/components/hardware/HardwareCatalog";
import { hardwareViews } from "@/lib/hardware/server";
import styles from "@/components/hardware/hardware.module.css";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = hardwareViews().find((v) => v.item.slug === slug);
  return {
    title: v ? `${v.item.displayName} setup guide` : "Hardware not found",
    alternates: { canonical: `/hardware/${slug}` },
  };
}
export default async function HardwareGuide({ params }: Props) {
  const { slug } = await params;
  const views = hardwareViews();
  const view = views.find((v) => v.item.slug === slug);
  if (!view) notFound();
  const { item } = view;
  return (
    <div className={styles.page}>
      <Header />
      <main className={`${styles.main} ${styles.guide}`}>
        <Link href="/hardware">← Hardware compatibility</Link>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>{item.manufacturer} · Setup guide</p>
          <h1>{item.displayName}</h1>
          <p>{item.model}</p>
          {item.referenceSku && <p>Reference SKU: {item.referenceSku}</p>}
          <CertificationBadge item={item} />
          <p>{item.description}</p>
          <p>{item.connections.join(" · ")}</p>
        </header>
        <section className={styles.section}>
          <h2>Before you buy</h2>
          <ul>
            {item.compatibilityNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <PurchaseAction view={view} source="public_hardware" />
        </section>
        <section className={styles.section}>
          <h2>Set up and test in Trading Docks</h2>
          <ol>
            {item.setup.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ol>
          <Link className={styles.button} href={item.testAction.href}>
            {item.testAction.label} →
          </Link>
        </section>
        <section className={styles.section}>
          <h2>Troubleshooting</h2>
          <ul>
            {item.troubleshooting.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <a
            href={item.manufacturerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Manufacturer specifications and support ↗
          </a>
        </section>
        <ConsumableRecommendations views={views} hardwareId={item.id} />
        <p className={styles.footnote}>
          Physical test results apply to an exact model, interface, driver,
          operating system and browser. A successful software test alone does
          not certify a physical device.
        </p>
      </main>
      <Footer />
    </div>
  );
}
