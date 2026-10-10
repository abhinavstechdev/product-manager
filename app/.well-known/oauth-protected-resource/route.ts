import { NextResponse } from "next/server";
import { ALL_MCP_SCOPES } from "@/lib/permissions/roles";
import { getBaseUrl, getMcpUrl } from "@/lib/config/urls";

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);
  const mcpUrl = getMcpUrl(request);

  return NextResponse.json({
    resource: mcpUrl,
    authorization_servers: [`${baseUrl}`],
    scopes_supported: ALL_MCP_SCOPES,
    bearer_methods_supported: ["header"],
  });
}
