"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Boxes,
  Bot,
  ShieldCheck,
  Check,
  X,
  Package,
  ShoppingCart,
  Truck,
  BarChart3,
  Sparkles,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

function ConsentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const clientId = searchParams.get("client_id") || "mcp-client";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const scope = searchParams.get("scope") || "";
  const state = searchParams.get("state") || "";
  const codeChallenge = searchParams.get("code_challenge") || "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [authorizedSuccess, setAuthorizedSuccess] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          // Redirect to login preserving the full consent URL
          const currentUrl = window.location.href;
          window.location.href = `/login?return_to=${encodeURIComponent(currentUrl)}`;
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch (err) {
        const currentUrl = window.location.href;
        window.location.href = `/login?return_to=${encodeURIComponent(currentUrl)}`;
      } finally {
        setLoadingUser(false);
      }
    }
    checkAuth();
  }, []);

  const handleDecision = async (action: "grant" | "deny") => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          redirectUri,
          scope,
          state,
          codeChallenge,
          codeChallengeMethod,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error_description || data.error || "Authorization failed");
      }

      if (action === "grant") {
        setAuthorizedSuccess(true);
      }

      // Redirect back to ChatGPT's redirect_uri callback
      if (data.redirectUrl) {
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 300);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process authorization");
      setIsSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium">Verifying authenticated account...</p>
      </div>
    );
  }

  // Parse hostname for display & client identity
  let clientDomain = "AI Assistant";
  let isGemini = false;
  try {
    if (redirectUri) {
      clientDomain = new URL(redirectUri).hostname;
    }
  } catch {}
  if (clientDomain.toLowerCase().includes("google") || clientId?.toLowerCase().includes("gemini")) {
    isGemini = true;
  }
  const clientDisplayName = isGemini
    ? "Google Gemini"
    : clientDomain.includes("chatgpt") || clientDomain.includes("openai")
    ? "ChatGPT"
    : "ChatGPT / Remote AI Assistant";

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-7 sm:p-9 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 text-white shadow-lg shadow-indigo-500/25 mb-1">
              {isGemini ? <Sparkles className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              Grant Permission to {clientDisplayName}
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </h1>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {clientDisplayName} (Model Context Protocol) is requesting access to connect to your Apex Logistics store.
            </p>
          </div>

          {/* Authenticated Account Badge */}
          {user && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-slate-800 shrink-0">
                  {user.username ? user.username.slice(0, 2).toUpperCase() : "SV"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {user.username || user.name}
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono font-medium">
                      {user.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {user.email} &bull; {user.workspaceName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-emerald-400 shrink-0 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Authenticated</span>
              </div>
            </div>
          )}

          {/* Requested Permissions List */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider text-left">
              Permissions Requested
            </h2>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 flex items-start gap-3">
                <Package className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Products & Inventory Control</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Query stock availability, check low-stock alerts, and perform inventory adjustments.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 flex items-start gap-3">
                <ShoppingCart className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Order Management & Fulfillment</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Create customer orders, process the packing queue, and initiate dispatches.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 flex items-start gap-3">
                <BarChart3 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Business Analytics & Metrics</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Access sales analytics, product revenue summaries, and dashboard KPIs.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Client Details */}
          <div className="text-[11px] text-slate-500 bg-slate-950/30 border border-slate-800/60 rounded-xl p-2.5 flex items-center justify-between">
            <span>Client: <strong className="text-slate-400">{clientId}</strong></span>
            <span>Callback: <strong className="text-slate-400">{clientDomain}</strong></span>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-950/50 border border-rose-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {authorizedSuccess && (
            <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Permission granted! Redirecting to {clientDisplayName}...</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting || authorizedSuccess}
              onClick={() => handleDecision("deny")}
              className="w-full sm:w-1/3 py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-white border border-slate-700 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Deny</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting || authorizedSuccess}
              onClick={() => handleDecision("grant")}
              className="w-full sm:w-2/3 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-lg shadow-indigo-600/25 transition disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Grant Permission & Connect</span>
                </>
              )}
            </button>
          </div>

          <div className="text-center text-[11px] text-slate-500 pt-1">
            Authorizing will issue an OAuth access token to {clientDisplayName} on behalf of <strong className="text-slate-400">seveton</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-400">
          Loading authorization...
        </div>
      }
    >
      <ConsentForm />
    </Suspense>
  );
}
