// Stateless, HMAC-signed tokens. Web Crypto only, so the middleware (edge)
// and the route handlers (node) verify with the same code.

const encoder = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type TokenPurpose = "session" | "signin";

export interface TokenClaims {
  purpose: TokenPurpose;
  sub: string;
  exp: number;
  nonce: string;
}

export async function signToken(claims: TokenClaims, secret: string): Promise<string> {
  const body = b64url(encoder.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken(
  token: string | undefined,
  purpose: TokenPurpose,
  secret: string,
  nowMs: number = Date.now(),
): Promise<TokenClaims | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromB64url(sig) as BufferSource,
      encoder.encode(body),
    );
  } catch {
    return null;
  }
  if (!ok) return null;
  let claims: TokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    return null;
  }
  if (claims.purpose !== purpose || typeof claims.exp !== "number" || claims.exp < nowMs) {
    return null;
  }
  return claims;
}

export function newNonce(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(18)));
}

export const SESSION_COOKIE = "hq_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SIGNIN_TTL_MS = 15 * 60 * 1000;
