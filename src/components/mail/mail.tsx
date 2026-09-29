"use client";

import * as React from "react";
import {
  AlertCircle,
  BadgeDollarSign,
  Boxes,
  CheckCheck,
  Inbox,
  KeyRound,
  Search,
  Send,
  Shapes,
  Siren,
  Users2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { MailItem } from "@/lib/mail-organize";
import { cn } from "@/lib/utils";
import { MailDisplay } from "./mail-display";
import { MailList } from "./mail-list";
import { Nav } from "./nav";
import { useMail } from "./use-mail";

interface MailProps {
  mails: MailItem[];
  navCollapsedSize: number;
}

const FOLDERS: Record<string, { title: string; filter: (m: MailItem) => boolean }> = {
  inbox: { title: "Inbox", filter: (m) => m.direction === "received" && !m.handled },
  urgent: {
    title: "Needs attention",
    filter: (m) => m.direction === "received" && !m.handled && m.priority === "urgent",
  },
  sent: { title: "Sent", filter: (m) => m.direction === "sent" },
  handled: { title: "Handled", filter: (m) => m.handled },
};

const CATEGORY_ICONS = {
  Alerts: AlertCircle,
  Customers: Users2,
  Billing: BadgeDollarSign,
  Auth: KeyRound,
  Product: Boxes,
  Other: Shapes,
} as const;

export function Mail({ mails, navCollapsedSize }: MailProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [folder, setFolder] = React.useState("inbox");
  const [query, setQuery] = React.useState("");
  const [selected] = useMail();

  const inFolder = mails.filter((m) =>
    folder.startsWith("cat:")
      ? m.direction === "received" && m.category === folder.slice(4)
      : FOLDERS[folder].filter(m),
  );
  const q = query.trim().toLowerCase();
  const shown = q
    ? inFolder.filter((m) =>
        [m.subject, m.from, m.fromName, ...m.to, m.project ?? ""].some((s) =>
          s.toLowerCase().includes(q),
        ),
      )
    : inFolder;
  const count = (f: (m: MailItem) => boolean) => {
    const n = mails.filter(f).length;
    return n ? String(n) : "";
  };
  const title = folder.startsWith("cat:") ? folder.slice(4) : FOLDERS[folder].title;

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup direction="horizontal" className="h-full items-stretch">
        <ResizablePanel
          defaultSize={18}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={14}
          maxSize={22}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className={cn(isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out")}
        >
          <div
            className={cn("flex h-[52px] items-center", isCollapsed ? "justify-center" : "px-4")}
          >
            {isCollapsed ? (
              <Send className="h-4 w-4" />
            ) : (
              <span className="text-sm font-semibold">Resend mail</span>
            )}
          </div>
          <Separator />
          <Nav
            isCollapsed={isCollapsed}
            active={folder}
            onSelect={setFolder}
            links={[
              { key: "inbox", title: "Inbox", label: count(FOLDERS.inbox.filter), icon: Inbox },
              {
                key: "urgent",
                title: "Needs attention",
                label: count(FOLDERS.urgent.filter),
                icon: Siren,
              },
              { key: "sent", title: "Sent", label: count(FOLDERS.sent.filter), icon: Send },
              { key: "handled", title: "Handled", icon: CheckCheck },
            ]}
          />
          <Separator />
          <Nav
            isCollapsed={isCollapsed}
            active={folder}
            onSelect={setFolder}
            links={(Object.keys(CATEGORY_ICONS) as (keyof typeof CATEGORY_ICONS)[]).map((c) => ({
              key: `cat:${c}`,
              title: c,
              label: count((m) => m.direction === "received" && !m.handled && m.category === c),
              icon: CATEGORY_ICONS[c],
            }))}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={36} minSize={28}>
          <Tabs defaultValue="all">
            <div className="flex items-center px-4 py-2">
              <h1 className="text-xl font-bold">{title}</h1>
              <TabsList className="ml-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="urgent">Urgent</TabsTrigger>
              </TabsList>
            </div>
            <Separator />
            <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search subject, sender, project"
                    className="pl-8"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <TabsContent value="all" className="m-0">
              <MailList items={shown} />
            </TabsContent>
            <TabsContent value="urgent" className="m-0">
              <MailList items={shown.filter((m) => m.priority === "urgent")} />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={46} minSize={30}>
          <MailDisplay mail={mails.find((m) => m.id === selected) ?? null} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}
