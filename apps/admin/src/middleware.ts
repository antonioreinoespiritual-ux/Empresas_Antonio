import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Fase 1: verificar sesión de AdminUser (cookie admin_auth) + permiso por módulo
// antes de servir cualquier ruta del dashboard.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/orders/:path*", "/products/:path*", "/users/:path*"],
};
