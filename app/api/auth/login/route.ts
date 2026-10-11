import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureAdminUser } from "@/lib/db/client";
import { users, workspaceMemberships, workspaces } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { verifyPassword, createSessionToken, SessionPayload } from "@/lib/auth/session";
import { UserRole } from "@/lib/permissions/roles";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, rememberMe, returnTo } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim();
    const cleanPassword = String(password).trim();

    const db = await getDb();
    // Ensure seveton account is provisioned in the database
    await ensureAdminUser(db);

    // Look up user by username, email, or name (case-insensitive)
    const lowerUsername = cleanUsername.toLowerCase();
    const [user] = await (db as any)
      .select()
      .from(users)
      .where(
        or(
          sql`LOWER(${users.username}) = ${lowerUsername}`,
          sql`LOWER(${users.email}) = ${lowerUsername}`,
          sql`LOWER(${users.email}) = ${`${lowerUsername}@apexlogistics.com`}`,
          sql`LOWER(${users.name}) = ${lowerUsername}`
        )
      )
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Verify password against bcrypt hash
    const isPasswordValid = await verifyPassword(cleanPassword, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Lookup workspace membership
    const [membership] = await (db as any)
      .select({
        role: workspaceMemberships.role,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
      })
      .from(workspaceMemberships)
      .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
      .where(eq(workspaceMemberships.userId, user.id))
      .limit(1);

    const payload: SessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      username: user.username || user.name,
      workspaceId: membership?.workspaceId || "ws_apex_main",
      role: (membership?.role || "OWNER") as UserRole,
      workspaceName: membership?.workspaceName || "Apex Logistics & Retail",
    };

    const isRememberMe = Boolean(rememberMe);
    const token = await createSessionToken(payload, isRememberMe);

    // Determine cookie lifetime: 30 days for "Remember me", 1 day otherwise
    const maxAge = isRememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: payload.role,
        workspaceId: payload.workspaceId,
      },
      redirectUrl: returnTo && returnTo.startsWith("/") ? returnTo : "/",
    });

    response.cookies.set("apex_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return response;
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal authentication error" },
      { status: 500 }
    );
  }
}
