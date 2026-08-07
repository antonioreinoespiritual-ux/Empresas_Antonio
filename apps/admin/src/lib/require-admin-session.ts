import { headers } from "next/headers";
import { adminAuth } from "@repo/core/infrastructure";

/**
 * El layout del dashboard solo protege la navegación por página: una Server
 * Action se puede invocar directamente (POST al endpoint generado) sin pasar
 * por ahí. Cada acción que escribe datos debe llamar esto primero.
 */
export async function requireAdminSession() {
  const session = await adminAuth.api.getSession({ headers: headers() });
  if (!session) {
    throw new Error("No autenticado");
  }
  return session;
}
