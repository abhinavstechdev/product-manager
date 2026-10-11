"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, ShoppingCart, UserPlus } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: string;
  availableStock: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  shippingAddress: string;
}

export function OrderCreateModal({
  isOpen,
  onClose,
  onOrderCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [source, setSource] = useState("WhatsApp");
  const [discount, setDiscount] = useState("0");
  const [shippingFee, setShippingFee] = useState("0");
  const [paymentStatus, setPaymentStatus] = useState<"UNPAID" | "PARTIALLY_PAID" | "PAID">("UNPAID");
  const [paymentMethod, setPaymentMethod] = useState("Cash on Delivery");
  const [notes, setNotes] = useState("");
  const [packingNotes, setPackingNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<
    Array<{ productId: string; quantity: number; unitPrice: number }>
  >([{ productId: "", quantity: 1, unitPrice: 0 }]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/products")
        .then((r) => r.json())
        .then((d) => setProducts(d.products || []));
      fetch("/api/customers")
        .then((r) => r.json())
        .then((d) => setCustomers(d || []));
    }
  }, [isOpen]);

  const handleCustomerChange = (id: string) => {
    setSelectedCustomerId(id);
    const c = customers.find((cust) => cust.id === id);
    if (c) {
      setShippingAddress(c.shippingAddress);
    }
  };

  const addItemRow = () => {
    setItems([...items, { productId: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemProductChange = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    const updated = [...items];
    updated[index].productId = prodId;
    if (prod) {
      updated[index].unitPrice = parseFloat(prod.sellingPrice);
    }
    setItems(updated);
  };

  const handleItemQuantityChange = (index: number, qty: number) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, qty);
    setItems(updated);
  };

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const total = Math.max(0, subtotal - parseFloat(discount || "0") + parseFloat(shippingFee || "0"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validItems = items.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      setError("Please add at least one product to the order.");
      setLoading(false);
      return;
    }

    try {
      const payload: any = {
        source,
        shippingAddress,
        items: validItems,
        orderDiscount: parseFloat(discount || "0"),
        shippingFee: parseFloat(shippingFee || "0"),
        paymentMethod,
        paymentStatus,
        notes: notes || null,
        packingNotes: packingNotes || null,
      };

      if (isNewCustomer) {
        payload.newCustomer = {
          name: newCustName,
          phone: newCustPhone,
          shippingAddress,
        };
      } else {
        payload.customerId = selectedCustomerId;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      onOrderCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm sm:text-base font-bold text-white">Create Manual Order</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Customer Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Customer Information
              </label>
              <button
                type="button"
                onClick={() => setIsNewCustomer(!isNewCustomer)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {isNewCustomer ? "Select Existing Customer" : "+ New Customer"}
              </button>
            </div>

            {isNewCustomer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <input
                  type="text"
                  placeholder="Customer Full Name"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  required
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Phone (+91 98765 43210)"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ) : (
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Choose Existing Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || "No phone"})
                  </option>
                ))}
              </select>
            )}

            <textarea
              placeholder="Shipping Delivery Address"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              required
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Line items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Order Items (Auto-Reserved on Creation)
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800"
                >
                  <select
                    value={it.productId}
                    onChange={(e) => handleItemProductChange(idx, e.target.value)}
                    required
                    className="w-full sm:flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 sm:py-1.5 text-xs text-white"
                  >
                    <option value="">-- Select Product SKU --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name} (Avail: {p.availableStock})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Qty:</span>
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) =>
                          handleItemQuantityChange(idx, parseInt(e.target.value, 10))
                        }
                        className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white text-center font-mono"
                      />
                    </div>

                    <div className="w-20 text-right text-xs font-mono text-emerald-400 font-bold">
                      ₹{(it.quantity * it.unitPrice).toFixed(2)}
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-900 min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing & Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-slate-400">Order Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Instagram">Instagram</option>
                <option value="Phone">Phone</option>
                <option value="Facebook">Facebook</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Website">Website</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="UNPAID">UNPAID</option>
                <option value="PAID">PAID</option>
                <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400">Discount (₹)</label>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">Shipping (₹)</label>
              <input
                type="number"
                min={0}
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Packing Notes (e.g. Wrap fragile)"
              value={packingNotes}
              onChange={(e) => setPackingNotes(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
            />
            <input
              type="text"
              placeholder="Customer / Internal Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
            />
          </div>

          {/* Order Total Preview & Buttons */}
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-[11px] text-slate-400">
                Subtotal: ₹{subtotal.toFixed(2)}
              </div>
              <div className="text-base font-bold text-white font-mono">
                Total Amount: <span className="text-emerald-400">₹{total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white order-2 sm:order-1 text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 order-1 sm:order-2 text-center cursor-pointer min-h-[42px]"
              >
                {loading ? "Reserving Stock & Creating..." : "Confirm & Create Order"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
