import "server-only";
import { Resend } from "resend";
import { env } from "./env";
import type { RawMail } from "./mail-organize";

let client: Resend | undefined;
function resend() {
  client ??= new Resend(env().RESEND_API_KEY);
  return client;
}

export interface MailFetch {
  mails: RawMail[];
  error: string | null;
}

// The newest 100 in each direction. Older mail stays in Resend; HQ is for
// what needs doing now, not an archive.
export async function fetchMail(): Promise<MailFetch> {
  const [received, sent] = await Promise.all([
    resend().emails.receiving.list({ limit: 100 }),
    resend().emails.list({ limit: 100 }),
  ]);
  const mails: RawMail[] = [];
  const errors: string[] = [];
  if (received.error) errors.push(`received: ${received.error.message}`);
  else
    for (const m of received.data.data)
      mails.push({
        id: m.id,
        direction: "received",
        from: m.from,
        to: m.to,
        subject: m.subject,
        created_at: m.created_at,
      });
  if (sent.error) errors.push(`sent: ${sent.error.message}`);
  else
    for (const m of sent.data.data)
      mails.push({
        id: m.id,
        direction: "sent",
        from: m.from,
        to: m.to,
        subject: m.subject,
        created_at: m.created_at,
        last_event: m.last_event,
      });
  return { mails, error: errors.length ? errors.join("; ") : null };
}

export interface MailBody {
  text: string | null;
  html: string | null;
  replyTo: string[] | null;
  messageId: string | null;
}

export async function fetchBody(id: string, direction: "received" | "sent"): Promise<MailBody> {
  if (direction === "received") {
    const r = await resend().emails.receiving.get(id);
    if (r.error) throw new Error(r.error.message);
    return {
      text: r.data.text,
      html: r.data.html,
      replyTo: r.data.reply_to,
      messageId: r.data.message_id,
    };
  }
  const r = await resend().emails.get(id);
  if (r.error) throw new Error(r.error.message);
  return {
    text: r.data.text,
    html: r.data.html,
    replyTo: r.data.reply_to,
    messageId: r.data.message_id,
  };
}

export async function sendReply(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo: string | null;
}) {
  const r = await resend().emails.send({
    from: opts.from,
    to: opts.to,
    subject: /^re:/i.test(opts.subject) ? opts.subject : `Re: ${opts.subject}`,
    text: opts.text,
    headers: opts.inReplyTo
      ? { "In-Reply-To": opts.inReplyTo, References: opts.inReplyTo }
      : undefined,
  });
  if (r.error) throw new Error(r.error.message);
  return r.data.id;
}

export async function sendSignInLink(to: string, url: string) {
  const r = await resend().emails.send({
    from: env().HQ_SIGNIN_FROM,
    to,
    subject: "Your Aroqon HQ sign-in link",
    text: `Sign in to Aroqon HQ:\n\n${url}\n\nThe link works once and expires in 15 minutes. If you did not ask for it, ignore this email.`,
  });
  if (r.error) throw new Error(r.error.message);
}
