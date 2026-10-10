import { NextResponse } from "next/server";
import { ALL_MCP_SCOPES } from "@/lib/permissions/roles";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = process.env.APP_BASE_URL || `${url.protocol}//${url.host}`;

  return NextResponse.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    registration_endpoint: `${baseUrl}/api/oauth/register`,
    revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ALL_MCP_SCOPES,
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
  });
}
