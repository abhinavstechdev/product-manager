import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { oauthApplications, oauthGrants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOptionalSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const responseType = searchParams.get("response_type");
  const scope = searchParams.get("scope") || "dashboard:read products:read orders:read inventory:read";
  const state = searchParams.get("state") || "";
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";

  if (!clientId || !redirectUri || responseType !== "code") {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing client_id, redirect_uri, or response_type" },
      { status: 400 }
    );
  }

  // 1. Verify user is authenticated
  const session = await getOptionalSession();
  if (!session) {
    // Redirect unauthenticated visitors to login page and preserve return_to
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("return_to", request.url);
    return NextResponse.redirect(loginUrl.toString());
  }

  // 2. Redirect authenticated user to Grant Permission consent screen
  const consentUrl = new URL("/oauth/consent", request.url);
  searchParams.forEach((val, key) => {
    consentUrl.searchParams.set(key, val);
  });
  return NextResponse.redirect(consentUrl.toString());
}

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", error_description: "Active user session required to authorize applications" },
      { status: 401 }
    );
  }

  let body: any = {};
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    body = Object.fromEntries(formData.entries());
  } else {
    body = await request.json().catch(() => ({}));
  }

  const clientId = body.client_id || body.clientId;
  const redirectUri = body.redirect_uri || body.redirectUri;
  const scope = body.scope || "dashboard:read products:read orders:read inventory:read";
  const state = body.state || "";
  const codeChallenge = body.code_challenge || body.codeChallenge;
  const codeChallengeMethod = body.code_challenge_method || body.codeChallengeMethod || "S256";
  const action = body.action || "grant";

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing client_id or redirect_uri" },
      { status: 400 }
    );
  }

  // Handle user denial
  if (action === "deny") {
    const targetRedirect = new URL(redirectUri);
    targetRedirect.searchParams.set("error", "access_denied");
    targetRedirect.searchParams.set("error_description", "User rejected permission request");
    if (state) targetRedirect.searchParams.set("state", state);

    if (contentType.includes("application/x-www-form-urlencoded")) {
      return NextResponse.redirect(targetRedirect.toString());
    }
    return NextResponse.json({ redirectUrl: targetRedirect.toString() });
  }

  const effectiveCodeChallenge = codeChallenge || "client_secret_auth";
  const effectiveCodeChallengeMethod = codeChallenge ? codeChallengeMethod : "none";

  const db = await getDb();

  // Validate or auto-register client if standard dynamic client
  let [app] = await (db as any)
    .select()
    .from(oauthApplications)
    .where(eq(oauthApplications.clientId, clientId))
    .limit(1);

  if (!app) {
    const appId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clientName = clientId.toLowerCase().includes("gemini")
      ? "Google Gemini MCP"
      : "ChatGPT / Remote AI Assistant";
    await (db as any).insert(oauthApplications).values({
      id: appId,
      workspaceId: session.workspaceId,
      clientId,
      clientName,
      redirectUris: JSON.stringify([redirectUri]),
      scopes: scope,
      createdAt: new Date(),
    });
  }

  // Issue Authorization Code tied to authenticated session account (seveton)
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
    codeChallenge: effectiveCodeChallenge,
    codeChallengeMethod: effectiveCodeChallengeMethod,
    redirectUri,
    expiresAt,
  });

  // Construct target redirect
  const targetRedirect = new URL(redirectUri);
  targetRedirect.searchParams.set("code", code);
  if (state) targetRedirect.searchParams.set("state", state);

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return NextResponse.redirect(targetRedirect.toString());
  }

  return NextResponse.json({ redirectUrl: targetRedirect.toString() });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
