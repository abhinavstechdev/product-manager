import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { oauthTokens } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

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

    const token = body.token;
    if (!token) {
      return NextResponse.json({ error: "invalid_request", error_description: "Missing token parameter" }, { status: 400 });
    }

    const db = await getDb();
    await (db as any)
      .update(oauthTokens)
      .set({ revokedAt: new Date() })
      .where(or(eq(oauthTokens.accessToken, token), eq(oauthTokens.refreshToken, token)));

    return NextResponse.json({ success: true, message: "Token revoked" });
  } catch (err: any) {
    return NextResponse.json({ error: "server_error", error_description: err?.message }, { status: 500 });
  }
}
