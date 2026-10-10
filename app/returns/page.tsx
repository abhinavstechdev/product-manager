"use client";

import React, { useState, useEffect } from "react";
import { RotateCcw, AlertTriangle, CheckCircle2, XCircle, ShieldCheck, Plus, X } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export default function ReturnsPage() {
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // New return form
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<"sellable" | "damaged">("sellable");
  const [notes, setNotes] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReturns = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/returns");
      const data = await res.json();
      setReturnsList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const handleApprove = async (returnId: string) => {
    try {
      await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnId, action: "APPROVE", restockSellable: true }),
      });
      loadReturns();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (returnId: string) => {
    try {
      await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnId, action: "REJECT", reason: "Condition rejected by QC" }),
      });
      loadReturns();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason,
          items: [{ productId, quantity: parseInt(quantity, 10), condition }],
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register return");

      setIsRegisterOpen(false);
      setOrderId("");
      setReason("");
      loadReturns();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-400" />
            Returns & Quality Control Inspection
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Quarantine returned items, inspect sellable versus damaged condition, and restore approved inventory.
          </p>
        </div>
        <button
          onClick={() => setIsRegisterOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Register Customer Return
        </button>
      </div>

      {/* QC Rule card */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <span className="font-bold text-white">Quarantine Policy:</span> Returned packages are quarantined upon receipt. Sellable items are atomically returned to available warehouse stock only after inspection approval. Damaged items are logged and written off.
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Return Reason</th>
                <th className="py-3 px-4">QC Status</th>
                <th className="py-3 px-4">Refund Amount</th>
                <th className="py-3 px-4 text-center">QC Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Loading returns...
                  </td>
                </tr>
              ) : returnsList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No returns registered.
                  </td>
                </tr>
              ) : (
                returnsList.map((rRow) => {
                  const ret = rRow.returnRecord;
                  return (
                    <tr key={ret.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(ret.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                        {rRow.orderNumber || ret.orderId}
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        <div>{ret.reason}</div>
                        {ret.notes && (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">{ret.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={ret.status} />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        ₹{ret.refundAmount || "0.00"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {ret.status === "REGISTERED" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleApprove(ret.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
                            >
                              Approve & Restock
                            </button>
                            <button
                              onClick={() => handleReject(ret.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] font-mono">Processed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Register Customer Return</h2>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterReturn} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300">Target Order ID or Number</label>
                <input
                  type="text"
                  placeholder="e.g. ORD-2026-000101"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  required
                  className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Returned Product ID</label>
                <input
                  type="text"
                  placeholder="e.g. prd_noise_cancelling_headphones"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  required
                  className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Returned Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Initial Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as any)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="sellable">Sellable (Eligible for restock)</option>
                    <option value="damaged">Damaged (Quarantined)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Return Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Size mismatch / wrong color requested"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Unopened original box"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  {formLoading ? "Registering..." : "Submit for QC"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
