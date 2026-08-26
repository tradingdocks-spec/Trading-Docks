import { notFound, redirect } from "next/navigation";

import { CardWorkspaceView } from "@/components/dashboard/card-workspace/CardWorkspaceView";
import { getCardWorkspaceData } from "@/lib/card-workspace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CardWorkspacePage({
  params,
}: {
  params: Promise<{ inventoryItemId: string }>;
}) {
  const { inventoryItemId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/sign-in?next=/dashboard/cards/${encodeURIComponent(inventoryItemId)}`);

  const data = await getCardWorkspaceData({
    supabase,
    userId: user.id,
    inventoryItemId: decodeURIComponent(inventoryItemId),
  });

  if (!data) notFound();

  return <CardWorkspaceView data={data} />;
}
