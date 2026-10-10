import { NextRequest, NextResponse } from "next/server";
import { verifyMcpToken } from "@/lib/auth/oauth";
import { createMcpServer } from "@/lib/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";


export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const principal = await verifyMcpToken(authHeader);

  if (!principal) {
    return new NextResponse(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Unauthorized: Valid OAuth 2.1 Bearer token required in Authorization header",
        },
        id: null,
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer error="invalid_token", realm="mcp"',
        },
      }
    );
  }

  try {
    const server = createMcpServer(principal);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode for serverless compatibility
      enableJsonResponse: true,
    });

    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (err: any) {
    console.error("MCP request handler error:", err);
    return new NextResponse(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: err?.message || "Internal MCP Server error",
        },
        id: null,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  // Discovery or SSE handshake endpoint
  const authHeader = request.headers.get("authorization");
  const principal = await verifyMcpToken(authHeader);

  if (!principal) {
    return NextResponse.json(
      {
        status: "active",
        service: "Apex AI Inventory & Order MCP Server",
        protocol: "Model Context Protocol (Streamable HTTP)",
        version: "1.0.0",
        authentication: "OAuth 2.1 Bearer Token required for tool calls",
        tokenEndpoint: "/api/oauth/token",
        authorizationEndpoint: "/api/oauth/authorize",
      },
      {
        headers: {
          "WWW-Authenticate": 'Bearer realm="mcp"',
        },
      }
    );
  }

  const server = createMcpServer(principal);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return await transport.handleRequest(request);
}
