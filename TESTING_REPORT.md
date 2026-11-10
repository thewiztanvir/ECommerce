# Testing Strategy & Execution Report

This document records the automated testing strategy, critical test scenario coverage, test execution logs, and defect verification status.

---

## 1. Test Strategy Overview

The testing architecture spans three automated layers:
1. **Unit Testing:** Tests domain logic engines in isolation (pricing arithmetic, tax evaluation, discount stacking, order state transitions, money utility).
2. **Integration Testing:** Tests API route contracts (`/api/v1/*`), database transaction boundaries, atomic inventory reservation under concurrency, and webhook signature verification.
3. **End-to-End (E2E) Testing:** Validates full customer and administrative journeys in headless browser environments via Playwright.

---

## 2. 18 Critical Test Scenarios (PRD Section 23.2)

| Test ID | Critical Scenario Description | Target Test File | Priority | Automation Status | Result |
|---|---|---|---|---|---|
| **TC-CRIT-01** | Customer adds an in-stock variant to cart. | `tests/unit/cart.service.spec.ts` | P0 | Planned (Phase 3) | Pending |
| **TC-CRIT-02** | Customer attempts to add more units than available; rejected gracefully. | `tests/unit/cart.service.spec.ts` | P0 | Planned (Phase 3) | Pending |
| **TC-CRIT-03** | Concurrent checkout for final unit; exactly one reservation succeeds. | `tests/integration/inventory.concurrency.spec.ts` | P0 | Planned (Phase 3) | Pending |
| **TC-CRIT-04** | Price changes after item enters cart; checkout reflects authoritative price. | `tests/unit/pricing.engine.spec.ts` | P0 | Planned (Phase 3) | Pending |
| **TC-CRIT-05** | Coupon expires between cart and checkout; checkout rejects it. | `tests/unit/promotions.service.spec.ts` | P0 | Planned (Phase 3) | Pending |
| **TC-CRIT-06** | Customer double-clicks place-order button; only one order created. | `tests/integration/checkout.idempotency.spec.ts` | P0 | Planned (Phase 4) | Pending |
| **TC-CRIT-07** | Payment provider sends duplicate webhook; payment applied exactly once. | `tests/integration/webhooks.spec.ts` | P0 | Planned (Phase 4) | Pending |
| **TC-CRIT-08** | Payment webhook arrives before browser redirect; order state remains valid. | `tests/integration/webhooks.spec.ts` | P0 | Planned (Phase 4) | Pending |
| **TC-CRIT-09** | Payment succeeds but email notification fails; order remains confirmed and email retries. | `tests/unit/outbox.service.spec.ts` | P0 | Planned (Phase 4) | Pending |
| **TC-CRIT-10** | Payment fails; reserved inventory released according to policy. | `tests/integration/checkout.failure.spec.ts` | P0 | Planned (Phase 4) | Pending |
| **TC-CRIT-11** | Refund webhook is duplicated; refund is not duplicated. | `tests/integration/refunds.spec.ts` | P0 | Planned (Phase 5) | Pending |
| **TC-CRIT-12** | Staff member without permission attempts a refund; denied (403) and audited. | `tests/integration/rbac.guard.spec.ts` | P0 | Planned (Phase 1) | Pending |
| **TC-CRIT-13** | CMS editor previews a draft; draft is not publicly accessible. | `tests/integration/cms.spec.ts` | P0 | Planned (Phase 5) | Pending |
| **TC-CRIT-14** | Scheduled content publishes at the configured timestamp. | `tests/unit/cms.service.spec.ts` | P0 | Planned (Phase 5) | Pending |
| **TC-CRIT-15** | Database backup is restored into clean environment with intact counts. | `tests/integration/backup.spec.ts` | P0 | Planned (Phase 6) | Pending |
| **TC-CRIT-16** | Customer cannot access another customer's order by ID change (IDOR test). | `tests/integration/orders.idor.spec.ts` | P0 | Planned (Phase 4) | Pending |
| **TC-CRIT-17** | Invalid or malicious media upload is rejected. | `tests/integration/media.upload.spec.ts` | P0 | Planned (Phase 2) | Pending |
| **TC-CRIT-18** | API rate limits enforced on authentication and checkout endpoints. | `tests/integration/ratelimit.spec.ts` | P0 | Planned (Phase 1) | Pending |

---

## 3. Test Execution Summary

*Test execution tracking will be updated as each development phase implements its automated test suites.*
- **Phase 0 Scaffolding:** Build and lint verification.
- **Current Passed Tests:** 0 / 18
- **Critical Defects:** 0
