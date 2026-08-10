export type ApiClientStatus = "ACTIVE" | "SUSPENDED";

export interface ApiClient {
  id: string;
  name: string;
  description: string | null;
  status: ApiClientStatus;
  forceReadOnly: boolean;
  /** null = todas las Offers; [] = ninguna; array = allow-list explícita. */
  allowedOfferIds: string[] | null;
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Kill switch por cliente: un ApiClient SUSPENDED no puede autenticar ninguna de sus keys. */
export function isClientUsable(client: ApiClient): boolean {
  return client.status === "ACTIVE";
}

export function isOfferAllowed(client: ApiClient, offerId: string): boolean {
  if (client.allowedOfferIds === null) return true;
  return client.allowedOfferIds.includes(offerId);
}
