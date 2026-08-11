import { IdempotencyConflictError, IdempotencyInProgressError } from "../../../domain";
import { IDEMPOTENCY_PENDING_STATUS, type IdempotencyRepository } from "../ports/idempotency-repository.port";

const POLL_INTERVAL_MS = 40;
const MAX_POLL_ATTEMPTS = 25; // ~1s de espera máxima antes de rendirse

export interface WithIdempotencyDeps {
  idempotency: IdempotencyRepository;
}

export interface WithIdempotencyInput {
  apiClientId: string;
  idempotencyKey: string;
  requestHash: string;
  ttlMs: number;
  now: Date;
}

export interface IdempotentExecutionResult<T> {
  status: number;
  body: T;
  /** true si esta llamada ejecutó la mutación; false si devolvió un resultado ya resuelto por otra llamada. */
  executed: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Garantiza que una mutación con la misma Idempotency-Key + el mismo
 * payload (requestHash) se ejecute exactamente una vez, sin importar
 * cuántas llamadas concurrentes lleguen con esa key: la que gana la
 * reserva atómica ejecuta `execute`; el resto espera (poll corto) el
 * resultado y lo devuelve sin re-ejecutar nada. La misma key con un
 * requestHash distinto nunca se acepta en silencio — se rechaza con
 * IdempotencyConflictError.
 *
 * `execute` debe modelar sus fallos "esperables" como `{status, body}`
 * (p. ej. {status: 409, body: {...}}) en vez de lanzarlos — así también
 * quedan cacheados para reintentos futuros idénticos. Una excepción
 * realmente inesperada sí se relanza (con status 500 finalizado en el
 * registro, para no dejar la reserva trabada para siempre).
 */
export async function withIdempotency<T>(
  deps: WithIdempotencyDeps,
  input: WithIdempotencyInput,
  execute: () => Promise<{ status: number; body: T }>
): Promise<IdempotentExecutionResult<T>> {
  const expiresAt = new Date(input.now.getTime() + input.ttlMs);
  const reservation = await deps.idempotency.reserve({
    apiClientId: input.apiClientId,
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    expiresAt,
  });

  if (reservation.outcome === "reserved") {
    try {
      const { status, body } = await execute();
      // Si `execute` ya mutó con éxito, un fallo al finalizar la reserva de
      // idempotencia (p. ej. un permiso SQL faltante — pasó en producción
      // real, F9) nunca debe convertir una escritura exitosa en un 500: el
      // caller ya obtuvo el resultado correcto, solo se pierde la garantía
      // de que un reintento futuro con la misma key lo encuentre cacheado.
      try {
        await deps.idempotency.finalize(reservation.id, { responseStatus: status, responseBody: body });
      } catch (finalizeError) {
        console.error("No se pudo finalizar la reserva de idempotencia (la mutación sí se ejecutó)", finalizeError);
      }
      return { status, body, executed: true };
    } catch (error) {
      // Un fallo al finalizar-con-error nunca debe enmascarar la excepción
      // real que causó el fallo original — si eso pasa, quien llama ve un
      // 500 genérico sin poder distinguir la causa real de un problema de
      // infraestructura de idempotencia (pasó en producción real, F9).
      const message = error instanceof Error ? error.message : String(error);
      try {
        await deps.idempotency.finalize(reservation.id, { responseStatus: 500, responseBody: { error: message } });
      } catch (finalizeError) {
        console.error("No se pudo finalizar la reserva de idempotencia tras un error", finalizeError);
      }
      throw error;
    }
  }

  let record = reservation.record;
  if (record.requestHash !== input.requestHash) {
    throw new IdempotencyConflictError(`Idempotency-Key "${input.idempotencyKey}" ya se usó con un payload distinto`);
  }

  for (let attempt = 0; record.responseStatus === IDEMPOTENCY_PENDING_STATUS && attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const refreshed = await deps.idempotency.findByKey(input.apiClientId, input.idempotencyKey);
    if (!refreshed) break;
    record = refreshed;
  }

  if (record.responseStatus === IDEMPOTENCY_PENDING_STATUS) {
    throw new IdempotencyInProgressError(
      `La request original con Idempotency-Key "${input.idempotencyKey}" todavía se está procesando`
    );
  }

  return { status: record.responseStatus, body: record.responseBody as T, executed: false };
}
