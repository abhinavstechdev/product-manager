import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as resetService from "@/lib/services/reset-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json().catch(() => ({}));
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Master security authorization password is required." },
        { status: 400 }
      );
    }

    const result = await resetService.executeFactoryReset({
      workspaceId: session.workspaceId,
      password,
      confirmed: true,
      actor: {
        id: session.userId,
        name: session.name,
        type: "USER",
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, status: result.status },
        { status: 403 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error during factory reset." },
      { status: 500 }
    );
  }
}
