import type { MetadataRoute } from "next";

// Aroqon HQ is a private dashboard. /login is the only publicly
// indexable URL; private routes are intentionally not enumerated.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://hq.aroqon.com/login",
      lastModified: new Date("2026-10-08"),
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}
