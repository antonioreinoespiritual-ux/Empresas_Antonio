export class DomainError extends Error {}
export class NotFoundError extends DomainError {}
export class ConflictError extends DomainError {}

/** CAS de Page.version fallido: otra escritura ganó la carrera — el llamador debe releer y reintentar, nunca pisar a ciegas. */
export class VersionConflictError extends ConflictError {}

/** Límite de requests superado dentro de la ventana vigente (ApiRateLimitBucket). */
export class RateLimitExceededError extends DomainError {}

/** Misma Idempotency-Key con un payload distinto al de la primera vez que se usó. */
export class IdempotencyConflictError extends ConflictError {}

/** La primera request con esta Idempotency-Key todavía se está procesando — reintentar en breve, nunca ejecutar en paralelo. */
export class IdempotencyInProgressError extends DomainError {}
