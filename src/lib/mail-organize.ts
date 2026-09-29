import type { Triage } from "./hq-types";

// How HQ files a Resend email when the Co-Founder has not triaged it yet. The
// rules are deliberately few and legible; anything they get wrong, the owner
// or the agent corrects with a triage row, which always wins.

export const CATEGORIES = ["Alerts", "Customers", "Billing", "Auth", "Product", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface MailItem {
  id: string;
  direction: "received" | "sent";
  from: string;
  fromName: string;
  to: string[];
  subject: string;
  date: string;
  deliveryStatus: string | null;
  category: string;
  priority: "urgent" | "normal" | "low";
  project: string | null;
  handled: boolean;
  summary: string | null;
  action: string | null;
  triaged: boolean;
}

export interface RawMail {
  id: string;
  direction: "received" | "sent";
  from: string;
  to: string[];
  subject: string;
  created_at: string;
  last_event?: string | null;
}

// Sending/receiving domains → portfolio project. Longest suffix wins.
const PROJECT_DOMAINS: [string, string][] = [
  ["captivate.axtevi.com", "captivate"],
  ["axtevi.com", "captivate"],
  ["proviciency.com", "proficiencyai"],
  ["proficiencyai.net", "proficiencyai"],
  ["proficiencyems.com", "proficiencyai"],
  ["riseswfl.com", "rise"],
  ["certivo.tools", "certivo"],
  ["aroqon.com", "data-foundry"],
];

export function addressOf(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m ? m[1] : value).trim().toLowerCase();
}

export function displayName(value: string): string {
  const m = value.match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  return addressOf(value).split("@")[0];
}

function domainOf(address: string): string {
  return addressOf(address).split("@")[1] ?? "";
}

export function projectFor(addresses: string[]): string | null {
  let best: { len: number; slug: string } | null = null;
  for (const a of addresses) {
    const d = domainOf(a);
    for (const [suffix, slug] of PROJECT_DOMAINS) {
      if ((d === suffix || d.endsWith(`.${suffix}`)) && (!best || suffix.length > best.len)) {
        best = { len: suffix.length, slug };
      }
    }
  }
  return best?.slug ?? null;
}

const has = (text: string, words: RegExp) => words.test(text.toLowerCase());

const ALERT = /\b(alert|failure|failed|missed[- ]run|error|down|outage|incident|backup)\b/;
const BILLING = /\b(invoice|receipt|payment|payout|charge|subscription|refund|billing|stripe)\b/;
const AUTH =
  /\b(reset your password|password reset|verify|verification|confirm your|sign[- ]in link|magic link|one-time code|otp)\b/;

export function classify(mail: RawMail): { category: Category; priority: MailItem["priority"] } {
  const subject = mail.subject ?? "";
  const from = addressOf(mail.from);
  const ours = projectFor([mail.from]) !== null;
  const localPart = from.split("@")[0];
  const machine = /^(no-?reply|noreply|notifications?|alerts?|test|mailer|bounce)/.test(localPart);

  if (has(subject, ALERT) || /^alerts?@/.test(addressOf(mail.to[0] ?? ""))) {
    const failing = has(subject, /\b(failure|failed|missed|down|outage|error)\b/);
    return { category: "Alerts", priority: failing ? "urgent" : "normal" };
  }
  if (has(subject, AUTH)) return { category: "Auth", priority: "low" };
  if (has(subject, BILLING)) return { category: "Billing", priority: "normal" };
  if (mail.direction === "received" && !ours && !machine) {
    return { category: "Customers", priority: "urgent" };
  }
  if (ours || machine) return { category: "Product", priority: "low" };
  return { category: "Other", priority: "normal" };
}

export function organize(mails: RawMail[], triage: Triage[]): MailItem[] {
  const byId = new Map(triage.map((t) => [t.email_id, t]));
  return mails
    .map((m) => {
      const t = byId.get(m.id);
      const auto = classify(m);
      return {
        id: m.id,
        direction: m.direction,
        from: addressOf(m.from),
        fromName: displayName(m.from),
        to: m.to.map(addressOf),
        subject: m.subject || "(no subject)",
        date: m.created_at,
        deliveryStatus: m.last_event ?? null,
        category: t?.category ?? auto.category,
        priority: t?.priority ?? auto.priority,
        project: projectFor([m.from, ...m.to]),
        handled: t?.handled ?? false,
        summary: t?.summary ?? null,
        action: t?.action ?? null,
        triaged: Boolean(t),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface MailStats {
  received: number;
  sent: number;
  needsAttention: number;
  urgent: number;
  deliveryProblems: number;
  byCategory: Record<string, number>;
}

const DELIVERY_PROBLEMS = new Set([
  "bounced",
  "complained",
  "failed",
  "suppressed",
  "delivery_delayed",
]);

export function mailStats(items: MailItem[]): MailStats {
  const byCategory: Record<string, number> = {};
  let needsAttention = 0;
  let urgent = 0;
  let deliveryProblems = 0;
  for (const m of items) {
    if (m.direction === "received") {
      byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
      if (!m.handled && m.priority !== "low") needsAttention++;
      if (!m.handled && m.priority === "urgent") urgent++;
    } else if (m.deliveryStatus && DELIVERY_PROBLEMS.has(m.deliveryStatus)) {
      deliveryProblems++;
    }
  }
  return {
    received: items.filter((m) => m.direction === "received").length,
    sent: items.filter((m) => m.direction === "sent").length,
    needsAttention,
    urgent,
    deliveryProblems,
    byCategory,
  };
}
