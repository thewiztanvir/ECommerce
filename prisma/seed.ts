/**
 * Production Database Seeder & Fixture Engine
 * Complies with PRD Section 3.2, 3.3, 9.1, 9.2, 13.1, 13.2 & ADR-002, ADR-003, ADR-005.
 *
 * Owned & Maintained by: Database Engineer
 *
 * Responsibilities:
 * 1. Seed all 11 roles (10 administrative RBAC roles + REGISTERED_CUSTOMER).
 * 2. Seed all 44 granular permissions and map them via RolePermission per PRD 13.2.
 * 3. Seed deterministic Super Admin (admin@ecommerce.test) and Customer (customer@ecommerce.test).
 * 4. Seed full taxonomy hierarchy (Electronics, Apparel, Home & Living) with subcategories.
 * 5. Seed sample catalog products, sellable variants, minor-unit prices, and inventory baselines.
 * 6. Record initial immutable StockMovement ledger entries corresponding to initial on-hand stock.
 * 7. Absolute idempotency: safely re-executable without duplicate keys or constraint violations.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  ROLES,
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS_MATRIX,
  GLOBAL_SCOPE,
} from "../src/lib/rbac.guard";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

async function main() {
  console.log("🌱 Starting idempotent database seeding...");

  // ===========================================================================
  // 1. Seed Granular Permissions
  // ===========================================================================
  console.log("  ↳ [1/6] Seeding granular permissions...");
  const permMap = new Map<string, string>();

  for (const permKey of ALL_PERMISSIONS) {
    const permRecord = await prisma.permission.upsert({
      where: { key: permKey },
      update: {},
      create: {
        key: permKey,
        description: `Permission allowing ${permKey.replace(/:/g, " ")}`,
      },
    });
    permMap.set(permKey, permRecord.id);
  }
  console.log(`     ✓ Verified ${permMap.size} permissions.`);

  // ===========================================================================
  // 2. Seed Roles & Role-Permission Matrix (PRD Section 13.2)
  // ===========================================================================
  console.log("  ↳ [2/6] Seeding RBAC roles & permission matrix...");
  const roleNames = [
    ROLES.SUPER_ADMIN,
    ROLES.STORE_ADMIN,
    ROLES.CATALOG_MANAGER,
    ROLES.INVENTORY_MANAGER,
    ROLES.ORDER_MANAGER,
    ROLES.CUSTOMER_SUPPORT,
    ROLES.MARKETING_MANAGER,
    ROLES.CONTENT_EDITOR,
    ROLES.FINANCE_MANAGER,
    ROLES.ANALYST,
    "REGISTERED_CUSTOMER",
  ] as const;

  const roleRecordMap = new Map<string, string>();

  for (const roleName of roleNames) {
    const roleRecord = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description:
          roleName === "REGISTERED_CUSTOMER"
            ? "Verified storefront customer with shopping and order history access"
            : `${roleName.replace(/_/g, " ")} administrative role`,
      },
    });
    roleRecordMap.set(roleName, roleRecord.id);
  }

  // Bind permissions to roles per PRD 13.2 matrix
  let totalRolePermissionsBound = 0;
  for (const [roleName, permissionsSet] of Object.entries(ROLE_PERMISSIONS_MATRIX)) {
    const roleId = roleRecordMap.get(roleName);
    if (!roleId) continue;

    for (const permKey of permissionsSet) {
      const permissionId = permMap.get(permKey);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
      totalRolePermissionsBound++;
    }
  }
  console.log(
    `     ✓ Verified ${roleRecordMap.size} roles and ${totalRolePermissionsBound} role-permission mappings.`
  );

  // ===========================================================================
  // 3. Seed Default Super Admin Account
  // ===========================================================================
  console.log("  ↳ [3/6] Seeding Super Admin account (admin@ecommerce.test)...");
  const adminSalt = await bcrypt.genSalt(12);
  const adminPasswordHash = await bcrypt.hash("Admin12345!", adminSalt);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@ecommerce.test" },
    update: {
      passwordHash: adminPasswordHash,
      status: "ACTIVE",
    },
    create: {
      email: "admin@ecommerce.test",
      passwordHash: adminPasswordHash,
      status: "ACTIVE",
    },
  });

  // Ensure Admin Profile
  await prisma.customerProfile.upsert({
    where: { userId: adminUser.id },
    update: {
      firstName: "System",
      lastName: "Administrator",
    },
    create: {
      userId: adminUser.id,
      firstName: "System",
      lastName: "Administrator",
    },
  });

  // Bind SUPER_ADMIN role with GLOBAL scope
  const superAdminRoleId = roleRecordMap.get(ROLES.SUPER_ADMIN)!;
  await prisma.userRole.upsert({
    where: {
      userId_roleId_scope: {
        userId: adminUser.id,
        roleId: superAdminRoleId,
        scope: GLOBAL_SCOPE,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRoleId,
      scope: GLOBAL_SCOPE,
    },
  });
  console.log(`     ✓ Super Admin configured (ID: ${adminUser.id}).`);

  // ===========================================================================
  // 4. Seed Default Test Customer Account
  // ===========================================================================
  console.log("  ↳ [4/6] Seeding Customer account (customer@ecommerce.test)...");
  const customerSalt = await bcrypt.genSalt(12);
  const customerPasswordHash = await bcrypt.hash("Customer12345!", customerSalt);

  const customerUser = await prisma.user.upsert({
    where: { email: "customer@ecommerce.test" },
    update: {
      passwordHash: customerPasswordHash,
      status: "ACTIVE",
    },
    create: {
      email: "customer@ecommerce.test",
      passwordHash: customerPasswordHash,
      status: "ACTIVE",
    },
  });

  // Ensure Customer Profile
  const customerProfile = await prisma.customerProfile.upsert({
    where: { userId: customerUser.id },
    update: {
      firstName: "Alex",
      lastName: "Taylor",
    },
    create: {
      userId: customerUser.id,
      firstName: "Alex",
      lastName: "Taylor",
    },
  });

  // Bind REGISTERED_CUSTOMER role
  const customerRoleId = roleRecordMap.get("REGISTERED_CUSTOMER");
  if (customerRoleId) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId_scope: {
          userId: customerUser.id,
          roleId: customerRoleId,
          scope: GLOBAL_SCOPE,
        },
      },
      update: {},
      create: {
        userId: customerUser.id,
        roleId: customerRoleId,
        scope: GLOBAL_SCOPE,
      },
    });
  }

  // Idempotently ensure default saved shipping address
  let sampleAddress = await prisma.address.findFirst({
    where: { userId: customerUser.id, isDefault: true },
  });

  if (!sampleAddress) {
    sampleAddress = await prisma.address.create({
      data: {
        userId: customerUser.id,
        type: "SHIPPING",
        recipientName: "Alex Taylor",
        streetLine1: "123 Main Street",
        streetLine2: "Suite 4B",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        countryCode: "US",
        isDefault: true,
      },
    });
  }

  // Link address to customer profile defaults
  if (
    customerProfile.defaultShippingAddressId !== sampleAddress.id ||
    customerProfile.defaultBillingAddressId !== sampleAddress.id
  ) {
    await prisma.customerProfile.update({
      where: { userId: customerUser.id },
      data: {
        defaultShippingAddressId: sampleAddress.id,
        defaultBillingAddressId: sampleAddress.id,
      },
    });
  }
  console.log(`     ✓ Customer configured with address (ID: ${customerUser.id}).`);

  // ===========================================================================
  // 5. Seed Category Taxonomy Hierarchy
  // ===========================================================================
  console.log("  ↳ [5/6] Seeding category hierarchy...");
  const categoriesData = [
    {
      name: "Electronics",
      slug: "electronics",
      sortOrder: 10,
      children: [
        { name: "Smartphones", slug: "smartphones", sortOrder: 11 },
        { name: "Laptops", slug: "laptops", sortOrder: 12 },
        { name: "Audio & Headphones", slug: "audio-headphones", sortOrder: 13 },
      ],
    },
    {
      name: "Apparel",
      slug: "apparel",
      sortOrder: 20,
      children: [
        { name: "Men's Clothing", slug: "mens-clothing", sortOrder: 21 },
        { name: "Women's Clothing", slug: "womens-clothing", sortOrder: 22 },
        { name: "Accessories", slug: "apparel-accessories", sortOrder: 23 },
      ],
    },
    {
      name: "Home & Living",
      slug: "home-living",
      sortOrder: 30,
      children: [
        { name: "Kitchen & Dining", slug: "kitchen-dining", sortOrder: 31 },
        { name: "Home Decor", slug: "home-decor", sortOrder: 32 },
      ],
    },
  ];

  const categoryMap = new Map<string, string>();

  for (const cat of categoriesData) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: {
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
        status: "ACTIVE",
      },
    });
    categoryMap.set(cat.slug, parent.id);

    for (const child of cat.children) {
      const childRecord = await prisma.category.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          parentId: parent.id,
          sortOrder: child.sortOrder,
        },
        create: {
          name: child.name,
          slug: child.slug,
          parentId: parent.id,
          sortOrder: child.sortOrder,
          status: "ACTIVE",
        },
      });
      categoryMap.set(child.slug, childRecord.id);
    }
  }
  console.log(`     ✓ Verified ${categoryMap.size} categories across 3 root trees.`);

  // ===========================================================================
  // 6. Seed Sample Catalog Products, Variants, Prices & Inventory Baseline
  // ===========================================================================
  console.log("  ↳ [6/6] Seeding sample products, variants, and stock ledgers...");

  interface SeedProductSpec {
    categorySlug: string;
    productSlug: string;
    title: string;
    description: string;
    brand: string;
    variants: Array<{
      sku: string;
      title: string;
      attributes: Record<string, string>;
      priceMinor: number;
      compareAtMinor?: number;
      initialStock: number;
      safetyStock: number;
    }>;
  }

  const catalogSpecs: SeedProductSpec[] = [
    {
      categorySlug: "audio-headphones",
      productSlug: "quantum-wireless-headphones",
      title: "Quantum Wireless Noise-Cancelling Headphones",
      description:
        "High-fidelity wireless active noise-cancelling headphones featuring 40mm dynamic drivers, 30-hour battery life, and ultra-comfortable memory foam ear cushions.",
      brand: "AcoustiQ",
      variants: [
        {
          sku: "QW-NC-BLK",
          title: "Midnight Black",
          attributes: { color: "Midnight Black" },
          priceMinor: 19999, // $199.99
          compareAtMinor: 24999, // $249.99
          initialStock: 50,
          safetyStock: 5,
        },
        {
          sku: "QW-NC-SLV",
          title: "Lunar Silver",
          attributes: { color: "Lunar Silver" },
          priceMinor: 19999, // $199.99
          compareAtMinor: 24999, // $249.99
          initialStock: 30,
          safetyStock: 5,
        },
      ],
    },
    {
      categorySlug: "mens-clothing",
      productSlug: "classic-organic-crewneck",
      title: "Classic Organic Cotton Crewneck Tee",
      description:
        "Premium everyday t-shirt crafted from 100% certified organic combed ring-spun cotton. Ultra-soft hand feel with reinforced double-needle collar and seams.",
      brand: "Terra Apparel",
      variants: [
        {
          sku: "TEE-ORG-NVY-M",
          title: "Navy Blue / Medium",
          attributes: { color: "Navy", size: "M" },
          priceMinor: 2999, // $29.99
          compareAtMinor: 3499, // $34.99
          initialStock: 100,
          safetyStock: 10,
        },
        {
          sku: "TEE-ORG-NVY-L",
          title: "Navy Blue / Large",
          attributes: { color: "Navy", size: "L" },
          priceMinor: 2999, // $29.99
          compareAtMinor: 3499, // $34.99
          initialStock: 75,
          safetyStock: 10,
        },
      ],
    },
    {
      categorySlug: "kitchen-dining",
      productSlug: "artisan-ceramic-pour-over",
      title: "Artisan Ceramic Pour-Over Coffee Dripper",
      description:
        "Handcrafted ceramic coffee dripper featuring spiral ribs for optimal thermal retention and consistent extraction rate. Brews 1 to 4 cups of specialty coffee.",
      brand: "BaristaCraft",
      variants: [
        {
          sku: "CDR-ART-WHT",
          title: "Matte White",
          attributes: { finish: "Matte White", size: "Size 02" },
          priceMinor: 3450, // $34.50
          initialStock: 40,
          safetyStock: 5,
        },
      ],
    },
  ];

  for (const spec of catalogSpecs) {
    const categoryId = categoryMap.get(spec.categorySlug);
    if (!categoryId) {
      console.warn(`Category slug '${spec.categorySlug}' not found; skipping.`);
      continue;
    }

    const product = await prisma.product.upsert({
      where: { slug: spec.productSlug },
      update: {
        title: spec.title,
        description: spec.description,
        status: "PUBLISHED",
        brandName: spec.brand,
      },
      create: {
        categoryId,
        slug: spec.productSlug,
        title: spec.title,
        description: spec.description,
        status: "PUBLISHED",
        brandName: spec.brand,
      },
    });

    for (const vSpec of spec.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: vSpec.sku },
        update: {
          title: vSpec.title,
          attributesJson: JSON.stringify(vSpec.attributes),
          status: "ACTIVE",
        },
        create: {
          productId: product.id,
          sku: vSpec.sku,
          title: vSpec.title,
          attributesJson: JSON.stringify(vSpec.attributes),
          status: "ACTIVE",
        },
      });

      // Idempotently maintain active price in integer minor cents
      const existingPrice = await prisma.price.findFirst({
        where: { variantId: variant.id, currency: "USD" },
      });

      if (existingPrice) {
        await prisma.price.update({
          where: { id: existingPrice.id },
          data: {
            amountMinor: vSpec.priceMinor,
            compareAtAmountMinor: vSpec.compareAtMinor ?? null,
          },
        });
      } else {
        await prisma.price.create({
          data: {
            variantId: variant.id,
            currency: "USD",
            amountMinor: vSpec.priceMinor,
            compareAtAmountMinor: vSpec.compareAtMinor,
          },
        });
      }

      // Upsert Inventory baseline with safety stock
      await prisma.inventory.upsert({
        where: { variantId: variant.id },
        update: {
          safetyStock: vSpec.safetyStock,
        },
        create: {
          variantId: variant.id,
          onHandQuantity: vSpec.initialStock,
          reservedQuantity: 0,
          safetyStock: vSpec.safetyStock,
        },
      });

      // Maintain append-only StockMovement ledger entry for initial stock balance
      const existingMovement = await prisma.stockMovement.findFirst({
        where: { variantId: variant.id, reason: "INITIAL_SEED" },
      });

      if (!existingMovement) {
        await prisma.stockMovement.create({
          data: {
            variantId: variant.id,
            quantityDelta: vSpec.initialStock,
            reason: "INITIAL_SEED",
            referenceId: `SEED-${variant.sku}`,
            actorId: adminUser.id,
          },
        });
      }
    }
  }
  console.log(`     ✓ Verified catalog products, sellable SKUs, prices, and stock ledgers.`);

  console.log("✅ Database seeding completed with 100% architectural integrity!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
