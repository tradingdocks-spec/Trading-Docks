import type { MetadataRoute } from "next";
import { activeHardware } from '@/lib/hardware/catalog';

const SITE_URL = "https://www.tradingdocks.com";

const PUBLIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
  { path: '/hardware', priority: 0.7, changeFrequency: 'monthly' },
  ...activeHardware().map(item => ({ path: `/hardware/${item.slug}`, priority: 0.5, changeFrequency: 'monthly' as const })),
  { path: "/sign-up", priority: 0.8, changeFrequency: "monthly" },
  { path: "/security", priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.4, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
