import Link from "next/link";

import { LiveRefresh } from "@/components/hq/live-refresh";
import { NavLinks } from "@/components/hq/nav-links";
import { signOutAction } from "@/lib/actions";

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-6 border-b bg-card px-4 sm:px-6 2xl:px-10">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">
            A
          </span>
          Aroqon HQ
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-4">
          <LiveRefresh />
          <form action={signOutAction}>
            <button className="text-sm text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
