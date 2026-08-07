import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Carga el .env de la raíz del monorepo (no committeado) — estas pruebas
// requieren una base de datos Postgres real vía DATABASE_URL.
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../.env") });
