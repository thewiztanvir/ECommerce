/**
 * Database Seed Verification Tests
 * Complies with PRD Section 13, Section 16 & ADR-002, ADR-003, ADR-005.
 */

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { ROLES, ALL_PERMISSIONS } from "@/lib/rbac.guard";

describe("Database Seeding Integration Verification", () => {
  it("should verify all 11 roles are seeded", async () => {
    const roles = await prisma.role.findMany();
    const roleNames = roles.map((r) => r.name);

    expect(roles.length).toBeGreaterThanOrEqual(11);
    for (const roleName of Object.values(ROLES)) {
      expect(roleNames).toContain(roleName);
    }
    expect(roleNames).toContain("REGISTERED_CUSTOMER");
  });

  it("should verify all granular permissions and mappings exist", async () => {
    const permCount = await prisma.permission.count();
    expect(permCount).toBe(ALL_PERMISSIONS.length);

    const rolePermCount = await prisma.rolePermission.count();
    expect(rolePermCount).toBeGreaterThanOrEqual(160);
  });

  it("should verify default admin user with SUPER_ADMIN role", async () => {
    const admin = await prisma.user.findUnique({
      where: { email: "admin@ecommerce.test" },
      include: {
        userRoles: {
          include: { role: true },
        },
        customerProfile: true,
      },
    });

    expect(admin).not.toBeNull();
    expect(admin?.status).toBe("ACTIVE");
    expect(admin?.customerProfile?.firstName).toBe("System");
    expect(admin?.customerProfile?.lastName).toBe("Administrator");

    const assignedRoles = admin?.userRoles.map((ur) => ur.role.name);
    expect(assignedRoles).toContain(ROLES.SUPER_ADMIN);
  });

  it("should verify test customer with REGISTERED_CUSTOMER role and address", async () => {
    const customer = await prisma.user.findUnique({
      where: { email: "customer@ecommerce.test" },
      include: {
        userRoles: {
          include: { role: true },
        },
        customerProfile: true,
        addresses: true,
      },
    });

    expect(customer).not.toBeNull();
    expect(customer?.status).toBe("ACTIVE");
    expect(customer?.customerProfile?.firstName).toBe("Alex");
    expect(customer?.addresses.length).toBeGreaterThanOrEqual(1);

    const assignedRoles = customer?.userRoles.map((ur) => ur.role.name);
    expect(assignedRoles).toContain("REGISTERED_CUSTOMER");
  });

  it("should verify categories hierarchy is intact", async () => {
    const rootCategories = await prisma.category.findMany({
      where: { parentId: null },
      include: { children: true },
    });

    expect(rootCategories.length).toBe(3);
    const slugs = rootCategories.map((c) => c.slug);
    expect(slugs).toContain("electronics");
    expect(slugs).toContain("apparel");
    expect(slugs).toContain("home-living");

    const allCategoriesCount = await prisma.category.count();
    expect(allCategoriesCount).toBe(11);
  });

  it("should verify catalog products, variants, minor-unit prices, and inventory baselines", async () => {
    const products = await prisma.product.findMany({
      include: {
        media: true,
        variants: {
          include: {
            prices: true,
            inventory: true,
          },
        },
      },
    });

    expect(products.length).toBe(8);

    let totalVariants = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let thumbnailCount = 0;

    for (const product of products) {
      expect(product.variants.length).toBeGreaterThanOrEqual(2);
      expect(product.media.length).toBeGreaterThanOrEqual(1);

      const hasThumbnail = product.media.some((m) => m.isThumbnail);
      if (hasThumbnail) thumbnailCount++;

      for (const variant of product.variants) {
        totalVariants++;
        expect(variant.prices.length).toBeGreaterThanOrEqual(1);

        const price = variant.prices[0];
        expect(price.amountMinor).toBeGreaterThan(0);
        expect(Number.isInteger(price.amountMinor)).toBe(true);

        expect(variant.inventory).not.toBeNull();
        const onHand = variant.inventory!.onHandQuantity;
        const safety = variant.inventory!.safetyStock;

        expect(onHand).toBeGreaterThanOrEqual(0);
        expect(safety).toBeGreaterThanOrEqual(3);
        expect(variant.inventory?.reservedQuantity).toBe(0);

        if (onHand === 0) {
          outOfStockCount++;
        } else if (onHand <= safety) {
          lowStockCount++;
        } else {
          inStockCount++;
        }
      }
    }

    expect(totalVariants).toBe(21);
    expect(thumbnailCount).toBe(8); // Every product has a thumbnail
    expect(inStockCount).toBeGreaterThanOrEqual(10);
    expect(lowStockCount).toBeGreaterThanOrEqual(4);
    expect(outOfStockCount).toBeGreaterThanOrEqual(4);
  });

  it("should verify stock movements audit ledger matches initial positive stock", async () => {
    const stockMovements = await prisma.stockMovement.findMany({
      where: { reason: "INITIAL_SEED" },
    });

    // Stock movements are recorded for all non-zero initial variants (16 in-stock / low-stock variants)
    expect(stockMovements.length).toBe(16);
    for (const movement of stockMovements) {
      expect(movement.quantityDelta).toBeGreaterThan(0);
      expect(movement.actorId).toBeDefined();
    }
  });
});
