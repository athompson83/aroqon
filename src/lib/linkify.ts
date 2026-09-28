// Splits plain-text email into text and link segments. Only http(s) and
// mailto become links; anything else stays text, so a crafted "javascript:"
// string can never reach an href.

export type Segment = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

const URL_RE = /\b(?:https?:\/\/[^\s<>"')\]]+|mailto:[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/gi;
const TRAILING = /[.,;:!?]+$/;

export function linkify(input: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const match of input.matchAll(URL_RE)) {
    let text = match[0];
    const start = match.index ?? 0;
    const trail = text.match(TRAILING)?.[0] ?? "";
    text = text.slice(0, text.length - trail.length);
    const href = /^www\./i.test(text) ? `https://${text}` : text;
    if (!safeHref(href)) continue;
    if (start > last) out.push({ kind: "text", text: input.slice(last, start) });
    out.push({ kind: "link", text, href });
    last = start + text.length;
  }
  if (last < input.length) out.push({ kind: "text", text: input.slice(last) });
  return out;
}

export function safeHref(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:";
  } catch {
    return false;
  }
}

// HTML email opens its links in a new tab. The iframe it renders in allows
// popups and nothing else — no scripts, no same-origin — so the page stays
// unable to reach HQ.
export function withLinkTargets(html: string): string {
  const base = '<base target="_blank">';
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head([^>]*)>/i, `<head$1>${base}`)
    : `${base}${html}`;
}
