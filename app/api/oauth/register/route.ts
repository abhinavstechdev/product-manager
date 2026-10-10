import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { oauthApplications } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { ALL_MCP_SCOPES } from "@/lib/permissions/roles";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientName = body.client_name || "Custom MCP Client";
    const redirectUris = body.redirect_uris || ["http://localhost:3000/callback"];
    const scopes = body.scope || ALL_MCP_SCOPES.join(" ");

    const session = await getSession();
    const db = await getDb();

    const clientId = `client_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    const appId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await (db as any).insert(oauthApplications).values({
      id: appId,
      workspaceId: session.workspaceId,
      clientId,
      clientName,
      redirectUris: JSON.stringify(redirectUris),
      scopes,
      createdAt: new Date(),
    });

    return NextResponse.json({
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      scope: scopes,
      token_endpoint_auth_method: "none",
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: "server_error", error_description: err?.message }, { status: 500 });
  }
}
