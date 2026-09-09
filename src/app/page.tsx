import { redirect } from "next/navigation";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { MarketSection } from "@/components/landing/MarketSection";
import { PricingSection } from "@/components/landing/PricingSection";
import {
  LifecycleStory,
  ConfidenceSection,
  HomepageClosing,
} from "@/components/landing/LifecycleStory";
import styles from "@/components/landing/Homepage.module.css";
import { hasSupabasePublicConfig } from "@/lib/supabase/proxy-routing";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  // Preserve the defensive session redirect in addition to the proxy check.
  const user = await (async () => {
    if (!hasSupabasePublicConfig()) return null;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  })();
  if (user) redirect("/dashboard");
  return (
    <main data-landing-version="lifecycle-2026-09" className={styles.page}>
      <Header />
      <Hero />
      <LifecycleStory />
      <MarketSection />
      <ConfidenceSection />
      <PricingSection />
      <HomepageClosing />
      <Footer />
    </main>
  );
}
