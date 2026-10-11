"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, MobileDrawer, MobileBottomNav } from "./Sidebar";
import { Header } from "./Header";
import { OrderCreateModal } from "./OrderCreateModal";
import { BrandingProvider } from "./BrandingContext";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // If on login, OAuth consent, or digital bill screens, render clean standalone view
  if (pathname?.startsWith("/login") || pathname?.startsWith("/oauth") || pathname?.startsWith("/bill")) {
    return (
      <BrandingProvider>
        <main className="min-h-screen w-full bg-slate-950 text-slate-100 print:overflow-visible">{children}</main>
      </BrandingProvider>
    );
  }

  return (
    <BrandingProvider>
      <div className="flex h-screen w-full overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Slide-out Drawer */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
        <Header
          onNewOrder={() => setIsOrderModalOpen(true)}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 bg-slate-950/50 pb-24 md:pb-8 w-full max-w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        onOpenMenu={() => setIsMobileMenuOpen(true)}
      />

      <OrderCreateModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onOrderCreated={() => {
          window.location.reload();
        }}
      />
    </div>
    </BrandingProvider>
  );
}
