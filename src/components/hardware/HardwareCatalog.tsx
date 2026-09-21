"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  activeHardware,
  categories,
  certificationFor,
  certifications,
  isConsumable,
  type Hardware,
  type HardwareSource,
} from "@/lib/hardware/catalog";
import {
  amazonDisclosure,
  defaultDisclosure,
  purchaseLink,
  approvedUrl,
} from "@/lib/hardware/links";
import styles from "./hardware.module.css";
export type HardwareView = {
  item: Hardware;
  purchase: ReturnType<typeof purchaseLink>;
  disclosure: string;
};
const defaultViews = () =>
  activeHardware().map((item) => ({
    item,
    purchase: purchaseLink(item, {
      enabled: false,
      disclosure: defaultDisclosure,
    }),
    disclosure: defaultDisclosure,
  }));
export function CertificationBadge({ item }: { item: Hardware }) {
  const tier = certificationFor(item);
  return (
    <span className={styles.badge} data-tier={tier}>
      {certifications[tier].label}
    </span>
  );
}
function ProductImage({ item }: { item: Hardware }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.image}>
      {failed || !item.image ? (
        <p>
          Product photo unavailable.{" "}
          <a
            href={item.manufacturerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View manufacturer photos
          </a>
        </p>
      ) : (
        <Image
          src={item.image}
          alt={item.imageAlt}
          width={480}
          height={300}
          unoptimized
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
export function PurchaseAction({
  view,
  source,
}: {
  view: HardwareView;
  source: HardwareSource;
}) {
  if (!view.purchase) return null;
  return (
    <div className={styles.purchase}>
      <a
        className={styles.button}
        href={`/hardware/out/${view.item.id}?source=${source}`}
        target="_blank"
        rel={
          view.purchase.affiliate
            ? "sponsored noopener noreferrer"
            : "noopener noreferrer"
        }
      >
        {view.purchase.label} <span aria-hidden="true">↗</span>
      </a>
      {view.purchase.affiliate && (
        <p className={styles.disclosure}>
          {view.disclosure} {amazonDisclosure}
        </p>
      )}
      {isConsumable(view.item) &&
        view.purchase.retailer === "AMAZON_US" &&
        approvedUrl(view.item.manufacturerUrl) && (
          <p className={styles.disclosure}>
            <a
              href={view.item.manufacturerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {view.item.fallbackLabel ?? "Manufacturer guidance"} ↗
            </a>
          </p>
        )}
    </div>
  );
}
export function HardwareCatalog({
  views = defaultViews(),
  source = "public_hardware",
  compact = false,
}: {
  views?: HardwareView[];
  source?: HardwareSource;
  compact?: boolean;
}) {
  return (
    <div className={styles.grid} data-compact={compact}>
      {views
        .filter(
          (v) =>
            v.item.active &&
            !isConsumable(v.item) &&
            (!compact || v.item.recommended),
        )
        .map((view) => (
          <article className={styles.card} key={view.item.id} id={view.item.id}>
            {!compact && <ProductImage item={view.item} />}
            <div className={styles.cardBody}>
              <p className={styles.eyebrow}>{categories[view.item.category]}</p>
              <h3>{view.item.displayName}</h3>
              <p className={styles.variant}>{view.item.model}</p>
              {view.item.referenceSku && (
                <p className={styles.variant}>
                  Reference SKU: {view.item.referenceSku}
                </p>
              )}
              <CertificationBadge item={view.item} />
              {!compact && (
                <>
                  <p>{view.item.description}</p>
                  <ul className={styles.features}>
                    {[...view.item.connections, ...view.item.capabilities].map(
                      (c) => (
                        <li key={c}>{c}</li>
                      ),
                    )}
                  </ul>
                  <p>
                    <strong>Why this reference:</strong> {view.item.rationale}
                  </p>
                </>
              )}
              {source !== "public_hardware" && (
                <p className={styles.status}>
                  Your store:{" "}
                  {view.item.category === "terminal"
                    ? source === "pos_hardware"
                      ? "See live pairing and connection status below."
                      : "Open POS Hardware to check pairing and connection status."
                    : "Ready to test — physical readiness is not yet verified here."}
                </p>
              )}
              <div className={styles.actions}>
                <Link href={`/hardware/${view.item.slug}`}>Setup Guide →</Link>
                {source !== "public_hardware" && (
                  <Link href={view.item.testAction.href}>
                    {view.item.testAction.label} →
                  </Link>
                )}
              </div>
              <PurchaseAction view={view} source={source} />
            </div>
          </article>
        ))}
    </div>
  );
}
export function HardwareRecommendations({
  views,
  source,
}: {
  views?: HardwareView[];
  source: "pos_onboarding" | "pos_hardware";
}) {
  return (
    <section
      className={styles.recommendations}
      aria-label="Hardware recommendations"
    >
      <h2>
        {source === "pos_onboarding"
          ? "Hardware for your counter"
          : "Recommended hardware & setup"}
      </h2>
      <p>
        Use your existing equipment or explore our reference stack. Purchases
        are optional. Model certification is separate from your store’s setup
        status.
      </p>
      {source === "pos_onboarding" && (
        <p>
          <Link href="/dashboard/pos/hardware#scanner-test">
            I already have a scanner — test it →
          </Link>
        </p>
      )}
      <HardwareCatalog views={views} source={source} compact />
      {source === "pos_hardware" && (
        <ConsumableRecommendations views={views} source={source} />
      )}
      <p>
        <Link href="/hardware">Full compatibility catalog →</Link>
      </p>
    </section>
  );
}

export function ConsumableRecommendations({
  views = defaultViews(),
  hardwareId,
  source = "public_hardware",
}: {
  views?: HardwareView[];
  hardwareId?: string;
  source?: HardwareSource;
}) {
  const supplies = views.filter(
    ({ item }) =>
      item.active &&
      isConsumable(item) &&
      (!hardwareId || item.relatedHardwareIds?.includes(hardwareId)),
  );
  if (!supplies.length) return null;
  return (
    <section
      className={styles.recommendations}
      aria-label="Compatible consumables"
    >
      <h2>Media for this setup</h2>
      <p>
        Match the media to your printer and selected preset. These supplies are
        Compatible, not physically Tested. Start with one test print and
        scan-back where applicable.
      </p>
      <div className={styles.supplies}>
        {supplies.map((view) => (
          <article
            key={view.item.id}
            id={view.item.id}
            className={styles.supply}
          >
            <p className={styles.eyebrow}>{categories[view.item.category]}</p>
            <h3>{view.item.displayName}</h3>
            <CertificationBadge item={view.item} />
            <p>{view.item.description}</p>
            <p>{view.item.capabilities.join(" · ")}</p>
            <p>
              For:{" "}
              {view.item.relatedHardwareIds?.map((id) => {
                const device =
                  views.find((v) => v.item.id === id)?.item ??
                  activeHardware().find((d) => d.id === id);
                return device ? (
                  <Link key={id} href={`/hardware/${device.slug}`}>
                    {device.displayName}
                  </Link>
                ) : null;
              })}
            </p>
            <div className={styles.actions}>
              <Link href={`/hardware/${view.item.slug}`}>
                Media setup guide →
              </Link>
              <Link href={view.item.testAction.href}>
                {view.item.testAction.label} →
              </Link>
            </div>
            <PurchaseAction view={view} source={source} />
          </article>
        ))}
      </div>
    </section>
  );
}
