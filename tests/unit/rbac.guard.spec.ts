import { describe, it, expect } from "vitest";
import {
  ROLES,
  PERMISSIONS,
  ALL_ROLES,
  ALL_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  hasRole,
  assertPermission,
  getEffectivePermissions,
  getPermissionsForRole,
  RbacForbiddenError,
  RbacUnauthorizedError,
  GLOBAL_SCOPE,
  RbacActor,
} from "@/lib/rbac.guard";

describe("RBAC Guard & Permission Matrix (PRD Section 13.1, 13.2 / ADR-005)", () => {
  describe("Deny-by-Default Core Guarantees", () => {
    it("denies access when subject is null, undefined, or empty", () => {
      expect(hasPermission(null, PERMISSIONS.PRODUCTS_READ)).toBe(false);
      expect(hasPermission(undefined, PERMISSIONS.PRODUCTS_READ)).toBe(false);
      expect(hasPermission([], PERMISSIONS.PRODUCTS_READ)).toBe(false);
    });

    it("denies access when user account status is SUSPENDED or DELETED", () => {
      const suspendedUser: RbacActor = {
        id: "user-1",
        status: "SUSPENDED",
        roles: [ROLES.SUPER_ADMIN],
      };
      const deletedUser: RbacActor = {
        id: "user-2",
        status: "DELETED",
        roles: [ROLES.SUPER_ADMIN],
      };

      expect(hasPermission(suspendedUser, PERMISSIONS.PRODUCTS_READ)).toBe(false);
      expect(hasPermission(deletedUser, PERMISSIONS.PRODUCTS_READ)).toBe(false);
      expect(() => assertPermission(suspendedUser, PERMISSIONS.PRODUCTS_READ)).toThrow(
        RbacForbiddenError
      );
    });

    it("throws RbacUnauthorizedError (401) when asserting permissions for unauthenticated subject", () => {
      expect(() => assertPermission(null, PERMISSIONS.PRODUCTS_READ)).toThrow(
        RbacUnauthorizedError
      );
      try {
        assertPermission(null, PERMISSIONS.PRODUCTS_READ);
      } catch (err) {
        expect((err as RbacUnauthorizedError).statusCode).toBe(401);
      }
    });

    it("throws RbacForbiddenError (403) when subject lacks permission", () => {
      const supportUser: RbacActor = {
        id: "user-support",
        roles: [ROLES.CUSTOMER_SUPPORT],
      };

      expect(() =>
        assertPermission(supportUser, PERMISSIONS.SETTINGS_MANAGE)
      ).toThrow(RbacForbiddenError);

      try {
        assertPermission(supportUser, PERMISSIONS.SETTINGS_MANAGE);
      } catch (err) {
        const rbacErr = err as RbacForbiddenError;
        expect(rbacErr.statusCode).toBe(403);
        expect(rbacErr.requiredPermission).toBe(PERMISSIONS.SETTINGS_MANAGE);
        expect(rbacErr.roles).toContain(ROLES.CUSTOMER_SUPPORT);
      }
    });
  });

  describe("PRD Section 13.2 Permission Matrix Verification Across All 10 Roles", () => {
    it("Super Admin has full access to all defined permissions", () => {
      const superAdmin: RbacActor = {
        id: "admin-1",
        roles: [ROLES.SUPER_ADMIN],
      };

      for (const permission of ALL_PERMISSIONS) {
        expect(hasPermission(superAdmin, permission)).toBe(true);
      }
    });

    it("Store Admin has operational permissions within store, but cannot manage global settings/full financial exports", () => {
      const storeAdmin: RbacActor = {
        id: "sa-1",
        roles: [{ role: ROLES.STORE_ADMIN, scope: "STORE_101" }],
      };

      // Allowed within store scope
      expect(hasPermission(storeAdmin, PERMISSIONS.PRODUCTS_CREATE, "STORE_101")).toBe(true);
      expect(hasPermission(storeAdmin, PERMISSIONS.ORDERS_UPDATE, "STORE_101")).toBe(true);
      expect(hasPermission(storeAdmin, PERMISSIONS.ORDERS_CANCEL, "STORE_101")).toBe(true);
      expect(hasPermission(storeAdmin, PERMISSIONS.SETTINGS_MANAGE_STORE, "STORE_101")).toBe(true);
      expect(hasPermission(storeAdmin, PERMISSIONS.REPORTS_FINANCIAL_STORE, "STORE_101")).toBe(true);

      // Disallowed global administrative rights
      expect(hasPermission(storeAdmin, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
      expect(hasPermission(storeAdmin, PERMISSIONS.USERS_MANAGE)).toBe(false);
      expect(hasPermission(storeAdmin, PERMISSIONS.REPORTS_FINANCIAL_FULL)).toBe(false);
      expect(hasPermission(storeAdmin, PERMISSIONS.REPORTS_EXPORT)).toBe(false);
    });

    it("Catalog Manager has C/U on products/categories, R on inventory/orders, no mutation elsewhere", () => {
      const catalogManager: RbacActor = {
        id: "cm-1",
        roles: [ROLES.CATALOG_MANAGER],
      };

      // C/U on products & categories
      expect(hasPermission(catalogManager, PERMISSIONS.PRODUCTS_READ)).toBe(true);
      expect(hasPermission(catalogManager, PERMISSIONS.PRODUCTS_CREATE)).toBe(true);
      expect(hasPermission(catalogManager, PERMISSIONS.PRODUCTS_UPDATE)).toBe(true);
      expect(hasPermission(catalogManager, PERMISSIONS.PRODUCTS_DELETE)).toBe(false); // No delete

      expect(hasPermission(catalogManager, PERMISSIONS.CATEGORIES_READ)).toBe(true);
      expect(hasPermission(catalogManager, PERMISSIONS.CATEGORIES_CREATE)).toBe(true);
      expect(hasPermission(catalogManager, PERMISSIONS.CATEGORIES_UPDATE)).toBe(true);
      expect(hasPermission(catalogManager, PERMISSIONS.CATEGORIES_DELETE)).toBe(false); // No delete

      // Read on inventory & orders
      expect(hasPermission(catalogManager, PERMISSIONS.INVENTORY_READ)).toBe(true);
      expect(hasPermission(catalogManager, PERMISSIONS.ORDERS_READ)).toBe(true);

      // No access to refunds, settings, customers, CMS, cancel
      expect(hasPermission(catalogManager, PERMISSIONS.ORDERS_CANCEL)).toBe(false);
      expect(hasPermission(catalogManager, PERMISSIONS.REFUNDS_REQUEST)).toBe(false);
      expect(hasPermission(catalogManager, PERMISSIONS.CUSTOMERS_READ)).toBe(false);
      expect(hasPermission(catalogManager, PERMISSIONS.SETTINGS_READ)).toBe(false);
    });

    it("Inventory Manager has C/U on inventory, R on products/categories/orders, no delete", () => {
      const invManager: RbacActor = {
        id: "im-1",
        roles: [ROLES.INVENTORY_MANAGER],
      };

      expect(hasPermission(invManager, PERMISSIONS.INVENTORY_READ)).toBe(true);
      expect(hasPermission(invManager, PERMISSIONS.INVENTORY_CREATE)).toBe(true);
      expect(hasPermission(invManager, PERMISSIONS.INVENTORY_UPDATE)).toBe(true);
      expect(hasPermission(invManager, PERMISSIONS.INVENTORY_DELETE)).toBe(false);

      expect(hasPermission(invManager, PERMISSIONS.PRODUCTS_READ)).toBe(true);
      expect(hasPermission(invManager, PERMISSIONS.CATEGORIES_READ)).toBe(true);
      expect(hasPermission(invManager, PERMISSIONS.ORDERS_READ)).toBe(true);

      // Cannot mutate products or process orders
      expect(hasPermission(invManager, PERMISSIONS.PRODUCTS_CREATE)).toBe(false);
      expect(hasPermission(invManager, PERMISSIONS.ORDERS_UPDATE)).toBe(false);
      expect(hasPermission(invManager, PERMISSIONS.ORDERS_CANCEL)).toBe(false);
    });

    it("Order Manager has C/U on orders, Approve cancel, Request-only refunds, R on inventory/products", () => {
      const orderManager: RbacActor = {
        id: "om-1",
        roles: [ROLES.ORDER_MANAGER],
      };

      expect(hasPermission(orderManager, PERMISSIONS.ORDERS_READ)).toBe(true);
      expect(hasPermission(orderManager, PERMISSIONS.ORDERS_CREATE)).toBe(true);
      expect(hasPermission(orderManager, PERMISSIONS.ORDERS_UPDATE)).toBe(true);

      // Cancel Order: Approve/Execute
      expect(hasPermission(orderManager, PERMISSIONS.ORDERS_CANCEL)).toBe(true);

      // Refunds: Request only (cannot approve or manage)
      expect(hasPermission(orderManager, PERMISSIONS.REFUNDS_REQUEST)).toBe(true);
      expect(hasPermission(orderManager, PERMISSIONS.REFUNDS_APPROVE)).toBe(false);
      expect(hasPermission(orderManager, PERMISSIONS.REFUNDS_MANAGE)).toBe(false);

      expect(hasPermission(orderManager, PERMISSIONS.CUSTOMERS_READ)).toBe(true);
      expect(hasPermission(orderManager, PERMISSIONS.REPORTS_FULFILLMENT_METRICS)).toBe(true);
      expect(hasPermission(orderManager, PERMISSIONS.AUDIT_READ)).toBe(true);

      // Cannot mutate inventory directly or manage settings
      expect(hasPermission(orderManager, PERMISSIONS.INVENTORY_CREATE)).toBe(false);
      expect(hasPermission(orderManager, PERMISSIONS.SETTINGS_READ)).toBe(false);
    });

    it("Customer Support has Request-only for cancel and refunds, limited customer updates, no approval", () => {
      const support: RbacActor = {
        id: "cs-1",
        roles: [ROLES.CUSTOMER_SUPPORT],
      };

      expect(hasPermission(support, PERMISSIONS.ORDERS_READ)).toBe(true);
      expect(hasPermission(support, PERMISSIONS.PRODUCTS_READ)).toBe(true);
      expect(hasPermission(support, PERMISSIONS.INVENTORY_READ)).toBe(true);

      // Request only
      expect(hasPermission(support, PERMISSIONS.ORDERS_CANCEL_REQUEST)).toBe(true);
      expect(hasPermission(support, PERMISSIONS.ORDERS_CANCEL)).toBe(false);

      expect(hasPermission(support, PERMISSIONS.REFUNDS_REQUEST)).toBe(true);
      expect(hasPermission(support, PERMISSIONS.REFUNDS_APPROVE)).toBe(false);

      // Limited customer edit (contact info only)
      expect(hasPermission(support, PERMISSIONS.CUSTOMERS_READ)).toBe(true);
      expect(hasPermission(support, PERMISSIONS.CUSTOMERS_UPDATE_CONTACT)).toBe(true);
      expect(hasPermission(support, PERMISSIONS.CUSTOMERS_DELETE)).toBe(false);
      expect(hasPermission(support, PERMISSIONS.CUSTOMERS_READ_PII)).toBe(false);
    });

    it("Marketing Manager has C/U promotions, C/U CMS, Publish content (A), customer segments", () => {
      const marketing: RbacActor = {
        id: "mkt-1",
        roles: [ROLES.MARKETING_MANAGER],
      };

      expect(hasPermission(marketing, PERMISSIONS.PROMOTIONS_READ)).toBe(true);
      expect(hasPermission(marketing, PERMISSIONS.PROMOTIONS_CREATE)).toBe(true);
      expect(hasPermission(marketing, PERMISSIONS.PROMOTIONS_UPDATE)).toBe(true);
      expect(hasPermission(marketing, PERMISSIONS.PROMOTIONS_DELETE)).toBe(false);

      expect(hasPermission(marketing, PERMISSIONS.CMS_READ)).toBe(true);
      expect(hasPermission(marketing, PERMISSIONS.CMS_CREATE)).toBe(true);
      expect(hasPermission(marketing, PERMISSIONS.CMS_UPDATE)).toBe(true);
      expect(hasPermission(marketing, PERMISSIONS.CMS_PUBLISH)).toBe(true);

      expect(hasPermission(marketing, PERMISSIONS.CUSTOMERS_READ_SEGMENT)).toBe(true);
      expect(hasPermission(marketing, PERMISSIONS.REPORTS_CAMPAIGN_REVENUE)).toBe(true);

      // No order, inventory mutation or direct refund access
      expect(hasPermission(marketing, PERMISSIONS.ORDERS_UPDATE)).toBe(false);
      expect(hasPermission(marketing, PERMISSIONS.REFUNDS_REQUEST)).toBe(false);
    });

    it("Content Editor has C/U CMS, but CANNOT publish directly (subject to workflow)", () => {
      const editor: RbacActor = {
        id: "ce-1",
        roles: [ROLES.CONTENT_EDITOR],
      };

      expect(hasPermission(editor, PERMISSIONS.CMS_READ)).toBe(true);
      expect(hasPermission(editor, PERMISSIONS.CMS_CREATE)).toBe(true);
      expect(hasPermission(editor, PERMISSIONS.CMS_UPDATE)).toBe(true);
      expect(hasPermission(editor, PERMISSIONS.CMS_SUBMIT_FOR_REVIEW)).toBe(true);

      // Direct publish MUST BE DENIED (PRD 13.2: "subject to workflow")
      expect(hasPermission(editor, PERMISSIONS.CMS_PUBLISH)).toBe(false);
      expect(() => assertPermission(editor, PERMISSIONS.CMS_PUBLISH)).toThrow(
        RbacForbiddenError
      );

      // Cannot access orders or inventory
      expect(hasPermission(editor, PERMISSIONS.ORDERS_READ)).toBe(false);
      expect(hasPermission(editor, PERMISSIONS.INVENTORY_READ)).toBe(false);
    });

    it("Finance Manager has Approve refunds (A), Full financial reports, billing customer info, Audit read", () => {
      const finance: RbacActor = {
        id: "fin-1",
        roles: [ROLES.FINANCE_MANAGER],
      };

      // Refunds: Approve and Execute
      expect(hasPermission(finance, PERMISSIONS.REFUNDS_READ)).toBe(true);
      expect(hasPermission(finance, PERMISSIONS.REFUNDS_REQUEST)).toBe(true);
      expect(hasPermission(finance, PERMISSIONS.REFUNDS_APPROVE)).toBe(true);

      expect(hasPermission(finance, PERMISSIONS.REPORTS_FINANCIAL_FULL)).toBe(true);
      expect(hasPermission(finance, PERMISSIONS.REPORTS_EXPORT)).toBe(true);
      expect(hasPermission(finance, PERMISSIONS.AUDIT_READ)).toBe(true);
      expect(hasPermission(finance, PERMISSIONS.CUSTOMERS_READ_BILLING)).toBe(true);

      // Read-only catalog, inventory, orders
      expect(hasPermission(finance, PERMISSIONS.PRODUCTS_READ)).toBe(true);
      expect(hasPermission(finance, PERMISSIONS.INVENTORY_READ)).toBe(true);
      expect(hasPermission(finance, PERMISSIONS.ORDERS_READ)).toBe(true);

      // No CMS, settings manage, or order status mutation
      expect(hasPermission(finance, PERMISSIONS.CMS_CREATE)).toBe(false);
      expect(hasPermission(finance, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
      expect(hasPermission(finance, PERMISSIONS.ORDERS_UPDATE)).toBe(false);
    });

    it("Analyst has strictly Read-only and aggregate metrics with ZERO mutation permissions", () => {
      const analyst: RbacActor = {
        id: "an-1",
        roles: [ROLES.ANALYST],
      };

      // Read access
      expect(hasPermission(analyst, PERMISSIONS.PRODUCTS_READ)).toBe(true);
      expect(hasPermission(analyst, PERMISSIONS.CATEGORIES_READ)).toBe(true);
      expect(hasPermission(analyst, PERMISSIONS.INVENTORY_READ)).toBe(true);
      expect(hasPermission(analyst, PERMISSIONS.ORDERS_READ)).toBe(true);
      expect(hasPermission(analyst, PERMISSIONS.REFUNDS_READ)).toBe(true);
      expect(hasPermission(analyst, PERMISSIONS.CUSTOMERS_READ_AGGREGATE)).toBe(true);
      expect(hasPermission(analyst, PERMISSIONS.PROMOTIONS_READ)).toBe(true);
      expect(hasPermission(analyst, PERMISSIONS.CMS_READ)).toBe(true);
      expect(hasPermission(analyst, PERMISSIONS.REPORTS_FINANCIAL_AGGREGATE)).toBe(true);

      // Zero mutation permissions
      expect(hasPermission(analyst, PERMISSIONS.PRODUCTS_CREATE)).toBe(false);
      expect(hasPermission(analyst, PERMISSIONS.PRODUCTS_UPDATE)).toBe(false);
      expect(hasPermission(analyst, PERMISSIONS.INVENTORY_UPDATE)).toBe(false);
      expect(hasPermission(analyst, PERMISSIONS.ORDERS_UPDATE)).toBe(false);
      expect(hasPermission(analyst, PERMISSIONS.ORDERS_CANCEL)).toBe(false);
      expect(hasPermission(analyst, PERMISSIONS.REFUNDS_APPROVE)).toBe(false);
      expect(hasPermission(analyst, PERMISSIONS.CMS_CREATE)).toBe(false);
      expect(hasPermission(analyst, PERMISSIONS.CMS_PUBLISH)).toBe(false);
      expect(hasPermission(analyst, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
      expect(hasPermission(analyst, PERMISSIONS.CUSTOMERS_READ_PII)).toBe(false);
    });
  });

  describe("Scope Isolation & Multi-Tenant Boundaries", () => {
    it("allows global role to operate across all specific store scopes", () => {
      const globalStoreAdmin: RbacActor = {
        id: "sa-global",
        roles: [{ role: ROLES.STORE_ADMIN, scope: GLOBAL_SCOPE }],
      };

      expect(
        hasPermission(globalStoreAdmin, PERMISSIONS.ORDERS_UPDATE, "STORE_EAST")
      ).toBe(true);
      expect(
        hasPermission(globalStoreAdmin, PERMISSIONS.ORDERS_UPDATE, "STORE_WEST")
      ).toBe(true);
    });

    it("restricts store-scoped role from accessing resources in a different store", () => {
      const eastStoreAdmin: RbacActor = {
        id: "sa-east",
        roles: [{ role: ROLES.STORE_ADMIN, scope: "STORE_EAST" }],
      };

      // Allowed in assigned store
      expect(
        hasPermission(eastStoreAdmin, PERMISSIONS.ORDERS_UPDATE, "STORE_EAST")
      ).toBe(true);

      // Denied in different store
      expect(
        hasPermission(eastStoreAdmin, PERMISSIONS.ORDERS_UPDATE, "STORE_WEST")
      ).toBe(false);

      expect(() =>
        assertPermission(eastStoreAdmin, PERMISSIONS.ORDERS_UPDATE, "STORE_WEST")
      ).toThrow(RbacForbiddenError);
    });
  });

  describe("Helper Utilities", () => {
    it("checks hasAllPermissions correctly", () => {
      const superAdmin = [ROLES.SUPER_ADMIN];
      const support = [ROLES.CUSTOMER_SUPPORT];

      expect(
        hasAllPermissions(superAdmin, [
          PERMISSIONS.PRODUCTS_READ,
          PERMISSIONS.SETTINGS_MANAGE,
        ])
      ).toBe(true);

      expect(
        hasAllPermissions(support, [
          PERMISSIONS.PRODUCTS_READ,
          PERMISSIONS.SETTINGS_MANAGE,
        ])
      ).toBe(false);
    });

    it("checks hasAnyPermission correctly", () => {
      const support = [ROLES.CUSTOMER_SUPPORT];

      expect(
        hasAnyPermission(support, [
          PERMISSIONS.PRODUCTS_READ,
          PERMISSIONS.SETTINGS_MANAGE,
        ])
      ).toBe(true);

      expect(
        hasAnyPermission(support, [
          PERMISSIONS.SETTINGS_MANAGE,
          PERMISSIONS.CMS_PUBLISH,
        ])
      ).toBe(false);
    });

    it("checks hasRole correctly", () => {
      const actor: RbacActor = {
        id: "u-1",
        roles: [{ role: ROLES.ORDER_MANAGER, scope: "STORE_01" }],
      };

      expect(hasRole(actor, ROLES.ORDER_MANAGER, "STORE_01")).toBe(true);
      expect(hasRole(actor, ROLES.ORDER_MANAGER, "STORE_02")).toBe(false);
      expect(hasRole(actor, ROLES.SUPER_ADMIN)).toBe(false);
    });

    it("combines permissions from multiple roles on one user", () => {
      const hybridUser: RbacActor = {
        id: "hybrid-1",
        roles: [ROLES.CATALOG_MANAGER, ROLES.INVENTORY_MANAGER],
      };

      // From Catalog Manager: Products C/U
      expect(hasPermission(hybridUser, PERMISSIONS.PRODUCTS_CREATE)).toBe(true);
      // From Inventory Manager: Inventory C/U
      expect(hasPermission(hybridUser, PERMISSIONS.INVENTORY_CREATE)).toBe(true);
      // Neither role has CMS or Orders cancel
      expect(hasPermission(hybridUser, PERMISSIONS.CMS_CREATE)).toBe(false);
      expect(hasPermission(hybridUser, PERMISSIONS.ORDERS_CANCEL)).toBe(false);
    });

    it("retrieves distinct effective permissions", () => {
      const perms = getEffectivePermissions([ROLES.CATALOG_MANAGER]);
      expect(perms.has(PERMISSIONS.PRODUCTS_READ)).toBe(true);
      expect(perms.has(PERMISSIONS.PRODUCTS_CREATE)).toBe(true);
      expect(perms.has(PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    });

    it("retrieves permissions for role definition", () => {
      const superAdminPerms = getPermissionsForRole(ROLES.SUPER_ADMIN);
      expect(superAdminPerms.length).toBe(ALL_PERMISSIONS.length);
    });
  });
});
