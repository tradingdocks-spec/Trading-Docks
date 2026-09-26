import { ShowcaseTagManager } from "@/components/dashboard/showcase/ShowcaseTagManager";
import { getShowcaseTagAdmin } from "@/lib/showcase-tag-admin";

export default async function ShowcaseTagsPage() {
  const context = await getShowcaseTagAdmin();
  if ("error" in context) {
    return <main className="dashboard-responsive mx-auto max-w-3xl px-4 py-10"><h1 className="text-2xl font-semibold text-td-primary">Store tags</h1><p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-500" role="alert">{context.error}</p></main>;
  }
  return <ShowcaseTagManager />;
}
