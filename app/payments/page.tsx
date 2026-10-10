"use client";

import React, { useState, useEffect } from "react";
import { CreditCard, CheckCircle2, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/payments");
      const data = await res.json();
      setPayments(data.payments || []);
      setSummary(data.summary || null);
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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-emerald-400" />
          Payments & Cash Collection Ledger
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Record cash collections, UPI QR settlements, bank transfers, and track outstanding receivables.
        </p>
      </div>

      {/* Summary KPI cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Total Cash Collected"
            value={`₹${summary.totalCollected.toLocaleString()}`}
            subtitle={`${payments.length} verified transactions`}
            icon={TrendingUp}
            color="emerald"
          />
          <MetricCard
            title="Gross Order Value"
            value={`₹${summary.totalGrossOrderValue.toLocaleString()}`}
            subtitle={`${summary.paidCount} orders fully paid`}
            icon={CreditCard}
            color="indigo"
          />
          <MetricCard
            title="Outstanding Receivables"
            value={`₹${summary.outstandingBalance.toLocaleString()}`}
            subtitle={`${summary.unpaidCount} unpaid, ${summary.partialCount} partial`}
            icon={AlertTriangle}
            color="rose"
          />
        </div>
      )}

      {/* Payments Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Payment Transaction Ledger</h2>
          <span className="text-xs text-slate-400 font-mono">
            {payments.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Reference / UTR</th>
                <th className="py-3 px-4 text-right">Order Total</th>
                <th className="py-3 px-4 text-right">Amount Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No payment collections recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((pRow) => {
                  const p = pRow.payment;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                        {pRow.orderNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-200">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        {p.reference || "Direct Cash"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        ₹{pRow.orderTotal}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        ₹{p.amount}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
