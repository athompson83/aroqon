import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { safeHref } from "@/lib/linkify";
import { cn } from "@/lib/utils";

// Reports from the Co-Founder, Codex and the monitors are GitHub-flavoured
// Markdown: headings, tables, task lists and links. Raw HTML in them is never
// rendered, and a link survives only if it is http(s) or mailto.

const components: Components = {
  h1: ({ children }) => <h2 className="mt-4 text-base font-semibold first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-4 text-sm font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => (
    <h4 className="mt-3 text-sm font-semibold text-muted-foreground first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="my-2">{children}</p>,
  ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>,
  a: ({ href, children }) =>
    href && safeHref(href) ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  code: ({ children }) => <code className="rounded bg-muted px-1 text-[0.9em]">{children}</code>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-md border">
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t px-3 py-2 align-top">{children}</td>,
  hr: () => <hr className="my-4" />,
};

export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn("text-sm leading-relaxed break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {source}
      </ReactMarkdown>
    </div>
  );
}
