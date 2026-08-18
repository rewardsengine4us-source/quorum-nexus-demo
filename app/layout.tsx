import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quorum Nexus",
  description: "Credit card points optimizer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-base-950 text-slate-50 antialiased">{children}</body>
    </html>
  );
}
