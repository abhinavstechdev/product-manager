"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { name: "AI Activity & Approvals", href: "/ai-activity", icon: Bot, badge: "AI" },
  { name: "MCP Connections", href: "/mcp-connections", icon: Plug, highlight: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-100 tracking-tight text-sm flex items-center gap-1.5">
              Apex Logistics
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.5 rounded border border-indigo-500/30">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              AI & Manual Inventory
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
