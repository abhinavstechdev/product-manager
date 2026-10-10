"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, Download, TrendingUp, Package, CreditCard, ShoppingBag, FileSpreadsheet } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";

export default function ReportsPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        setReportData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDownloadCsv = (type: "sales" | "inventory") => {
    window.open(`/api/reports?export=${type}`, "_blank");
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 text-xs">
        Compiling business analytics and database metrics...
      </div>
    );
  }

  const s = reportData?.sales || {};
  const o = reportData?.overview || {};
  const best = reportData?.bestSelling || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Executive Reports & Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real database aggregates covering revenue, product sales velocity, and exportable audit records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadCsv("sales")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Orders CSV
          </button>
          <button
            onClick={() => handleDownloadCsv("inventory")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-4 h-4 text-indigo-400" /> Export Stock CSV
          </button>
        </div>
      </div>

      {/* Financial Health KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Gross Order Value"
          value={`₹${(s.totalGrossOrderValue ?? 0).toLocaleString()}`}
          subtitle={`${s.orderCount ?? 0} total placed orders`}
          icon={TrendingUp}
          color="indigo"
        />
        <MetricCard
          title="Discounts Given"
          value={`₹${(s.totalDiscounts ?? 0).toLocaleString()}`}
          subtitle="Promotions & coupon reductions"
          icon={CreditCard}
          color="rose"
        />
        <MetricCard
          title="Shipping Collected"
          value={`₹${(s.totalShippingFees ?? 0).toLocaleString()}`}
          subtitle="Logistics freight surcharge"
          icon={ShoppingBag}
          color="cyan"
        />
        <MetricCard
          title="Delivered Revenue"
          value={`₹${(s.deliveredRevenue ?? 0).toLocaleString()}`}
          subtitle="Fulfilled customer deliveries"
          icon={TrendingUp}
          color="emerald"
        />
      </div>

      {/* Top Selling Products */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-400" />
          Top Selling Products by Volume
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Product Title</th>
                <th className="py-2.5 px-3 text-center">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {best.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No order items recorded yet.
                  </td>
                </tr>
              ) : (
                best.map((b: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">
                      {b.sku}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium">{b.name}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400">
                      {b.totalQty}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                      ₹{b.totalRevenue.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
