import { AutomationSection } from "@/components/landing/AutomationSection";
import { BackgroundEffects } from "@/components/landing/BackgroundEffects";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { MarketSection } from "@/components/landing/MarketSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { TrustedGames } from "@/components/landing/TrustedGames";

export default function HomePage() {
  return (
    <main
      data-landing-version="v83"
      className="relative min-h-screen overflow-hidden bg-[#02090f] text-white"
    >
      <BackgroundEffects />
      <Header />
      <Hero />
      <TrustedGames />
      <MarketSection />
      <FeaturesSection />
      <AutomationSection />
      <TestimonialsSection />
      <PricingSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}
