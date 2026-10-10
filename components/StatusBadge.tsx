import React from "react";

export function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();

  switch (s) {
    case "NEW":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse"></span>
          New
        </span>
      );
    case "CONFIRMED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5"></span>
          Confirmed
        </span>
      );
    case "PROCESSING":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5 animate-spin"></span>
          Processing
        </span>
      );
    case "PACKED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>
          Packed
        </span>
      );
    case "SHIPPED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5"></span>
          Shipped
        </span>
      );
    case "DELIVERED":
    case "PAID":
    case "APPROVED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
          {status}
        </span>
      );
    case "CANCELLED":
    case "REJECTED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>
          {status}
        </span>
      );
    case "PARTIALLY_PAID":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1.5"></span>
          Partially Paid
        </span>
      );
    case "UNPAID":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mr-1.5"></span>
          Unpaid
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          {status}
        </span>
      );
  }
}
