"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Upload,
  Link as LinkIcon,
  Trash2,
  Camera,
  Sparkles,
  Crop,
  Maximize2,
  Plug,
  KeyRound,
  Copy,
  ExternalLink,
  XCircle,
  Percent,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import { useBranding } from "@/components/BrandingContext";

export default function SettingsPage() {
  const { updateBranding } = useBranding();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedDevToken, setCopiedDevToken] = useState(false);

  interface LogoMeta {
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    aspectRatio: string;
    preset: "auto" | "banner" | "square" | "original";
    trimmed: boolean;
  }

  const [logoInputMode, setLogoInputMode] = useState<"upload" | "url">("upload");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [rawImageSource, setRawImageSource] = useState<string>("");
  const [logoPreset, setLogoPreset] = useState<"auto" | "banner" | "square" | "original">("auto");
  const [autoTrimMargins, setAutoTrimMargins] = useState<boolean>(true);
  const [logoMeta, setLogoMeta] = useState<LogoMeta | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    cancellationDeductionType: "PERCENTAGE",
    cancellationDeductionValue: "5.00",
    cancellationRestockPolicy: "RELEASE_TO_AVAILABLE",
    cancellationNotice:
      "A cancellation deduction fee applies to cancelled orders as per company policy. The remaining net amount is credited/refunded to original payment method within 3-5 business days.",
  });

  // Intelligent Canvas Dimension Auto-Adjuster Engine
  const autoAdjustLogo = (
    imageSrc: string,
    preset: "auto" | "banner" | "square" | "original" = logoPreset,
    trim: boolean = autoTrimMargins
  ) => {
    if (!imageSrc) return;
    setIsProcessingLogo(true);

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      if (!origW || !origH) {
        setIsProcessingLogo(false);
        return;
      }

      let srcX = 0;
      let srcY = 0;
      let srcW = origW;
      let srcH = origH;
      let trimmed = false;

      // 1. Auto-detect & crop surrounding blank/transparent padding
      if (trim) {
        try {
          const scanCanvas = document.createElement("canvas");
          scanCanvas.width = origW;
          scanCanvas.height = origH;
          const sCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
          if (sCtx) {
            sCtx.drawImage(img, 0, 0);
            const imgData = sCtx.getImageData(0, 0, origW, origH);
            const data = imgData.data;

            // Check corner pixels for white/light background
            const cornerIndices = [
              0,
              (origW - 1) * 4,
              ((origH - 1) * origW) * 4,
              (origH * origW - 1) * 4,
            ];
            let lightCornerCount = 0;
            for (const idx of cornerIndices) {
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];
              if (a > 200 && r > 235 && g > 235 && b > 235) {
                lightCornerCount++;
              }
            }
            const isLightBg = lightCornerCount >= 2;

            let minX = origW;
            let minY = origH;
            let maxX = 0;
            let maxY = 0;
            let foundContent = false;

            const step = origW > 1000 || origH > 1000 ? 2 : 1;
            for (let y = 0; y < origH; y += step) {
              for (let x = 0; x < origW; x += step) {
                const idx = (y * origW + x) * 4;
                const a = data[idx + 3];
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                let isContent = false;
                if (a < 15) {
                  isContent = false;
                } else if (isLightBg) {
                  isContent = !(r > 238 && g > 238 && b > 238);
                } else {
                  isContent = a >= 25;
                }

                if (isContent) {
                  foundContent = true;
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }

            if (foundContent && maxX > minX && maxY > minY) {
              const padX = Math.max(4, Math.round((maxX - minX) * 0.04));
              const padY = Math.max(4, Math.round((maxY - minY) * 0.04));
              srcX = Math.max(0, minX - padX);
              srcY = Math.max(0, minY - padY);
              srcW = Math.min(origW - srcX, maxX - minX + padX * 2);
              srcH = Math.min(origH - srcY, maxY - minY + padY * 2);

              if (srcW < origW * 0.95 || srcH < origH * 0.95) {
                trimmed = true;
              }
            }
          }
        } catch (err) {
          console.warn("Canvas trim skipped:", err);
        }
      }

      // 2. Intelligent Auto-Adjust Dimensions for Invoices
      const aspect = srcW / srcH;
      let targetW: number;
      let targetH: number;

      if (preset === "square") {
        targetW = 260;
        targetH = 260;
      } else if (preset === "banner") {
        targetW = 450;
        targetH = 150;
      } else if (preset === "original") {
        const maxW = 450;
        const maxH = 180;
        const scale = Math.min(maxW / srcW, maxH / srcH, 1);
        targetW = Math.round(srcW * scale);
        targetH = Math.round(srcH * scale);
      } else {
        // "auto": dynamically pick the ideal invoice dimension
        if (aspect >= 2.2) {
          targetW = 440;
          targetH = Math.min(150, Math.round(440 / aspect));
        } else if (aspect >= 1.25) {
          targetW = 380;
          targetH = Math.min(180, Math.round(380 / aspect));
        } else if (aspect >= 0.8) {
          targetW = 240;
          targetH = Math.round(240 / aspect);
        } else {
          targetH = 180;
          targetW = Math.round(180 * aspect);
        }
      }

      // 3. Render into clean output canvas with high DPI smoothing
      const outCanvas = document.createElement("canvas");
      outCanvas.width = targetW;
      outCanvas.height = targetH;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) {
        setIsProcessingLogo(false);
        return;
      }

      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = "high";

      if (preset === "square" || preset === "banner") {
        const scale = Math.min(targetW / srcW, targetH / srcH);
        const drawW = srcW * scale;
        const drawH = srcH * scale;
        const drawX = (targetW - drawW) / 2;
        const drawY = (targetH - drawH) / 2;
        outCtx.drawImage(img, srcX, srcY, srcW, srcH, drawX, drawY, drawW, drawH);
      } else {
        outCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);
      }

      const compressedDataUrl = outCanvas.toDataURL("image/png", 0.95);
      setForm((prev) => ({ ...prev, companyLogoUrl: compressedDataUrl }));
      setLogoMeta({
        width: targetW,
        height: targetH,
        originalWidth: origW,
        originalHeight: origH,
        aspectRatio: `${(targetW / targetH).toFixed(1)}:1`,
        preset,
        trimmed,
      });
      setIsProcessingLogo(false);
    };

    img.onerror = () => {
      setIsProcessingLogo(false);
      setMessage({ type: "error", text: "Could not process logo. If using a web URL, ensure it allows direct image access." });
    };

    img.src = imageSrc;
  };

  const handlePresetChange = (newPreset: "auto" | "banner" | "square" | "original") => {
    setLogoPreset(newPreset);
    if (rawImageSource) {
      autoAdjustLogo(rawImageSource, newPreset, autoTrimMargins);
    }
  };

  const handleToggleTrim = () => {
    const newTrim = !autoTrimMargins;
    setAutoTrimMargins(newTrim);
    if (rawImageSource) {
      autoAdjustLogo(rawImageSource, logoPreset, newTrim);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (res.ok && data.settings) {
          const logoUrl = data.settings.companyLogoUrl || "";
          setForm({
            companyName: data.settings.companyName || "",
            companyAddress: data.settings.companyAddress || "",
            companyPhone: data.settings.companyPhone || "",
            companyEmail: data.settings.companyEmail || "",
            companyTaxId: data.settings.companyTaxId || "",
            companyLogoUrl: logoUrl,
            companyWebsite: data.settings.companyWebsite || "",
            invoicePrefix: data.settings.invoicePrefix || "INV",
            invoiceFooterNotes: data.settings.invoiceFooterNotes || "",
            timezone: data.settings.timezone || "Asia/Kolkata",
            currency: data.settings.currency || "INR",
            cancellationDeductionType: data.settings.cancellationDeductionType || "PERCENTAGE",
            cancellationDeductionValue: data.settings.cancellationDeductionValue || "5.00",
            cancellationRestockPolicy: data.settings.cancellationRestockPolicy || "RELEASE_TO_AVAILABLE",
            cancellationNotice:
              data.settings.cancellationNotice ||
              "A cancellation deduction fee applies to cancelled orders as per company policy. The remaining net amount is credited/refunded to original payment method within 3-5 business days.",
          });

          if (logoUrl) {
            setRawImageSource(logoUrl);
            if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
              setLogoInputMode("url");
            } else {
              setLogoInputMode("upload");
              setUploadedFileName("Uploaded company logo");
            }

            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const w = img.naturalWidth || img.width;
              const h = img.naturalHeight || img.height;
              if (w && h) {
                setLogoMeta({
                  width: w,
                  height: h,
                  originalWidth: w,
                  originalHeight: h,
                  aspectRatio: `${(w / h).toFixed(1)}:1`,
                  preset: "auto",
                  trimmed: false,
                });
              }
            };
            img.src = logoUrl;
          }
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select a valid image file (PNG, JPG, SVG, WebP)." });
      return;
    }

    setUploadedFileName(`${file.name} (${Math.round(file.size / 1024)} KB)`);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawResult = event.target?.result as string;
      if (!rawResult) return;

      setRawImageSource(rawResult);
      // Auto-adjust dimensions immediately for perfect invoice proportions
      autoAdjustLogo(rawResult, logoPreset, autoTrimMargins);
    };
    reader.readAsDataURL(file);
  };

  const handleAutoAdjustUrl = () => {
    if (!form.companyLogoUrl) {
      setMessage({ type: "error", text: "Please enter an image URL first." });
      return;
    }
    setRawImageSource(form.companyLogoUrl);
    autoAdjustLogo(form.companyLogoUrl, logoPreset, autoTrimMargins);
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, companyLogoUrl: "" }));
    setRawImageSource("");
    setUploadedFileName("");
    setLogoMeta(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
        setMessage({ type: "success", text: "Settings saved successfully! Website name, branding, and billing invoices have now been updated." });
        updateBranding({
          companyName: form.companyName,
          logoUrl: form.companyLogoUrl,
          currency: form.currency,
        });
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

            {/* Logo Upload & URL Manager */}
            <div className="md:col-span-2 space-y-3 bg-slate-950/60 p-4 sm:p-5 rounded-xl border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <label className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <Image className="w-4 h-4 text-indigo-400" />
                    <span>Company Logo for Bills &amp; Invoices</span>
                  </label>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Upload an image or provide a URL — dimensions and whitespace margins are automatically adjusted for a perfect invoice fit.
                  </span>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setLogoInputMode("upload")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      logoInputMode === "upload"
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLogoInputMode("url")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      logoInputMode === "url"
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Image URL</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start pt-1">
                {/* Mode 1: File Upload Dropzone */}
                {logoInputMode === "upload" ? (
                  <div className="lg:col-span-2 space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-900/60 hover:bg-slate-900 rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center text-center cursor-pointer transition group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-200">
                        Click or tap to upload logo image
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        PNG, JPG, SVG, WebP • Auto-adjusts proportions &amp; trims blank padding
                      </p>
                      {uploadedFileName && (
                        <div className="mt-2.5 px-2.5 py-1 rounded-md bg-indigo-950/80 border border-indigo-500/30 text-[11px] text-indigo-300 font-mono">
                          Selected: {uploadedFileName}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Mode 2: Web Image URL Input */
                  <div className="lg:col-span-2 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Direct Image Web URL
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        name="companyLogoUrl"
                        value={form.companyLogoUrl}
                        onChange={handleChange}
                        placeholder="https://example.com/logo.png"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                      />
                      <button
                        type="button"
                        onClick={handleAutoAdjustUrl}
                        disabled={!form.companyLogoUrl || isProcessingLogo}
                        className="px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Auto-Adjust</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      Paste a direct image URL and click &quot;Auto-Adjust&quot; to calibrate dimensions and trim empty margins for invoices.
                    </span>
                  </div>
                )}

                {/* Live Invoice Preview Box */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    Bill Invoice Preview:
                  </span>
                  <div className="bg-white rounded-xl border border-slate-300 p-3 sm:p-4 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3 min-h-[50px]">
                      {form.companyLogoUrl ? (
                        <img
                          src={form.companyLogoUrl}
                          alt="Logo Preview"
                          className="h-11 max-w-[140px] sm:max-w-[160px] object-contain"
                          onError={(e) => {
                            (e.target as any).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white shadow font-bold text-sm">
                          {form.companyName ? form.companyName.slice(0, 2).toUpperCase() : "AP"}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[110px]">
                          {form.companyName || "Apex Logistics"}
                        </div>
                        <div className="text-[9px] text-slate-500">Tax Invoice Header</div>
                      </div>
                    </div>

                    {form.companyLogoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        title="Remove logo"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Dimension Auto-Adjustment Toolbar (Shown whenever a logo is present) */}
              {form.companyLogoUrl && (
                <div className="p-3.5 bg-slate-900/90 rounded-xl border border-indigo-500/30 space-y-3 mt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-xs font-bold text-white">Dimension Auto-Adjustment</span>
                      {logoMeta && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono border border-indigo-500/30">
                          {logoMeta.width} × {logoMeta.height} px ({logoMeta.aspectRatio})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {logoMeta?.trimmed && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          <Check className="w-3 h-3" /> Blank margins trimmed
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleToggleTrim}
                        title="Toggle margin auto-trim"
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer font-medium ${
                          autoTrimMargins
                            ? "bg-indigo-950 border-indigo-500/50 text-indigo-300"
                            : "bg-slate-800 border-slate-700 text-slate-400"
                        }`}
                      >
                        <Crop className="w-3 h-3" />
                        <span>Trim Margins: {autoTrimMargins ? "ON" : "OFF"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Preset Options */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] font-medium text-slate-400 mr-1">Proportions:</span>
                    <button
                      type="button"
                      onClick={() => handlePresetChange("auto")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                        logoPreset === "auto"
                          ? "bg-indigo-600 text-white shadow"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Fit (Recommended)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePresetChange("banner")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                        logoPreset === "banner"
                          ? "bg-indigo-600 text-white shadow"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Wide Header (3:1)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePresetChange("square")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                        logoPreset === "square"
                          ? "bg-indigo-600 text-white shadow"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <span>Square Badge (1:1)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePresetChange("original")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                        logoPreset === "original"
                          ? "bg-indigo-600 text-white shadow"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <span>Original Ratio</span>
                    </button>

                    {isProcessingLogo && (
                      <span className="text-[11px] text-indigo-400 animate-pulse ml-auto flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Adjusting...
                      </span>
                    )}
                  </div>
                </div>
              )}
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

        {/* Section 5: Order Cancellation & Deduction Policy */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              <span>Order Cancellation &amp; Deduction Policy</span>
            </div>
            <span className="text-[10px] bg-rose-500/10 text-rose-300 font-mono px-2 py-0.5 rounded border border-rose-500/20 font-semibold self-start sm:self-auto">
              Automated Deduction on Cancel
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            When an order is cancelled (either from the Operations dashboard or via AI Agent MCP tools), configure whether a cancellation fee is deducted, how much is refunded, and whether reserved inventory is automatically released.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Deduction Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Deduction Calculation Type
              </label>
              <select
                name="cancellationDeductionType"
                value={form.cancellationDeductionType}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500 transition cursor-pointer"
              >
                <option value="PERCENTAGE">Percentage of Order Total (%)</option>
                <option value="FIXED">Fixed Cancellation Fee (₹ Flat)</option>
                <option value="NONE">No Deduction (0% / 100% Full Refund)</option>
              </select>
              <span className="text-[10px] text-slate-500 block">
                Determines how cancellation fees are calculated.
              </span>
            </div>

            {/* Deduction Value */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Deduction Fee Rate / Amount {form.cancellationDeductionType === "PERCENTAGE" ? "(%)" : "(₹)"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  name="cancellationDeductionValue"
                  disabled={form.cancellationDeductionType === "NONE"}
                  value={form.cancellationDeductionType === "NONE" ? "0.00" : form.cancellationDeductionValue}
                  onChange={handleChange}
                  placeholder={form.cancellationDeductionType === "PERCENTAGE" ? "10.00" : "50.00"}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-rose-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <div className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">
                  {form.cancellationDeductionType === "PERCENTAGE" ? "%" : "₹"}
                </div>
              </div>

              {/* Quick Presets */}
              {form.cancellationDeductionType === "PERCENTAGE" && (
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  {["0", "5", "10", "15", "20"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, cancellationDeductionValue: `${preset}.00` }))}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                        parseFloat(form.cancellationDeductionValue) === parseFloat(preset)
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              )}

              {form.cancellationDeductionType === "FIXED" && (
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  {["50", "100", "150", "200"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, cancellationDeductionValue: `${preset}.00` }))}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                        parseFloat(form.cancellationDeductionValue) === parseFloat(preset)
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Restock Policy */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Inventory Restock Policy on Cancel
              </label>
              <select
                name="cancellationRestockPolicy"
                value={form.cancellationRestockPolicy}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500 transition cursor-pointer"
              >
                <option value="RELEASE_TO_AVAILABLE">Release to Available Stock (Recommended)</option>
                <option value="HOLD_IN_RESERVE">Hold in Quarantine / Manual Inspection</option>
              </select>
              <span className="text-[10px] text-slate-500 block">
                Controls whether reserved warehouse stock is returned immediately.
              </span>
            </div>
          </div>

          {/* Customer Cancellation Notice */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 block">
              Customer Cancellation &amp; Refund Notice (Displayed on Bills &amp; Invoices)
            </label>
            <textarea
              name="cancellationNotice"
              rows={2}
              value={form.cancellationNotice}
              onChange={handleChange}
              placeholder="A cancellation deduction fee applies to cancelled orders as per company policy. The remaining net amount is credited/refunded to original payment method within 3-5 business days."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-rose-500 transition"
            />
            <span className="text-[10px] text-slate-500 block">
              Appears on the digital bill and printed invoice when an order is cancelled.
            </span>
          </div>

          {/* Interactive Calculation Simulator Card */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-bold border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-rose-300">
                <Percent className="w-3.5 h-3.5" />
                <span>Live Deduction Simulator (Example Order of ₹1,000.00):</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Sample Simulation</span>
            </div>

            {(() => {
              const sampleTotal = 1000;
              let sampleFee = 0;
              if (form.cancellationDeductionType === "PERCENTAGE") {
                sampleFee = Math.round((sampleTotal * (parseFloat(form.cancellationDeductionValue || "0") / 100)) * 100) / 100;
              } else if (form.cancellationDeductionType === "FIXED") {
                sampleFee = Math.min(sampleTotal, Math.max(0, parseFloat(form.cancellationDeductionValue || "0")));
              } else {
                sampleFee = 0;
              }
              const sampleRefund = Math.max(0, sampleTotal - sampleFee);

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Order Amount</span>
                    <span className="font-mono text-white font-bold text-sm">₹1,000.00</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/30">
                    <span className="text-[10px] text-rose-300 uppercase font-semibold block">Deduction Fee Levied</span>
                    <span className="font-mono text-rose-400 font-bold text-sm">-₹{sampleFee.toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/30">
                    <span className="text-[10px] text-emerald-300 uppercase font-semibold block">Net Customer Refund</span>
                    <span className="font-mono text-emerald-400 font-bold text-sm">₹{sampleRefund.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Section 6: Model Context Protocol (MCP) API Token & Remote Access */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Plug className="w-4 h-4" />
              <span>Model Context Protocol (MCP) Developer Access</span>
            </div>
            <Link
              href="/mcp-connections"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              <span>Full MCP Server Guide &amp; Tools</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Pre-Shared Bearer Token (Direct Access)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                  Permanent • Full OWNER Scopes
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText("Bearer mcp_dev_token_apex");
                  setCopiedDevToken(true);
                  setTimeout(() => setCopiedDevToken(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer self-start sm:self-auto transition"
              >
                {copiedDevToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDevToken ? "Copied!" : "Copy Bearer Token"}</span>
              </button>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300 select-all">
              Authorization: Bearer mcp_dev_token_apex
            </div>
            <p className="text-[11px] text-slate-400">
              No generation needed — this pre-shared development token is permanently active on your workspace with full access to all 72+ catalog, inventory, and order MCP tools.
            </p>
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
