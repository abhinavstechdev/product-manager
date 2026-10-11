"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Plug,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Bot,
  Globe,
  Lock,
  RefreshCw,
  Terminal,
  Layers,
  ChevronDown,
  ChevronUp,
  Settings,
  UserCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function GeminiMcpPage() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [activeTroubleshoot, setActiveTroubleshoot] = useState<string | null>(null);

  // Health check state
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    checked: boolean;
    success: boolean;
    isHttps: boolean;
    reachable: boolean;
    message: string;
  } | null>(null);

  // Dynamic public endpoint detection
  const [endpointUrl, setEndpointUrl] = useState("https://product-manager-kappa-two.vercel.app/api/mcp");
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setEndpointUrl(`${origin}/api/mcp`);
      setIsLocal(origin.includes("localhost") || origin.includes("127.0.0.1"));
    }
  }, []);

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const runHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/mcp/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: "google_gemini" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHealthStatus({
          checked: true,
          success: true,
          isHttps: data.checks.isHttps,
          reachable: true,
          message: data.message || "Endpoint verified and compliant with MCP specification.",
        });
      } else {
        setHealthStatus({
          checked: true,
          success: false,
          isHttps: false,
          reachable: false,
          message: data.error || "Failed to reach MCP validation endpoint.",
        });
      }
    } catch (err: any) {
      setHealthStatus({
        checked: true,
        success: false,
        isHttps: false,
        reachable: false,
        message: err?.message || "Network error while validating server health.",
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  const toggleTroubleshoot = (id: string) => {
    setActiveTroubleshoot(activeTroubleshoot === id ? null : id);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb Navigation & Provider Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/mcp-connections"
            className="text-slate-400 hover:text-slate-200 transition"
          >
            MCP Integrations
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-indigo-400 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Google Gemini MCP Guide
          </span>
        </div>

        {/* Multi-Provider Tabs */}
        <div className="flex items-center gap-2">
          <Link
            href="/chatgpt-mcp"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            <Bot className="w-3.5 h-3.5 text-violet-400" />
            ChatGPT MCP Guide
          </Link>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Google Gemini MCP Guide
            <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-1 rounded font-mono ml-0.5">
              NEW
            </span>
          </span>
          <Link
            href="/mcp-connections"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            <Plug className="w-3.5 h-3.5 text-emerald-400" />
            MCP Server Configuration
          </Link>
        </div>
      </div>

      {/* Main Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Google Gemini MCP Guide
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                Provider: google_gemini
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Complete setup guide for connecting Google Gemini Custom Connected Apps to Apex Logistics via Model Context Protocol (MCP).
            </p>
          </div>
        </div>
      </div>

      {/* Provider Isolation Notice */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-semibold text-slate-200">
            Independent Provider Isolation (ChatGPT MCP Baseline Preserved)
          </div>
          <p className="text-slate-400 leading-relaxed">
            This integration operates under the isolated provider namespace{" "}
            <code className="text-indigo-300 font-mono">google_gemini</code>. Your existing ChatGPT MCP integration, OAuth 2.1 credentials, developer tokens, webhook subscriptions, and server tools remain 100% active, untouched, and unmodifiable by Gemini workflows.
          </p>
        </div>
      </div>

      {/* Official Security Notice (Google Third-Party Compliance) */}
      <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2.5">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4" />
          <span>Official Google Connected Apps Security & Privacy Notice</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Third-party MCP servers are operated independently of Google. When you connect Apex Logistics as a custom app, Google Gemini communicates directly with this MCP server to execute catalog queries, check stock availability, and manage orders. Users should review their organization’s privacy policy and data governance practices before connecting.
        </p>
        <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-amber-300/90">
          <span>Manage or revoke anytime:</span>
          <a
            href="https://gemini.google.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white flex items-center gap-1 font-medium"
          >
            Gemini Connected Apps Settings <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-slate-600">•</span>
          <a
            href="https://myaccount.google.com/linkedapps"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white flex items-center gap-1 font-medium"
          >
            Google Account Linked Apps <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Live Server Endpoint & Compatibility Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-indigo-500/30 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Globe className="w-4 h-4" />
              <span>Public Model Context Protocol (MCP) Server URL</span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-white mt-1 break-all bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 inline-block">
              {endpointUrl}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => copyToClipboard(endpointUrl, setCopiedUrl)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedUrl ? "Copied MCP URL!" : "Copy Endpoint"}
            </button>
            <button
              onClick={runHealthCheck}
              disabled={checkingHealth}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingHealth ? "animate-spin" : ""}`} />
              {checkingHealth ? "Verifying..." : "Validate Gemini Compatibility"}
            </button>
          </div>
        </div>

        {/* Localhost Warning if applicable */}
        {isLocal && (
          <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Development Environment Detected: </span>
              Google Gemini cloud servers cannot access <code className="font-mono text-amber-300">localhost</code>. To connect from Gemini, use your production Vercel URL (e.g. <code className="font-mono text-emerald-300">https://product-manager-kappa-two.vercel.app/api/mcp</code>).
            </div>
          </div>
        )}

        {/* Health Check Results */}
        {healthStatus && (
          <div
            className={`p-4 rounded-xl border text-xs ${
              healthStatus.success
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/40 border-rose-500/40 text-rose-200"
            }`}
          >
            <div className="font-bold flex items-center gap-2 mb-1">
              {healthStatus.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  MCP Server Ready for Google Gemini
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Health Check Failed
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-300">{healthStatus.message}</p>
          </div>
        )}

        {/* Protocol Spec Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 text-xs">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Protocol Specification</span>
            <span className="font-mono text-emerald-400 font-bold">Streamable HTTP (Stateless)</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Transport Security</span>
            <span className="font-mono text-blue-400 font-bold">Strict HTTPS (TLS 1.3)</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Tool Handshake</span>
            <span className="font-mono text-indigo-400 font-bold">JSON-RPC 2.0 Compliant</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Available Tools</span>
            <span className="font-mono text-purple-400 font-bold">72 Production Tools</span>
          </div>
        </div>
      </div>

      {/* Prerequisites & Eligibility (Distinguishing Google vs Website Requirements) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Google's Eligibility Requirements */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <UserCheck className="w-4 h-4" />
            <span>Google Gemini Eligibility Requirements</span>
          </div>
          <p className="text-xs text-slate-400">
            These requirements are established by Google for Gemini Custom Connected Apps during current rollout:
          </p>

          <ul className="space-y-3 text-xs">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                1
              </span>
              <div>
                <strong className="text-white block">Age Requirement: 18 or Older</strong>
                <span className="text-slate-400 text-[11px]">
                  Custom connected apps are only accessible to Google Accounts verified as 18 years or older.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                2
              </span>
              <div>
                <strong className="text-white block">United States Region</strong>
                <span className="text-slate-400 text-[11px]">
                  Google currently requires users to be located in the United States for custom apps preview.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                3
              </span>
              <div>
                <strong className="text-white block">Personal Google Account Only</strong>
                <span className="text-slate-400 text-[11px]">
                  Must sign in using a personal Google Account (<code className="text-indigo-300">@gmail.com</code>). Google Workspace, business, and school accounts are not currently supported by Google.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                4
              </span>
              <div>
                <strong className="text-white block">&quot;Keep Activity&quot; Must Be Enabled</strong>
                <span className="text-slate-400 text-[11px]">
                  In Google Account data settings, Gemini Apps Activity (&quot;Keep Activity&quot;) must be turned ON.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                5
              </span>
              <div>
                <strong className="text-white block">Initial Setup on Gemini Web</strong>
                <span className="text-slate-400 text-[11px]">
                  While custom apps are usable across web and mobile apps, the initial connection must be configured through the Gemini web app (<a href="https://gemini.google.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">gemini.google.com/apps</a>).
                </span>
              </div>
            </li>
          </ul>
        </div>

        {/* Website (Apex Logistics) Technical Requirements */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>Apex Logistics Server Requirements</span>
          </div>
          <p className="text-xs text-slate-400">
            Technical criteria imposed by this store for secure remote AI operation:
          </p>

          <ul className="space-y-3 text-xs">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                A
              </span>
              <div>
                <strong className="text-white block">Public HTTPS Endpoint</strong>
                <span className="text-slate-400 text-[11px]">
                  Endpoint must be reachable over public HTTPS with a valid SSL/TLS certificate issued to your Vercel or custom domain.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                B
              </span>
              <div>
                <strong className="text-white block">Standard MCP Spec Compliance</strong>
                <span className="text-slate-400 text-[11px]">
                  The server exposes the standard Streamable HTTP transport conforming to Model Context Protocol specification for tools and resources.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                C
              </span>
              <div>
                <strong className="text-white block">Supported Authentication Credentials</strong>
                <span className="text-slate-400 text-[11px]">
                  Server supports RFC 8414 OAuth 2.1 metadata discovery or Bearer token header authorization (<code className="text-indigo-300">mcp_dev_token_apex</code>).
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                D
              </span>
              <div>
                <strong className="text-white block">Zero Cross-Provider Side Effects</strong>
                <span className="text-slate-400 text-[11px]">
                  Gemini requests execute under operator role permissions and cannot modify or disconnect ChatGPT settings.
                </span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Step-by-Step Connection Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-8 shadow-xl">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Step-by-Step Gemini Connection Guide
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Follow these official steps to link Apex Logistics to your personal Google Gemini account.
          </p>
        </div>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono text-xs font-bold flex items-center justify-center">
                  01
                </span>
                <h3 className="text-sm font-bold text-white">Open Google Gemini</h3>
              </div>
              <a
                href="https://gemini.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-xs font-semibold border border-blue-500/30 transition"
              >
                Open gemini.google.com <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-10">
              Navigate to <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">https://gemini.google.com/</a> in your browser. Ensure you are signed in with an eligible personal Google Account (<code className="text-indigo-300 font-mono">@gmail.com</code>).
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono text-xs font-bold flex items-center justify-center">
                  02
                </span>
                <h3 className="text-sm font-bold text-white">Open Connected Apps Settings</h3>
              </div>
              <a
                href="https://gemini.google.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-xs font-semibold border border-indigo-500/30 transition"
              >
                Go to gemini.google.com/apps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-10">
              In Gemini, open <strong>Settings</strong> (gear icon) and select <strong>Connected Apps</strong>. If Connected Apps does not appear directly, open <strong>Personal Intelligence</strong> first to reveal connected apps preferences, or navigate directly to{" "}
              <a href="https://gemini.google.com/apps" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline font-mono">
                https://gemini.google.com/apps
              </a>.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono text-xs font-bold flex items-center justify-center">
                03
              </span>
              <h3 className="text-sm font-bold text-white">Add a Custom App</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pl-10">
              Under the <strong>Custom apps</strong> section, select the option to add a custom app. If you already have existing custom apps connected, click the <strong>Add a custom app</strong> button.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono text-xs font-bold flex items-center justify-center">
                  04
                </span>
                <h3 className="text-sm font-bold text-white">Enter the MCP Server URL</h3>
              </div>
              <button
                onClick={() => copyToClipboard(endpointUrl, setCopiedUrl)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? "Copied!" : "Copy URL"}
              </button>
            </div>
            <div className="pl-10 space-y-2">
              <p className="text-xs text-slate-300 leading-relaxed">
                Enter your live, public MCP server URL:
              </p>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all">
                {endpointUrl}
              </div>
              <p className="text-[11px] text-slate-400">
                <strong>Important:</strong> Do not hardcode or invent arbitrary endpoints. Google Gemini requires this public URL to establish a secure Streamable HTTP connection.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono text-xs font-bold flex items-center justify-center">
                05
              </span>
              <h3 className="text-sm font-bold text-white">
                Configure Advanced Authentication (When Required)
              </h3>
            </div>
            <div className="pl-10 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                If Dynamic Client Registration (DCR) is not automatically negotiated by your client, select <strong>Advanced features</strong> or <strong>Show more</strong> in Gemini. Our server supports the following documented authentication methods:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    Option A: OAuth 2.1 Discovery (Recommended)
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Gemini auto-discovers metadata via standard discovery endpoints:
                  </p>
                  <code className="text-indigo-300 font-mono text-[10px] block truncate">
                    /.well-known/oauth-authorization-server
                  </code>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      Option B: Bearer Header Token
                    </div>
                    <button
                      onClick={() => copyToClipboard("Bearer mcp_dev_token_apex", setCopiedToken)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {copiedToken ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedToken ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    If Gemini allows custom headers, supply authorization:
                  </p>
                  <code className="text-emerald-300 font-mono text-[10px] block truncate">
                    Authorization: Bearer mcp_dev_token_apex
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Step 6 */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono text-xs font-bold flex items-center justify-center">
                06
              </span>
              <h3 className="text-sm font-bold text-white">
                Complete the Connection &amp; Invoke in Gemini Chat
              </h3>
            </div>
            <div className="pl-10 space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Click <strong>Next</strong> or <strong>Save</strong> and complete any on-screen authorization prompts. Once connected, invoke Apex Logistics in any Gemini chat prompt using the <strong>@</strong> mention syntax:
              </p>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Example Gemini Prompts
                </span>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-indigo-300">
                    @Apex Logistics show all low-stock items in the warehouse
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-emerald-300">
                    @Apex Logistics check pending orders in the packing queue
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-purple-300">
                    @Apex Logistics what is the current available stock for SKU MAKA-SC-001?
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 7: Comprehensive Troubleshooting Guide (All 11 scenarios) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
          <HelpCircle className="w-4 h-4" />
          <span>Step 7: Comprehensive Gemini Troubleshooting</span>
        </div>
        <p className="text-xs text-slate-400">
          Find actionable resolutions for common connection and configuration issues:
        </p>

        <div className="space-y-2 text-xs">
          {[
            {
              id: "missing-settings",
              title: "1. Missing Connected Apps settings in Gemini",
              solution:
                "Google requires users to be 18+ and using a personal Google Account (@gmail.com). Work (Workspace) and school accounts do not have Connected Apps enabled. Also ensure you open Settings -> Personal Intelligence first if Connected Apps is not in the root settings menu.",
            },
            {
              id: "eligibility",
              title: "2. Account or regional eligibility restrictions",
              solution:
                "Gemini Custom Connected Apps are currently restricted to personal accounts in the United States. If you are using a VPN or an account registered outside the US, the Custom apps feature will not appear until Google expands regional availability.",
            },
            {
              id: "keep-activity",
              title: "3. 'Keep Activity' setting is disabled",
              solution:
                "Google Gemini requires 'Gemini Apps Activity' (Keep Activity) to be enabled. Go to Google Account -> Data & Privacy -> Web & App Activity / Gemini Apps Activity and ensure it is turned ON.",
            },
            {
              id: "unreachable-url",
              title: "4. Invalid or unreachable MCP server URL",
              solution:
                "Google Gemini's cloud backend cannot reach 'http://localhost'. Ensure you enter your publicly accessible deployment URL (e.g. https://product-manager-kappa-two.vercel.app/api/mcp). Test URL reachability in an incognito window.",
            },
            {
              id: "https-cert",
              title: "5. HTTPS or certificate errors",
              solution:
                "Gemini strictly requires valid SSL/TLS certificates issued by a trusted Certificate Authority. Self-signed certificates or expired SSL certificates will cause Gemini to fail with a network error.",
            },
            {
              id: "auth-methods",
              title: "6. Unsupported authentication methods",
              solution:
                "Apex Logistics supports both OAuth 2.1 PKCE (RFC 7636) and Bearer token headers. If Gemini prompts for basic authentication or custom tokens, select 'Advanced features' and configure Bearer mcp_dev_token_apex.",
            },
            {
              id: "dcr-missing",
              title: "7. Missing Dynamic Client Registration (DCR)",
              solution:
                "If Gemini's client cannot dynamically register, click 'Show more' or 'Advanced features' in the Gemini Custom App wizard to manually enter client credentials or bearer tokens.",
            },
            {
              id: "oauth-callback",
              title: "8. OAuth authorization or callback errors",
              solution:
                "Ensure redirect URIs in OAuth client configurations match the exact callback provided by Google Gemini. For standard token access, use the pre-shared Bearer token mcp_dev_token_apex.",
            },
            {
              id: "protocol-compat",
              title: "9. MCP protocol incompatibility",
              solution:
                "Apex Logistics is built with @modelcontextprotocol/sdk, adhering strictly to Streamable HTTP transport and JSON-RPC 2.0. Ensure Gemini connects using the HTTP endpoint (/api/mcp).",
            },
            {
              id: "timeouts",
              title: "10. Server timeouts and unavailable tools",
              solution:
                "Google Gemini enforces strict request timeouts (~10 seconds). On cold starts, Vercel serverless functions might take a few seconds. If a timeout occurs, retry the request to use a warm container.",
            },
            {
              id: "permissions",
              title: "11. Permission and authorization failures",
              solution:
                "Operations requiring admin privileges (such as factory reset or hard stock wipes) are restricted by operator roles. Ensure your token or user session has appropriate workspace permissions.",
            },
          ].map((item) => {
            const isOpen = activeTroubleshoot === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden"
              >
                <button
                  onClick={() => toggleTroubleshoot(item.id)}
                  className="w-full p-3.5 text-left flex items-center justify-between text-slate-200 hover:text-white font-semibold transition"
                >
                  <span>{item.title}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                {isOpen && (
                  <div className="p-3.5 pt-0 text-slate-400 text-[11px] leading-relaxed border-t border-slate-800/60 mt-1">
                    {item.solution}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Google Documentation Links (Clickable & Safe) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
          <ExternalLink className="w-4 h-4" />
          <span>Official Google Reference Documentation</span>
        </div>
        <p className="text-xs text-slate-400">
          Refer to Google&apos;s authoritative support articles for official Gemini Custom Connected Apps policies:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <a
            href="https://support.google.com/gemini/answer/17209137"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/80 transition group"
          >
            <div className="font-bold text-white group-hover:text-blue-300 flex items-center justify-between">
              <span>Gemini Custom Connected Apps</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Google Help article 17209137: Connecting third-party MCP servers.
            </p>
          </a>

          <a
            href="https://support.google.com/gemini/answer/13695044"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/80 transition group"
          >
            <div className="font-bold text-white group-hover:text-blue-300 flex items-center justify-between">
              <span>Gemini Connected Apps Overview</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Google Help article 13695044: Managing connected applications.
            </p>
          </a>

          <a
            href="https://support.google.com/gemini/answer/13594961"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/80 transition group"
          >
            <div className="font-bold text-white group-hover:text-blue-300 flex items-center justify-between">
              <span>Gemini Apps Privacy &amp; Data</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Google Help article 13594961: How Google handles your data.
            </p>
          </a>

          <a
            href="https://gemini.google.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/80 transition group"
          >
            <div className="font-bold text-white group-hover:text-indigo-300 flex items-center justify-between">
              <span>Gemini Connected Apps Settings</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Direct link to Gemini settings to add or remove apps.
            </p>
          </a>

          <a
            href="https://myaccount.google.com/linkedapps"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/80 transition group"
          >
            <div className="font-bold text-white group-hover:text-indigo-300 flex items-center justify-between">
              <span>Google Account Linked Apps</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Review and revoke third-party authorizations at the account level.
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}
