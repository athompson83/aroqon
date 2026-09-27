import { describe, expect, it } from "vitest";
import { newNonce, signToken, verifyToken } from "@/lib/session";

const secret = "s".repeat(40);
const claims = (over = {}) => ({
  purpose: "signin" as const,
  sub: "owner@example.com",
  exp: Date.now() + 60_000,
  nonce: newNonce(),
  ...over,
});

describe("signed tokens", () => {
  it("round-trips a valid token", async () => {
    const c = claims();
    expect(await verifyToken(await signToken(c, secret), "signin", secret)).toEqual(c);
  });

  it("rejects a token signed with another secret", async () => {
    const t = await signToken(claims(), "x".repeat(40));
    expect(await verifyToken(t, "signin", secret)).toBeNull();
  });

  it("rejects a tampered body", async () => {
    const t = await signToken(claims(), secret);
    const [, sig] = t.split(".");
    const forged = btoa(JSON.stringify(claims({ sub: "attacker@example.com" })))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifyToken(`${forged}.${sig}`, "signin", secret)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const t = await signToken(claims({ exp: Date.now() - 1 }), secret);
    expect(await verifyToken(t, "signin", secret)).toBeNull();
  });

  // A sign-in link must not work as a session cookie, or the emailed URL
  // would itself be a 30-day credential.
  it("rejects a token used for the wrong purpose", async () => {
    const t = await signToken(claims(), secret);
    expect(await verifyToken(t, "session", secret)).toBeNull();
  });

  it("rejects garbage", async () => {
    for (const t of [undefined, "", "abc", "a.b", "..."]) {
      expect(await verifyToken(t, "session", secret)).toBeNull();
    }
  });
});
