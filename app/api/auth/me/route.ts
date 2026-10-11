import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
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
      workspaceName: session.workspaceName,
    },
  });
}
