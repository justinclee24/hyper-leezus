import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "HyperLeezus",
  description: "Sports analytics and prediction intelligence platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#030810] text-slate-100">
        <Nav />
        {children}
      </body>
    </html>
  );
}
