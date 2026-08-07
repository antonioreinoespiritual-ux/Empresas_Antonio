import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Fase 1: verificar sesión de User (cookie user_auth) antes de servir /account/*.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*"],
};
