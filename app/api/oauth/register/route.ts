import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { oauthApplications } from "@/lib/db/schema";
import { getOptionalSession } from "@/lib/auth/session";
import { ALL_MCP_SCOPES } from "@/lib/permissions/roles";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientName = body.client_name || "Google Gemini / Remote MCP Client";
    const redirectUris = body.redirect_uris || ["http://localhost:3000/callback"];
    const scopes = body.scope || ALL_MCP_SCOPES.join(" ");

    // Dynamic Client Registration (RFC 7591) does not require an active user session cookie.
    // The user authenticates later at the authorization endpoint.
    const session = await getOptionalSession();
    const workspaceId = session?.workspaceId || "ws_apex_main";
    const db = await getDb();

    const clientId = `client_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    const clientSecret = `sec_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    const appId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await (db as any).insert(oauthApplications).values({
      id: appId,
      workspaceId,
      clientId,
      clientName,
      redirectUris: JSON.stringify(redirectUris),
      scopes,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        client_id: clientId,
        client_secret: clientSecret,
        client_name: clientName,
        redirect_uris: redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_post",
        scope: scopes,
      },
      {
        status: 201,
        headers: CORS_HEADERS,
      }
    );
  } catch (err: any) {
    console.error("OAuth registration error:", err);
    return NextResponse.json(
      { error: "server_error", error_description: err?.message || "Failed to register client" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
