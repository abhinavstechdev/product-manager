"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Plug,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Bot,
  Terminal,
  Code2,
  Cpu,
  Layers,
  ChevronRight,
  Play,
  RefreshCw,
  CheckCircle2,
  KeyRound,
  Globe,
  Settings,
  HelpCircle,
  FileCode,
  Laptop,
} from "lucide-react";

type AiPlatform =
  | "claude"
  | "chatgpt"
  | "gemini"
  | "cursor"
  | "windsurf"
  | "antigravity"
  | "vscode"
  | "ollama"
  | "langchain";

export default function AllAiMcpPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<AiPlatform>("claude");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [endpointUrl, setEndpointUrl] = useState("https://product-manager-kappa-two.vercel.app/api/mcp");

  // Live tool runner state
  const [selectedTestTool, setSelectedTestTool] = useState("get_dashboard_summary");
  const [runningTool, setRunningTool] = useState(false);
  const [toolResult, setToolResult] = useState<any | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEndpointUrl(`${window.location.origin}/api/mcp`);
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const platforms = [
    {
      id: "claude" as AiPlatform,
      name: "Claude Desktop & Code",
      vendor: "Anthropic",
      icon: "🌟",
      badge: "Desktop + CLI",
      popular: true,
    },
    {
      id: "chatgpt" as AiPlatform,
      name: "ChatGPT & Custom GPTs",
      vendor: "OpenAI",
      icon: "🤖",
      badge: "Custom Actions",
      popular: true,
    },
    {
      id: "gemini" as AiPlatform,
      name: "Google Gemini",
      vendor: "Google DeepMind",
      icon: "✨",
      badge: "Connected Apps",
      popular: true,
    },
    {
      id: "cursor" as AiPlatform,
      name: "Cursor IDE",
      vendor: "Anysphere",
      icon: "⚡",
      badge: ".cursor/mcp.json",
      popular: true,
    },
    {
      id: "windsurf" as AiPlatform,
      name: "Windsurf IDE",
      vendor: "Codeium Cascade",
      icon: "🌊",
      badge: "mcp_config.json",
    },
    {
      id: "antigravity" as AiPlatform,
      name: "Antigravity IDE",
      vendor: "Google AI",
      icon: "🪐",
      badge: "Built-in MCP",
    },
    {
      id: "vscode" as AiPlatform,
      name: "VS Code (Cline / Roo)",
      vendor: "VS Marketplace",
      icon: "💻",
      badge: "Extension Host",
    },
    {
      id: "ollama" as AiPlatform,
      name: "Ollama & Open WebUI",
      vendor: "Self-Hosted LLMs",
      icon: "🦙",
      badge: "Local Agent",
    },
    {
      id: "langchain" as AiPlatform,
      name: "LangChain & Python SDK",
      vendor: "Developer SDKs",
      icon: "🐍",
      badge: "Code Integration",
    },
  ];

  // Config generators
  const getClaudeDesktopJson = () =>
    JSON.stringify(
      {
        mcpServers: {
          "apex-retail-ops": {
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

  const getClaudeCodeCli = () =>
    `claude mcp add apex-retail-ops ${endpointUrl} --header "Authorization: Bearer mcp_dev_token_apex"`;

  const getCursorJson = () =>
    JSON.stringify(
      {
        mcpServers: {
          "apex-retail-ops": {
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

  const getWindsurfJson = () =>
    JSON.stringify(
      {
        mcpServers: {
          "apex-retail-ops": {
            serverUrl: endpointUrl,
            headers: {
              Authorization: "Bearer mcp_dev_token_apex",
            },
          },
        },
      },
      null,
      2
    );

  const getVsCodeJson = () =>
    JSON.stringify(
      {
        mcpServers: {
          "apex-retail-ops": {
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

  const getAntigravityJson = () =>
    JSON.stringify(
      {
        mcpServers: {
          "apex-retail-ops": {
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

  const getPythonSnippet = () => `import asyncio
from mcp.client.streamable_http import StreamableHTTPClient

async def main():
    async with StreamableHTTPClient(
        url="${endpointUrl}",
        headers={"Authorization": "Bearer mcp_dev_token_apex"}
    ) as client:
        tools = await client.list_tools()
        print(f"Connected! Available tools: {len(tools.tools)}")
        
        # Call a tool directly
        summary = await client.call_tool("get_dashboard_summary", {})
        print(summary)

asyncio.run(main())`;

  const getCurlSnippet = () => `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer mcp_dev_token_apex" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_dashboard_summary",
      "arguments": {}
    }
  }'`;

  // Live tool execution test
  const handleRunTestTool = async () => {
    setRunningTool(true);
    setToolResult(null);
    setToolError(null);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mcp_dev_token_apex",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: selectedTestTool,
            arguments: {},
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setToolError(data.error?.message || `HTTP ${res.status} Error`);
      } else {
        setToolResult(data.result);
      }
    } catch (err: any) {
      setToolError(err.message || "Failed to execute tool call");
    } finally {
      setRunningTool(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2.5 py-0.5 rounded-full">
              Universal Integration Hub
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
              90+ Tools Ready
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-indigo-400" />
            MCP for All AI Ecosystems
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            One standardized Model Context Protocol (MCP) server that connects your live retail database, inventory, and order operations to any frontier AI model or developer IDE.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Link
            href="/chatgpt-mcp"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            <span>ChatGPT Guide</span>
          </Link>
          <Link
            href="/gemini-mcp"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Gemini Guide</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>Settings</span>
          </Link>
        </div>
      </div>

      {/* Quick Universal Connection Credentials Strip */}
      <div className="p-5 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-purple-950/40 rounded-2xl border border-indigo-500/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <span>Universal Pre-Shared Credentials (Works on ALL AI Tools)</span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30 font-semibold self-start sm:self-auto">
            Permanent • No Expiry
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Universal Endpoint */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Streamable MCP Endpoint URL</span>
              <button
                type="button"
                onClick={() => copyToClipboard(endpointUrl, "url")}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {copiedKey === "url" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === "url" ? "Copied!" : "Copy URL"}</span>
              </button>
            </div>
            <div className="p-2 bg-slate-900 rounded-lg font-mono text-xs text-indigo-300 select-all truncate border border-slate-800">
              {endpointUrl}
            </div>
          </div>

          {/* Bearer Token */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Pre-Shared Bearer Auth Header</span>
              <button
                type="button"
                onClick={() => copyToClipboard("Bearer mcp_dev_token_apex", "token")}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {copiedKey === "token" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === "token" ? "Copied!" : "Copy Header"}</span>
              </button>
            </div>
            <div className="p-2 bg-slate-900 rounded-lg font-mono text-xs text-emerald-300 select-all truncate border border-slate-800">
              Bearer mcp_dev_token_apex
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Platform Tabs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Laptop className="w-4 h-4 text-indigo-400" />
            Select Your AI Client or Environment:
          </h2>
          <span className="text-xs text-slate-400">Click any card to view configuration</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {platforms.map((p) => {
            const isSelected = selectedPlatform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlatform(p.id)}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? "bg-indigo-950/50 border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500"
                    : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{p.icon}</span>
                  {p.popular && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                      Popular
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-bold text-white text-xs leading-snug">{p.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{p.vendor}</div>
                </div>
                <div className="text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
                  {p.badge}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Client Instruction Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl">
        {/* Tab 1: Claude Desktop & Claude Code */}
        {selectedPlatform === "claude" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌟</span>
                <div>
                  <h3 className="text-base font-bold text-white">Anthropic Claude Desktop &amp; Claude Code CLI</h3>
                  <p className="text-xs text-slate-400">Configure native Model Context Protocol support in Claude</p>
                </div>
              </div>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 font-mono px-2 py-0.5 rounded">
                Official MCP Founding Partner
              </span>
            </div>

            {/* Sub-option 1: Claude Desktop JSON */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <span>Option A: Claude Desktop Configuration (`claude_desktop_config.json`)</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(getClaudeDesktopJson(), "claude-json")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {copiedKey === "claude-json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === "claude-json" ? "Copied Config!" : "Copy JSON"}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                On Windows, save to: <code className="text-indigo-300 font-mono bg-slate-950 px-1 py-0.5 rounded">%APPDATA%\Claude\claude_desktop_config.json</code>
                <br />
                On macOS, save to: <code className="text-indigo-300 font-mono bg-slate-950 px-1 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>
              </p>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-200 overflow-x-auto">
                {getClaudeDesktopJson()}
              </pre>
            </div>

            {/* Sub-option 2: Claude Code CLI */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Option B: Claude Code CLI Terminal Command</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(getClaudeCodeCli(), "claude-cli")}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {copiedKey === "claude-cli" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === "claude-cli" ? "Copied CLI Command!" : "Copy Command"}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto select-all">
                {getClaudeCodeCli()}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: ChatGPT */}
        {selectedPlatform === "chatgpt" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="text-base font-bold text-white">OpenAI ChatGPT &amp; Custom GPTs</h3>
                  <p className="text-xs text-slate-400">Connect via Custom GPT Actions or OpenAI Developer Apps</p>
                </div>
              </div>
              <Link
                href="/chatgpt-mcp"
                className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Full ChatGPT Guide</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">1</span>
                  <span>Create a New Custom GPT or Action</span>
                </div>
                <p className="text-slate-400 pl-7">
                  Go to ChatGPT &gt; My GPTs &gt; Create a GPT &gt; Configure &gt; Add Actions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">2</span>
                  <span>Authentication Configuration</span>
                </div>
                <p className="text-slate-400 pl-7">
                  Under <strong>Authentication</strong>, choose <strong>API Key</strong> &gt; Auth Type: <strong>Bearer</strong>. Paste:
                </p>
                <div className="pl-7">
                  <code className="text-emerald-300 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    mcp_dev_token_apex
                  </code>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">3</span>
                  <span>Schema Import URL</span>
                </div>
                <p className="text-slate-400 pl-7">
                  Import OpenAPI schema directly from:
                </p>
                <div className="pl-7">
                  <code className="text-indigo-300 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 select-all">
                    {endpointUrl.replace("/api/mcp", "/api/chatgpt-actions/openapi.json")}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Google Gemini */}
        {selectedPlatform === "gemini" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✨</span>
                <div>
                  <h3 className="text-base font-bold text-white">Google Gemini Custom Connected Apps</h3>
                  <p className="text-xs text-slate-400">Streamable MCP protocol for Gemini Workspace &amp; Desktop</p>
                </div>
              </div>
              <Link
                href="/gemini-mcp"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Full Gemini Guide</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs text-slate-300">
              <p>
                Google Gemini Custom Apps connect directly to your Streamable MCP endpoint using standard Bearer Token authentication.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gemini App URL:</span>
                  <code className="text-indigo-300 font-mono text-xs select-all mt-1 block truncate">{endpointUrl}</code>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Bearer Secret Token:</span>
                  <code className="text-emerald-300 font-mono text-xs select-all mt-1 block">mcp_dev_token_apex</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Cursor IDE */}
        {selectedPlatform === "cursor" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="text-base font-bold text-white">Cursor IDE (`.cursor/mcp.json`)</h3>
                  <p className="text-xs text-slate-400">Add to project root or Cursor Features &gt; MCP Settings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(getCursorJson(), "cursor-json")}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {copiedKey === "cursor-json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "cursor-json" ? "Copied Cursor Config!" : "Copy .cursor/mcp.json"}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Create a file named <code className="text-indigo-300 font-mono bg-slate-950 px-1 py-0.5 rounded">.cursor/mcp.json</code> in your project workspace:
            </p>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-200 overflow-x-auto">
              {getCursorJson()}
            </pre>
          </div>
        )}

        {/* Tab 5: Windsurf IDE */}
        {selectedPlatform === "windsurf" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌊</span>
                <div>
                  <h3 className="text-base font-bold text-white">Windsurf IDE (Codeium Cascade)</h3>
                  <p className="text-xs text-slate-400">Configure in ~/.codeium/windsurf/mcp_config.json</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(getWindsurfJson(), "windsurf-json")}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {copiedKey === "windsurf-json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "windsurf-json" ? "Copied Windsurf Config!" : "Copy Config"}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Add this server configuration to <code className="text-indigo-300 font-mono bg-slate-950 px-1 py-0.5 rounded">~/.codeium/windsurf/mcp_config.json</code>:
            </p>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-200 overflow-x-auto">
              {getWindsurfJson()}
            </pre>
          </div>
        )}

        {/* Tab 6: Antigravity IDE */}
        {selectedPlatform === "antigravity" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🪐</span>
                <div>
                  <h3 className="text-base font-bold text-white">Google Antigravity &amp; Gemini IDE</h3>
                  <p className="text-xs text-slate-400">Native MCP Server integration in Google Antigravity config</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(getAntigravityJson(), "antigravity-json")}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {copiedKey === "antigravity-json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "antigravity-json" ? "Copied Config!" : "Copy Config"}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              In your Antigravity agent configuration (<code className="text-indigo-300 font-mono bg-slate-950 px-1 py-0.5 rounded">mcp_config.json</code>):
            </p>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-violet-200 overflow-x-auto">
              {getAntigravityJson()}
            </pre>
          </div>
        )}

        {/* Tab 7: VS Code Cline / Roo */}
        {selectedPlatform === "vscode" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💻</span>
                <div>
                  <h3 className="text-base font-bold text-white">VS Code (Cline, Roo Code, Continue)</h3>
                  <p className="text-xs text-slate-400">Configure inside cline_mcp_settings.json</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(getVsCodeJson(), "vscode-json")}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {copiedKey === "vscode-json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "vscode-json" ? "Copied VS Code Config!" : "Copy Config"}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-blue-200 overflow-x-auto">
              {getVsCodeJson()}
            </pre>
          </div>
        )}

        {/* Tab 8: Ollama & Open WebUI */}
        {selectedPlatform === "ollama" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🦙</span>
                <div>
                  <h3 className="text-base font-bold text-white">Ollama &amp; Open WebUI</h3>
                  <p className="text-xs text-slate-400">Connect local LLM agents to your live operations backend</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>
                In Open WebUI &gt; Admin Settings &gt; Tools &gt; Add MCP Server:
              </p>
              <div className="grid grid-cols-1 gap-2 pt-2">
                <div className="p-2.5 bg-slate-900 rounded border border-slate-800 font-mono">
                  Server URL: <span className="text-indigo-300">{endpointUrl}</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded border border-slate-800 font-mono">
                  Headers: <span className="text-emerald-300">&#123;&quot;Authorization&quot;: &quot;Bearer mcp_dev_token_apex&quot;&#125;</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 9: LangChain & Python */}
        {selectedPlatform === "langchain" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐍</span>
                <div>
                  <h3 className="text-base font-bold text-white">LangChain, LlamaIndex &amp; Python SDK</h3>
                  <p className="text-xs text-slate-400">Use standard Python MCP client library</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(getPythonSnippet(), "python-snippet")}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {copiedKey === "python-snippet" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "python-snippet" ? "Copied Python!" : "Copy Python"}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-200 overflow-x-auto">
              {getPythonSnippet()}
            </pre>
          </div>
        )}
      </div>

      {/* Live In-Browser MCP Tool Execution Sandbox */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Live In-Browser Tool Tester</h3>
              <p className="text-xs text-slate-400">Test live MCP execution against your production database</p>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-mono px-2 py-0.5 rounded border border-indigo-500/20 font-semibold self-start sm:self-auto">
            Live Streamable HTTP POST /api/mcp
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-300 block mb-1">Select Tool to Test:</label>
            <select
              value={selectedTestTool}
              onChange={(e) => setSelectedTestTool(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="get_dashboard_summary">get_dashboard_summary (Business Aggregates)</option>
              <option value="get_company_settings">get_company_settings (Store Profile &amp; Settings)</option>
              <option value="get_cancellation_policy">get_cancellation_policy (Cancellation Deduction Policy)</option>
              <option value="list_products">list_products (Catalog &amp; Stock Levels)</option>
              <option value="list_orders">list_orders (Recent Orders &amp; Fulfillment)</option>
              <option value="get_inventory_summary">get_inventory_summary (Physical/Reserved/Available)</option>
              <option value="list_audit_events">list_audit_events (Recent Operational Audit Trail)</option>
              <option value="get_user_profile">get_user_profile (Identity &amp; Scopes)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleRunTestTool}
            disabled={runningTool}
            className="self-end sm:self-auto mt-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer disabled:opacity-60 min-h-[42px]"
          >
            {runningTool ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{runningTool ? "Executing..." : "Run Tool Call"}</span>
          </button>
        </div>

        {toolError && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
            {toolError}
          </div>
        )}

        {toolResult && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> 200 OK • Tool Output:
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(JSON.stringify(toolResult, null, 2), "tool-result")}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {copiedKey === "tool-result" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === "tool-result" ? "Copied Result!" : "Copy Result"}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 max-h-72 overflow-y-auto">
              {JSON.stringify(toolResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Direct cURL Command Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Raw HTTP / cURL Command (Terminal Testing)</span>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(getCurlSnippet(), "curl-cmd")}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
          >
            {copiedKey === "curl-cmd" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === "curl-cmd" ? "Copied cURL!" : "Copy cURL"}</span>
          </button>
        </div>
        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto select-all">
          {getCurlSnippet()}
        </pre>
      </div>
    </div>
  );
}
