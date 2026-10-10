"use client";

import React, { useState } from "react";
import { X, CreditCard } from "lucide-react";

export function PaymentRecordModal({
  order,
  isOpen,
  onClose,
  onPaymentRecorded,
}: {
  order: { id: string; orderNumber: string; totalAmount: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded: () => void;
}) {
  const [amount, setAmount] = useState(order ? order.totalAmount : "0");
  const [method, setMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          amount: parseFloat(amount),
          paymentMethod: method,
          reference: reference || null,
          notes: notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment recording failed");

      onPaymentRecorded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Record Payment</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Order Number</div>
              <div className="font-mono font-bold text-white text-sm">{order.orderNumber}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Amount</div>
              <div className="font-mono font-bold text-emerald-400 text-base">₹{order.totalAmount}</div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Payment Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
              <option value="Cash">Cash</option>
              <option value="Cash on Delivery">Cash on Delivery (Collected)</option>
              <option value="Bank transfer">NEFT / IMPS / Bank Transfer</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Transaction Reference / UTR</label>
            <input
              type="text"
              placeholder="e.g. UPI/20261010/839210"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Received by store counter"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
            >
              {loading ? "Recording..." : "Confirm Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
