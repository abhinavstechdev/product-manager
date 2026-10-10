"use client";

import React, { useState, useEffect } from "react";
import { X, Boxes, PlusCircle, MinusCircle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
}

export function StockAdjustModal({
  isOpen,
  onClose,
  onAdjusted,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdjusted: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"ADD" | "REDUCE">("ADD");
  const [quantity, setQuantity] = useState("5");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"MANUAL_ADJUSTMENT" | "STOCK_RECEIVED" | "DAMAGED_GOODS" | "STOCK_CORRECTION">("STOCK_RECEIVED");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/products")
        .then((r) => r.json())
        .then((d) => setProducts(d.products || []));
    }
  }, [isOpen]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const qty = parseInt(quantity, 10);
    const quantityChange = adjustmentType === "ADD" ? qty : -qty;

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          quantityChange,
          reason,
          type,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust inventory");

      onAdjusted();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Adjust Warehouse Stock</h2>
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

          <div>
            <label className="text-xs font-semibold text-slate-300">Target Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              required
              className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="">-- Choose Product SKU --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name} (Physical: {p.physicalStock}, Reserved: {p.reservedStock})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs grid grid-cols-3 text-center">
              <div>
                <div className="text-slate-400 text-[10px]">Physical</div>
                <div className="text-white font-mono font-bold mt-0.5">{selectedProduct.physicalStock}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Reserved</div>
                <div className="text-amber-400 font-mono font-bold mt-0.5">{selectedProduct.reservedStock}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Available</div>
                <div className="text-emerald-400 font-mono font-bold mt-0.5">{selectedProduct.availableStock}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setAdjustmentType("ADD");
                setType("STOCK_RECEIVED");
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border ${
                adjustmentType === "ADD"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-950 text-slate-400 border-slate-800"
              }`}
            >
              <PlusCircle className="w-4 h-4" /> Stock Intake (+)
            </button>
            <button
              type="button"
              onClick={() => {
                setAdjustmentType("REDUCE");
                setType("MANUAL_ADJUSTMENT");
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border ${
                adjustmentType === "REDUCE"
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : "bg-slate-950 text-slate-400 border-slate-800"
              }`}
            >
              <MinusCircle className="w-4 h-4" /> Reduce Stock (-)
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Quantity</label>
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
            <label className="text-xs font-semibold text-slate-300">Reason (Mandatory for Audit Ledger)</label>
            <input
              type="text"
              placeholder="e.g. New supplier shipment intake or damaged box"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
            >
              {loading ? "Recording..." : "Record Stock Movement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
