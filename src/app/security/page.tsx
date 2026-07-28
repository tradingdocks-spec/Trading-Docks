import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust center"
      title="Security at Trading Docks"
      introduction="Trading Docks uses layered safeguards to protect accounts, business information, and connected services."
      sections={[
        {
          title: "Account protection",
          paragraphs: [
            "Authentication is handled through Supabase. Passwords are not stored directly by Trading Docks, and authenticated sessions use secure browser cookies.",
          ],
        },
        {
          title: "Payments",
          paragraphs: [
            "Subscription checkout and payment details are handled by Stripe. Trading Docks does not directly store full payment-card numbers.",
          ],
        },
        {
          title: "Marketplace credentials",
          paragraphs: [
            "Connected marketplace credentials and tokens should be encrypted, access-controlled, and used only for the connection authorized by the account owner. Never send API keys or passwords through support email.",
          ],
        },
        {
          title: "Report a concern",
          paragraphs: [
            "If you believe you found a security issue, contact tradingdocks@gmail.com with a clear description. Do not access, alter, or download data that does not belong to you.",
          ],
        },
      ]}
    />
  );
}
