import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  ApiKeyHasher,
  ApiKeySecretGenerator,
  ApiKeySecretMaterial,
} from "../../application/agent-access/ports/api-key-crypto.port";

// SHA-256 simple (sin salt) es suficiente aquí porque el secreto ya tiene
// alta entropía propia (32 bytes aleatorios) — a diferencia de una
// contraseña humana, no hace falta un hash costoso (scrypt/bcrypt) para
// defenderse de diccionario/fuerza bruta sobre el secreto en sí. Lo que sí
// importa es no comparar el hash con `===` (timing attack) — de ahí
// timingSafeEqual en verify().
export class NodeApiKeyHasher implements ApiKeyHasher {
  hash(secret: string): string {
    return createHash("sha256").update(secret, "utf8").digest("hex");
  }

  verify(secret: string, hash: string): boolean {
    const candidate = Buffer.from(this.hash(secret), "hex");
    const expected = Buffer.from(hash, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  }
}

export class NodeApiKeySecretGenerator implements ApiKeySecretGenerator {
  generate(): ApiKeySecretMaterial {
    return {
      keyPrefix: `ak_${randomBytes(9).toString("base64url")}`,
      secret: randomBytes(32).toString("base64url"),
    };
  }
}
