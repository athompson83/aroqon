import "server-only";
import { cookies } from "next/headers";
import { env } from "./env";
import { SESSION_COOKIE, verifyToken } from "./session";

export async function isOwner(): Promise<boolean> {
  const e = env();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifyToken(token, "session", e.HQ_SESSION_SECRET);
  return claims !== null && claims.sub === e.HQ_OWNER_EMAIL.toLowerCase();
}
