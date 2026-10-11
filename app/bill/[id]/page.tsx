"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Printer,
  Copy,
  Check,
  Share2,
  Download,
  ArrowLeft,
  Receipt,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  FileCheck2,
  AlertCircle,
  Clock,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import {
  formatDateTimeIST,
  formatDateIST,
  formatCurrencyINR,
  amountToWordsINR,
} from "@/lib/utils/format";

function BillContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.id as string;

  const [billData, setBillData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    async function fetchBill() {
      if (!orderId) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/bill/${orderId}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Failed to load bill data");
        } else {
          setBillData(data);
          // If ?print=true parameter was provided, trigger auto print
          if (searchParams.get("print") === "true") {
            setTimeout(() => {
              window.print();
            }, 600);
          }
        }
      } catch (err: any) {
        setError(err.message || "Network error loading bill");
      } finally {
        setLoading(false);
      }
    }
    fetchBill();
  }, [orderId, searchParams]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href.split("?")[0]);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!billData) return;
    const currentUrl = typeof window !== "undefined" ? window.location.href.split("?")[0] : "";
    const text = `Hello ${billData.customer.name}, here is your digital tax invoice for order ${billData.order.orderNumber} (Total: ${formatCurrencyINR(billData.order.totalAmount)}): ${currentUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-3">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium">Generating digital tax invoice...</p>
      </div>
    );
  }

  if (error || !billData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h1 className="text-xl font-bold text-white">Bill Not Found</h1>
        <p className="text-xs text-slate-400 max-w-sm">{error || "The requested invoice could not be located."}</p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Orders
        </Link>
      </div>
    );
  }

  const { order, customer, items, company, invoiceNumber, amountInWords } = billData;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-900 pb-16 print:overflow-visible print:bg-white print:p-0 print:pb-0">
      {/* Action Bar (Hidden in Print) */}
      <div className="print:hidden sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
            <Link
              href="/orders"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white font-medium transition py-1.5 px-2 -ml-2 rounded-lg hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
            <span className="text-slate-700 hidden sm:inline">|</span>
            <span className="text-xs font-bold font-mono text-indigo-400 truncate">
              {invoiceNumber}
            </span>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-mono px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
              IST (Asia/Kolkata)
            </span>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer min-h-[40px]"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="truncate">{copiedUrl ? "Copied!" : "Copy URL"}</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition cursor-pointer min-h-[40px]"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="truncate">WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition cursor-pointer min-h-[40px]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="truncate">Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main A4 Invoice Container */}
      <div className="max-w-4xl mx-auto mt-3 sm:mt-6 print:mt-0 print:max-w-none print:w-full px-2.5 sm:px-4 print:px-0">
        <div className="bg-white rounded-xl sm:rounded-2xl print:rounded-none shadow-2xl print:shadow-none border border-slate-200 print:border-none p-4 sm:p-8 md:p-12 space-y-6 sm:space-y-8 text-slate-800">
          {/* Header Section: Company Profile & Tax Invoice Badge */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-5 sm:gap-6 border-b border-slate-200 pb-5 sm:pb-6">
            <div className="space-y-2 max-w-md w-full">
              <div className="flex items-center gap-3">
                {company.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="h-10 sm:h-12 md:h-14 w-auto max-w-[160px] sm:max-w-[200px] object-contain rounded"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white shadow-md font-bold text-base sm:text-lg">
                    {company.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                    {company.name}
                  </h1>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 block">
                    Retail &amp; Order Fulfillment
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1 pt-1 leading-relaxed">
                <p className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{company.address}</span>
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 pt-0.5">
                  {company.phone && (
                    <a href={`tel:${company.phone}`} className="flex items-center gap-1 hover:text-indigo-600">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {company.phone}
                    </a>
                  )}
                  {company.email && (
                    <a href={`mailto:${company.email}`} className="flex items-center gap-1 hover:text-indigo-600">
                      <Mail className="w-3 h-3 text-slate-400" />
                      {company.email}
                    </a>
                  )}
                </div>
                {company.taxId && (
                  <p className="font-mono font-bold text-slate-800 text-[11px] pt-0.5">
                    {company.taxId}
                  </p>
                )}
              </div>
            </div>

            {/* Invoice Meta Box */}
            <div className="sm:text-right space-y-2 w-full sm:w-auto min-w-[200px] bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-none border-slate-200">
              <div className="inline-block sm:text-right">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded border border-indigo-200">
                  Tax Invoice / Bill of Supply
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Original for Recipient
                </span>
              </div>

              <div className="space-y-1 text-xs pt-1">
                <div className="flex justify-between sm:justify-end gap-2">
                  <span className="text-slate-500">Invoice No:</span>
                  <span className="font-mono font-bold text-slate-900">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between sm:justify-end gap-2">
                  <span className="text-slate-500">Order Ref:</span>
                  <span className="font-mono text-slate-700">{order.orderNumber}</span>
                </div>
                <div className="flex justify-between sm:justify-end gap-2">
                  <span className="text-slate-500">Date &amp; Time:</span>
                  <span className="font-medium text-slate-900">
                    {formatDateTimeIST(order.createdAt, company.timezone)}
                  </span>
                </div>
                <div className="flex justify-between sm:justify-end gap-2">
                  <span className="text-slate-500">Payment Status:</span>
                  <span
                    className={`font-bold uppercase text-[11px] px-2 py-0.5 rounded ${
                      order.paymentStatus === "PAID"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between sm:justify-end gap-2">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="font-medium text-slate-800">{order.paymentMethod || "Cash on Delivery"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To / Customer & Shipping Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50/80 p-4 sm:p-5 rounded-xl border border-slate-200/80 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Billed To (Customer Details):
              </span>
              <p className="font-bold text-slate-900 text-sm">{customer.name}</p>
              {customer.phone && customer.phone !== "—" && (
                <p className="text-slate-600 flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <a href={`tel:${customer.phone}`} className="hover:text-indigo-600">{customer.phone}</a>
                </p>
              )}
              {customer.email && customer.email !== "—" && (
                <p className="text-slate-600 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <a href={`mailto:${customer.email}`} className="hover:text-indigo-600">{customer.email}</a>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Shipping &amp; Delivery Address:
              </span>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                {customer.address || order.shippingAddress || "Walk-in / Direct Fulfillment"}
              </p>
              <div className="pt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
                <span>Order Channel:</span>
                <span className="font-semibold text-slate-800">{order.source || "Direct Store"}</span>
              </div>
            </div>
          </div>

          {/* Mobile Card View for Line Items (Shown on Phone, Hidden on Desktop & Print) */}
          <div className="block sm:hidden print:hidden space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5">
              Order Items ({items.length})
            </div>
            {items.map((it: any, idx: number) => (
              <div
                key={it.id || idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-slate-900 leading-snug">
                    <span className="text-slate-400 mr-1.5">#{idx + 1}</span>
                    {it.productName}
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-sm shrink-0">
                    ₹{parseFloat(it.totalPrice).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span className="font-mono">SKU: {it.sku}</span>
                  <span>
                    ₹{parseFloat(it.unitPrice).toFixed(2)} × {it.quantity}
                  </span>
                </div>
                {parseFloat(it.discount || 0) > 0 && (
                  <div className="text-[10px] text-emerald-600 font-medium">
                    Discount applied: -₹{parseFloat(it.discount).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Line Items Table (Shown on Desktop and in Print Mode) */}
          <div className="hidden sm:block print:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800 text-[11px] font-bold text-slate-900 uppercase">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description &amp; SKU</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Discount</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it: any, idx: number) => (
                  <tr key={it.id || idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 text-center font-mono text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{it.productName}</div>
                      <div className="font-mono text-[10px] text-slate-500">SKU: {it.sku}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      ₹{parseFloat(it.unitPrice).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                      {it.quantity}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">
                      {parseFloat(it.discount || 0) > 0 ? `₹${parseFloat(it.discount).toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{parseFloat(it.totalPrice).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculations & Total Summary Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2 border-t border-slate-200">
            {/* Amount in Words */}
            <div className="space-y-2 max-w-sm text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Amount in Words (INR):
                </span>
                <p className="font-bold text-slate-900 italic mt-0.5">
                  {amountInWords}
                </p>
              </div>

              {order.notes && (
                <div className="pt-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-bold block text-slate-700">Order Remarks:</span>
                  {order.notes}
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹{parseFloat(order.subtotal || 0).toFixed(2)}
                </span>
              </div>

              {parseFloat(order.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Order Discount:</span>
                  <span className="font-mono font-semibold">
                    -₹{parseFloat(order.discount).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Shipping &amp; Handling:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {parseFloat(order.shippingFee || 0) > 0
                    ? `₹${parseFloat(order.shippingFee).toFixed(2)}`
                    : "FREE (₹0.00)"}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-900">
                <span>Total Amount:</span>
                <span className="font-mono text-base text-indigo-900">
                  ₹{parseFloat(order.totalAmount || 0).toFixed(2)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-100 text-center text-[11px] text-slate-600 mt-2 font-medium">
                {order.paymentStatus === "PAID" ? (
                  <span className="text-emerald-700 font-bold">
                    ✓ Total Amount Received in Full
                  </span>
                ) : (
                  <span className="text-amber-800 font-bold">
                    Payment Pending: ₹{parseFloat(order.totalAmount || 0).toFixed(2)} Due on Delivery
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Terms & Conditions / Footer Notes */}
          <div className="border-t border-slate-200 pt-6 space-y-2 text-[10px] text-slate-500 leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-slate-700 block">
              Terms &amp; Conditions / Billing Declaration:
            </span>
            <p className="whitespace-pre-line text-slate-600">
              {company.footerNotes}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-[9px] text-slate-400">
              <span>{company.name} Platform • Computer-generated digital invoice • Verified IST</span>
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {company.website}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-400">
          <Receipt className="w-10 h-10 animate-pulse text-indigo-400 mb-3" />
          <p>Loading tax invoice...</p>
        </div>
      }
    >
      <BillContent />
    </React.Suspense>
  );
}
