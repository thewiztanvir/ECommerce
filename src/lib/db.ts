/**
 * Database Client Singleton & Concurrency Engine
 * Complies with PRD Section 16, Section 9.3 and ADR-002.
 *
 * Responsibilities:
 * 1. Maintain a single PrismaClient instance across hot-module reloads in Next.js.
 * 2. Configure logging and connection safety.
 * 3. Provide atomic inventory reservation primitives guaranteeing ZERO overselling under race conditions.
 */

import { PrismaClient, Prisma } from "@prisma/client";

declare global {
  // Prevent multiple instances in Next.js development hot-reloading
  // eslint-disable-next-line no-var
  var __prismaClientInstance: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalThis.__prismaClientInstance ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClientInstance = prisma;
}

export default prisma;

// Re-export Prisma types for cross-domain usage
export { PrismaClient, Prisma };

/**
 * Health check helper to verify database connectivity and measure latency.
 */
export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    // Simple ANSI-standard ping query
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Atomically reserve inventory for a given variant using a conditional SQL update.
 * Guarantees zero overselling under concurrent checkouts without table locks.
 *
 * Concurrency pattern:
 * PRD Section 9.3 & ADR-002:
 * UPDATE inventory
 * SET reserved_quantity = reserved_quantity + :requested,
 *     updated_at = CURRENT_TIMESTAMP
 * WHERE variant_id = :variant_id
 *   AND (on_hand_quantity - reserved_quantity - safety_stock) >= :requested
 *
 * @param tx - Prisma TransactionClient or root PrismaClient
 * @param variantId - The target ProductVariant ID
 * @param requested - Number of units requested
 * @returns boolean - true if exactly 1 row was updated (reservation secured), false otherwise
 */
export async function atomicReserveInventory(
  tx: Prisma.TransactionClient | PrismaClient,
  variantId: string,
  requested: number
): Promise<boolean> {
  if (requested <= 0 || !Number.isInteger(requested)) {
    throw new Error(
      `Invalid reservation quantity: ${requested}. Must be a positive integer.`
    );
  }

  const rowsAffected = await tx.$executeRaw`
    UPDATE inventory
    SET reserved_quantity = reserved_quantity + ${requested},
        updated_at = CURRENT_TIMESTAMP
    WHERE variant_id = ${variantId}
      AND (on_hand_quantity - reserved_quantity - safety_stock) >= ${requested}
  `;

  return rowsAffected === 1;
}

/**
 * Atomically release a temporary reservation (e.g., when cart expires or payment fails).
 * Uses ANSI CASE WHEN to avoid negative quantities regardless of database engine.
 *
 * @param tx - Prisma TransactionClient or root PrismaClient
 * @param variantId - The target ProductVariant ID
 * @param quantity - Number of units to release
 */
export async function releaseInventoryReservation(
  tx: Prisma.TransactionClient | PrismaClient,
  variantId: string,
  quantity: number
): Promise<void> {
  if (quantity <= 0) return;

  await tx.$executeRaw`
    UPDATE inventory
    SET reserved_quantity = CASE
          WHEN (reserved_quantity - ${quantity}) < 0 THEN 0
          ELSE reserved_quantity - ${quantity}
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE variant_id = ${variantId}
  `;
}

/**
 * Atomically commit inventory when an order payment succeeds:
 * Deducts both on_hand_quantity and reserved_quantity.
 *
 * @param tx - Prisma TransactionClient or root PrismaClient
 * @param variantId - The target ProductVariant ID
 * @param quantity - Number of units to commit
 */
export async function commitInventoryReservation(
  tx: Prisma.TransactionClient | PrismaClient,
  variantId: string,
  quantity: number
): Promise<void> {
  if (quantity <= 0) return;

  await tx.$executeRaw`
    UPDATE inventory
    SET on_hand_quantity = on_hand_quantity - ${quantity},
        reserved_quantity = CASE
          WHEN (reserved_quantity - ${quantity}) < 0 THEN 0
          ELSE reserved_quantity - ${quantity}
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE variant_id = ${variantId}
  `;
}
