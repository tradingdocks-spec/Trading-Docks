import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CardJourney } from "./CardJourney";
import styles from "./Homepage.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>The operating system for TCG inventory</p>
        <h1>
          Every card.
          <br />
          Every move.
          <br />
          <span>One system.</span>
        </h1>
        <p className={styles.heroDescription}>
          Scan, identify, value, organize, list, sell, and track every card
          through one connected record.
        </p>
        <div className={styles.actions}>
          <Link href="/sign-up?plan=free" className={styles.primary}>
            Start free <ArrowRight size={16} />
          </Link>
          <a href="#experience" className={styles.textLink}>
            Explore the workspace <ArrowRight size={15} />
          </a>
        </div>
        <p className={styles.heroFine}>
          Free for up to 500 cards. No credit card required.
        </p>
        <div className={styles.heroStatement}>
          <span>One card. One connected record.</span>
          <p>Identity, cost, location, and selling context stay together.</p>
        </div>
      </div>
      <div className={styles.productStage}>
        <div className={styles.stageCaption}>
          <span className={styles.statusDot} /> EXPLORE THE CARD JOURNEY{" "}
          <span>01 — 06</span>
        </div>
        <CardJourney />
      </div>
    </section>
  );
}
