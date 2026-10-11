"use client";

import React, { useState, useEffect } from "react";
import { Building2, ShieldCheck, Bell, Sparkles, LogOut, Menu } from "lucide-react";

export function Header({
  onNewOrder,
  onNewProduct,
  onMenuClick,
}: {
  onNewOrder?: () => void;
  onNewProduct?: () => void;
  onMenuClick?: () => void;
}) {
  const [user, setUser] = useState<{
    name: string;
    username?: string;
    email: string;
    role: string;
  }>({
    name: "seveton",
    username: "seveton",
    email: "seveton@apexlogistics.com",
    role: "OWNER",
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/login";
  };

  const displayName = user.username || user.name || "seveton";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 flex items-center justify-between z-10 sticky top-0">
      {/* Workspace Switcher & Context */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 transition min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
          >
            <Menu className="w-5 h-5 text-indigo-400" />
          </button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 border border-slate-800 px-2.5 sm:px-3 py-1.5 rounded-xl">
          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px] sm:max-w-none">
            Apex Logistics
          </span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono shrink-0">
            ₹ INR
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Role:</span>
          <span className="font-semibold text-slate-200">{user.role || "OWNER"}</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {onNewProduct && (
          <button
            onClick={onNewProduct}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl transition"
          >
            + Add Product
          </button>
        )}

        {onNewOrder && (
          <button
            onClick={onNewOrder}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/20 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            + New Order
          </button>
        )}

        {/* User avatar & Logout */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-slate-800">
            {initials}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-slate-200 leading-none">
              {displayName}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-none truncate max-w-[140px]">
              {user.email}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer ml-1"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
