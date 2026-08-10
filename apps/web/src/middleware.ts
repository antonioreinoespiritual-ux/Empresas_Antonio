import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// F5 (PLAN-AGENT-API-01): el token de preview viaja en la URL, así que
// puede quedar en logs de acceso o en el header Referer de un recurso
// cargado dentro de la página — estos headers no protegen contra esa
// exposición inherente de la URL (para eso está el TTL corto + revocación
// del propio token), pero sí evitan que la página quede cacheada,
// indexada, o que un click hacia afuera filtre la URL completa vía Referer.
function withPreviewHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

// Chequeo optimista compatible con el runtime Edge (sin acceso a Prisma).
// La verificación autoritativa de sesión ocurre en (account)/layout.tsx (Node runtime).
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/preview/")) {
    return withPreviewHeaders(NextResponse.next());
  }

  const sessionCookie = getSessionCookie(request, { cookiePrefix: "user_auth" });
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/preview/:path*"],
};
