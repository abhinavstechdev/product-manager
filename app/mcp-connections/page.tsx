"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plug, Copy, Check, Sparkles, ShieldCheck, Terminal, Bot, ExternalLink, Code2, AlertTriangle, Trash2, KeyRound } from "lucide-react";

export function McpConnectionsPage() {
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<"streamable" | "oauth" | "reset">("streamable");
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFactoryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword) return;
    setResetLoading(true);
    setResetResult(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetResult({ success: false, message: data.error || "Reset failed." });
      } else {
        setResetResult({ success: true, message: data.message || "Factory reset complete! System is clean." });
        setResetPassword("");
      }
    } catch (err: any) {
      setResetResult({ success: false, message: err?.message || "Network error during reset." });
    } finally {
      setResetLoading(false);
    }
  };

  const endpointUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/mcp`
    : "http://localhost:3000/api/mcp";

  const claudeConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        apexInventory: {
          url: endpointUrl,
          headers: {
            Authorization: "Bearer mcp_dev_token_apex",
          },
        },
      },
    },
    null,
    2
  );

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Breadcrumb Navigation & Provider Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Integrations</span>
          <span className="text-slate-600">/</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <Plug className="w-3.5 h-3.5" />
            MCP Server Configuration
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
          <Link
            href="/gemini-mcp"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Google Gemini MCP Guide
            <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-1 rounded font-mono ml-0.5">
              NEW
            </span>
          </Link>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">
            <Plug className="w-3.5 h-3.5 text-emerald-400" />
            MCP Server Configuration
          </span>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plug className="w-6 h-6 text-emerald-400" />
          Model Context Protocol (MCP) Server Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Connect Claude Desktop, Cursor, Antigravity, or remote AI assistants over authenticated Streamable HTTP.
        </p>
      </div>

      {/* Connection Endpoint Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Remote Streamable HTTP Endpoint</span>
            </div>
            <div className="text-lg font-bold font-mono text-white mt-1 break-all">
              {endpointUrl}
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(endpointUrl, setCopiedEndpoint)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 shrink-0"
          >
            {copiedEndpoint ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedEndpoint ? "Copied URL!" : "Copy Endpoint"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Protocol Transport</span>
            <span className="font-mono text-emerald-400 font-bold">Streamable HTTP (Stateless)</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Authorization Method</span>
            <span className="font-mono text-indigo-400 font-bold">OAuth 2.1 (RFC 7636 PKCE)</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Available Tools</span>
            <span className="font-mono text-purple-400 font-bold">72 Production Tools</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("streamable")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "streamable"
              ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Quick Connect (Client Config)
        </button>
        <button
          onClick={() => setActiveTab("oauth")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "oauth"
              ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          OAuth 2.1 Server Metadata
        </button>
        <button
          onClick={() => setActiveTab("reset")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "reset"
              ? "bg-rose-950/40 text-rose-400 border border-rose-500/30"
              : "text-slate-400 hover:text-rose-400"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Danger Zone & Factory Reset
        </button>
      </div>

      {/* Tab 1: Client Configuration */}
      {activeTab === "streamable" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              Claude Desktop / Antigravity Configuration
            </h2>
            <button
              onClick={() => copyToClipboard(claudeConfigSnippet, setCopiedConfig)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              {copiedConfig ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedConfig ? "Copied!" : "Copy JSON"}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Add this configuration to your client&apos;s MCP settings (e.g., <code className="text-indigo-300">claude_desktop_config.json</code> or <code className="text-indigo-300">.mcp.json</code>):
          </p>

          <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto">
            {claudeConfigSnippet}
          </pre>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2 text-xs text-slate-300">
            <div className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Verified Assistant Capabilities:
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
              <li>Query low stock and out-of-stock warehouse items with ledger accuracy</li>
              <li>Create manual phone and WhatsApp orders with automatic inventory reservations</li>
              <li>Check packing queue and generate printable picking slips</li>
              <li>Dispatch shipments and atomically reduce physical inventory</li>
              <li>Record UPI and Cash customer payments</li>
              <li>Trigger high-impact pending actions requiring human approval in AI Activity</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: OAuth 2.1 Metadata */}
      {activeTab === "oauth" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Standards-Compliant OAuth 2.1 Discovery Endpoints
          </h2>
          <p className="text-xs text-slate-400">
            For dynamic MCP clients that negotiate authentication via RFC 8414 and RFC 9728:
          </p>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-500 text-[10px] block">Authorization Server Metadata</span>
                <span className="text-white">/.well-known/oauth-authorization-server</span>
              </div>
              <a
                href="/.well-known/oauth-authorization-server"
                target="_blank"
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                Inspect <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-500 text-[10px] block">Protected Resource Metadata</span>
                <span className="text-white">/.well-known/oauth-protected-resource</span>
              </div>
              <a
                href="/.well-known/oauth-protected-resource"
                target="_blank"
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                Inspect <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-500 text-[10px] block">Token Endpoint</span>
                <span className="text-white">/api/oauth/token</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">POST</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-500 text-[10px] block">Authorize Endpoint (PKCE S256)</span>
                <span className="text-white">/api/oauth/authorize</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">GET / POST</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Danger Zone & Factory Reset */}
      {activeTab === "reset" && (
        <div className="bg-slate-900 border border-rose-900/40 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="border-b border-rose-900/30 pb-4">
            <h2 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Platform Factory Reset & Clean Slate
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Purges all sample catalog items, dummy orders, payments, shipments, and customer records so the platform starts completely fresh with zero fake data.
            </p>
          </div>

          <div className="p-4 bg-rose-950/20 rounded-xl border border-rose-500/30 space-y-2 text-xs text-rose-200">
            <div className="font-bold flex items-center gap-1.5 text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Warning: Irreversible Platform Purge
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              This operation executes a complete database wipe of all 10 dummy products, categories, customers, orders, shipments, returns, and inventory transactions.
              It requires the master security password (<code className="text-rose-300 font-mono">Aezakmi@ff135</code>). Once wiped, the website will have zero fake data.
            </p>
          </div>

          <form onSubmit={handleFactoryReset} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                Master Authorization Password:
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Enter Aezakmi@ff135"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={resetLoading || !resetPassword}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              {resetLoading ? "Purging System Data..." : "Execute Factory Reset (Clean Slate)"}
            </button>
          </form>

          {resetResult && (
            <div
              className={`p-4 rounded-xl border text-xs ${
                resetResult.success
                  ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/30 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="font-bold mb-1">
                {resetResult.success ? "✓ Factory Reset Successful" : "⚠️ Reset Failed"}
              </div>
              <p className="text-[11px]">{resetResult.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default McpConnectionsPage;
