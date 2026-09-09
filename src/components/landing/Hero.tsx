import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CardJourney } from "./CardJourney";
import styles from "./Homepage.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>The operating system for your cards</p>
        <h1>
          Follow every card
          <br />
          from <span>scan to sale.</span>
        </h1>
        <p className={styles.heroDescription}>
          Know what it is, what it’s worth, and exactly where it is. One
          workspace for trading-card collectors, sellers, and stores.
        </p>
        <div className={styles.actions}>
          <Link href="/sign-up?plan=free" className={styles.primary}>
            Create your free account <ArrowRight size={16} />
          </Link>
          <a href="#experience" className={styles.textLink}>
            See how it works <ArrowRight size={15} />
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
