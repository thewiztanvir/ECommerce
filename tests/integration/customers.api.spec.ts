/**
 * Integration Test Suite: Customer Account & Address API Endpoints
 * Tests:
 * - GET & PATCH /api/v1/customers/profile (Profile retrieval & update)
 * - POST & GET /api/v1/customers/addresses (Address creation: SHIPPING & BILLING)
 * - Default address toggle (Setting one address as default unsets others)
 * - Anti-IDOR Security Boundary: Customer B attempting GET, PATCH, DELETE on Customer A's address is denied (404)
 *
 * Complies with PRD Section 6.6 (FR-ACCOUNT-004, FR-ACCOUNT-005),
 * Section 18.1, Section 18.2 (Anti-IDOR Protection), and ADR-005.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { authService } from "@/modules/auth/auth.service";
import { sealSessionData } from "@/modules/auth/session.service";

// In-memory cookie jar to simulate session store for test requests
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = cookieJar.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
    set: (nameOrOptions: any, value?: any) => {
      if (typeof nameOrOptions === "string") {
        cookieJar.set(nameOrOptions, value);
      } else if (nameOrOptions && typeof nameOrOptions === "object") {
        cookieJar.set(nameOrOptions.name, nameOrOptions.value);
      }
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
    has: (name: string) => cookieJar.has(name),
  })),
}));

// Import route handlers
import {
  GET as getProfileRoute,
  PATCH as patchProfileRoute,
} from "@/app/api/v1/customers/profile/route";
import {
  GET as listAddressesRoute,
  POST as createAddressRoute,
} from "@/app/api/v1/customers/addresses/route";
import {
  GET as getAddressRoute,
  PATCH as patchAddressRoute,
  DELETE as deleteAddressRoute,
} from "@/app/api/v1/customers/addresses/[id]/route";

describe("Integration: Customer Profile & Address Management APIs", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  let customerA: { id: string; email: string };
  let customerB: { id: string; email: string };
  let tokenCustomerA: string;
  let tokenCustomerB: string;

  beforeAll(async () => {
    // Register Customer A
    const resA = await authService.register({
      email: `cust-a-${runId}@example.com`,
      password: "CustAPassword123!",
      firstName: "Alice",
      lastName: "Adams",
      phone: "+12125550101",
    });
    customerA = { id: resA.id, email: resA.email };

    // Register Customer B (for IDOR attack testing)
    const resB = await authService.register({
      email: `cust-b-${runId}@example.com`,
      password: "CustBPassword123!",
      firstName: "Bob",
      lastName: "Baker",
      phone: "+12125550102",
    });
    customerB = { id: resB.id, email: resB.email };

    // Generate authenticated Bearer tokens
    tokenCustomerA = await sealSessionData({
      user: {
        id: customerA.id,
        email: customerA.email,
        roles: ["REGISTERED_CUSTOMER"],
      },
      isLoggedIn: true,
    });

    tokenCustomerB = await sealSessionData({
      user: {
        id: customerB.id,
        email: customerB.email,
        roles: ["REGISTERED_CUSTOMER"],
      },
      isLoggedIn: true,
    });
  });

  afterAll(async () => {
    // Cleanup database records for Customer A and Customer B
    const userIds = [customerA?.id, customerB?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.address.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.customerProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.userRole.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  });

  describe("1. Customer Profile (GET & PATCH /api/v1/customers/profile)", () => {
    it("should retrieve the authenticated customer's profile (200 OK)", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/customers/profile", {
        headers: { Authorization: `Bearer ${tokenCustomerA}` },
      });

      const res = await getProfileRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.userId).toBe(customerA.id);
      expect(json.data.email).toBe(customerA.email);
      expect(json.data.firstName).toBe("Alice");
      expect(json.data.lastName).toBe("Adams");
      expect(json.data.phone).toBe("+12125550101");
    });

    it("should reject unauthenticated profile retrieval (401 Unauthorized)", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/customers/profile");

      const res = await getProfileRoute(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should update profile details (name and phone) (200 OK)", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/customers/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustomerA}`,
        },
        body: JSON.stringify({
          firstName: "Alicia",
          lastName: "Adams-Smith",
          phone: "+12125550999",
        }),
      });

      const res = await patchProfileRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.firstName).toBe("Alicia");
      expect(json.data.lastName).toBe("Adams-Smith");
      expect(json.data.phone).toBe("+12125550999");

      // Verify database update
      const dbProfile = await prisma.customerProfile.findUnique({
        where: { userId: customerA.id },
      });
      expect(dbProfile?.firstName).toBe("Alicia");
      expect(dbProfile?.lastName).toBe("Adams-Smith");
    });

    it("should reject profile update with invalid phone format (422 Unprocessable)", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/customers/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustomerA}`,
        },
        body: JSON.stringify({
          phone: "invalid-phone-format-xyz",
        }),
      });

      const res = await patchProfileRoute(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("2. Customer Address Creation & Listing (POST & GET /api/v1/customers/addresses)", () => {
    let createdShippingAddressId: string;
    let createdBillingAddressId: string;

    it("should create a SHIPPING address for Customer A (201 Created)", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/customers/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustomerA}`,
        },
        body: JSON.stringify({
          recipientName: "Alicia Adams",
          type: "SHIPPING",
          streetLine1: "350 5th Ave",
          streetLine2: "Suite 4200",
          city: "New York",
          state: "NY",
          postalCode: "10118",
          countryCode: "US",
          isDefault: true,
        }),
      });

      const res = await createAddressRoute(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.id).toBeDefined();
      expect(json.data.userId).toBe(customerA.id);
      expect(json.data.type).toBe("SHIPPING");
      expect(json.data.streetLine1).toBe("350 5th Ave");
      expect(json.data.city).toBe("New York");
      expect(json.data.isDefault).toBe(true);

      createdShippingAddressId = json.data.id;
    });

    it("should create a BILLING address for Customer A (201 Created)", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/customers/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustomerA}`,
        },
        body: JSON.stringify({
          recipientName: "Alicia Adams Corp",
          type: "BILLING",
          streetLine1: "1 Wall St",
          city: "New York",
          state: "NY",
          postalCode: "10005",
          countryCode: "US",
          isDefault: false,
        }),
      });

      const res = await createAddressRoute(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.type).toBe("BILLING");
      expect(json.data.isDefault).toBe(false);

      createdBillingAddressId = json.data.id;
    });

    it("should reject address creation with missing mandatory fields (422 Unprocessable)", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/customers/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustomerA}`,
        },
        body: JSON.stringify({
          recipientName: "Alicia",
          // missing streetLine1, city, state, postalCode
        }),
      });

      const res = await createAddressRoute(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should list all addresses belonging to Customer A (200 OK)", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/customers/addresses", {
        headers: { Authorization: `Bearer ${tokenCustomerA}` },
      });

      const res = await listAddressesRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(json.data.addresses)).toBe(true);
      expect(json.data.addresses.length).toBeGreaterThanOrEqual(2);

      const addressIds = json.data.addresses.map((a: any) => a.id);
      expect(addressIds).toContain(createdShippingAddressId);
      expect(addressIds).toContain(createdBillingAddressId);
    });
  });

  describe("3. Default Address Toggle Guarantee", () => {
    let addr1Id: string;
    let addr2Id: string;

    it("should atomically unset previous default address when a new address is marked as default", async () => {
      cookieJar.clear();

      // Create First Address with isDefault: true
      const req1 = new NextRequest("http://localhost:3000/api/v1/customers/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustomerA}`,
        },
        body: JSON.stringify({
          recipientName: "Default Test 1",
          type: "SHIPPING",
          streetLine1: "100 Broadway",
          city: "New York",
          state: "NY",
          postalCode: "10005",
          countryCode: "US",
          isDefault: true,
        }),
      });
      const res1 = await createAddressRoute(req1);
      const json1 = await res1.json();
      addr1Id = json1.data.id;
      expect(json1.data.isDefault).toBe(true);

      // Create Second Address with isDefault: true
      const req2 = new NextRequest("http://localhost:3000/api/v1/customers/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustomerA}`,
        },
        body: JSON.stringify({
          recipientName: "Default Test 2",
          type: "SHIPPING",
          streetLine1: "200 Broadway",
          city: "New York",
          state: "NY",
          postalCode: "10006",
          countryCode: "US",
          isDefault: true,
        }),
      });
      const res2 = await createAddressRoute(req2);
      const json2 = await res2.json();
      addr2Id = json2.data.id;
      expect(json2.data.isDefault).toBe(true);

      // Verify that addr1 has been automatically unset from isDefault
      const addr1Db = await prisma.address.findUnique({ where: { id: addr1Id } });
      const addr2Db = await prisma.address.findUnique({ where: { id: addr2Id } });

      expect(addr1Db?.isDefault).toBe(false);
      expect(addr2Db?.isDefault).toBe(true);

      // Verify CustomerProfile defaultShippingAddressId points to addr2
      const profile = await prisma.customerProfile.findUnique({ where: { userId: customerA.id } });
      expect(profile?.defaultShippingAddressId).toBe(addr2Id);
    });

    it("should update default address toggle via PATCH /api/v1/customers/addresses/[id]", async () => {
      cookieJar.clear();

      // Set addr1 back to default
      const patchReq = new NextRequest(`http://localhost:3000/api/v1/customers/addresses/${addr1Id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustomerA}`,
        },
        body: JSON.stringify({ isDefault: true }),
      });

      const patchRes = await patchAddressRoute(patchReq, {
        params: Promise.resolve({ id: addr1Id }),
      });
      expect(patchRes.status).toBe(200);

      // Check that addr1 is now default and addr2 is unset
      const addr1Db = await prisma.address.findUnique({ where: { id: addr1Id } });
      const addr2Db = await prisma.address.findUnique({ where: { id: addr2Id } });

      expect(addr1Db?.isDefault).toBe(true);
      expect(addr2Db?.isDefault).toBe(false);
    });
  });

  describe("4. Insecure Direct Object Reference (IDOR) Security Boundary Verification", () => {
    let customerA_AddressId: string;

    beforeAll(async () => {
      // Create a private address under Customer A
      const addr = await prisma.address.create({
        data: {
          userId: customerA.id,
          recipientName: "Alice Adams Private",
          type: "SHIPPING",
          streetLine1: "742 Evergreen Terrace",
          city: "Springfield",
          state: "OR",
          postalCode: "97477",
          countryCode: "US",
          isDefault: false,
        },
      });
      customerA_AddressId = addr.id;
    });

    it("TC-IDOR-01: Customer B cannot retrieve Customer A's address via GET (404 Not Found)", async () => {
      cookieJar.clear();

      const req = new NextRequest(
        `http://localhost:3000/api/v1/customers/addresses/${customerA_AddressId}`,
        {
          headers: { Authorization: `Bearer ${tokenCustomerB}` },
        }
      );

      const res = await getAddressRoute(req, {
        params: Promise.resolve({ id: customerA_AddressId }),
      });
      const json = await res.json();

      // OWASP Anti-IDOR standard: Returns 404 NOT_FOUND to avoid disclosing object existence
      expect(res.status).toBe(404);
      expect(json.error.code).toBe("NOT_FOUND");
      expect(json.error.message).toContain("Address not found");
    });

    it("TC-IDOR-02: Customer B cannot update Customer A's address via PATCH (404 Not Found)", async () => {
      cookieJar.clear();

      const req = new NextRequest(
        `http://localhost:3000/api/v1/customers/addresses/${customerA_AddressId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenCustomerB}`,
          },
          body: JSON.stringify({
            recipientName: "Hacked by Bob Baker",
            streetLine1: "666 Malicious Lane",
          }),
        }
      );

      const res = await patchAddressRoute(req, {
        params: Promise.resolve({ id: customerA_AddressId }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe("NOT_FOUND");

      // Verify the address was NOT mutated in the database
      const dbAddr = await prisma.address.findUnique({
        where: { id: customerA_AddressId },
      });
      expect(dbAddr?.recipientName).toBe("Alice Adams Private");
      expect(dbAddr?.streetLine1).toBe("742 Evergreen Terrace");
    });

    it("TC-IDOR-03: Customer B cannot delete Customer A's address via DELETE (404 Not Found)", async () => {
      cookieJar.clear();

      const req = new NextRequest(
        `http://localhost:3000/api/v1/customers/addresses/${customerA_AddressId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenCustomerB}` },
        }
      );

      const res = await deleteAddressRoute(req, {
        params: Promise.resolve({ id: customerA_AddressId }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe("NOT_FOUND");

      // Verify the address STILL exists in the database
      const dbAddr = await prisma.address.findUnique({
        where: { id: customerA_AddressId },
      });
      expect(dbAddr).not.toBeNull();
      expect(dbAddr?.id).toBe(customerA_AddressId);
    });

    it("should allow Customer A to legitimately retrieve, update, and delete their own address", async () => {
      cookieJar.clear();

      // Legitimate GET
      const getReq = new NextRequest(
        `http://localhost:3000/api/v1/customers/addresses/${customerA_AddressId}`,
        {
          headers: { Authorization: `Bearer ${tokenCustomerA}` },
        }
      );
      const getRes = await getAddressRoute(getReq, {
        params: Promise.resolve({ id: customerA_AddressId }),
      });
      expect(getRes.status).toBe(200);

      // Legitimate PATCH
      const patchReq = new NextRequest(
        `http://localhost:3000/api/v1/customers/addresses/${customerA_AddressId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenCustomerA}`,
          },
          body: JSON.stringify({ streetLine1: "742 Evergreen Terrace Apt B" }),
        }
      );
      const patchRes = await patchAddressRoute(patchReq, {
        params: Promise.resolve({ id: customerA_AddressId }),
      });
      expect(patchRes.status).toBe(200);

      // Legitimate DELETE
      const delReq = new NextRequest(
        `http://localhost:3000/api/v1/customers/addresses/${customerA_AddressId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenCustomerA}` },
        }
      );
      const delRes = await deleteAddressRoute(delReq, {
        params: Promise.resolve({ id: customerA_AddressId }),
      });
      expect(delRes.status).toBe(200);

      // Verify deletion in database
      const dbAddrAfter = await prisma.address.findUnique({
        where: { id: customerA_AddressId },
      });
      expect(dbAddrAfter).toBeNull();
    });
  });
});
