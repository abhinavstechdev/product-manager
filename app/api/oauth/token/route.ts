import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { oauthGrants, oauthTokens } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPkce } from "@/lib/auth/oauth";

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
    let body: any = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      body = await request.json().catch(() => ({}));
    }

    const grantType = body.grant_type;
    const db = await getDb();

    if (grantType === "authorization_code") {
      const { code, redirect_uri, client_id, code_verifier } = body;

      if (!code) {
        return NextResponse.json(
          { error: "invalid_request", error_description: "Missing authorization code" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const [grant] = await (db as any)
        .select()
        .from(oauthGrants)
        .where(eq(oauthGrants.code, code))
        .limit(1);

      if (!grant) {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "Invalid authorization code" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (grant.usedAt) {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "Authorization code has already been used" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (new Date() > new Date(grant.expiresAt)) {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "Authorization code has expired" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Verify PKCE code_verifier against code_challenge if required
      if (grant.codeChallenge && grant.codeChallenge !== "client_secret_auth") {
        if (!code_verifier) {
          return NextResponse.json(
            { error: "invalid_request", error_description: "Missing PKCE code_verifier" },
            { status: 400, headers: CORS_HEADERS }
          );
        }
        const isPkceValid = verifyPkce(code_verifier, grant.codeChallenge, grant.codeChallengeMethod);
        if (!isPkceValid) {
          return NextResponse.json(
            { error: "invalid_grant", error_description: "PKCE verification failed: code_verifier does not match code_challenge" },
            { status: 400, headers: CORS_HEADERS }
          );
        }
      }

      // Mark code as used
      await (db as any)
        .update(oauthGrants)
        .set({ usedAt: new Date() })
        .where(eq(oauthGrants.id, grant.id));

      // Generate Access Token and Refresh Token
      const accessToken = `mcp_at_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      const refreshToken = `mcp_rt_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      const tokenId = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const expiresInSeconds = 86400 * 30; // 30 days
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      await (db as any).insert(oauthTokens).values({
        id: tokenId,
        accessToken,
        refreshToken,
        clientId: grant.clientId,
        userId: grant.userId,
        workspaceId: grant.workspaceId,
        scopes: grant.scopes,
        expiresAt,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      });

      return NextResponse.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresInSeconds,
        refresh_token: refreshToken,
        scope: grant.scopes,
      }, { headers: CORS_HEADERS });
    }

    if (grantType === "refresh_token") {
      const { refresh_token } = body;
      if (!refresh_token) {
        return NextResponse.json(
          { error: "invalid_request", error_description: "Missing refresh_token" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const [tokenRecord] = await (db as any)
        .select()
        .from(oauthTokens)
        .where(eq(oauthTokens.refreshToken, refresh_token))
        .limit(1);

      if (!tokenRecord || tokenRecord.revokedAt) {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "Invalid or revoked refresh token" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const newAccessToken = `mcp_at_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      const expiresInSeconds = 86400 * 30;
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      await (db as any)
        .update(oauthTokens)
        .set({
          accessToken: newAccessToken,
          expiresAt,
          lastUsedAt: new Date(),
        })
        .where(eq(oauthTokens.id, tokenRecord.id));

      return NextResponse.json({
        access_token: newAccessToken,
        token_type: "Bearer",
        expires_in: expiresInSeconds,
        refresh_token: tokenRecord.refreshToken,
        scope: tokenRecord.scopes,
      }, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { error: "unsupported_grant_type", error_description: "Only authorization_code and refresh_token are supported" },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("OAuth token error:", err);
    return NextResponse.json(
      { error: "server_error", error_description: err?.message || "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
