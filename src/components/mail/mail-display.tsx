"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { CheckCheck, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { mailBodyAction, replyAction, triageAction } from "@/lib/actions";
import { CATEGORIES, projectFor, type MailItem } from "@/lib/mail-organize";
import type { MailBody } from "@/lib/resend";

interface MailDisplayProps {
  mail: MailItem | null;
}

export function MailDisplay({ mail }: MailDisplayProps) {
  const [body, setBody] = useState<{ id: string; result: MailBody | string } | null>(null);
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!mail) return;
    let live = true;
    mailBodyAction({ id: mail.id, direction: mail.direction }).then((r) => {
      if (live) setBody({ id: mail.id, result: r.ok ? r.data : r.error });
    });
    return () => {
      live = false;
    };
  }, [mail]);

  if (!mail) {
    return <div className="p-8 text-center text-muted-foreground">No message selected</div>;
  }

  const loaded = body?.id === mail.id ? body.result : null;
  // Reply as the address that received it — only ever one of our domains.
  const replyFrom = mail.to.find((a) => projectFor([a])) ?? null;
  const replyTo =
    (typeof loaded === "object" && loaded?.replyTo?.[0]) ||
    (mail.direction === "received" ? mail.from : null);

  function triage(change: { category?: string; handled?: boolean }) {
    if (!mail) return;
    startTransition(async () => {
      const r = await triageAction({
        email_id: mail.id,
        direction: mail.direction,
        category: change.category ?? mail.category,
        priority: mail.priority,
        handled: change.handled ?? mail.handled,
      });
      setNotice(r.ok ? null : r.error);
    });
  }

  function send() {
    if (!mail || !replyFrom || !replyTo) return;
    startTransition(async () => {
      const r = await replyAction({
        from: replyFrom,
        to: replyTo,
        subject: mail.subject,
        text: reply,
        inReplyTo: typeof loaded === "object" ? (loaded?.messageId ?? null) : null,
      });
      if (r.ok) {
        setReply("");
        setNotice("Reply sent.");
        triage({ handled: true });
      } else setNotice(r.error);
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() => triage({ handled: !mail.handled })}
            >
              {mail.handled ? <Undo2 className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
              <span className="sr-only">{mail.handled ? "Mark not handled" : "Mark handled"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{mail.handled ? "Mark not handled" : "Mark handled"}</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          File under
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
            value={mail.category}
            disabled={pending}
            onChange={(e) => triage({ category: e.target.value })}
          >
            {[...new Set([...CATEGORIES, mail.category])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {notice && <span className="ml-auto text-xs text-muted-foreground">{notice}</span>}
      </div>
      <Separator />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-start p-4">
          <div className="grid gap-1 text-sm">
            <div className="font-semibold">{mail.fromName}</div>
            <div className="line-clamp-1 text-xs">{mail.subject}</div>
            <div className="line-clamp-1 text-xs">
              <span className="font-medium">From:</span> {mail.from}
            </div>
            <div className="line-clamp-1 text-xs">
              <span className="font-medium">To:</span> {mail.to.join(", ")}
            </div>
            {mail.action && (
              <div className="text-xs">
                <span className="font-medium">Co-Founder:</span> {mail.action}
              </div>
            )}
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {format(new Date(mail.date), "PPpp")}
          </div>
        </div>
        <Separator />
        <div className="flex-1 overflow-auto p-4 text-sm">
          {loaded === null ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : typeof loaded === "string" ? (
            <p className="text-bad">Could not load this email: {loaded}</p>
          ) : loaded.text ? (
            <div className="whitespace-pre-wrap">{loaded.text}</div>
          ) : loaded.html ? (
            // No scripts, no same-origin: the email cannot reach HQ's cookies.
            <iframe
              title="Email body"
              sandbox=""
              srcDoc={loaded.html}
              className="h-full min-h-[400px] w-full rounded-md border bg-white"
            />
          ) : (
            <p className="text-muted-foreground">This email has no body.</p>
          )}
        </div>
        {mail.direction === "received" && replyFrom && replyTo && (
          <>
            <Separator className="mt-auto" />
            <form
              className="grid gap-4 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Textarea
                className="p-4"
                placeholder={`Reply to ${replyTo} as ${replyFrom}…`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="flex items-center">
                <Button
                  type="submit"
                  size="sm"
                  className="ml-auto"
                  disabled={pending || !reply.trim()}
                >
                  Send
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
