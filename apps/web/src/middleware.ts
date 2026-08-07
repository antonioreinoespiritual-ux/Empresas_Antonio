import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Chequeo optimista compatible con el runtime Edge (sin acceso a Prisma).
// La verificación autoritativa de sesión ocurre en (account)/layout.tsx (Node runtime).
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request, { cookiePrefix: "user_auth" });
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*"],
};
