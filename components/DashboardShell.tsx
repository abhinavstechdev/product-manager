"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { OrderCreateModal } from "./OrderCreateModal";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const pathname = usePathname();

  // If on login or OAuth consent screens, render clean standalone view
  if (pathname?.startsWith("/login") || pathname?.startsWith("/oauth")) {
    return <main className="min-h-screen w-screen bg-slate-950 text-slate-100">{children}</main>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onNewOrder={() => setIsOrderModalOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-950/50">
          {children}
        </main>
      </div>

      <OrderCreateModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onOrderCreated={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
