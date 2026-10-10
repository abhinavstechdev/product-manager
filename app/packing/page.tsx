"use client";

import React, { useState, useEffect } from "react";
import { BoxSelect, Printer, CheckCircle2, Clock, PackageCheck, AlertCircle } from "lucide-react";
import { PackingSlipModal } from "@/components/PackingSlipModal";
import { StatusBadge } from "@/components/StatusBadge";

export default function PackingPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlipOrder, setSelectedSlipOrder] = useState<string | null>(null);
  const [packingNotesMap, setPackingNotesMap] = useState<Record<string, string>>({});

  const loadQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/packing");
      const data = await res.json();
      setQueue(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleMarkPacked = async (orderId: string) => {
    try {
      const packingNotes = packingNotesMap[orderId] || undefined;
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, packingNotes }),
      });
      if (!res.ok) throw new Error("Failed to mark packed");
      loadQueue();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BoxSelect className="w-6 h-6 text-amber-400" />
            Packing Station & Pick Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Warehouse orders awaiting picking, bubble-wrapping, and packing slip attachment.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold font-mono">
          {queue.length} Orders in Queue
        </div>
      </div>

      {/* Queue Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-xs">
            Loading packing queue...
          </div>
        ) : queue.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            Packing queue is clear! All confirmed orders are packed.
          </div>
        ) : (
          queue.map((ord) => (
            <div
              key={ord.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition shadow-xl space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-indigo-400">
                    {ord.orderNumber}
                  </span>
                  <StatusBadge status={ord.status} />
                </div>

                <div className="mt-3 space-y-1">
                  <div className="text-xs font-bold text-white">{ord.customerName}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-2">
                    {ord.shippingAddress}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Order Date: {new Date(ord.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {ord.packingNotes && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                    <span className="font-bold">Instructions:</span> {ord.packingNotes}
                  </div>
                )}

                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Add packing note (e.g. double bubble)"
                    value={packingNotesMap[ord.id] || ""}
                    onChange={(e) =>
                      setPackingNotesMap({ ...packingNotesMap, [ord.id]: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedSlipOrder(ord.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" /> Packing Slip
                </button>
                <button
                  onClick={() => handleMarkPacked(ord.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20"
                >
                  <PackageCheck className="w-3.5 h-3.5" /> Mark Packed
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <PackingSlipModal
        orderId={selectedSlipOrder}
        isOpen={!!selectedSlipOrder}
        onClose={() => setSelectedSlipOrder(null)}
      />
    </div>
  );
}
