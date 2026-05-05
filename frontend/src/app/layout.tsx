import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hyper Leezus",
  description: "Sports analytics and prediction intelligence platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#06111f] text-slate-100">{children}</body>
    </html>
  );
}
