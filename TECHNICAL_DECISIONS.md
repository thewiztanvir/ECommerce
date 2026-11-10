# Architecture Decision Records (ADRs)

This document records the foundational architectural decisions made for the production e-commerce platform.

---

## ADR-001: Modular Monolith vs. Microservices Architecture

- **Status:** Approved
- **Deciders:** Software Architect, Product Manager, DevOps Engineer
- **Context:**
  The PRD defines 10 core domain modules (Auth, Catalog, Cart, Checkout, Inventory, Orders, Payments, CMS, Admin, Audit). Microservices would introduce distributed transactions (2PC/Saga), network latency, complex observability, and multi-service deployment overhead.
- **Decision:**
  We adopt a **Type-Safe Modular Monolith** in Next.js 15 (TypeScript) and PostgreSQL. Each domain module (`src/modules/*`) encapsulates its own domain models, business services, and database repositories. Communication between modules occurs via in-process TypeScript interfaces and database transactions. Background asynchronous operations use an outbox pattern with Redis/BullMQ.
- **Consequences:**
  - *Positive:* Atomic multi-table database transactions; zero inter-service network latency; simple single-container deployment; full type safety end-to-end.
  - *Trade-off:* Requires disciplined module boundaries to prevent accidental coupling; scalable by horizontal replication of the entire stateless node.

---

## ADR-002: Relational Database & Atomic Inventory Reservation Pattern

- **Status:** Approved
- **Deciders:** Software Architect, Database Engineer, Backend Engineer
- **Context:**
  PRD Section 9.3 mandates that inventory reservations must be concurrency-safe with a target of **zero overselling** caused by race conditions during peak checkout traffic.
- **Decision:**
  We adopt **PostgreSQL 16+** with Prisma ORM. Stock reservation uses an atomic conditional SQL `UPDATE` statement:
  ```sql
  UPDATE inventory
  SET reserved_quantity = reserved_quantity + :requested,
      updated_at = NOW()
  WHERE variant_id = :variant_id
    AND (on_hand_quantity - reserved_quantity - safety_stock) >= :requested;
  ```
  If affected rows equals 1, the reservation succeeds and is stored with a 15-minute TTL. If 0 rows are affected, the reservation fails immediately, triggering a 409 Conflict / Out of Stock response. An automated background worker reaps expired active reservations.
- **Consequences:**
  - *Positive:* Mathematical guarantee of zero overselling without distributed locks. High performance under concurrent load.
  - *Trade-off:* Requires raw SQL execution within Prisma transactions.

---

## ADR-003: Monetary Calculations in Integer Minor Units (Cents)

- **Status:** Approved
- **Deciders:** Software Architect, Backend Engineer, QA Engineer
- **Context:**
  PRD Section 7.2 (FR-PRICE-001) mandates that monetary values must never use binary floating-point representations due to rounding discrepancies.
- **Decision:**
  All prices, discounts, shipping fees, tax amounts, and order totals are stored and manipulated strictly as **integer minor units** (`amount_minor: integer`, representing cents for USD/EUR or base units for zero-decimal currencies) paired with an explicit ISO 4217 currency code (`currency: string`). Formatting for display occurs strictly at the presentation layer using `Intl.NumberFormat`.
- **Consequences:**
  - *Positive:* Eliminates IEEE 754 floating-point errors (`0.1 + 0.2 != 0.3`). Guarantees exact ledger accounting.
  - *Trade-off:* UI input fields must convert decimal inputs to minor units upon receipt.

---

## ADR-004: Payment Gateway Adapter & Durable Webhook Inbox

- **Status:** Approved
- **Deciders:** Software Architect, Security Engineer, Backend Engineer
- **Context:**
  PRD Section 7.3 requires seamless payment processing, PCI DSS compliance (zero storage of raw card credentials), and resilient webhook ingestion that tolerates network retries, duplicate events, and out-of-order delivery.
- **Decision:**
  1. We use hosted/tokenized payment elements (Stripe Elements pattern) to ensure card data never touches our application servers.
  2. Webhook endpoints verify HMAC signatures and persist raw events to a durable `payment_events` table before acknowledging with HTTP 200.
  3. A unique constraint on `(provider, event_id)` guarantees idempotent processing. State transitions follow a strict Finite State Machine that ignores illegal regressions.
  4. A built-in Mock Payment Adapter is provided for deterministic, hermetic local testing and CI/CD pipelines.
- **Consequences:**
  - *Positive:* Zero PCI liability; resilient against provider webhook retries and network partitions; completely reproducible local test suite.

---

## ADR-005: Deny-by-Default Role-Based Access Control (RBAC) & Session Auth

- **Status:** Approved
- **Deciders:** Security Engineer, Software Architect, Backend Engineer
- **Context:**
  PRD Section 13 defines a detailed permission matrix across 10 roles. Admin functions must be safeguarded against privilege escalation, CSRF, and IDOR.
- **Decision:**
  1. Passwords hashed using Argon2id or bcrypt (salt rounds = 12).
  2. Authenticated sessions managed via cryptographically signed HTTP-only, SameSite=Lax, Secure cookies.
  3. Server-side RBAC guard middleware intercepts all `/api/v1/admin/*` routes to check permissions against the database. UI element hiding is treated strictly as an affordance, never as a security boundary.
  4. Every state mutation generates an immutable entry in the `audit_logs` table capturing `actor_id`, `action`, `target_type`, `target_id`, `ip_address`, and diff.
- **Consequences:**
  - *Positive:* Comprehensive protection against OWASP Top 10 vulnerabilities and full audit compliance.

---

## ADR-006: Package Build Script Approval & Lifecycle Configuration (pnpm v12)

- **Status:** Approved
- **Deciders:** DevOps Engineer
- **Context:**
  In pnpm v12+, package lifecycle scripts (e.g. `postinstall` for native binary bindings like `@prisma/client`, `@prisma/engines`, `prisma`, `esbuild`, `sharp`) are blocked by default for security (`ERR_PNPM_IGNORED_BUILDS`). Additionally, `pnpm.onlyBuiltDependencies` in `package.json` is deprecated and ignored in favor of `pnpm-workspace.yaml`.
- **Decision:**
  We configure build script authorizations explicitly in `pnpm-workspace.yaml` under `allowBuilds`:
  ```yaml
  allowBuilds:
    '@prisma/client': true
    '@prisma/engines': true
    esbuild: true
    prisma: true
    sharp: true
  ```
  And we removed the deprecated `pnpm` field from `package.json`.
- **Consequences:**
  - *Positive:* Reproducible, deterministic package installation across local Windows/Linux development environments and CI/CD runners with zero installation warnings or blocked build scripts.
