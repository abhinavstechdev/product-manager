import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DashboardShell } from "@/components/DashboardShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Apex Logistics | AI Inventory & Order Management Platform",
  description:
    "Unified multi-tenant Inventory, Product, Customer, and Manual Order Management platform with remote Model Context Protocol (MCP) server integration.",
};

import { Suspense } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased overflow-hidden">
        <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100" />}>
          <DashboardShell>{children}</DashboardShell>
        </Suspense>
      </body>
    </html>
  );
}
