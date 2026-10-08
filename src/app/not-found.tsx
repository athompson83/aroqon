import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Aroqon HQ",
  robots: { index: false, follow: false },
};

// Rendered by Next.js with a real HTTP 404 status for unknown paths hit
// with an authenticated session. Unauthenticated unknown paths get their
// 404 from middleware (HTML or Markdown, depending on Accept).
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h1 className="text-lg font-semibold">404 — page not found</h1>
          <p className="text-sm text-muted-foreground">
            This address does not exist on Aroqon HQ. Aroqon HQ is a private
            operator console; the only public page is the sign-in page.
          </p>
        </div>
        <p className="text-sm">
          <a className="underline" href="/login">
            Go to sign-in
          </a>
        </p>
      </div>
    </div>
  );
}
