# Phase 1 Sprint Backlog & Acceptance Criteria
## Foundation: Authentication, RBAC, Customer Accounts, Core Entities & Observability

- **Sprint Goal:** Deliver an enterprise-grade foundational backend architecture consisting of normalized database entities, strict minor-unit monetary handling, secure authentication with session management, server-side RBAC across 10 roles, customer account management with IDOR protection, structured JSON logging, and tamper-evident audit logging.
- **Milestone Exit Criteria (PRD Appendix C):**
  - Database schema migrations execute idempotently without data loss.
  - All Phase 1 P0 and P1 requirements pass automated test suites.
  - 100% test coverage for MoneyEngine minor-unit conversions and arithmetic.
  - Authentication, password reset, and session rotation verified against OWASP ASVS Level 2.
  - Server-side RBAC guards verified with deny-by-default behavior across all 10 roles.
  - Zero plain-text passwords or unredacted secrets/PII in log streams.

---

## Epic 1: Database Architecture & Core Domain Entities
**PRD Traceability:** PRD Section 16, FR-PRICE-001, FR-PRICE-002, FR-CAT-003, ADR-002, ADR-003

### Story 1.1: Core Relational Database Schema & Migrations
**As a** system engineer,  
**I want** a strongly-typed, normalized Prisma database schema representing users, roles, customer profiles, addresses, products, orders, inventory, payments, and audit logs,  
**So that** all business operations have strict relational integrity, foreign key constraints, and indexing for optimal query plans.

- **Target Files:** `prisma/schema.prisma`, `prisma/migrations/`, `src/lib/db.ts`
- **Verification Tests:** `tests/integration/db.schema.spec.ts`

#### Acceptance Criteria (Given/When/Then):
1. **Scenario: Successful Schema Migration & Idempotency**
   - **Given** a clean development or staging database environment,
   - **When** the database migration command `prisma db push` or `prisma migrate deploy` is executed,
   - **Then** all 28 core tables specified in PRD Section 16.2 (`users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `customer_profiles`, `addresses`, `categories`, `products`, `product_variants`, `prices`, `inventory`, `stock_movements`, `carts`, `cart_items`, `promotions`, `orders`, `order_items`, `order_addresses`, `order_status_history`, `inventory_reservations`, `payment_attempts`, `payment_events`, `refunds`, `shipments`, `return_requests`, `cms_pages`, `audit_logs`, `outbox_events`) are created without errors.
   - **And** running the migration a second time succeeds without schema mutation or data corruption.

2. **Scenario: Relational Integrity & Cascade Rules**
   - **Given** an existing User record with an associated `CustomerProfile`, saved `Address` entries, and active `UserRole` grants,
   - **When** the User record is deleted via admin cascade,
   - **Then** the dependent profile, addresses, and user-role relations are removed cleanly via `onDelete: Cascade`.
   - **And** financial transaction records, order history (`Order`), and audit log entries (`AuditLog`) retain referential consistency and are strictly preserved without orphaned records.

3. **Scenario: Uniqueness Constraints Enforcement**
   - **Given** a user registered with email `jane.shopper@example.com`,
   - **When** a new user attempts registration with `jane.shopper@example.com` (case-insensitive),
   - **Then** the database rejects the insertion with a unique constraint violation on `users.email`.
   - **And** the application throws a typed conflict error without exposing raw database queries.

---

### Story 1.2: Monetary Value & Explicit Currency Engine
**As a** checkout and finance service,  
**I want** all monetary calculations executed using integer minor units (cents) and explicit ISO-4217 currency codes,  
**So that** floating-point calculation errors, precision drift, and currency mismatches are mathematically impossible.

- **Target Files:** `src/lib/money.ts`
- **Verification Tests:** `tests/unit/money.spec.ts`

#### Acceptance Criteria (Given/When/Then):
1. **Scenario: Floating-Point Elimination during Conversion**
   - **Given** monetary input prices prone to IEEE-754 float inaccuracies (e.g. `19.99 * 100 = 1998.9999999999998` or `0.1 + 0.2 = 0.30000000000000004`),
   - **When** converted via `MoneyEngine.fromDecimal(amount, "USD")`,
   - **Then** the resulting `Money` object returns integer minor units (`1999` and `30` respectively) using half-up rounding.
   - **And** `amountMinor` is guaranteed to be an integer via `Number.isInteger()`.

2. **Scenario: Currency Mismatch Rejection**
   - **Given** an amount of `1000` minor units in currency `"USD"` and another amount of `500` minor units in currency `"EUR"`,
   - **When** `MoneyEngine.add(m1, m2)` or `MoneyEngine.subtract(m1, m2)` is called,
   - **Then** the engine throws a descriptive `CurrencyMismatchError("Cannot operate on mismatched currencies: USD vs EUR")`.
   - **And** no arithmetic calculation is performed.

3. **Scenario: Half-Up Tax and Discount Proration**
   - **Given** a price of `$10.05` (`1005` minor units) subject to a `7.25%` tax rate,
   - **When** `MoneyEngine.multiply(money, 0.0725)` is computed,
   - **Then** the calculated result `72.8625` is rounded strictly half-up to `73` cents minor units.
   - **And** splitting an uneven order line across items preserves the penny sum exactly with zero leakage.

---

## Epic 2: Customer Authentication & Session Management
**PRD Traceability:** FR-ACCOUNT-001, FR-ACCOUNT-002, FR-ACCOUNT-003, SEC-AUTH-001, SEC-AUTH-002, SEC-AUTH-004, SEC-APP-004

### Story 2.1: Customer Registration & Credential Hashing
**As a** prospective customer,  
**I want** to register with my email, password, first name, and last name,  
**So that** I have a private account to track my orders and manage my addresses.

- **Target Files:** `src/modules/auth/auth.service.ts`, `src/modules/auth/password.ts`, `src/app/api/v1/auth/register/route.ts`
- **Verification Tests:** `tests/unit/auth.service.spec.ts`, `tests/integration/auth.api.spec.ts`

#### Acceptance Criteria (Given/When/Then):
1. **Scenario: Successful Registration with Secure Password Hash**
   - **Given** valid registration details (`email: "customer@example.com"`, `password: "ValidPass123!"`, `firstName: "Alice"`, `lastName: "Smith"`),
   - **When** `POST /api/v1/auth/register` is invoked,
   - **Then** a User record is created in status `ACTIVE`.
   - **And** the password is saved as an industry-standard hash (bcrypt with work factor >= 12 or Argon2id) and never stored in plain text.
   - **And** a corresponding `CustomerProfile` is created with `firstName` and `lastName`.
   - **And** the API returns HTTP 201 with public profile data and does not leak the password hash.

2. **Scenario: Password Strength Policy Enforcement**
   - **Given** registration input with a weak password (e.g. `< 8 characters`, missing digits or special characters, or common passwords like `"password123"`),
   - **When** `POST /api/v1/auth/register` is invoked,
   - **Then** the server rejects the request with HTTP 400 Bad Request and validation code `PASSWORD_WEAK`.
   - **And** no user record is created in the database.

3. **Scenario: Duplicate Registration Privacy Preservation**
   - **Given** an existing active user with email `alice@example.com`,
   - **When** an attacker submits registration for `alice@example.com`,
   - **Then** the system returns HTTP 409 Conflict with a generic message `"An account with this email already exists or is unavailable."`.
   - **And** an audit warning is generated without revealing sensitive profile data.

---

## Epic 3: Role-Based Access Control (RBAC) & Privileged Access
**PRD Traceability:** Section 13 (13.1, 13.2, 13.3), FR-RBAC-001, FR-RBAC-002, FR-RBAC-003, SEC-AUTH-003

### Story 3.1: Server-Side RBAC Guard & Permission Matrix Enforcement
**As a** system security architect,  
**I want** a universal server-side authorization guard enforcing the 10-role permission matrix,  
**So that** unauthenticated or unauthorized users are strictly barred from mutating catalog, inventory, orders, CMS, promotions, or financial records.

- **Target Files:** `src/lib/rbac.guard.ts`, `src/lib/permissions.ts`
- **Verification Tests:** `tests/integration/rbac.guard.spec.ts`, `tests/unit/rbac.matrix.spec.ts`

#### Acceptance Criteria (Given/When/Then):
1. **Scenario: Deny Access by Default**
   - **Given** any API endpoint under `/api/v1/admin/*`,
   - **When** an unauthenticated request or a request without explicit role authorization is received,
   - **Then** the RBAC guard rejects the request with HTTP 401 Unauthorized or HTTP 403 Forbidden.
   - **And** no business logic or database query is executed.

2. **Scenario: 10-Role Permission Matrix Validation**
   - **Given** the 10 predefined roles in PRD Section 13.2:
     - `SUPER_ADMIN`, `STORE_ADMIN`, `CATALOG_MANAGER`, `INVENTORY_MANAGER`, `ORDER_MANAGER`, `CUSTOMER_SUPPORT`, `MARKETING_MANAGER`, `CONTENT_EDITOR`, `FINANCE_MANAGER`, `ANALYST`,
   - **When** tested against specific capability keys:
     - Catalog Manager editing products: **Allowed** (HTTP 200).
     - Catalog Manager issuing a refund or deleting orders: **Denied** (HTTP 403 `code: "INSUFFICIENT_PERMISSIONS"`).
     - Finance Manager issuing/approving refunds: **Allowed** (HTTP 200).
     - Customer Support reading order history: **Allowed** (HTTP 200).
     - Customer Support editing platform settings: **Denied** (HTTP 403).
   - **Then** permissions are evaluated strictly on the server regardless of UI component visibility.
