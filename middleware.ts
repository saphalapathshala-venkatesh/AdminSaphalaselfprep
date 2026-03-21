import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Cookie is present — allow the request through.
  // Full session validation (expiry, revocation, role) is enforced in every
  // API route via getSessionUserFromRequest / getSessionUser.  Running a DB
  // round-trip here in Vercel edge middleware causes self-call failures that
  // redirect valid users back to /login.
  return NextResponse.next();
}
