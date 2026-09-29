import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { ingest } from "@/lib/hq";
import { IngestPayload } from "@/lib/ingest-schema";

export const runtime = "nodejs";

const MAX_BYTES = 1_000_000;

function authorized(header: string | null, token: string): boolean {
  const presented = Buffer.from(header?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(token);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

export async function POST(req: NextRequest) {
  const token = env().HQ_INGEST_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Ingest is not enabled (HQ_INGEST_TOKEN unset)" },
      { status: 503 },
    );
  }
  if (!authorized(req.headers.get("authorization"), token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ error: "Payload over 1 MB" }, { status: 413 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }
  const parsed = IngestPayload.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: z.treeifyError(parsed.error) },
      { status: 422 },
    );
  }
  try {
    return NextResponse.json({ ok: true, result: await ingest(parsed.data) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 502 },
    );
  }
}
