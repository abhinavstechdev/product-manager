"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBranding } from "./BrandingContext";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  ShoppingCart,
  BoxSelect,
  Truck,
  CreditCard,
  RotateCcw,
  BarChart3,
  Bot,
  Plug,
  Sparkles,
  Settings,
} from "lucide-react";

const navigationItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Inventory Ledger", href: "/inventory", icon: Boxes },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Packing Queue", href: "/packing", icon: BoxSelect },
  { name: "Shipping & Dispatch", href: "/shipping", icon: Truck },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Returns & QC", href: "/returns", icon: RotateCcw },
  { name: "Reports & Analytics", href: "/reports", icon: BarChart3 },
  { name: "Company & Bill Settings", href: "/settings", icon: Settings },
  { name: "AI Activity & Approvals", href: "/ai-activity", icon: Bot, badge: "AI" },
  { name: "ChatGPT MCP Guide", href: "/chatgpt-mcp", icon: Bot },
  { name: "Google Gemini MCP Guide", href: "/gemini-mcp", icon: Sparkles, badge: "NEW", highlight: true },
  { name: "MCP Server Configuration", href: "/mcp-connections", icon: Plug },
];

export function Sidebar() {
  const pathname = usePathname();
  const { branding } = useBranding();

  return (
    <aside className="hidden md:flex w-64 bg-slate-950 border-r border-slate-800/80 flex-col justify-between shrink-0 select-none">
      <div className="flex-1 overflow-y-auto">
        {/* Brand header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800/80 gap-3 sticky top-0 bg-slate-950 z-10">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="w-9 h-9 object-contain rounded-xl bg-slate-900 border border-slate-800 p-1 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0 font-bold text-xs">
              {branding.companyName ? branding.companyName.slice(0, 2).toUpperCase() : "AP"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-100 tracking-tight text-sm flex items-center gap-1.5">
              <span className="truncate max-w-[125px]">{branding.companyName || "Apex Logistics"}</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.5 rounded border border-indigo-500/30 shrink-0">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium truncate">
              Operations Hub
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div className="py-4 px-3 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Operations
          </div>
          {navigationItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-md shadow-indigo-950/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive
                        ? "text-indigo-400"
                        : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {item.badge}
                  </span>
                )}
                {item.highlight && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse"></span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer MCP Live status */}
      <div className="p-4 border-t border-slate-800/80 m-3 bg-slate-900/60 rounded-xl border">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-slate-300">
            MCP Server Active
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 font-mono truncate">
          POST /api/mcp
        </div>
        <div className="mt-2.5 text-[10px] text-indigo-300 flex items-center gap-1 font-medium bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
          <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
          <span>Streamable HTTP Protocol</span>
        </div>
      </div>
    </aside>
  );
}

// Mobile Slide-out Drawer Menu
export function MobileDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { branding } = useBranding();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out drawer panel */}
      <div className="relative w-4/5 max-w-xs bg-slate-950 border-r border-slate-800 flex flex-col justify-between h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.companyName}
                  className="w-8 h-8 object-contain rounded-xl bg-slate-900 border border-slate-800 p-0.5 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-md font-bold text-xs shrink-0">
                  {branding.companyName ? branding.companyName.slice(0, 2).toUpperCase() : "AP"}
                </div>
              )}
              <span className="font-bold text-white text-sm truncate mr-2">{branding.companyName || "Apex Logistics"}</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 -mr-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Items */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navigation
            </div>
            {navigationItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition active:scale-[0.98] ${
                    isActive
                      ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                      : "text-slate-300 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 m-3 rounded-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>MCP Server Online</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            India Timezone: Asia/Kolkata
          </div>
        </div>
      </div>
    </div>
  );
}

// Mobile Bottom Navigation Bar (Phone operators)
export function MobileBottomNav({
  onOpenMenu,
}: {
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();

  const bottomTabs = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Products", href: "/products", icon: Package },
    { name: "Orders", href: "/orders", icon: ShoppingCart },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-2 py-1.5 flex items-center justify-around safe-area-pb shadow-2xl"
    >
      {bottomTabs.map((tab) => {
        const isActive =
          tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] transition ${
              isActive
                ? "text-indigo-400 font-bold"
                : "text-slate-400 hover:text-slate-200 font-medium"
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
            <span className="text-[10px] leading-tight">{tab.name}</span>
          </Link>
        );
      })}

      {/* More / Menu Drawer Trigger */}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] min-h-[44px] text-slate-400 hover:text-slate-200 transition font-medium"
        aria-label="Open full menu"
      >
        <div className="w-5 h-5 flex flex-col justify-center items-center gap-1 mb-0.5">
          <span className="w-4 h-0.5 bg-slate-400 rounded-full" />
          <span className="w-4 h-0.5 bg-slate-400 rounded-full" />
          <span className="w-4 h-0.5 bg-slate-400 rounded-full" />
        </div>
        <span className="text-[10px] leading-tight">More</span>
      </button>
    </nav>
  );
}
