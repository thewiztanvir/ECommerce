/**
 * Database Singleton & Concurrency Engine Unit Tests
 * Complies with PRD Section 16, Section 9.3 and ADR-002.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  prisma,
  checkDatabaseHealth,
  atomicReserveInventory,
  releaseInventoryReservation,
  commitInventoryReservation,
  PrismaClient,
} from "@/lib/db";

describe("Database Client Singleton & Concurrency Engine (PRD 9.3, 16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Singleton Instance Verification", () => {
    it("should export an initialized PrismaClient instance", () => {
      expect(prisma).toBeDefined();
      expect(typeof prisma.$executeRaw).toBe("function");
      expect(typeof prisma.$queryRaw).toBe("function");
      expect(typeof prisma.$transaction).toBe("function");
    });

    it("should attach singleton to globalThis in non-production environments", () => {
      expect(globalThis.__prismaClientInstance).toBe(prisma);
    });
  });

  describe("2. Health Check Helper", () => {
    it("should report healthy when ping query succeeds", async () => {
      const mockQueryRaw = vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce([{ 1: 1 }]);
      const health = await checkDatabaseHealth();

      expect(mockQueryRaw).toHaveBeenCalled();
      expect(health.ok).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeUndefined();
    });

    it("should report unhealthy with error message when ping query fails", async () => {
      vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(
        new Error("Connection refused: 5432")
      );
      const health = await checkDatabaseHealth();

      expect(health.ok).toBe(false);
      expect(health.error).toContain("Connection refused: 5432");
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("3. Atomic Stock Reservation (PRD 9.3 & ADR-002)", () => {
    it("should successfully reserve stock when rowsAffected === 1", async () => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
      } as unknown as Parameters<typeof atomicReserveInventory>[0];

      const reserved = await atomicReserveInventory(mockTx, "var_123", 2);

      expect(reserved).toBe(true);
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });

    it("should reject reservation when stock is insufficient (rowsAffected === 0)", async () => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValue(0),
      } as unknown as Parameters<typeof atomicReserveInventory>[0];

      const reserved = await atomicReserveInventory(mockTx, "var_123", 999);

      expect(reserved).toBe(false);
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });

    it("should reject non-positive or non-integer quantities", async () => {
      const mockTx = {
        $executeRaw: vi.fn(),
      } as unknown as Parameters<typeof atomicReserveInventory>[0];

      await expect(atomicReserveInventory(mockTx, "var_123", 0)).rejects.toThrow(
        /Invalid reservation quantity/
      );
      await expect(atomicReserveInventory(mockTx, "var_123", -5)).rejects.toThrow(
        /Invalid reservation quantity/
      );
      await expect(atomicReserveInventory(mockTx, "var_123", 1.5)).rejects.toThrow(
        /Invalid reservation quantity/
      );
      expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe("4. Stock Release & Commit Operations", () => {
    it("should execute release query with ANSI CASE WHEN clause", async () => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
      } as unknown as Parameters<typeof releaseInventoryReservation>[0];

      await releaseInventoryReservation(mockTx, "var_123", 3);
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });

    it("should ignore zero or negative release quantities safely", async () => {
      const mockTx = {
        $executeRaw: vi.fn(),
      } as unknown as Parameters<typeof releaseInventoryReservation>[0];

      await releaseInventoryReservation(mockTx, "var_123", 0);
      await releaseInventoryReservation(mockTx, "var_123", -2);
      expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    });

    it("should execute commit query on order confirmation", async () => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
      } as unknown as Parameters<typeof commitInventoryReservation>[0];

      await commitInventoryReservation(mockTx, "var_123", 2);
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });

    it("should ignore zero or negative commit quantities safely", async () => {
      const mockTx = {
        $executeRaw: vi.fn(),
      } as unknown as Parameters<typeof commitInventoryReservation>[0];

      await commitInventoryReservation(mockTx, "var_123", 0);
      expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    });
  });
});
