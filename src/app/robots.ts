import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    sitemap: "https://www.tradingdocks.com/sitemap.xml",
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/sign-in", "/sign-up"],
        disallow: [
          "/dashboard/",
          "/onboarding/",
          "/api/",
          "/share/",
        ],
      },
    ],
  };
}
