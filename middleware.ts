import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const verifyUrl = new URL("/api/auth/me", req.url);
  try {
    const res = await fetch(verifyUrl.toString(), {
      headers: { Cookie: `admin_session=${token}` },
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const data = await res.json();
    if (!data.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = data.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
