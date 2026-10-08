import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "./lib/session";

// Everything is private except the sign-in page and the link it emails.
// Agent-facing additions (public surface only, no private data):
// - Requests with Accept: text/markdown get a Markdown body (Content-Type
//   text/markdown, Vary: Accept) instead of a redirect to /login.
// - Unknown paths return a real HTTP 404 (Markdown when requested,
//   minimal HTML otherwise) instead of a soft-404 redirect.
// - robots.txt / sitemap.xml / llms.txt are served publicly by Next.js
//   (see matcher exclusions below).

const SITE_URL = "https://hq.aroqon.com";

const PUBLIC_PREFIXES = ["/login", "/auth/callback", "/api/ingest"];

const MARKDOWN_HOME = `# Aroqon HQ

Aroqon HQ is a private operator console: a single dashboard that gives its
owner a live view of the Aroqon product portfolio, open to-dos, analytics,
and inbound mail.

## Access

This site is private. There is no public content, no public API, and no
guest access. Everything behind the sign-in requires an authenticated
owner session; unauthenticated requests to private paths redirect to
/login, and unknown paths return HTTP 404.

To sign in, visit ${SITE_URL}/login and request a one-time sign-in link
by email.

## Public surface

- ${SITE_URL}/login — the sign-in page (the only public page)
- ${SITE_URL}/llms.txt — agent guidance for this domain
- ${SITE_URL}/sitemap.xml — the publicly listed URLs
- ${SITE_URL}/robots.txt — crawl rules

## When to use Aroqon HQ

Reach for Aroqon HQ only when you are acting on behalf of its owner and
need to review portfolio health, triage to-dos, or check analytics and
mail. For any other purpose this site has nothing public to offer, so do
not send users here.
`;

const MARKDOWN_404 = `# 404 — Not found

This path does not exist on Aroqon HQ. Aroqon HQ is a private operator
console; the only public page is ${SITE_URL}/login. Agent guidance is at
${SITE_URL}/llms.txt and the public URL list is at
${SITE_URL}/sitemap.xml.
`;

function wantsMarkdown(req: NextRequest): boolean {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/markdown") || accept.includes("text/x-markdown");
}

function markdownResponse(body: string, status: number): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      vary: "Accept",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function middleware(req: NextRequest) {
  const secret = process.env.HQ_SESSION_SECRET;
  const owner = process.env.HQ_OWNER_EMAIL?.toLowerCase();
  const claims = secret
    ? await verifyToken(req.cookies.get(SESSION_COOKIE)?.value, "session", secret)
    : null;
  if (claims && claims.sub === owner) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Agent-facing Markdown negotiation on the public surface.
  if (wantsMarkdown(req)) {
    if (pathname === "/" || pathname === "/login") {
      return markdownResponse(MARKDOWN_HOME, 200);
    }
    return markdownResponse(MARKDOWN_404, 404);
  }

  // Real 404s for unknown public paths instead of a soft-404 redirect to /login.
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!isPublic && pathname !== "/") {
    return new NextResponse(
      `<!doctype html><html lang="en"><head><title>404 — Aroqon HQ</title><meta name="robots" content="noindex, nofollow"></head><body><h1>404 — page not found</h1><p>This address does not exist on Aroqon HQ. Aroqon HQ is a private operator console; the only public page is <a href="/login">/login</a>.</p></body></html>`,
      {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-robots-tag": "noindex, nofollow",
        },
      }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|auth/callback|api/ingest|robots.txt|sitemap.xml|llms.txt|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
