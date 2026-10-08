import type { MetadataRoute } from "next";

// Aroqon HQ is a private, noindex dashboard. Only the sign-in page and
// the agent-facing files are crawlable; everything else is disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/login", "/llms.txt", "/sitemap.xml", "/robots.txt", "/icon.svg"],
        disallow: ["/"],
      },
    ],
    sitemap: "https://hq.aroqon.com/sitemap.xml",
  };
}
