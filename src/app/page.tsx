import { redirect } from "next/navigation";

import { AutomationSection } from "@/components/landing/AutomationSection";
import { BackgroundEffects } from "@/components/landing/BackgroundEffects";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ExperienceSection } from "@/components/landing/ExperienceSection";
import { EcosystemSection } from "@/components/landing/EcosystemSection";
import { LandingExperienceEffects } from "@/components/landing/LandingExperienceEffects";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { MarketSection } from "@/components/landing/MarketSection";
import { PlanJourneySection } from "@/components/landing/PlanJourneySection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { TrustedGames } from "@/components/landing/TrustedGames";
import { TrustSection } from "@/components/landing/TrustSection";
import { WorkflowExperienceSection } from "@/components/landing/WorkflowExperienceSection";
import { hasSupabasePublicConfig } from "@/lib/supabase/proxy-routing";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  // Keep this check in the page as a defense in depth. The proxy normally
  // handles this redirect, but the root route must never show the public
  // landing page to a user whose valid session reached the server.
  const user = await (async () => {
    if (!hasSupabasePublicConfig()) return null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  })();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main
      data-landing-version="v236"
      className="relative min-h-screen overflow-hidden bg-[#02090f] text-white"
    >
      <BackgroundEffects />
      <LandingExperienceEffects />
      <Header />
      <Hero />
      <TrustedGames />
      <ExperienceSection />
      <WorkflowExperienceSection />
      <PlanJourneySection />
      <FeaturesSection />
      <EcosystemSection />
      <MarketSection />
      <AutomationSection />
      <TrustSection />
      <TestimonialsSection />
      <PricingSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}
