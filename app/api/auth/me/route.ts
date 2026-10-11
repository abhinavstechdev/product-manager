import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getOptionalSession();
  const workspaceId = session?.workspaceId || "ws_apex_main";
  let liveCompanyName = "Apex Logistics";
  let liveLogoUrl = "";
  let liveCurrency = "INR";

  try {
    const db = await getDb();
    const [ws] = await (db as any)
      .select({
        id: workspaces.id,
        name: workspaces.name,
        companyName: workspaces.companyName,
        logoUrl: workspaces.companyLogoUrl,
        currency: workspaces.currency,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (ws) {
      liveCompanyName = ws.companyName || ws.name || "Apex Logistics";
      liveLogoUrl = ws.logoUrl || "";
      liveCurrency = ws.currency || "INR";
    }
  } catch (err) {
    console.error("Error reading workspace in /api/auth/me:", err);
  }

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      workspace: {
        workspaceId,
        companyName: liveCompanyName,
        workspaceName: liveCompanyName,
        logoUrl: liveLogoUrl,
        currency: liveCurrency,
      },
    }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: session.userId,
      email: session.email,
      name: session.name,
      username: session.username,
      workspaceId: session.workspaceId,
      role: session.role,
      workspaceName: liveCompanyName,
      companyName: liveCompanyName,
      logoUrl: liveLogoUrl,
      currency: liveCurrency,
    },
    workspace: {
      workspaceId: session.workspaceId,
      companyName: liveCompanyName,
      workspaceName: liveCompanyName,
      logoUrl: liveLogoUrl,
      currency: liveCurrency,
    },
  });
}
