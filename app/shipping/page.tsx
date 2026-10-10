"use client";

import React, { useState, useEffect } from "react";
import { Truck, CheckCircle2, Package, MapPin, Calendar, ExternalLink } from "lucide-react";
import { ShipOrderModal } from "@/components/ShipOrderModal";
import { StatusBadge } from "@/components/StatusBadge";

export default function ShippingPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [selectedShipOrder, setSelectedShipOrder] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shipping");
      const data = await res.json();
      setQueue(data.queue || []);
      setShipments(data.shipments || []);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", text: "Failed to load shipping data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkDelivered = async (orderId: string) => {
    try {
      setDeliveringId(orderId);
      setFeedback(null);
      const res = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "DELIVER" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to mark delivered");
      }
      setFeedback({
        type: "success",
        text: `Order ${data.orderNumber || ""} marked as DELIVERED successfully!`,
      });
      await loadData();
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: "error",
        text: err?.message || "Error marking order as delivered.",
      });
    } finally {
      setDeliveringId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-cyan-400" />
            Shipping Station & Dispatch Logistics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch packed orders with courier partner tracking numbers and verify customer delivery confirmations.
          </p>
        </div>
      </div>

      {/* Status Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-lg transition ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-700/60 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white px-2 py-0.5 text-[11px] rounded bg-slate-800/50 hover:bg-slate-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Packed Orders Awaiting Dispatch */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            Awaiting Courier Pickup ({queue.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queue.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
              All packed packages have been handed over to couriers!
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
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() =>
                      setSelectedShipOrder({ id: ord.id, orderNumber: ord.orderNumber })
                    }
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20"
                  >
                    <Truck className="w-3.5 h-3.5" /> Handover & Ship
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Dispatched Shipments History */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-400" />
          Dispatched Shipments & Waybills ({shipments.length})
        </h2>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Courier Partner</th>
                  <th className="py-3 px-4">AWB / Tracking Number</th>
                  <th className="py-3 px-4">Shipped Date</th>
                  <th className="py-3 px-4">Est. Delivery</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No shipments dispatched yet.
                    </td>
                  </tr>
                ) : (
                  shipments.map((sRow) => {
                    const shp = sRow.shipment;
                    return (
                      <tr key={shp.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                          {sRow.orderNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {shp.courier}
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-400 font-bold">
                          {shp.trackingNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {new Date(shp.shippedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {shp.expectedDeliveryAt
                            ? new Date(shp.expectedDeliveryAt).toLocaleDateString()
                            : "3-5 days"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {sRow.orderStatus === "DELIVERED" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Delivered
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMarkDelivered(shp.orderId)}
                              disabled={deliveringId === shp.orderId}
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition disabled:opacity-50 cursor-pointer"
                            >
                              {deliveringId === shp.orderId ? "Updating..." : "Mark Delivered"}
                            </button>
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
      </div>

      <ShipOrderModal
        order={selectedShipOrder}
        isOpen={!!selectedShipOrder}
        onClose={() => setSelectedShipOrder(null)}
        onOrderShipped={loadData}
      />
    </div>
  );
}
