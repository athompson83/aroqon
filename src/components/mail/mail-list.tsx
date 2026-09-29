import type { ComponentProps } from "react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MailItem } from "@/lib/mail-organize";
import { cn } from "@/lib/utils";
import { useMail } from "./use-mail";

interface MailListProps {
  items: MailItem[];
}

export function MailList({ items }: MailListProps) {
  const [selected, setSelected] = useMail();

  if (!items.length) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>;
  }

  return (
    <ScrollArea className="h-[calc(100vh-11rem)]">
      <div className="flex flex-col gap-2 p-4 pt-0">
        {items.map((item) => (
          <button
            key={item.id}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
              selected === item.id && "bg-muted",
            )}
            onClick={() => setSelected(item.id)}
          >
            <div className="flex w-full flex-col gap-1">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">
                    {item.direction === "sent" ? `To ${item.to[0] ?? ""}` : item.fromName}
                  </div>
                  {!item.handled && item.direction === "received" && item.priority !== "low" && (
                    <span
                      className={cn(
                        "flex h-2 w-2 rounded-full",
                        item.priority === "urgent" ? "bg-bad" : "bg-primary",
                      )}
                    />
                  )}
                </div>
                <div
                  className={cn(
                    "ml-auto text-xs",
                    selected === item.id ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                </div>
              </div>
              <div className="text-xs font-medium">{item.subject}</div>
            </div>
            {item.summary && (
              <div className="line-clamp-2 text-xs text-muted-foreground">{item.summary}</div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={badgeVariant(item.category)}>{item.category}</Badge>
              {item.project && <Badge variant="outline">{item.project}</Badge>}
              {item.deliveryStatus && <Badge variant="secondary">{item.deliveryStatus}</Badge>}
              {item.handled && <Badge variant="outline">handled</Badge>}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function badgeVariant(category: string): ComponentProps<typeof Badge>["variant"] {
  if (category === "Alerts") return "destructive";
  if (category === "Customers") return "default";
  return "secondary";
}
