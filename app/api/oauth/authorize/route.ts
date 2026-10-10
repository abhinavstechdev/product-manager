import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { oauthApplications, oauthGrants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const responseType = searchParams.get("response_type");
  const scope = searchParams.get("scope") || "dashboard:read products:read orders:read";
  const state = searchParams.get("state") || "";
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";

  if (!clientId || !redirectUri || responseType !== "code") {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing client_id, redirect_uri, or response_type" },
      { status: 400 }
    );
  }

  if (!codeChallenge) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "PKCE code_challenge is required for OAuth 2.1" },
      { status: 400 }
    );
  }

  const session = await getSession();
  const db = await getDb();

  // Validate or auto-register client if standard dynamic client
  let [app] = await (db as any)
    .select()
    .from(oauthApplications)
    .where(eq(oauthApplications.clientId, clientId))
    .limit(1);

  if (!app) {
    // Register dynamic client
    const appId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await (db as any).insert(oauthApplications).values({
      id: appId,
      workspaceId: session.workspaceId,
      clientId,
      clientName: "Remote MCP Assistant",
      redirectUris: JSON.stringify([redirectUri]),
      scopes: scope,
      createdAt: new Date(),
    });
  }

  // Issue Authorization Code
  const code = `code_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
  const grantId = `grt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await (db as any).insert(oauthGrants).values({
    id: grantId,
    code,
    clientId,
    userId: session.userId,
    workspaceId: session.workspaceId,
    scopes: scope,
    codeChallenge,
    codeChallengeMethod,
    redirectUri,
    expiresAt,
  });

  // Redirect back to client callback
  const targetRedirect = new URL(redirectUri);
  targetRedirect.searchParams.set("code", code);
  if (state) targetRedirect.searchParams.set("state", state);

  return NextResponse.redirect(targetRedirect.toString());
}
