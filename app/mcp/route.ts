import { NextRequest } from "next/server";
import { GET as apiGet, POST as apiPost } from "../api/mcp/route";

// Support direct /mcp endpoint as recommended by OpenAI / MCP Inspector
export async function POST(request: NextRequest) {
  return apiPost(request);
}

export async function GET(request: NextRequest) {
  return apiGet(request);
}
