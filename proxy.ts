import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "super-secure-production-secret-key-32-chars-long"
);

// Public paths that do not require authentication
const PUBLIC_PREFIXES = [
  "/login",
  "/oauth/consent",
  "/bill",
  "/api/bill",
  "/api/auth",
  "/api/health",
  "/api/mcp",
  "/api/oauth",
  "/.well-known",
  "/_next",
  "/favicon.ico",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public routes
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    // If user is already authenticated and visits /login, redirect to dashboard
    if (pathname === "/login") {
      const token = request.cookies.get("apex_session")?.value;
      if (token) {
        try {
          await jwtVerify(token, JWT_SECRET);
          const returnTo = request.nextUrl.searchParams.get("return_to") || "/";
          return NextResponse.redirect(new URL(returnTo, request.url));
        } catch {
          // Token invalid, allow login page
        }
      }
    }
    return NextResponse.next();
  }

  // 2. Check apex_session cookie
  const token = request.cookies.get("apex_session")?.value;

  if (!token) {
    // If API request, return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    // For web page requests, redirect to login page with return_to
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("return_to", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify JWT
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    // Invalid or expired token -> clear cookie and redirect
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json(
        { error: "Unauthorized: Session expired or invalid" },
        { status: 401 }
      );
      res.cookies.delete("apex_session");
      return res;
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("return_to", pathname + request.nextUrl.search);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("apex_session");
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files with extensions (.png, .jpg, .svg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
