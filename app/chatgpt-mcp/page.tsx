"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  Plug,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Code2,
  Lock,
  Layers,
  ArrowRight,
} from "lucide-react";

export default function ChatGptMcpPage() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("https://product-manager-kappa-two.vercel.app/api/mcp");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEndpointUrl(`${window.location.origin}/api/mcp`);
    }
  }, []);

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
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
          <span className="text-violet-400 font-semibold flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" />
            ChatGPT MCP Guide
          </span>
        </div>

        {/* Multi-Provider Tabs */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-600/20 text-violet-300 border border-violet-500/30">
            <Bot className="w-3.5 h-3.5 text-violet-400" />
            ChatGPT MCP Guide
          </span>
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
          <Link
            href="/mcp-connections"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            <Plug className="w-3.5 h-3.5 text-emerald-400" />
            MCP Server Configuration
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              ChatGPT MCP Guide
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                Provider: chatgpt_mcp
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Configured &amp; operational Model Context Protocol integration for OpenAI ChatGPT with OAuth 2.1 PKCE and interactive widgets.
            </p>
          </div>
        </div>
      </div>

      {/* Connection Endpoint Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-violet-950/40 to-slate-900 border border-violet-500/30 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-wider">
              <Bot className="w-4 h-4" />
              <span>ChatGPT MCP Server Endpoint</span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-white mt-1 break-all">
              {endpointUrl}
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(endpointUrl, setCopiedUrl)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 shrink-0 cursor-pointer transition"
          >
            {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedUrl ? "Copied Endpoint!" : "Copy Endpoint"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Protocol Transport</span>
            <span className="font-mono text-emerald-400 font-bold">Streamable HTTP (Stateless)</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Authentication</span>
            <span className="font-mono text-indigo-400 font-bold">OAuth 2.1 PKCE &amp; Bearer</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Safety Compliance</span>
            <span className="font-mono text-purple-400 font-bold">destructiveHint: true</span>
          </div>
        </div>
      </div>

      {/* Guide Steps */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-400" />
          ChatGPT Connection Workflows
        </h2>

        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <strong className="text-white block text-sm">1. OAuth 2.1 PKCE Authorization (Dynamic Connect)</strong>
            <p className="text-slate-400 leading-relaxed">
              When ChatGPT initiates connection via RFC 8414 / RFC 9728 discovery, users are redirected to the dedicated consent screen at{" "}
              <Link href="/oauth/consent" className="text-violet-400 underline font-mono">
                /oauth/consent
              </Link>
              . Operators approve access to issue a scoped OAuth 2.1 token with S256 code challenge protection.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <strong className="text-white block text-sm">2. Developer Bearer Token Fallback</strong>
            <p className="text-slate-400 leading-relaxed">
              For manual Action configuration or client testing, the server accepts pre-shared Bearer token authentication:
            </p>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400">
              <span>Authorization: Bearer mcp_dev_token_apex</span>
              <button
                onClick={() => copyToClipboard("Bearer mcp_dev_token_apex", setCopiedToken)}
                className="text-slate-400 hover:text-white"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <strong className="text-white block text-sm">3. Interactive UI Widgets (MCP Apps &amp; Output Template)</strong>
            <p className="text-slate-400 leading-relaxed">
              The server exposes decoupled render tools (<code className="text-violet-300">render_dashboard_widget</code>, <code className="text-violet-300">render_products_widget</code>, <code className="text-violet-300">render_order_widget</code>) that output both the standard MCP Apps metadata URI (<code className="text-emerald-300 font-mono">ui://widgets/...</code>) and the <code className="text-indigo-300 font-mono">openai/outputTemplate</code> alias for ChatGPT visual presentation.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <strong className="text-white block text-sm">4. Destructive Operation Safety Confirmations</strong>
            <p className="text-slate-400 leading-relaxed">
              In accordance with ChatGPT MCP safety requirements, destructive deletion tools (<code className="text-rose-400">delete_product</code>, <code className="text-rose-400">delete_order</code>, <code className="text-rose-400">delete_customer</code>, <code className="text-rose-400">delete_category</code>, <code className="text-rose-400">factory_reset</code>) include <code className="text-amber-400">annotations.destructiveHint: true</code> and issue cryptographic confirmation tokens requiring human operator authorization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
