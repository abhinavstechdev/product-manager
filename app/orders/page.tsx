"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Search,
  Plus,
  BoxSelect,
  Truck,
  CreditCard,
  XCircle,
  FileText,
  Clock,
  Eye,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderCreateModal } from "@/components/OrderCreateModal";
import { PackingSlipModal } from "@/components/PackingSlipModal";
import { ShipOrderModal } from "@/components/ShipOrderModal";
import { PaymentRecordModal } from "@/components/PaymentRecordModal";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSlipOrder, setSelectedSlipOrder] = useState<string | null>(null);
  const [selectedShipOrder, setSelectedShipOrder] = useState<any | null>(null);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<any | null>(null);
  const [viewOrderDetail, setViewOrderDetail] = useState<any | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      if (paymentFilter) q.set("paymentStatus", paymentFilter);
      if (search) q.set("search", search);

      const res = await fetch(`/api/orders?${q.toString()}`);
      const data = await res.json();
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter, paymentFilter, search]);

  const handleQuickStatusChange = async (orderId: string, newStatus: string, note?: string) => {
    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, newStatus, note }),
      });
      loadOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDetail = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders?id=${orderId}`);
      const data = await res.json();
      setViewOrderDetail(data);
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
            <ShoppingCart className="w-6 h-6 text-indigo-400" />
            Manual Order Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create, process, pack, dispatch, and collect payments on phone, WhatsApp, and social commerce orders.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Manual Order
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by order # (ORD-2026-...) or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
        >
          <option value="">All Fulfillment Statuses</option>
          <option value="NEW">NEW</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="PACKED">PACKED</option>
          <option value="SHIPPED">SHIPPED</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="RETURNED">RETURNED</option>
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
        >
          <option value="">All Payment Statuses</option>
          <option value="UNPAID">UNPAID</option>
          <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
          <option value="PAID">PAID</option>
        </select>
      </div>

      {/* Orders Table */}
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
                <th className="py-3 px-4 text-center">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No orders match current criteria.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      <button
                        onClick={() => handleOpenDetail(ord.id)}
                        className="hover:underline text-left cursor-pointer"
                      >
                        {ord.orderNumber}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      <div className="font-medium">{ord.customerName || "Customer"}</div>
                      {ord.customerPhone && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {ord.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-medium">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-[11px]">
                        {ord.source}
                      </span>
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
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View details */}
                        <button
                          onClick={() => handleOpenDetail(ord.id)}
                          title="View Order Details"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Packing Slip */}
                        <button
                          onClick={() => setSelectedSlipOrder(ord.id)}
                          title="Packing Slip"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {/* Mark Packed */}
                        {["CONFIRMED", "PROCESSING"].includes(ord.status) && (
                          <button
                            onClick={() =>
                              handleQuickStatusChange(ord.id, "PACKED", "Packed at warehouse")
                            }
                            title="Mark Packed"
                            className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 font-semibold"
                          >
                            <BoxSelect className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Ship */}
                        {ord.status === "PACKED" && (
                          <button
                            onClick={() =>
                              setSelectedShipOrder({ id: ord.id, orderNumber: ord.orderNumber })
                            }
                            title="Dispatch & Ship"
                            className="p-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 font-semibold"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Payment */}
                        {ord.paymentStatus !== "PAID" && (
                          <button
                            onClick={() =>
                              setSelectedPaymentOrder({
                                id: ord.id,
                                orderNumber: ord.orderNumber,
                                totalAmount: ord.totalAmount,
                              })
                            }
                            title="Record Payment"
                            className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Cancel order (releases reserved stock) */}
                        {["NEW", "CONFIRMED", "PROCESSING", "PACKED"].includes(ord.status) && (
                          <button
                            onClick={() =>
                              handleQuickStatusChange(ord.id, "CANCELLED", "Cancelled by operator")
                            }
                            title="Cancel Order (Releases Stock)"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal / Drawer */}
      {viewOrderDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  Order Details: {viewOrderDetail.orderNumber}
                </h2>
              </div>
              <button
                onClick={() => setViewOrderDetail(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs text-slate-300">
              {/* Status Header */}
              <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400">Fulfillment Status</div>
                  <StatusBadge status={viewOrderDetail.status} />
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-[11px] text-slate-400">Payment Status</div>
                  <StatusBadge status={viewOrderDetail.paymentStatus} />
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-[11px] text-slate-400">Order Total</div>
                  <div className="text-base font-bold font-mono text-emerald-400">
                    ₹{viewOrderDetail.totalAmount}
                  </div>
                </div>
              </div>

              {/* Customer & Shipping */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Customer</div>
                  <div className="text-white font-bold mt-1">
                    {viewOrderDetail.customer?.name}
                  </div>
                  <div className="text-slate-400">{viewOrderDetail.customer?.phone}</div>
                  <div className="text-slate-400">{viewOrderDetail.customer?.email}</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Delivery Address</div>
                  <div className="text-white mt-1 whitespace-pre-wrap">
                    {viewOrderDetail.shippingAddress}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <div className="font-bold text-slate-200 mb-2">Item Breakdown</div>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="p-2.5">Product SKU</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Unit Price</th>
                        <th className="p-2.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {viewOrderDetail.items?.map((it: any) => (
                        <tr key={it.id}>
                          <td className="p-2.5 font-mono text-indigo-400 font-bold">{it.sku}</td>
                          <td className="p-2.5 text-white">{it.productName}</td>
                          <td className="p-2.5 text-center font-mono font-bold">{it.quantity}</td>
                          <td className="p-2.5 text-right font-mono">₹{it.unitPrice}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                            ₹{it.totalPrice}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status History */}
              {viewOrderDetail.history && viewOrderDetail.history.length > 0 && (
                <div>
                  <div className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> Lifecycle Audit Trail
                  </div>
                  <div className="space-y-1.5">
                    {viewOrderDetail.history.map((h: any) => (
                      <div
                        key={h.id}
                        className="p-2 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-300">{h.newStatus}</span>
                          <span className="text-slate-400">— {h.note || "Status updated"}</span>
                        </div>
                        <div className="text-slate-400 font-mono">
                          {h.actorName} ({h.source}) • {new Date(h.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <OrderCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onOrderCreated={loadOrders}
      />
      <PackingSlipModal
        orderId={selectedSlipOrder}
        isOpen={!!selectedSlipOrder}
        onClose={() => setSelectedSlipOrder(null)}
      />
      <ShipOrderModal
        order={selectedShipOrder}
        isOpen={!!selectedShipOrder}
        onClose={() => setSelectedShipOrder(null)}
        onOrderShipped={loadOrders}
      />
      <PaymentRecordModal
        order={selectedPaymentOrder}
        isOpen={!!selectedPaymentOrder}
        onClose={() => setSelectedPaymentOrder(null)}
        onPaymentRecorded={loadOrders}
      />
    </div>
  );
}
