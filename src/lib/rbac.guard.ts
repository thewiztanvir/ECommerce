/**
 * Role-Based Access Control (RBAC) Guard & Permission Engine
 * Complies with PRD Section 13.1, Section 13.2 (Permission Matrix) and ADR-001 / ADR-005.
 *
 * Core Principles:
 * 1. Deny access by default (ADR-005). Any unspecified or unmapped permission is strictly forbidden.
 * 2. Server-side authoritative: UI element visibility is only an affordance, never a security boundary.
 * 3. Enforces the PRD 13.2 matrix across all 10 roles:
 *    - SUPER_ADMIN
 *    - STORE_ADMIN
 *    - CATALOG_MANAGER
 *    - INVENTORY_MANAGER
 *    - ORDER_MANAGER
 *    - CUSTOMER_SUPPORT
 *    - MARKETING_MANAGER
 *    - CONTENT_EDITOR
 *    - FINANCE_MANAGER
 *    - ANALYST
 * 4. Multi-scope aware: Staff roles may be scoped globally or restricted to specific stores/locations.
 */

// =============================================================================
// 1. ROLES & PERMISSION DEFINITIONS
// =============================================================================

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  STORE_ADMIN: "STORE_ADMIN",
  CATALOG_MANAGER: "CATALOG_MANAGER",
  INVENTORY_MANAGER: "INVENTORY_MANAGER",
  ORDER_MANAGER: "ORDER_MANAGER",
  CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
  MARKETING_MANAGER: "MARKETING_MANAGER",
  CONTENT_EDITOR: "CONTENT_EDITOR",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  ANALYST: "ANALYST",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly RoleName[] = Object.values(ROLES);

/**
 * Granular application permissions representing the 14 areas of PRD Section 13.2.
 */
export const PERMISSIONS = {
  // Area 1: Platform Settings
  SETTINGS_READ: "settings:read",
  SETTINGS_MANAGE: "settings:manage",
  SETTINGS_MANAGE_STORE: "settings:manage_store",

  // Area 2: Users and Roles
  USERS_READ: "users:read",
  USERS_MANAGE: "users:manage",
  USERS_MANAGE_STORE: "users:manage_store",

  // Area 3: Products
  PRODUCTS_READ: "products:read",
  PRODUCTS_CREATE: "products:create",
  PRODUCTS_UPDATE: "products:update",
  PRODUCTS_DELETE: "products:delete",

  // Area 4: Categories & Attributes
  CATEGORIES_READ: "categories:read",
  CATEGORIES_CREATE: "categories:create",
  CATEGORIES_UPDATE: "categories:update",
  CATEGORIES_DELETE: "categories:delete",

  // Area 5: Inventory
  INVENTORY_READ: "inventory:read",
  INVENTORY_CREATE: "inventory:create",
  INVENTORY_UPDATE: "inventory:update",
  INVENTORY_DELETE: "inventory:delete",

  // Area 6: Orders
  ORDERS_READ: "orders:read",
  ORDERS_CREATE: "orders:create",
  ORDERS_UPDATE: "orders:update",
  ORDERS_DELETE: "orders:delete",

  // Area 7: Cancel Order
  ORDERS_CANCEL: "orders:cancel",
  ORDERS_CANCEL_REQUEST: "orders:cancel_request",

  // Area 8: Refunds
  REFUNDS_READ: "refunds:read",
  REFUNDS_REQUEST: "refunds:request",
  REFUNDS_APPROVE: "refunds:approve",
  REFUNDS_APPROVE_LIMITED: "refunds:approve_limited",
  REFUNDS_MANAGE: "refunds:manage",

  // Area 9: Customers
  CUSTOMERS_READ: "customers:read",
  CUSTOMERS_CREATE: "customers:create",
  CUSTOMERS_UPDATE: "customers:update",
  CUSTOMERS_DELETE: "customers:delete",
  CUSTOMERS_READ_PII: "customers:read_pii",
  CUSTOMERS_READ_AGGREGATE: "customers:read_aggregate",
  CUSTOMERS_UPDATE_CONTACT: "customers:update_contact",
  CUSTOMERS_READ_SEGMENT: "customers:read_segment",
  CUSTOMERS_READ_BILLING: "customers:read_billing",

  // Area 10: Promotions
  PROMOTIONS_READ: "promotions:read",
  PROMOTIONS_CREATE: "promotions:create",
  PROMOTIONS_UPDATE: "promotions:update",
  PROMOTIONS_DELETE: "promotions:delete",

  // Area 11: CMS Content
  CMS_READ: "cms:read",
  CMS_CREATE: "cms:create",
  CMS_UPDATE: "cms:update",
  CMS_DELETE: "cms:delete",

  // Area 12: Publish Content
  CMS_PUBLISH: "cms:publish",
  CMS_SUBMIT_FOR_REVIEW: "cms:submit_for_review",

  // Area 13: Financial Reports
  REPORTS_FINANCIAL_FULL: "reports:financial_full",
  REPORTS_FINANCIAL_STORE: "reports:financial_store",
  REPORTS_FULFILLMENT_METRICS: "reports:fulfillment_metrics",
  REPORTS_CAMPAIGN_REVENUE: "reports:campaign_revenue",
  REPORTS_FINANCIAL_AGGREGATE: "reports:financial_aggregate",
  REPORTS_EXPORT: "reports:export",

  // Area 14: Audit Log
  AUDIT_READ: "audit:read",
  AUDIT_EXPORT: "audit:export",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(PERMISSIONS);

export const GLOBAL_SCOPE = "GLOBAL";

// =============================================================================
// 2. PERMISSION MATRIX ENFORCEMENT (PRD Section 13.2)
// =============================================================================

/**
 * Strict role-to-permission mapping derived from PRD Section 13.2.
 */
export const ROLE_PERMISSIONS_MATRIX: Record<RoleName, ReadonlySet<PermissionKey>> = {
  // 1. SUPER_ADMIN: Full access across all 14 areas without restriction
  [ROLES.SUPER_ADMIN]: new Set(ALL_PERMISSIONS),

  // 2. STORE_ADMIN: Full operations within store scope, limited settings/users/refunds/reports
  [ROLES.STORE_ADMIN]: new Set<PermissionKey>([
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_MANAGE_STORE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_MANAGE_STORE,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.CATEGORIES_CREATE,
    PERMISSIONS.CATEGORIES_UPDATE,
    PERMISSIONS.CATEGORIES_DELETE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.ORDERS_DELETE,
    PERMISSIONS.ORDERS_CANCEL,
    PERMISSIONS.REFUNDS_READ,
    PERMISSIONS.REFUNDS_REQUEST,
    PERMISSIONS.REFUNDS_APPROVE_LIMITED,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.CUSTOMERS_READ_PII,
    PERMISSIONS.CUSTOMERS_READ_AGGREGATE,
    PERMISSIONS.PROMOTIONS_READ,
    PERMISSIONS.PROMOTIONS_CREATE,
    PERMISSIONS.PROMOTIONS_UPDATE,
    PERMISSIONS.PROMOTIONS_DELETE,
    PERMISSIONS.CMS_READ,
    PERMISSIONS.CMS_CREATE,
    PERMISSIONS.CMS_UPDATE,
    PERMISSIONS.CMS_DELETE,
    PERMISSIONS.CMS_PUBLISH,
    PERMISSIONS.REPORTS_FINANCIAL_STORE,
    PERMISSIONS.AUDIT_READ,
  ]),

  // 3. CATALOG_MANAGER: Products C/U, Categories C/U, Inventory R, Orders R
  [ROLES.CATALOG_MANAGER]: new Set<PermissionKey>([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.CATEGORIES_CREATE,
    PERMISSIONS.CATEGORIES_UPDATE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ORDERS_READ,
  ]),

  // 4. INVENTORY_MANAGER: Products R, Categories R, Inventory C/U, Orders R
  [ROLES.INVENTORY_MANAGER]: new Set<PermissionKey>([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.ORDERS_READ,
  ]),

  // 5. ORDER_MANAGER: Orders C/U, Cancel Order (A), Refunds (request only), Customers R, Audit R
  [ROLES.ORDER_MANAGER]: new Set<PermissionKey>([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.ORDERS_CANCEL,
    PERMISSIONS.REFUNDS_REQUEST,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.REPORTS_FULFILLMENT_METRICS,
    PERMISSIONS.AUDIT_READ,
  ]),

  // 6. CUSTOMER_SUPPORT: Products R, Inventory R, Orders R, Cancel (request only), Refunds (request only), Customers limited
  [ROLES.CUSTOMER_SUPPORT]: new Set<PermissionKey>([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_CANCEL_REQUEST,
    PERMISSIONS.REFUNDS_REQUEST,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_UPDATE_CONTACT,
  ]),

  // 7. MARKETING_MANAGER: Products R, Categories R, Promotions C/U, CMS C/U, Publish Content (A), Customers segment, Reports campaign
  [ROLES.MARKETING_MANAGER]: new Set<PermissionKey>([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.CUSTOMERS_READ_SEGMENT,
    PERMISSIONS.PROMOTIONS_READ,
    PERMISSIONS.PROMOTIONS_CREATE,
    PERMISSIONS.PROMOTIONS_UPDATE,
    PERMISSIONS.CMS_READ,
    PERMISSIONS.CMS_CREATE,
    PERMISSIONS.CMS_UPDATE,
    PERMISSIONS.CMS_PUBLISH,
    PERMISSIONS.REPORTS_CAMPAIGN_REVENUE,
  ]),

  // 8. CONTENT_EDITOR: CMS C/U, Publish subject to workflow (cannot publish directly)
  [ROLES.CONTENT_EDITOR]: new Set<PermissionKey>([
    PERMISSIONS.CMS_READ,
    PERMISSIONS.CMS_CREATE,
    PERMISSIONS.CMS_UPDATE,
    PERMISSIONS.CMS_SUBMIT_FOR_REVIEW,
  ]),

  // 9. FINANCE_MANAGER: Products R, Inventory R, Orders R, Refunds (A), Customers billing, Promotions R, Financial reports (F), Audit R
  [ROLES.FINANCE_MANAGER]: new Set<PermissionKey>([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.REFUNDS_READ,
    PERMISSIONS.REFUNDS_REQUEST,
    PERMISSIONS.REFUNDS_APPROVE,
    PERMISSIONS.CUSTOMERS_READ_BILLING,
    PERMISSIONS.PROMOTIONS_READ,
    PERMISSIONS.REPORTS_FINANCIAL_FULL,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.AUDIT_READ,
  ]),

  // 10. ANALYST: Read-only access across products, categories, inventory, orders, refunds, aggregate customers, promotions, CMS, aggregate reports. No mutation.
  [ROLES.ANALYST]: new Set<PermissionKey>([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.REFUNDS_READ,
    PERMISSIONS.CUSTOMERS_READ_AGGREGATE,
    PERMISSIONS.PROMOTIONS_READ,
    PERMISSIONS.CMS_READ,
    PERMISSIONS.REPORTS_FINANCIAL_AGGREGATE,
  ]),
};

// =============================================================================
// 3. TYPES & ACTOR INTERFACES
// =============================================================================

export interface RoleAssignment {
  role: RoleName | string;
  scope?: string | null;
}

export interface RbacActor {
  id: string;
  roles: Array<RoleAssignment | RoleName | string>;
  status?: string; // "ACTIVE" | "SUSPENDED" | "DELETED"
  email?: string;
}

export type RbacSubject = RbacActor | RoleAssignment[] | RoleName[] | string[];

// =============================================================================
// 4. CUSTOM ERROR CLASSES
// =============================================================================

export class RbacForbiddenError extends Error {
  public readonly statusCode = 403;
  public readonly code = "FORBIDDEN";
  public readonly requiredPermission: PermissionKey;
  public readonly actorId?: string;
  public readonly roles: string[];
  public readonly resourceScope?: string;

  constructor(
    message: string,
    context: {
      requiredPermission: PermissionKey;
      actorId?: string;
      roles?: string[];
      resourceScope?: string;
    }
  ) {
    super(message);
    this.name = "RbacForbiddenError";
    this.requiredPermission = context.requiredPermission;
    this.actorId = context.actorId;
    this.roles = context.roles ?? [];
    this.resourceScope = context.resourceScope;
  }
}

export class RbacUnauthorizedError extends Error {
  public readonly statusCode = 401;
  public readonly code = "UNAUTHORIZED";

  constructor(message: string = "Authentication required to access this resource") {
    super(message);
    this.name = "RbacUnauthorizedError";
  }
}

// =============================================================================
// 5. CORE GUARD & EVALUATION LOGIC
// =============================================================================

/**
 * Normalize input roles into a structured array of RoleAssignment objects.
 */
export function normalizeRoleAssignments(subject: RbacSubject | null | undefined): {
  actorId?: string;
  status: string;
  assignments: RoleAssignment[];
} {
  if (!subject) {
    return { status: "UNAUTHENTICATED", assignments: [] };
  }

  // Check if subject is an RbacActor object
  if (typeof subject === "object" && "roles" in subject && Array.isArray((subject as RbacActor).roles)) {
    const actor = subject as RbacActor;
    const assignments: RoleAssignment[] = actor.roles.map((item) => {
      if (typeof item === "string") {
        return { role: item, scope: GLOBAL_SCOPE };
      }
      return { role: item.role, scope: item.scope ?? GLOBAL_SCOPE };
    });

    return {
      actorId: actor.id,
      status: actor.status ?? "ACTIVE",
      assignments,
    };
  }

  // Check if subject is an array of roles or role assignments
  if (Array.isArray(subject)) {
    const assignments: RoleAssignment[] = subject.map((item) => {
      if (typeof item === "string") {
        return { role: item, scope: GLOBAL_SCOPE };
      }
      if (typeof item === "object" && item !== null && "role" in item) {
        return { role: item.role, scope: item.scope ?? GLOBAL_SCOPE };
      }
      return { role: "", scope: GLOBAL_SCOPE };
    });

    return { status: "ACTIVE", assignments };
  }

  return { status: "UNKNOWN", assignments: [] };
}

/**
 * Check if a scope matches the required resource scope.
 * - GLOBAL scope matches everything.
 * - If resourceScope is not specified, only GLOBAL grants access or any assignment matches general context.
 * - If resourceScope is specified, assignment must match resourceScope or be GLOBAL.
 */
function isScopePermitted(assignmentScope: string | null | undefined, resourceScope?: string): boolean {
  const normAssignmentScope = assignmentScope ?? GLOBAL_SCOPE;
  if (normAssignmentScope === GLOBAL_SCOPE) {
    return true;
  }
  if (!resourceScope || resourceScope === GLOBAL_SCOPE) {
    return false;
  }
  return normAssignmentScope === resourceScope;
}

/**
 * Validate whether a given string is a valid recognized RoleName.
 */
export function isValidRole(role: unknown): role is RoleName {
  return typeof role === "string" && ALL_ROLES.includes(role as RoleName);
}

/**
 * Validate whether a given string is a valid recognized PermissionKey.
 */
export function isValidPermission(permission: unknown): permission is PermissionKey {
  return typeof permission === "string" && ALL_PERMISSIONS.includes(permission as PermissionKey);
}

/**
 * Core permission check: returns true if the subject has the required permission within the specified scope.
 * Denies by default if subject is missing, inactive, unauthenticated, or lacks the permission.
 */
export function hasPermission(
  subject: RbacSubject | null | undefined,
  permission: PermissionKey,
  resourceScope?: string
): boolean {
  if (!subject) return false;

  const { status, assignments } = normalizeRoleAssignments(subject);

  // Inactive, suspended, or deleted accounts are immediately denied
  if (status !== "ACTIVE") {
    return false;
  }

  for (const assignment of assignments) {
    if (!isValidRole(assignment.role)) {
      continue;
    }

    // Check scope match
    if (!isScopePermitted(assignment.scope, resourceScope)) {
      continue;
    }

    const rolePerms = ROLE_PERMISSIONS_MATRIX[assignment.role];
    if (rolePerms && rolePerms.has(permission)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the subject has ALL of the requested permissions within scope.
 */
export function hasAllPermissions(
  subject: RbacSubject | null | undefined,
  permissions: PermissionKey[],
  resourceScope?: string
): boolean {
  if (!permissions.length) return true;
  return permissions.every((p) => hasPermission(subject, p, resourceScope));
}

/**
 * Check if the subject has AT LEAST ONE of the requested permissions within scope.
 */
export function hasAnyPermission(
  subject: RbacSubject | null | undefined,
  permissions: PermissionKey[],
  resourceScope?: string
): boolean {
  if (!permissions.length) return false;
  return permissions.some((p) => hasPermission(subject, p, resourceScope));
}

/**
 * Check if the subject possesses a specific role (with optional scope).
 */
export function hasRole(
  subject: RbacSubject | null | undefined,
  role: RoleName,
  resourceScope?: string
): boolean {
  if (!subject) return false;

  const { status, assignments } = normalizeRoleAssignments(subject);
  if (status !== "ACTIVE") return false;

  return assignments.some(
    (a) => a.role === role && isScopePermitted(a.scope, resourceScope)
  );
}

/**
 * Returns all distinct permissions granted to a given role.
 */
export function getPermissionsForRole(role: RoleName): PermissionKey[] {
  const perms = ROLE_PERMISSIONS_MATRIX[role];
  return perms ? Array.from(perms) : [];
}

/**
 * Returns all distinct effective permissions granted to a subject across all active roles.
 */
export function getEffectivePermissions(
  subject: RbacSubject | null | undefined,
  resourceScope?: string
): Set<PermissionKey> {
  const result = new Set<PermissionKey>();
  if (!subject) return result;

  const { status, assignments } = normalizeRoleAssignments(subject);
  if (status !== "ACTIVE") return result;

  for (const assignment of assignments) {
    if (!isValidRole(assignment.role)) continue;
    if (!isScopePermitted(assignment.scope, resourceScope)) continue;

    const perms = ROLE_PERMISSIONS_MATRIX[assignment.role];
    if (perms) {
      perms.forEach((p) => {
        result.add(p);
      });
    }
  }

  return result;
}

/**
 * Assert that the subject possesses the required permission.
 * Throws RbacUnauthorizedError (401) if subject is unauthenticated.
 * Throws RbacForbiddenError (403) if subject lacks permission (TC-CRIT-12).
 */
export function assertPermission(
  subject: RbacSubject | null | undefined,
  permission: PermissionKey,
  resourceScope?: string
): void {
  if (!subject) {
    throw new RbacUnauthorizedError("Authentication required to perform this action.");
  }

  const { actorId, status, assignments } = normalizeRoleAssignments(subject);

  if (status !== "ACTIVE") {
    throw new RbacForbiddenError(`Account is not active (status: ${status}).`, {
      requiredPermission: permission,
      actorId,
      roles: assignments.map((a) => a.role),
      resourceScope,
    });
  }

  const permitted = hasPermission(subject, permission, resourceScope);

  if (!permitted) {
    throw new RbacForbiddenError(
      `Access denied: lacking required permission '${permission}'${
        resourceScope ? ` in scope '${resourceScope}'` : ""
      }.`,
      {
        requiredPermission: permission,
        actorId,
        roles: assignments.map((a) => a.role),
        resourceScope,
      }
    );
  }
}
