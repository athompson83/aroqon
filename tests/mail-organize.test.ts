import { describe, expect, it } from "vitest";
import {
  classify,
  displayName,
  mailStats,
  organize,
  projectFor,
  type RawMail,
} from "@/lib/mail-organize";
import type { Triage } from "@/lib/hq-types";

const mail = (over: Partial<RawMail>): RawMail => ({
  id: "1",
  direction: "received",
  from: "someone@gmail.com",
  to: ["hello@riseswfl.com"],
  subject: "Hello",
  created_at: "2026-09-27T10:00:00Z",
  ...over,
});

describe("classify", () => {
  it("files a failing backup alert as urgent", () => {
    expect(
      classify(
        mail({
          from: "test@mail.proviciency.com",
          to: ["alerts@mail.proviciency.com"],
          subject: "[ProficiencyAI backup] backup-failure",
        }),
      ),
    ).toEqual({ category: "Alerts", priority: "urgent" });
  });

  it("files a password reset as low-priority auth", () => {
    expect(
      classify(mail({ from: "no-reply@captivate.axtevi.com", subject: "Reset your password" })),
    ).toEqual({ category: "Auth", priority: "low" });
  });

  it("treats a person writing in from outside as a customer", () => {
    expect(classify(mail({ subject: "Question about pricing plans" }))).toEqual({
      category: "Customers",
      priority: "urgent",
    });
  });

  it("files billing mail as billing", () => {
    expect(
      classify(mail({ from: "receipts@stripe.com", subject: "Your receipt #123" })).category,
    ).toBe("Billing");
  });
});

describe("projectFor", () => {
  it("maps our domains to projects, most specific first", () => {
    expect(projectFor(["no-reply@captivate.axtevi.com"])).toBe("captivate");
    expect(projectFor(["Alerts <alerts@mail.proviciency.com>"])).toBe("proficiencyai");
    expect(projectFor(["x@riseswfl.com"])).toBe("rise");
    expect(projectFor(["x@gmail.com"])).toBeNull();
    // A suffix match must be on a label boundary.
    expect(projectFor(["x@notriseswfl.com"])).toBeNull();
  });
});

describe("organize", () => {
  it("lets a triage row override the rules", () => {
    const triage: Triage = {
      email_id: "1",
      direction: "received",
      category: "Billing",
      priority: "low",
      summary: "Vendor invoice",
      action: null,
      task_id: null,
      handled: true,
      updated_at: "2026-09-27T10:00:00Z",
    };
    const [item] = organize([mail({ subject: "Question about pricing" })], [triage]);
    expect(item).toMatchObject({
      category: "Billing",
      priority: "low",
      handled: true,
      triaged: true,
    });
  });

  it("sorts newest first and counts what needs attention", () => {
    const items = organize(
      [
        mail({ id: "a", created_at: "2026-09-01T00:00:00Z" }),
        mail({ id: "b", created_at: "2026-09-02T00:00:00Z", subject: "Reset your password" }),
        mail({
          id: "c",
          direction: "sent",
          from: "hi@riseswfl.com",
          to: ["x@y.com"],
          last_event: "bounced",
        }),
      ],
      [],
    );
    // c was created at the fixture default (Sept 27), newest of the three.
    expect(items.map((i) => i.id)).toEqual(["c", "b", "a"]);
    const stats = mailStats(items);
    expect(stats).toMatchObject({
      received: 2,
      sent: 1,
      needsAttention: 1,
      urgent: 1,
      deliveryProblems: 1,
    });
  });
});

describe("displayName", () => {
  it("reads the friendly name when there is one", () => {
    expect(displayName('"Jane Doe" <jane@x.com>')).toBe("Jane Doe");
    expect(displayName("jane@x.com")).toBe("jane");
  });
});
