import { describe, expect, it } from "vitest";
import { linkify, safeHref, withLinkTargets } from "@/lib/linkify";

describe("linkify", () => {
  it("turns URLs into links and leaves the rest as text", () => {
    expect(linkify("See https://example.com/a?b=1 for details.")).toEqual([
      { kind: "text", text: "See " },
      { kind: "link", text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { kind: "text", text: " for details." },
    ]);
  });

  it("drops trailing punctuation from a link", () => {
    const segs = linkify("Go to https://example.com.");
    expect(segs[1]).toEqual({
      kind: "link",
      text: "https://example.com",
      href: "https://example.com",
    });
    expect(segs[2]).toEqual({ kind: "text", text: "." });
  });

  it("links www. and mailto: addresses", () => {
    expect(linkify("www.aroqon.com")[0]).toEqual({
      kind: "link",
      text: "www.aroqon.com",
      href: "https://www.aroqon.com",
    });
    expect(linkify("mailto:a@b.com")[0]).toMatchObject({ kind: "link", href: "mailto:a@b.com" });
  });

  it("never links a javascript: URL", () => {
    expect(linkify("javascript:alert(1)")).toEqual([{ kind: "text", text: "javascript:alert(1)" }]);
    expect(safeHref("javascript:alert(1)")).toBe(false);
  });

  it("returns plain text untouched", () => {
    expect(linkify("no links here")).toEqual([{ kind: "text", text: "no links here" }]);
  });
});

describe("withLinkTargets", () => {
  it("adds a new-tab base to the head, or to the front when there is none", () => {
    expect(withLinkTargets("<html><head><title>x</title></head></html>")).toBe(
      '<html><head><base target="_blank"><title>x</title></head></html>',
    );
    expect(withLinkTargets("<p>hi</p>")).toBe('<base target="_blank"><p>hi</p>');
  });
});
