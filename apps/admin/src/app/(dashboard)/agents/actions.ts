"use server";

import { revalidatePath } from "next/cache";
import { issueApiKey } from "@repo/core/application";
import { agentAccess } from "@/lib/agent-access";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function createApiClientAction(input: {
  name: string;
  description?: string;
  forceReadOnly?: boolean;
  allowedOfferIds?: string[] | null;
}): Promise<{ ok: boolean; error?: string; clientId?: string }> {
  const session = await requireAdminSession();
  try {
    const client = await agentAccess.apiClients.create(
      {
        name: input.name,
        description: input.description ?? null,
        forceReadOnly: input.forceReadOnly ?? false,
        allowedOfferIds: input.allowedOfferIds,
        createdByAdminId: session.user.id,
      },
      { actorType: "admin", actorId: session.user.id }
    );
    revalidatePath("/agents");
    return { ok: true, clientId: client.id };
  } catch {
    return { ok: false, error: "No se pudo crear el cliente" };
  }
}

export async function setApiClientStatusAction(
  clientId: string,
  status: "ACTIVE" | "SUSPENDED"
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminSession();
  try {
    await agentAccess.apiClients.setStatus(clientId, status, { actorType: "admin", actorId: session.user.id });
    revalidatePath("/agents");
    revalidatePath(`/agents/${clientId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado" };
  }
}

export async function setForceReadOnlyAction(
  clientId: string,
  forceReadOnly: boolean
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminSession();
  try {
    await agentAccess.apiClients.setForceReadOnly(clientId, forceReadOnly, { actorType: "admin", actorId: session.user.id });
    revalidatePath(`/agents/${clientId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar forceReadOnly" };
  }
}

export async function setAllowedOfferIdsAction(
  clientId: string,
  allowedOfferIds: string[] | null
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminSession();
  try {
    await agentAccess.apiClients.setAllowedOfferIds(clientId, allowedOfferIds, { actorType: "admin", actorId: session.user.id });
    revalidatePath(`/agents/${clientId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar allowedOfferIds" };
  }
}

export async function issueApiKeyAction(
  clientId: string,
  scopes: string[]
): Promise<{ ok: boolean; error?: string; plaintextKey?: string }> {
  const session = await requireAdminSession();
  try {
    const result = await issueApiKey(
      { apiClients: agentAccess.apiClients, apiKeys: agentAccess.apiKeys, hasher: agentAccess.hasher, secretGenerator: agentAccess.secretGenerator },
      { apiClientId: clientId, scopes },
      { actorType: "admin", actorId: session.user.id }
    );
    revalidatePath(`/agents/${clientId}`);
    return { ok: true, plaintextKey: result.plaintextKey };
  } catch {
    return { ok: false, error: "No se pudo emitir la key" };
  }
}

export async function revokeApiKeyAction(clientId: string, keyId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminSession();
  try {
    await agentAccess.apiKeys.revoke(keyId, { actorType: "admin", actorId: session.user.id });
    revalidatePath(`/agents/${clientId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo revocar la key" };
  }
}

/**
 * Rotar = revocar la key actual + emitir una nueva con los mismos scopes —
 * dos mutaciones ya atómicas cada una (issue()/revoke() auditan en su
 * propia transacción), no una tercera operación de dominio nueva.
 */
export async function rotateApiKeyAction(
  clientId: string,
  keyId: string,
  scopes: string[]
): Promise<{ ok: boolean; error?: string; plaintextKey?: string }> {
  const session = await requireAdminSession();
  try {
    const issued = await issueApiKey(
      { apiClients: agentAccess.apiClients, apiKeys: agentAccess.apiKeys, hasher: agentAccess.hasher, secretGenerator: agentAccess.secretGenerator },
      { apiClientId: clientId, scopes },
      { actorType: "admin", actorId: session.user.id }
    );
    await agentAccess.apiKeys.revoke(keyId, { actorType: "admin", actorId: session.user.id });
    revalidatePath(`/agents/${clientId}`);
    return { ok: true, plaintextKey: issued.plaintextKey };
  } catch {
    return { ok: false, error: "No se pudo rotar la key" };
  }
}
