/** Quién ejecuta una mutación auditada — nunca inferido, siempre explícito en cada llamada. */
export interface AuditActor {
  actorType: string;
  actorId: string;
}
