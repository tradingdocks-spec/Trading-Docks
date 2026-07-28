import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      introduction="This policy explains what information Trading Docks collects, why it is used, and the choices available to you when using the platform."
      sections={[
        {
          title: "Information we collect",
          paragraphs: [
            "We collect account information you provide, such as your name and email address, along with inventory, marketplace, and workspace information you choose to store in Trading Docks.",
            "We may also collect technical information needed to operate and protect the service, including device, browser, authentication, and diagnostic data.",
          ],
        },
        {
          title: "How information is used",
          paragraphs: [
            "Information is used to provide the platform, authenticate accounts, process subscriptions, maintain marketplace connections, deliver support, improve reliability, and prevent abuse.",
            "Trading Docks does not sell your personal information.",
          ],
        },
        {
          title: "Service providers",
          paragraphs: [
            "Trusted service providers may process limited information on our behalf for authentication, hosting, payments, analytics, and other essential platform functions. Their handling of information is governed by their agreements and privacy practices.",
          ],
        },
        {
          title: "Your choices",
          paragraphs: [
            "You may request access to, correction of, or deletion of your account information by contacting us. Some records may be retained when required for security, legal, tax, or payment purposes.",
          ],
        },
      ]}
    />
  );
}
