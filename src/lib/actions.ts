"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { isOwner } from "./auth";
import { env } from "./env";
import { saveTask, saveTriage } from "./hq";
import { TaskInput, type Task } from "./hq-types";
import { projectFor } from "./mail-organize";
import { fetchBody, sendReply, sendSignInLink, type MailBody } from "./resend";
import { newNonce, SESSION_COOKIE, signToken, SIGNIN_TTL_MS } from "./session";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

const NOT_SIGNED_IN = { ok: false, error: "Not signed in" } as const;

export async function saveTaskAction(input: unknown): Promise<Result<Task>> {
  if (!(await isOwner())) return NOT_SIGNED_IN;
  const parsed = TaskInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That task is not valid" };
  if (!parsed.data.id && !parsed.data.title) return { ok: false, error: "A task needs a title" };
  try {
    const task = await saveTask(parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, data: task };
  } catch (e) {
    return fail(e);
  }
}

const TriageInput = z.object({
  email_id: z.string().min(1).max(100),
  direction: z.enum(["received", "sent"]),
  category: z.string().min(1).max(40).optional(),
  priority: z.enum(["urgent", "normal", "low"]).optional(),
  handled: z.boolean().optional(),
});

export async function triageAction(input: unknown): Promise<Result<null>> {
  if (!(await isOwner())) return NOT_SIGNED_IN;
  const parsed = TriageInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That change is not valid" };
  try {
    // A first triage row needs a category; callers pass the one on screen.
    await saveTriage({ category: "Other", ...parsed.data });
    revalidatePath("/mail");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function mailBodyAction(input: unknown): Promise<Result<MailBody>> {
  if (!(await isOwner())) return NOT_SIGNED_IN;
  const parsed = z
    .object({ id: z.string().min(1).max(100), direction: z.enum(["received", "sent"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown email" };
  try {
    return { ok: true, data: await fetchBody(parsed.data.id, parsed.data.direction) };
  } catch (e) {
    return fail(e);
  }
}

const ReplyInput = z.object({
  from: z.email(),
  to: z.email(),
  subject: z.string().max(500),
  text: z.string().trim().min(1).max(20_000),
  inReplyTo: z.string().max(500).nullable(),
});

export async function replyAction(input: unknown): Promise<Result<string>> {
  if (!(await isOwner())) return NOT_SIGNED_IN;
  const parsed = ReplyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The reply needs a message" };
  // Only ever send as one of our own domains.
  if (!projectFor([parsed.data.from])) {
    return { ok: false, error: `Cannot send as ${parsed.data.from}` };
  }
  try {
    return { ok: true, data: await sendReply(parsed.data) };
  } catch (e) {
    return fail(e);
  }
}

export async function requestSignInAction(input: unknown): Promise<Result<null>> {
  const parsed = z.object({ email: z.email() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter an email address" };
  const e = env();
  // Same answer whether or not the address is the owner's, so the form does
  // not confirm who owns HQ.
  if (parsed.data.email.toLowerCase() === e.HQ_OWNER_EMAIL.toLowerCase()) {
    try {
      const token = await signToken(
        {
          purpose: "signin",
          sub: e.HQ_OWNER_EMAIL.toLowerCase(),
          exp: Date.now() + SIGNIN_TTL_MS,
          nonce: newNonce(),
        },
        e.HQ_SESSION_SECRET,
      );
      const url = new URL("/auth/callback", e.HQ_BASE_URL);
      url.searchParams.set("token", token);
      await sendSignInLink(e.HQ_OWNER_EMAIL, url.toString());
    } catch (err) {
      return fail(err);
    }
  }
  return { ok: true, data: null };
}

export async function signOutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
