const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";

export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
  );
}
