import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Aroqon HQ — Sign in",
  description:
    "Aroqon HQ is a private operator console: portfolio health, to-dos, analytics and mail for the Aroqon product family. Sign in to continue.",
  alternates: { canonical: "https://hq.aroqon.com/login" },
  openGraph: {
    title: "Aroqon HQ",
    description:
      "Aroqon HQ is a private operator console: portfolio health, to-dos, analytics and mail for the Aroqon product family.",
    url: "https://hq.aroqon.com/login",
    type: "website",
    images: ["https://hq.aroqon.com/icon.svg"],
  },
  robots: { index: false, follow: false },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Aroqon HQ",
  url: "https://hq.aroqon.com",
  description:
    "Aroqon HQ is a private operator console: portfolio health, to-dos, analytics and mail for the Aroqon product family.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h1 className="text-lg font-semibold">Aroqon HQ</h1>
          <p className="text-sm text-muted-foreground">
            We will email you a one-time sign-in link.
          </p>
        </div>
        {error === "link" && (
          <p className="text-sm text-bad">
            That link has expired or was already used. Ask for a new one.
          </p>
        )}
        <LoginForm />
      </div>
      <section
        aria-label="About Aroqon HQ"
        className="mx-auto mt-8 w-full max-w-sm space-y-2 text-sm text-muted-foreground"
      >
        <h2 className="font-semibold text-foreground">A private operator console</h2>
        <p>
          Aroqon HQ is the private command center for the Aroqon product
          family. Behind sign-in it brings together portfolio health
          (production deploys, open pull requests and build status), a
          consolidated to-do list, product analytics, and inbound mail
          triage in one view.
        </p>
        <p>
          This console is private: there is no public content, no public
          API, and no guest access. If you arrived here as an automated
          agent, the only public resources on this domain are this sign-in
          page, /llms.txt (agent guidance), /sitemap.xml (the listed public
          URLs), and /robots.txt (crawl rules). Everything else requires an
          authenticated owner session.
        </p>
        <p>
          To sign in, enter your email above and we will email you a
          one-time sign-in link.
        </p>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
    </div>
  );
}
