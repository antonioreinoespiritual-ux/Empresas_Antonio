/** Sentinel de "todavía procesándose" — todo status HTTP real es >= 100. */
export const IDEMPOTENCY_PENDING_STATUS = 0;

export interface IdempotencyRecordSnapshot {
  id: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
}

export type ReserveIdempotencyKeyResult =
  | { outcome: "reserved"; id: string }
  | { outcome: "existing"; record: IdempotencyRecordSnapshot };

export interface IdempotencyRepository {
  /**
   * INSERT atómico con un placeholder (IDEMPOTENCY_PENDING_STATUS) — exactamente
   * un llamador concurrente con la misma (apiClientId, idempotencyKey) recibe
   * "reserved"; el resto recibe "existing" con la fila real, sea que ya
   * esté resuelta o siga en curso.
   */
  reserve(input: {
    apiClientId: string;
    idempotencyKey: string;
    requestHash: string;
    expiresAt: Date;
  }): Promise<ReserveIdempotencyKeyResult>;
  finalize(id: string, result: { responseStatus: number; responseBody: unknown }): Promise<void>;
  findByKey(apiClientId: string, idempotencyKey: string): Promise<IdempotencyRecordSnapshot | null>;
}
