# Known Issues, Risks & Technical Debt

This document tracks known issues, deferred enhancements, technical debt, and environmental risks.

---

## 1. Active Defects & Issues

| Issue ID | Severity | Component | Description | Workaround / Mitigation | Target Milestone |
|---|---|---|---|---|---|
| *None* | — | — | No active code defects reported. Greenfield baseline. | — | — |

---

## 2. Technical Debt & Deferred Enhancements

| Debt ID | Type | Description | Rationale | Planned Remediation |
|---|---|---|---|---|
| **DEBT-01** | Integration | Mock Payment Gateway used for automated test suites. | Enables hermetic CI testing without depending on external network APIs or live sandbox credentials. | Provider abstraction layer (`PaymentAdapter`) supports seamless swapping to production Stripe API via environment keys. |
| **DEBT-02** | Search | Database-backed ILIKE / Full-Text Search used initially for search queries. | Avoids operational complexity of deploying a separate Elasticsearch or Meilisearch cluster during initial release. | Abstraction layer (`SearchService`) is decoupled, allowing pluggable indexing engines in Phase 6. |

---

## 3. Environmental Risks

| Risk ID | Impact | Description | Monitoring & Mitigation |
|---|---|---|---|
| **ENV-01** | High | Concurrent database writes to inventory table under flash sales. | Row lock contention minimized by updating variants in deterministic sort order and keeping transaction durations short. |
| **ENV-02** | Medium | Webhook delivery latency from payment gateways during network spikes. | Durable `payment_events` inbox table buffers all events; polling fallback checks payment status during customer confirmation. |
