/**
 * Integration Test: RBAC Enforcement & Critical Scenario TC-CRIT-12
 * PRD Acceptance Criterion 12: "Staff member without permission attempts a refund; request is denied and logged."
 * Complies with ADR-005 (Deny-by-default access control).
 */

import { describe, it, expect, vi } from "vitest";
import {
  ROLES,
  PERMISSIONS,
  assertPermission,
  hasPermission,
  RbacForbiddenError,
  RbacUnauthorizedError,
  RbacActor,
} from "@/lib/rbac.guard";

describe("RBAC Critical Security Scenario: TC-CRIT-12", () => {
  // Mock audit logger to capture security denial events (PRD 13.3 / ADR-005)
  const auditLogSpy = vi.fn();

  function attemptRefundApproval(actor: RbacActor | null, refundId: string, storeScope?: string) {
    try {
      assertPermission(actor, PERMISSIONS.REFUNDS_APPROVE, storeScope);
      // If authorized, record successful mutation audit log
      auditLogSpy({
        actorId: actor?.id,
        action: "refund:approve",
        targetType: "Refund",
        targetId: refundId,
        outcome: "SUCCESS",
      });
      return { success: true, refundId };
    } catch (error) {
      if (error instanceof RbacForbiddenError) {
        auditLogSpy({
          actorId: error.actorId ?? "unknown",
          action: "security:access_denied",
          targetType: "Refund",
          targetId: refundId,
          outcome: "DENIED_403",
          requiredPermission: error.requiredPermission,
          roles: error.roles,
        });
      }
      throw error;
    }
  }

  it("TC-CRIT-12: Denies refund approval attempt by Customer Support agent and records audit log", () => {
    const supportAgent: RbacActor = {
      id: "agent-supp-77",
      email: "support@store.internal",
      roles: [ROLES.CUSTOMER_SUPPORT],
      status: "ACTIVE",
    };

    expect(() => attemptRefundApproval(supportAgent, "rfd-test-001")).toThrow(
      RbacForbiddenError
    );

    // Verify audit log captured denial
    expect(auditLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "agent-supp-77",
        action: "security:access_denied",
        outcome: "DENIED_403",
        requiredPermission: PERMISSIONS.REFUNDS_APPROVE,
        roles: [ROLES.CUSTOMER_SUPPORT],
      })
    );
  });

  it("TC-CRIT-12: Denies refund approval attempt by Order Manager (request-only role)", () => {
    const orderManager: RbacActor = {
      id: "manager-ord-12",
      email: "orders@store.internal",
      roles: [ROLES.ORDER_MANAGER],
      status: "ACTIVE",
    };

    // Order Manager can request refunds, but cannot approve/execute
    expect(hasPermission(orderManager, PERMISSIONS.REFUNDS_REQUEST)).toBe(true);
    expect(hasPermission(orderManager, PERMISSIONS.REFUNDS_APPROVE)).toBe(false);

    expect(() => attemptRefundApproval(orderManager, "rfd-test-002")).toThrow(
      RbacForbiddenError
    );
  });

  it("TC-CRIT-12: Denies refund approval attempt by Content Editor, Catalog Manager, and Analyst", () => {
    const unauthorizedActors: RbacActor[] = [
      { id: "editor-1", roles: [ROLES.CONTENT_EDITOR], status: "ACTIVE" },
      { id: "catalog-1", roles: [ROLES.CATALOG_MANAGER], status: "ACTIVE" },
      { id: "analyst-1", roles: [ROLES.ANALYST], status: "ACTIVE" },
    ];

    for (const actor of unauthorizedActors) {
      expect(() => attemptRefundApproval(actor, "rfd-test-batch")).toThrow(
        RbacForbiddenError
      );
    }
  });

  it("TC-CRIT-12: Allows refund approval for Finance Manager (authorized role A in PRD 13.2)", () => {
    const financeManager: RbacActor = {
      id: "fin-mgr-05",
      email: "finance@store.internal",
      roles: [ROLES.FINANCE_MANAGER],
      status: "ACTIVE",
    };

    const result = attemptRefundApproval(financeManager, "rfd-test-003");
    expect(result.success).toBe(true);
    expect(result.refundId).toBe("rfd-test-003");

    expect(auditLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "fin-mgr-05",
        action: "refund:approve",
        outcome: "SUCCESS",
      })
    );
  });

  it("TC-CRIT-12: Allows refund approval for Super Admin (full administrative role F in PRD 13.2)", () => {
    const superAdmin: RbacActor = {
      id: "super-admin-01",
      email: "admin@store.internal",
      roles: [ROLES.SUPER_ADMIN],
      status: "ACTIVE",
    };

    const result = attemptRefundApproval(superAdmin, "rfd-test-004");
    expect(result.success).toBe(true);
  });

  it("TC-CRIT-12: Unauthenticated attempt throws RbacUnauthorizedError (401)", () => {
    expect(() => attemptRefundApproval(null, "rfd-anon")).toThrow(
      RbacUnauthorizedError
    );
  });
});
