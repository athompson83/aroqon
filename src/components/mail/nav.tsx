"use client";

import type { LucideIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavProps {
  isCollapsed: boolean;
  active: string;
  onSelect: (key: string) => void;
  links: {
    key: string;
    title: string;
    label?: string;
    icon: LucideIcon;
  }[];
}

export function Nav({ links, isCollapsed, active, onSelect }: NavProps) {
  return (
    <div
      data-collapsed={isCollapsed}
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
    >
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link) => {
          const variant = link.key === active ? "default" : "ghost";
          return isCollapsed ? (
            <Tooltip key={link.key} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(link.key)}
                  className={cn(buttonVariants({ variant, size: "icon" }), "h-9 w-9")}
                >
                  <link.icon className="h-4 w-4" />
                  <span className="sr-only">{link.title}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-4">
                {link.title}
                {link.label && <span className="ml-auto text-muted-foreground">{link.label}</span>}
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              key={link.key}
              onClick={() => onSelect(link.key)}
              className={cn(buttonVariants({ variant, size: "sm" }), "justify-start")}
            >
              <link.icon className="mr-2 h-4 w-4" />
              {link.title}
              {link.label && (
                <span className={cn("ml-auto", variant === "default" && "text-primary-foreground")}>
                  {link.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
