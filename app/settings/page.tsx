"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  Building2,
  Phone,
  Mail,
  MapPin,
  Image,
  Globe,
  Clock,
  FileText,
  Save,
  Check,
  AlertCircle,
  Eye,
  RefreshCw,
  Receipt,
  HelpCircle,
} from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    companyTaxId: "",
    companyLogoUrl: "",
    companyWebsite: "",
    invoicePrefix: "INV",
    invoiceFooterNotes: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (res.ok && data.settings) {
          setForm({
            companyName: data.settings.companyName || "",
            companyAddress: data.settings.companyAddress || "",
            companyPhone: data.settings.companyPhone || "",
            companyEmail: data.settings.companyEmail || "",
            companyTaxId: data.settings.companyTaxId || "",
            companyLogoUrl: data.settings.companyLogoUrl || "",
            companyWebsite: data.settings.companyWebsite || "",
            invoicePrefix: data.settings.invoicePrefix || "INV",
            invoiceFooterNotes: data.settings.invoiceFooterNotes || "",
            timezone: data.settings.timezone || "Asia/Kolkata",
            currency: data.settings.currency || "INR",
          });
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to save settings." });
      } else {
        setMessage({ type: "success", text: "Settings saved successfully! Bills and invoices will now reflect these changes." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs">Loading company and bill configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-indigo-400" />
            Company &amp; Bill Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure business information, bill logo, contact details, tax identifiers, and default Indian time zone for all printed and digital bills.
          </p>
        </div>

        <Link
          href="/orders"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition self-start sm:self-auto"
        >
          <Receipt className="w-3.5 h-3.5 text-indigo-400" />
          <span>View Orders &amp; Bills</span>
        </Link>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            message.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/40 border-rose-500/40 text-rose-200"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Business Identity & Branding */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800/80 pb-3">
            <Building2 className="w-4 h-4" />
            <span>Company Identity &amp; Bill Branding</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Company Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                placeholder="e.g. Apex Logistics & Retail Pvt Ltd"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
              <span className="text-[10px] text-slate-500 block">
                Displayed as primary billing heading on digital and printed invoices.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Website URL
              </label>
              <input
                type="text"
                name="companyWebsite"
                value={form.companyWebsite}
                onChange={handleChange}
                placeholder="https://apexlogistics.in"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
              <span className="text-[10px] text-slate-500 block">
                Included in the digital bill footer.
              </span>
            </div>

            {/* Logo URL with Live Preview */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-slate-200 block flex items-center justify-between">
                <span>Company Logo for Bills</span>
                <span className="text-[10px] font-normal text-slate-400">Direct image URL or transparent PNG</span>
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <input
                  type="text"
                  name="companyLogoUrl"
                  value={form.companyLogoUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/logo.png (leave blank for text brand icon)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition w-full"
                />

                {/* Logo Preview Box */}
                <div className="w-24 h-12 rounded-xl bg-white border border-slate-300 flex items-center justify-center p-1 overflow-hidden shrink-0">
                  {form.companyLogoUrl ? (
                    <img
                      src={form.companyLogoUrl}
                      alt="Logo Preview"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as any).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">No Logo</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Contact Information & Location */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800/80 pb-3">
            <Phone className="w-4 h-4" />
            <span>Contact Details &amp; Physical Address</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Company Phone Number
              </label>
              <input
                type="text"
                name="companyPhone"
                value={form.companyPhone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Billing / Support Email
              </label>
              <input
                type="email"
                name="companyEmail"
                value={form.companyEmail}
                onChange={handleChange}
                placeholder="billing@apexlogistics.in"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Company Address (Appears on Tax Invoice Header)
              </label>
              <textarea
                name="companyAddress"
                rows={2}
                value={form.companyAddress}
                onChange={handleChange}
                placeholder="Plot 42, Electronic City Phase 1, Hosur Road, Bengaluru, Karnataka - 560100, India"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Tax, Time Zone & Regional Preferences */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800/80 pb-3">
            <Clock className="w-4 h-4" />
            <span>Tax Compliance &amp; Time Zone (Default: India)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                name="companyTaxId"
                value={form.companyTaxId}
                onChange={handleChange}
                placeholder="e.g. GSTIN: 29ABCDE1234F1Z5"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
              />
              <span className="text-[10px] text-slate-500 block">
                Printed on bills for Indian GST compliance.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Default Time Zone <span className="text-indigo-400 font-normal">(Default: India)</span>
              </label>
              <select
                name="timezone"
                value={form.timezone}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 transition cursor-pointer"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (India Standard Time - IST +05:30)</option>
                <option value="Asia/Dubai">Asia/Dubai (Gulf Standard Time - GST +04:00)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT +08:00)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
              </select>
              <span className="text-[10px] text-slate-500 block">
                All order dates and bill timestamps are rendered in this zone.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Currency
              </label>
              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 transition cursor-pointer"
              >
                <option value="INR">INR - Indian Rupee (₹)</option>
                <option value="USD">USD - US Dollar ($)</option>
                <option value="EUR">EUR - Euro (€)</option>
                <option value="AED">AED - UAE Dirham (AED)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Bill Terms & Declaration Notes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800/80 pb-3">
            <FileText className="w-4 h-4" />
            <span>Bill Format &amp; Terms and Conditions</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                name="invoicePrefix"
                value={form.invoicePrefix}
                onChange={handleChange}
                placeholder="INV"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono uppercase focus:outline-none focus:border-violet-500 transition"
              />
              <span className="text-[10px] text-slate-500 block">
                e.g. INV-ORD-2026-000001
              </span>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Invoice Footer Declaration &amp; Return Terms
              </label>
              <textarea
                name="invoiceFooterNotes"
                rows={3}
                value={form.invoiceFooterNotes}
                onChange={handleChange}
                placeholder="1. Computer-generated tax invoice. No signature required. 2. Goods once sold can be returned within 7 days. 3. Subject to local jurisdiction."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end pt-2 pb-6">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition cursor-pointer disabled:opacity-60 min-h-[44px]"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Saving Changes..." : "Save Company & Bill Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
