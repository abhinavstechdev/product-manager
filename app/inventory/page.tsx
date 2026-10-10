"use client";

import React, { useState, useEffect } from "react";
import { Boxes, PlusCircle, ArrowUpDown, Clock, Layers, ShieldAlert, Sparkles } from "lucide-react";
import { StockAdjustModal } from "@/components/StockAdjustModal";

export default function InventoryPage() {
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inventory");
      const data = await res.json();
      setSummary(data.summary);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-indigo-400" />
            Inventory Ledger & Stock Audit
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete transaction ledger tracking physical stock, reservations, dispatches, and quarantine.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" /> Adjust / Intake Stock
        </button>
      </div>

      {/* Formula & Rule Card (Section 10) */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Stock Allocation Formula</div>
            <div className="text-xs font-mono text-indigo-300 mt-0.5">
              Available Stock = Physical Stock - Reserved Stock
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-400 max-w-md">
          Orders atomically reserve stock upon creation. Reservations are released when orders ship or cancel. Direct manual editing without ledger entries is strictly prevented.
        </div>
      </div>

      {/* Stats row */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Physical Stock
            </span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {summary.totalPhysicalStock}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Reserved for Orders
            </span>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {summary.totalReservedStock}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Available for Sale
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {summary.totalAvailableStock}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Valuation (Cost)
            </span>
            <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
              ₹{summary.totalValuation?.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Audit Ledger (Stock Movements)
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Last {transactions.length} events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">SKU / Product</th>
                <th className="py-3 px-4">Movement Type</th>
                <th className="py-3 px-4 text-center">Change Qty</th>
                <th className="py-3 px-4 text-center">Prev ➔ New</th>
                <th className="py-3 px-4">Reason & Notes</th>
                <th className="py-3 px-4">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading ledger records...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No ledger transactions recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map((txRow) => {
                  const tx = txRow.transaction;
                  const prod = txRow.product;
                  const isPositive = tx.changeQty > 0;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-indigo-400 block">
                          {prod?.sku || "SKU"}
                        </span>
                        <span className="text-slate-300 text-[11px] line-clamp-1">
                          {prod?.name || "Product"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300">
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span
                          className={
                            isPositive
                              ? "text-emerald-400"
                              : tx.changeQty < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }
                        >
                          {isPositive ? `+${tx.changeQty}` : tx.changeQty}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-400 text-[11px]">
                        {tx.prevQty} ➔ <span className="font-bold text-white">{tx.newQty}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs">
                        <div className="line-clamp-2">{tx.reason}</div>
                        {tx.orderId && (
                          <span className="text-[10px] text-indigo-400 font-mono block mt-0.5">
                            Linked Order ID: {tx.orderId}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-200 font-medium">{tx.actorName}</span>
                          {tx.actorType === "AI_AGENT" && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-violet-500/20 text-violet-300 font-mono">
                              AI
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StockAdjustModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdjusted={loadData}
      />
    </div>
  );
}
