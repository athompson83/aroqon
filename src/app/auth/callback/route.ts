import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { consumeNonce } from "@/lib/hq";
import { newNonce, SESSION_COOKIE, SESSION_TTL_MS, signToken, verifyToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const e = env();
  const fail = NextResponse.redirect(new URL("/login?error=link", e.HQ_BASE_URL));
  const claims = await verifyToken(
    req.nextUrl.searchParams.get("token") ?? undefined,
    "signin",
    e.HQ_SESSION_SECRET,
  );
  if (!claims || claims.sub !== e.HQ_OWNER_EMAIL.toLowerCase()) return fail;
  if (!(await consumeNonce(claims.nonce))) return fail;

  const session = await signToken(
    { purpose: "session", sub: claims.sub, exp: Date.now() + SESSION_TTL_MS, nonce: newNonce() },
    e.HQ_SESSION_SECRET,
  );
  const res = NextResponse.redirect(new URL("/", e.HQ_BASE_URL));
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
