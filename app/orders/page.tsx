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
  Receipt,
  Printer,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderCreateModal } from "@/components/OrderCreateModal";
import { PackingSlipModal } from "@/components/PackingSlipModal";
import { ShipOrderModal } from "@/components/ShipOrderModal";
import { PaymentRecordModal } from "@/components/PaymentRecordModal";
import { formatDateTimeIST, formatDateIST } from "@/lib/utils/format";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedBillId, setCopiedBillId] = useState<string | null>(null);

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
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
        <div className="relative flex-1 min-w-full sm:min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by order # (ORD-2026-...) or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 sm:py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 sm:py-1.5 text-xs text-white"
          >
            <option value="">All Statuses</option>
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
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 sm:py-1.5 text-xs text-white"
          >
            <option value="">All Payments</option>
            <option value="UNPAID">UNPAID</option>
            <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
            <option value="PAID">PAID</option>
          </select>
        </div>
      </div>

      {/* Mobile Card List (Phones < 768px) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs bg-slate-900 rounded-2xl border border-slate-800">
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs bg-slate-900 rounded-2xl border border-slate-800">
            No orders match current criteria.
          </div>
        ) : (
          orders.map((ord) => (
            <div
              key={ord.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <button
                    onClick={() => handleOpenDetail(ord.id)}
                    className="font-mono font-bold text-sm text-indigo-400 hover:underline text-left block"
                  >
                    {ord.orderNumber}
                  </button>
                  <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                    {formatDateTimeIST(ord.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-base text-white">
                    ₹{ord.totalAmount}
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                    {ord.source}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300 pt-1 border-t border-slate-800/80">
                <div>
                  <div className="font-semibold text-slate-200">{ord.customerName || "Customer"}</div>
                  {ord.customerPhone && (
                    <div className="text-[11px] text-slate-400 font-mono">{ord.customerPhone}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={ord.status} />
                  <StatusBadge status={ord.paymentStatus} />
                </div>
              </div>

              {/* Quick Actions Row */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                <a
                  href={`/bill/${ord.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold hover:bg-indigo-600/30 transition min-h-[40px]"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Bill</span>
                </a>

                <button
                  onClick={() => handleOpenDetail(ord.id)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition min-h-[40px]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Details</span>
                </button>

                <button
                  onClick={() => setSelectedSlipOrder(ord.id)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-800 text-amber-300 text-xs font-semibold hover:bg-slate-700 transition min-h-[40px]"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Slip</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Orders Table (Table view for md: and up) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
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
                        className="hover:underline text-left cursor-pointer block"
                      >
                        {ord.orderNumber}
                      </button>
                      <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">
                        {formatDateTimeIST(ord.createdAt)}
                      </div>
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
                        {/* Digital Tax Invoice & Bill */}
                        <a
                          href={`/bill/${ord.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View Digital Bill & Print Tax Invoice"
                          className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </a>

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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Order Details: {viewOrderDetail.orderNumber}
                </h2>
              </div>
              <button
                onClick={() => setViewOrderDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5 sm:space-y-6 text-xs text-slate-300">
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

              {/* Digital Tax Invoice & Bill Actions Panel */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-950/40 via-slate-950 to-indigo-950/40 rounded-xl border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div>
                    <div className="text-white font-bold text-xs flex items-center gap-1.5">
                      <span>Digital Bill &amp; Tax Invoice</span>
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.5 rounded">
                        IST Verified
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Placed: {formatDateTimeIST(viewOrderDetail.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/bill/${viewOrderDetail.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Digital Bill</span>
                  </a>

                  <a
                    href={`/bill/${viewOrderDetail.id}?print=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Invoice</span>
                  </a>

                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        const url = `${window.location.origin}/bill/${viewOrderDetail.id}`;
                        navigator.clipboard.writeText(url);
                        setCopiedBillId(viewOrderDetail.id);
                        setTimeout(() => setCopiedBillId(null), 2000);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    {copiedBillId === viewOrderDetail.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedBillId === viewOrderDetail.id ? "Copied!" : "Copy URL"}</span>
                  </button>
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
                          {h.actorName} ({h.source}) • {formatDateTimeIST(h.createdAt)}
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
