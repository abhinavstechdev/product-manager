"use client";

import React, { useState, useEffect } from "react";
import { X, Printer, PackageCheck } from "lucide-react";

interface PackingSlipData {
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerPhone?: string;
  shippingAddress: string;
  packingNotes?: string;
  specialInstructions?: string;
  totalQuantity: number;
  items: Array<{
    sku: string;
    productName: string;
    quantity: number;
    barcode?: string;
  }>;
}

export function PackingSlipModal({
  orderId,
  isOpen,
  onClose,
}: {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<PackingSlipData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      setLoading(true);
      fetch(`/api/packing?slip=${orderId}`)
        .then((r) => r.json())
        .then((d) => {
          setData(d);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Warehouse Packing Slip</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-950 text-slate-100 font-sans space-y-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Loading slip details...
            </div>
          ) : data ? (
            <>
              {/* Slip header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
                    Packing Slip
                  </div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">
                    {data.orderNumber}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Date: {new Date(data.orderDate).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs text-indigo-400">Apex Logistics & Retail</div>
                  <div className="text-[11px] text-slate-400">Fulfillment Hub 01</div>
                </div>
              </div>

              {/* Delivery info */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[11px] font-semibold text-slate-400 uppercase">
                  Ship To Recipient
                </div>
                <div className="font-bold text-sm text-white mt-1">{data.customerName}</div>
                {data.customerPhone && (
                  <div className="text-xs text-slate-400 font-mono">{data.customerPhone}</div>
                )}
                <div className="text-xs text-slate-300 mt-1 whitespace-pre-wrap">
                  {data.shippingAddress}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3 text-right">Picked Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">
                          {it.sku}
                        </td>
                        <td className="py-2.5 px-3 text-slate-200">{it.productName}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                          {it.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900/60 border-t border-slate-800 font-bold">
                    <tr>
                      <td colSpan={2} className="py-2 px-3 text-right text-slate-400">
                        Total Items:
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">
                        {data.totalQuantity}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Packing notes */}
              {data.packingNotes && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                  <span className="font-bold">Packing Instructions:</span> {data.packingNotes}
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">Slip not found</div>
          )}
        </div>
      </div>
    </div>
  );
}
