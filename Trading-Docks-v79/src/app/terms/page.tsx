import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      introduction="These terms govern access to and use of Trading Docks. By creating an account or using the platform, you agree to these terms."
      sections={[
        {
          title: "Using Trading Docks",
          paragraphs: [
            "You are responsible for the accuracy of information entered into your account, maintaining the security of your login, and activity performed through your account.",
            "You may not misuse the service, interfere with its operation, attempt unauthorized access, or use it in violation of applicable law or marketplace rules.",
          ],
        },
        {
          title: "Subscriptions and billing",
          paragraphs: [
            "Paid plans renew according to the billing cycle selected at checkout until canceled. Prices, included features, usage limits, and applicable taxes are displayed before purchase.",
            "Subscription changes and cancellations are managed through the billing portal. Except where required by law, fees already paid are non-refundable.",
          ],
        },
        {
          title: "Marketplace and pricing information",
          paragraphs: [
            "Trading Docks may display information obtained from third-party marketplaces and data providers. Availability, pricing, identifiers, and other third-party information can change and should be reviewed before making listing, purchasing, or inventory decisions.",
          ],
        },
        {
          title: "Service availability",
          paragraphs: [
            "We work to keep Trading Docks reliable, but the service is provided without a guarantee of uninterrupted availability. Features may be updated, replaced, or discontinued as the platform evolves.",
          ],
        },
      ]}
    />
  );
}
