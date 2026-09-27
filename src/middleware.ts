import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "./lib/session";

// Everything is private except the sign-in page and the link it emails.
export async function middleware(req: NextRequest) {
  const secret = process.env.HQ_SESSION_SECRET;
  const owner = process.env.HQ_OWNER_EMAIL?.toLowerCase();
  const claims = secret
    ? await verifyToken(req.cookies.get(SESSION_COOKIE)?.value, "session", secret)
    : null;
  if (claims && claims.sub === owner) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|auth/callback|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
