"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Boxes,
  Package,
  ShoppingCart,
  BoxSelect,
  Truck,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Bot,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { StockAdjustModal } from "@/components/StockAdjustModal";
import { OrderCreateModal } from "@/components/OrderCreateModal";

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [repRes, ordRes, prodRes, confRes] = await Promise.all([
        fetch("/api/reports").then((r) => r.json()),
        fetch("/api/orders").then((r) => r.json()),
        fetch("/api/products?lowStock=true").then((r) => r.json()),
        fetch("/api/confirmations").then((r) => r.json()),
      ]);

      setOverview(repRes.overview || null);
      setRecentOrders((ordRes || []).slice(0, 6));
      setLowStockProducts(prodRes.products || []);
      setPendingConfirmations(confRes || []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveConfirmation = async (id: string) => {
    await fetch("/api/confirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationId: id, action: "APPROVE" }),
    });
    loadData();
  };

  const handleRejectConfirmation = async (id: string) => {
    await fetch("/api/confirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationId: id, action: "REJECT" }),
    });
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
          <div className="text-xs text-slate-400 font-medium">Loading warehouse intelligence...</div>
        </div>
      </div>
    );
  }

  const p = overview?.products || {};
  const o = overview?.orders || {};
  const f = overview?.financials || {};

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>AI Operations & Manual Fulfillment Active</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            Store & Warehouse Control Center
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Live database aggregates for inventory ledger movements, stock reservations, order workflows, and remote MCP assistant operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsStockModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Boxes className="w-4 h-4 text-emerald-400" />
            Adjust Stock
          </button>
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            + Manual Order
          </button>
        </div>
      </div>

      {/* Pending High-Impact AI Confirmations Alert (Section 25) */}
      {pendingConfirmations.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Bot className="w-4 h-4" />
              <span>Pending AI Write Confirmations ({pendingConfirmations.length})</span>
            </div>
            <Link
              href="/ai-activity"
              className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 font-semibold"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-xs text-amber-200/90">
            An authorized AI Assistant has staged high-impact operations that require human confirmation before committing to the database:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingConfirmations.map((conf) => (
              <div
                key={conf.id}
                className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="font-mono text-indigo-400">{conf.toolName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {conf.riskLevel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1 line-clamp-1">
                    {conf.description}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleRejectConfirmation(conf.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveConfirmation(conf.id)}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Physical Stock"
          value={p.physicalStock ?? 0}
          subtitle={`Across ${p.total ?? 0} active products`}
          icon={Boxes}
          color="indigo"
        />
        <MetricCard
          title="Reserved Stock"
          value={p.reservedStock ?? 0}
          subtitle="Held for unfulfilled orders"
          icon={Layers}
          color="amber"
        />
        <MetricCard
          title="Available Stock"
          value={p.availableStock ?? 0}
          subtitle="Physical minus Reserved"
          icon={CheckCircle2}
          color="emerald"
        />
        <MetricCard
          title="Inventory Valuation"
          value={`₹${(p.valuation ?? 0).toLocaleString()}`}
          subtitle="At purchase cost"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Secondary Operational Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Orders to Pack"
          value={o.toPack ?? 0}
          subtitle="Awaiting warehouse packing"
          icon={BoxSelect}
          color="amber"
        />
        <MetricCard
          title="Packed / Ready to Ship"
          value={o.packed ?? 0}
          subtitle="Waiting for courier pickup"
          icon={Truck}
          color="cyan"
        />
        <MetricCard
          title="Dispatched / Shipped"
          value={o.shipped ?? 0}
          subtitle="In transit to customers"
          icon={Package}
          color="indigo"
        />
        <MetricCard
          title="Outstanding Receivables"
          value={`₹${(f.outstandingBalance ?? 0).toLocaleString()}`}
          subtitle={`${o.unpaid ?? 0} unpaid orders`}
          icon={CreditCard}
          color="rose"
        />
      </div>

      {/* Main split: Queues Preview & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders Queue (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-400" />
              Recent Orders
            </h2>
            <Link
              href="/orders"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              View All Orders <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No orders recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                          <Link href={`/orders`}>{ord.orderNumber}</Link>
                        </td>
                        <td className="py-3 px-4 text-slate-200">
                          {ord.customerName || "Walk-in Customer"}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-medium">
                          {ord.source}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={ord.status} />
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={ord.paymentStatus} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          ₹{ord.totalAmount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts & Quick Links (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Low Stock Warnings
            </h2>
            <Link
              href="/inventory"
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
            >
              Ledger
            </Link>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            {lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                All products maintain healthy stock buffers!
              </div>
            ) : (
              lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-bold text-white line-clamp-1">{p.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      SKU: <span className="text-indigo-400">{p.sku}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold font-mono text-rose-400">
                      {p.availableStock} avail
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Threshold: {p.reorderThreshold}
                    </div>
                  </div>
                </div>
              ))
            )}

            <button
              onClick={() => setIsStockModalOpen(true)}
              className="w-full mt-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              + Quick Stock Replenishment
            </button>
          </div>

          {/* Remote MCP Assistant Info Widget */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-950/40 to-slate-900 border border-violet-500/20 shadow-xl space-y-2">
            <div className="flex items-center gap-2 text-violet-400 text-xs font-bold">
              <Bot className="w-4 h-4" />
              <span>AI Assistant Access Ready</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Claude Desktop, Antigravity, and compatible agents can query orders, pack queues, and adjust inventory via Streamable HTTP.
            </p>
            <div className="pt-1">
              <Link
                href="/mcp-connections"
                className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-semibold"
              >
                Setup MCP Connections <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <StockAdjustModal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        onAdjusted={loadData}
      />
      <OrderCreateModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onOrderCreated={loadData}
      />
    </div>
  );
}
