import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aroqon HQ",
  description: "The Co-Founder's dashboard: portfolio, to-dos, analytics and mail.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
