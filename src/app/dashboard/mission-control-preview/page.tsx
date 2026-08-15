import { redirect } from "next/navigation";

export const metadata = {
  title: "Business Command Center | Trading Docks",
};

export default function MissionControlPreviewPage() {
  redirect("/dashboard");
}
