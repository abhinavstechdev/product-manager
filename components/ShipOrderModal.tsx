"use client";

import React, { useState } from "react";
import { X, Truck, AlertTriangle } from "lucide-react";

export function ShipOrderModal({
  order,
  isOpen,
  onClose,
  onOrderShipped,
}: {
  order: { id: string; orderNumber: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderShipped: () => void;
}) {
  const [courier, setCourier] = useState("Delhivery");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [expectedDays, setExpectedDays] = useState("3");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          courier,
          trackingNumber,
          expectedDeliveryDays: parseInt(expectedDays, 10),
          notes: notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark order shipped");

      onOrderShipped();
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
            <Truck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Dispatch & Ship Order</h2>
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

          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              Marking <span className="font-mono font-bold">{order.orderNumber}</span> as Shipped will atomically deduct physical warehouse stock and release reservations.
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Courier Partner</label>
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="Delhivery">Delhivery Surface / Express</option>
              <option value="Blue Dart Express">Blue Dart Express</option>
              <option value="DTDC">DTDC Courier</option>
              <option value="India Post Speed Post">India Post Speed Post</option>
              <option value="Shadowfax">Shadowfax</option>
              <option value="Ekart">Ekart Logistics</option>
              <option value="Self Delivery / Local Driver">Self Delivery / Local Driver</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">AWB / Courier Tracking Number</label>
            <input
              type="text"
              placeholder="e.g. DEL-829104928"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              required
              className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Estimated Delivery (Days)</label>
            <input
              type="number"
              min={1}
              value={expectedDays}
              onChange={(e) => setExpectedDays(e.target.value)}
              className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Dispatch Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Handed over to morning pickup driver"
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50"
            >
              {loading ? "Dispatching..." : "Confirm & Ship Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
