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
 * 5. Seed 8 realistic catalog products spanning all 3 root categories with multiple variants,
 *    minor-unit integer cents, realistic attributes (color, size, storage), and media thumbnails.
 * 6. Seed varied stock levels across variants (in stock, low stock, out of stock) and safety thresholds.
 * 7. Record immutable StockMovement ledger entries corresponding to initial on-hand stock.
 * 8. Absolute idempotency: safely re-executable without duplicate keys or constraint violations.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  ROLES,
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
  console.log("  ↳ [1/7] Seeding granular permissions...");
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
  console.log("  ↳ [2/7] Seeding RBAC roles & permission matrix...");
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
  console.log("  ↳ [3/7] Seeding Super Admin account (admin@ecommerce.test)...");
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
  console.log("  ↳ [4/7] Seeding Customer account (customer@ecommerce.test)...");
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
  console.log("  ↳ [5/7] Seeding category hierarchy...");
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
  // 6. Seed Realistic Catalog Products, Variants, Media, Prices & Inventory
  // ===========================================================================
  console.log("  ↳ [6/7] Seeding rich catalog products, variants, media & stock ledgers...");

  interface SeedMediaSpec {
    url: string;
    altText: string;
    sortOrder: number;
    isThumbnail: boolean;
  }

  interface SeedVariantSpec {
    sku: string;
    title: string;
    attributes: Record<string, string>;
    priceMinor: number;
    compareAtMinor?: number;
    initialStock: number;
    safetyStock: number;
  }

  interface SeedProductSpec {
    categorySlug: string;
    productSlug: string;
    title: string;
    description: string;
    brand: string;
    media: SeedMediaSpec[];
    variants: SeedVariantSpec[];
  }

  const catalogSpecs: SeedProductSpec[] = [
    // -------------------------------------------------------------------------
    // Product 1: Electronics -> Audio & Headphones
    // -------------------------------------------------------------------------
    {
      categorySlug: "audio-headphones",
      productSlug: "quantum-wireless-headphones",
      title: "Quantum Wireless Noise-Cancelling Headphones",
      description:
        "High-fidelity wireless active noise-cancelling headphones featuring 40mm dynamic neodymium drivers, 30-hour battery life, transparency mode, and ultra-comfortable memory foam ear cushions.",
      brand: "AcoustiQ",
      media: [
        {
          url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
          altText: "Quantum Wireless Noise-Cancelling Headphones in Midnight Black",
          sortOrder: 0,
          isThumbnail: true,
        },
        {
          url: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80",
          altText: "Quantum Headphones resting on a minimalist studio wooden desk",
          sortOrder: 1,
          isThumbnail: false,
        },
      ],
      variants: [
        {
          sku: "QW-NC-BLK",
          title: "Midnight Black",
          attributes: { color: "Midnight Black" },
          priceMinor: 19999, // $199.99
          compareAtMinor: 24999, // $249.99 (In Stock)
          initialStock: 50,
          safetyStock: 5,
        },
        {
          sku: "QW-NC-SLV",
          title: "Lunar Silver",
          attributes: { color: "Lunar Silver" },
          priceMinor: 19999, // $199.99
          compareAtMinor: 24999, // $249.99 (Low Stock)
          initialStock: 3,
          safetyStock: 5,
        },
        {
          sku: "QW-NC-ROSE",
          title: "Rose Gold Limited Edition",
          attributes: { color: "Rose Gold" },
          priceMinor: 21999, // $219.99
          compareAtMinor: 26999, // $269.99 (Out of Stock)
          initialStock: 0,
          safetyStock: 5,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Product 2: Electronics -> Smartphones
    // -------------------------------------------------------------------------
    {
      categorySlug: "smartphones",
      productSlug: "apex-pro-5g-smartphone",
      title: "Apex Pro 5G Flagship Smartphone",
      description:
        "Engineered for creators and power users. Featuring a 6.7-inch 120Hz LTPO AMOLED HDR10+ display, triple 50MP optical computational camera system, aerospace aluminum chassis, and 5000mAh all-day battery.",
      brand: "Apex Mobile",
      media: [
        {
          url: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80",
          altText: "Apex Pro 5G Smartphone front and rear glass profile",
          sortOrder: 0,
          isThumbnail: true,
        },
        {
          url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80",
          altText: "Apex Pro 5G hand-held vibrant screen demonstration",
          sortOrder: 1,
          isThumbnail: false,
        },
      ],
      variants: [
        {
          sku: "APX-5G-128-OBS",
          title: "128GB / Obsidian Black",
          attributes: { storage: "128GB", color: "Obsidian Black" },
          priceMinor: 79900, // $799.00
          compareAtMinor: 89900, // $899.00 (In Stock)
          initialStock: 35,
          safetyStock: 5,
        },
        {
          sku: "APX-5G-256-OBS",
          title: "256GB / Obsidian Black",
          attributes: { storage: "256GB", color: "Obsidian Black" },
          priceMinor: 89900, // $899.00
          compareAtMinor: 99900, // $999.00 (In Stock)
          initialStock: 20,
          safetyStock: 5,
        },
        {
          sku: "APX-5G-256-GLC",
          title: "256GB / Glacier Blue",
          attributes: { storage: "256GB", color: "Glacier Blue" },
          priceMinor: 89900, // $899.00
          compareAtMinor: 99900, // $999.00 (Low Stock)
          initialStock: 2,
          safetyStock: 5,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Product 3: Electronics -> Laptops
    // -------------------------------------------------------------------------
    {
      categorySlug: "laptops",
      productSlug: "aerobook-ultra-14-laptop",
      title: "AeroBook Ultra 14 Professional Ultrabook",
      description:
        "Featherlight 1.1kg unibody aluminum chassis holding a color-calibrated 14-inch 3.2K 120Hz Retina-grade display, modern 8-core processor, dual Thunderbolt 4 ports, and up to 18 hours of real-world battery endurance.",
      brand: "AeroTech",
      media: [
        {
          url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80",
          altText: "AeroBook Ultra 14 open on wooden office workstation",
          sortOrder: 0,
          isThumbnail: true,
        },
      ],
      variants: [
        {
          sku: "AERO-14-512-GRY",
          title: "512GB SSD / 16GB RAM / Space Gray",
          attributes: { storage: "512GB", ram: "16GB", color: "Space Gray" },
          priceMinor: 129900, // $1,299.00
          compareAtMinor: 139900, // $1,399.00 (In Stock)
          initialStock: 15,
          safetyStock: 3,
        },
        {
          sku: "AERO-14-1TB-GRY",
          title: "1TB SSD / 32GB RAM / Space Gray",
          attributes: { storage: "1TB", ram: "32GB", color: "Space Gray" },
          priceMinor: 159900, // $1,599.00
          compareAtMinor: 174900, // $1,749.00 (Out of Stock)
          initialStock: 0,
          safetyStock: 3,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Product 4: Apparel -> Men's Clothing
    // -------------------------------------------------------------------------
    {
      categorySlug: "mens-clothing",
      productSlug: "classic-organic-crewneck",
      title: "Classic Organic Cotton Crewneck Tee",
      description:
        "Crafted from 100% GOTS-certified ring-spun organic combed cotton (180 GSM). Ultra-soft hand feel with reinforced double-needle neck tape, pre-shrunk construction, and clean tailored silhouette.",
      brand: "Terra Apparel",
      media: [
        {
          url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80",
          altText: "Classic Organic Cotton Crewneck Tee in Navy Blue",
          sortOrder: 0,
          isThumbnail: true,
        },
        {
          url: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80",
          altText: "Folded cotton t-shirt fabric texture and collar stitching detail",
          sortOrder: 1,
          isThumbnail: false,
        },
      ],
      variants: [
        {
          sku: "TEE-ORG-NVY-M",
          title: "Navy Blue / Medium",
          attributes: { color: "Navy Blue", size: "M" },
          priceMinor: 2999, // $29.99
          compareAtMinor: 3499, // $34.99 (In Stock)
          initialStock: 80,
          safetyStock: 10,
        },
        {
          sku: "TEE-ORG-NVY-L",
          title: "Navy Blue / Large",
          attributes: { color: "Navy Blue", size: "L" },
          priceMinor: 2999, // $29.99
          compareAtMinor: 3499, // $34.99 (In Stock)
          initialStock: 65,
          safetyStock: 10,
        },
        {
          sku: "TEE-ORG-WHT-M",
          title: "Optical White / Medium",
          attributes: { color: "Optical White", size: "M" },
          priceMinor: 2999, // $29.99
          compareAtMinor: 3499, // $34.99 (Low Stock)
          initialStock: 4,
          safetyStock: 10,
        },
        {
          sku: "TEE-ORG-WHT-L",
          title: "Optical White / Large",
          attributes: { color: "Optical White", size: "L" },
          priceMinor: 2999, // $29.99
          compareAtMinor: 3499, // $34.99 (Out of Stock)
          initialStock: 0,
          safetyStock: 10,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Product 5: Apparel -> Women's Clothing
    // -------------------------------------------------------------------------
    {
      categorySlug: "womens-clothing",
      productSlug: "elysian-merino-wool-sweater",
      title: "Elysian Oversized Merino Wool Knit Sweater",
      description:
        "Knitted from 100% extra-fine 19.5-micron Australian Merino wool. Offers natural micro-climate thermoregulation, gentle odor resistance, relaxed dropped shoulders, and ribbed neckline and hem.",
      brand: "Elysian Studios",
      media: [
        {
          url: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80",
          altText: "Elysian Oversized Merino Wool Knit Sweater in Oatmeal Heather",
          sortOrder: 0,
          isThumbnail: true,
        },
      ],
      variants: [
        {
          sku: "SWT-MRN-OAT-S",
          title: "Oatmeal Heather / Small",
          attributes: { color: "Oatmeal Heather", size: "S" },
          priceMinor: 12800, // $128.00
          compareAtMinor: 15800, // $158.00 (In Stock)
          initialStock: 30,
          safetyStock: 5,
        },
        {
          sku: "SWT-MRN-OAT-M",
          title: "Oatmeal Heather / Medium",
          attributes: { color: "Oatmeal Heather", size: "M" },
          priceMinor: 12800, // $128.00
          compareAtMinor: 15800, // $158.00 (In Stock)
          initialStock: 25,
          safetyStock: 5,
        },
        {
          sku: "SWT-MRN-SGE-S",
          title: "Sage Green / Small",
          attributes: { color: "Sage Green", size: "S" },
          priceMinor: 12800, // $128.00
          compareAtMinor: 15800, // $158.00 (Low Stock)
          initialStock: 3,
          safetyStock: 5,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Product 6: Apparel -> Accessories
    // -------------------------------------------------------------------------
    {
      categorySlug: "apparel-accessories",
      productSlug: "heritage-leather-bifold-wallet",
      title: "Heritage Full-Grain Leather Bi-Fold Wallet",
      description:
        "Handcrafted in small batches from vegetable-tanned full-grain Tuscan leather that deepens and develops a handsome patina over years of carry. Features 8 precision-cut card slots, dual billfold compartments, and integrated RFID-blocking shields.",
      brand: "Saddle & Oak",
      media: [
        {
          url: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80",
          altText: "Heritage Full-Grain Leather Bi-Fold Wallet in Cognac Tan",
          sortOrder: 0,
          isThumbnail: true,
        },
      ],
      variants: [
        {
          sku: "WLT-LTH-COG",
          title: "Cognac Tan",
          attributes: { color: "Cognac Tan", material: "Full-Grain Leather" },
          priceMinor: 6500, // $65.00
          compareAtMinor: 7800, // $78.00 (In Stock)
          initialStock: 45,
          safetyStock: 8,
        },
        {
          sku: "WLT-LTH-ESP",
          title: "Espresso Black",
          attributes: { color: "Espresso Black", material: "Full-Grain Leather" },
          priceMinor: 6500, // $65.00
          compareAtMinor: 7800, // $78.00 (Out of Stock)
          initialStock: 0,
          safetyStock: 8,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Product 7: Home & Living -> Kitchen & Dining
    // -------------------------------------------------------------------------
    {
      categorySlug: "kitchen-dining",
      productSlug: "artisan-ceramic-pour-over",
      title: "Artisan Ceramic Pour-Over Coffee Dripper Set",
      description:
        "Handcrafted high-fired ceramic cone dripper featuring interior 60-degree curved spiral channels for uniform water saturation and thermal extraction stability. Brews up to 600ml of specialty coffee and pairs with standard 02 cone filters.",
      brand: "BaristaCraft",
      media: [
        {
          url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80",
          altText: "BaristaCraft Artisan Ceramic Pour-Over Dripper in Matte White",
          sortOrder: 0,
          isThumbnail: true,
        },
      ],
      variants: [
        {
          sku: "CDR-ART-WHT",
          title: "Matte White / Size 02",
          attributes: { finish: "Matte White", capacity: "1-4 Cups" },
          priceMinor: 3450, // $34.50
          compareAtMinor: 4200, // $42.00 (In Stock)
          initialStock: 40,
          safetyStock: 5,
        },
        {
          sku: "CDR-ART-BLK",
          title: "Matte Charcoal / Size 02",
          attributes: { finish: "Matte Charcoal", capacity: "1-4 Cups" },
          priceMinor: 3450, // $34.50
          compareAtMinor: 4200, // $42.00 (Low Stock)
          initialStock: 4,
          safetyStock: 5,
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Product 8: Home & Living -> Home Decor
    // -------------------------------------------------------------------------
    {
      categorySlug: "home-decor",
      productSlug: "lumina-minimalist-desk-lamp",
      title: "Lumina Minimalist Dimmable LED Desk Lamp",
      description:
        "Sculpted from anodized architectural aluminum with stepless capacitive touch dimming, 5 adjustable Kelvin color modes (2700K warm to 6500K daylight), anti-glare honeycomb diffusion, and integrated 15W Qi wireless fast-charging base.",
      brand: "Lumina Home",
      media: [
        {
          url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80",
          altText: "Lumina Minimalist Desk Lamp illuminated warm glow on modern desk",
          sortOrder: 0,
          isThumbnail: true,
        },
      ],
      variants: [
        {
          sku: "LMP-LED-SLV",
          title: "Brushed Aluminum",
          attributes: { finish: "Brushed Aluminum", power: "15W Qi Fast Charge" },
          priceMinor: 8900, // $89.00
          compareAtMinor: 11900, // $119.00 (In Stock)
          initialStock: 25,
          safetyStock: 5,
        },
        {
          sku: "LMP-LED-BRS",
          title: "Satin Brass",
          attributes: { finish: "Satin Brass", power: "15W Qi Fast Charge" },
          priceMinor: 9900, // $99.00
          compareAtMinor: 12900, // $129.00 (Out of Stock)
          initialStock: 0,
          safetyStock: 5,
        },
      ],
    },
  ];

  let totalProducts = 0;
  let totalVariants = 0;
  let totalMedia = 0;

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
    totalProducts++;

    // Idempotently maintain product media items & thumbnail
    for (const m of spec.media) {
      const existingMedia = await prisma.productMedia.findFirst({
        where: { productId: product.id, url: m.url },
      });

      if (existingMedia) {
        await prisma.productMedia.update({
          where: { id: existingMedia.id },
          data: {
            altText: m.altText,
            sortOrder: m.sortOrder,
            isThumbnail: m.isThumbnail,
          },
        });
      } else {
        await prisma.productMedia.create({
          data: {
            productId: product.id,
            url: m.url,
            altText: m.altText,
            sortOrder: m.sortOrder,
            isThumbnail: m.isThumbnail,
          },
        });
      }
      totalMedia++;
    }

    // Upsert variants, prices, inventory, and initial stock movements
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
      totalVariants++;

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
          onHandQuantity: vSpec.initialStock,
          reservedQuantity: 0,
          safetyStock: vSpec.safetyStock,
        },
        create: {
          variantId: variant.id,
          onHandQuantity: vSpec.initialStock,
          reservedQuantity: 0,
          safetyStock: vSpec.safetyStock,
        },
      });

      // Maintain append-only StockMovement ledger entry for initial non-zero stock balances
      if (vSpec.initialStock > 0) {
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
  }
  console.log(
    `     ✓ Verified ${totalProducts} products, ${totalVariants} sellable SKUs, ${totalMedia} media assets, and stock ledgers.`
  );

  // ===========================================================================
  // 7. Seed Test Promotion Coupons (PRD Section 10 / FR-PROMO-001 - FR-PROMO-005)
  // ===========================================================================
  console.log("  ↳ [7/7] Seeding test promotion coupons...");

  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const promotionsData = [
    {
      code: "SAVE10",
      type: "PERCENTAGE",
      valueMinor: 1000, // 10% discount in basis points (1000 bps = 10%)
      minOrderMinor: 3000, // Minimum $30.00 subtotal (3000 cents)
      maxUses: 1000,
      startsAt: oneMonthAgo,
      endsAt: oneYearFromNow,
      status: "ACTIVE",
    },
    {
      code: "WELCOME20",
      type: "FIXED_AMOUNT",
      valueMinor: 2000, // Fixed $20.00 discount (2000 cents)
      minOrderMinor: 10000, // Minimum $100.00 subtotal (10000 cents)
      maxUses: 500,
      startsAt: oneMonthAgo,
      endsAt: oneYearFromNow,
      status: "ACTIVE",
    },
    {
      code: "EXPIRED50",
      type: "PERCENTAGE",
      valueMinor: 5000, // 50% discount in basis points
      minOrderMinor: 0,
      maxUses: 100,
      startsAt: sixtyDaysAgo,
      endsAt: tenDaysAgo, // Expired 10 days ago (for expiration validation tests)
      status: "ACTIVE",
    },
    {
      code: "DISABLED15",
      type: "PERCENTAGE",
      valueMinor: 1500, // 15% discount in basis points
      minOrderMinor: 2500, // Minimum $25.00 subtotal
      maxUses: 200,
      startsAt: oneMonthAgo,
      endsAt: oneYearFromNow,
      status: "DISABLED", // Disabled status (for status validation tests)
    },
  ];

  for (const promo of promotionsData) {
    await prisma.promotion.upsert({
      where: { code: promo.code },
      update: {
        type: promo.type,
        valueMinor: promo.valueMinor,
        minOrderMinor: promo.minOrderMinor,
        maxUses: promo.maxUses,
        startsAt: promo.startsAt,
        endsAt: promo.endsAt,
        status: promo.status,
      },
      create: {
        code: promo.code,
        type: promo.type,
        valueMinor: promo.valueMinor,
        minOrderMinor: promo.minOrderMinor,
        maxUses: promo.maxUses,
        usageCount: 0,
        startsAt: promo.startsAt,
        endsAt: promo.endsAt,
        status: promo.status,
      },
    });
  }
  console.log(`     ✓ Verified ${promotionsData.length} promotional coupons.`);

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
