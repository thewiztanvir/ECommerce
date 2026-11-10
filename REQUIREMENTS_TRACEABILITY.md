# Requirements Traceability Matrix (RTM) — Production Baseline v1.0
*Strictly verified against Ecommerce_PRD.md*

### 1. Storefront & Product Discovery
| PRD Req ID | Priority | Description | Domain Module | Target File(s) | Verification Test | Phase |
|---|---|---|---|---|---|---|
| FR-HOME-001 | P0 | Display approved hero content, featured categories, and selected products. | `cms`, `catalog` | `src/app/(storefront)/page.tsx`, `src/modules/cms/` | `tests/unit/cms.service.spec.ts` | Phase 2 |
| FR-HOME-002 | P0 | Content blocks configurable through CMS. | `cms` | `src/modules/cms/cms.service.ts` | `tests/unit/cms.service.spec.ts` | Phase 5 |
| FR-HOME-003 | P1 | Support campaign banners with start and end dates. | `cms` | `src/modules/cms/cms.repository.ts` | `tests/unit/cms.service.spec.ts` | Phase 5 |
| FR-HOME-004 | P1 | Shield unpublished or expired campaign content from public display. | `cms` | `src/modules/cms/cms.service.ts` | `tests/unit/cms.service.spec.ts` | Phase 5 |
| FR-HOME-005 | P1 | Provide meaningful loading, empty, and failure states. | `ui` | `src/components/ui/` | `tests/e2e/storefront-states.spec.ts` | Phase 2 |
| FR-PLP-001 | P0 | Display products assigned to selected category. | `catalog` | `src/app/(storefront)/category/[slug]/page.tsx` | `tests/integration/catalog.api.spec.ts` | Phase 2 |
| FR-PLP-002 | P0 | Support pagination or cursor loading with stable ordering. | `catalog` | `src/modules/catalog/catalog.service.ts` | `tests/integration/catalog.api.spec.ts` | Phase 2 |
| FR-PLP-003 | P0 | Support sorting by relevance, newest, price asc/desc. | `catalog` | `src/modules/catalog/catalog.repository.ts` | `tests/unit/catalog.sort.spec.ts` | Phase 2 |
| FR-PLP-004 | P0 | Support attribute filters (facets). | `catalog` | `src/modules/catalog/catalog.service.ts` | `tests/unit/catalog.facets.spec.ts` | Phase 2 |
| FR-PLP-005 | P0 | Display product card with image, title, price, compare-at, availability. | `ui`, `catalog` | `src/components/storefront/product-card.tsx` | `tests/e2e/catalog-browsing.spec.ts` | Phase 2 |
| FR-PLP-006 | P1 | Preserve filters and sorting in shareable URL search params. | `catalog` | `src/components/storefront/facet-filters.tsx` | `tests/e2e/catalog-browsing.spec.ts` | Phase 2 |
| FR-PLP-007 | P1 | Clearly identify unavailable products; honor business visibility rule. | `catalog`, `inventory` | `src/modules/catalog/catalog.service.ts` | `tests/unit/catalog.service.spec.ts` | Phase 2 |
| FR-PLP-008 | P1 | Avoid layout shifts (CLS < 0.1) on image load. | `ui` | `src/components/ui/optimized-image.tsx` | `tests/e2e/lighthouse.spec.ts` | Phase 6 |
| FR-SEARCH-001 | P0 | Search by name, SKU, brand, category, searchable attributes. | `catalog` | `src/modules/catalog/search.service.ts` | `tests/unit/search.service.spec.ts` | Phase 2 |
| FR-SEARCH-002 | P0 | Return paginated results with deterministic sorting. | `catalog` | `src/modules/catalog/search.service.ts` | `tests/integration/search.api.spec.ts` | Phase 2 |
| FR-SEARCH-003 | P0 | Provide helpful empty state with query revision advice. | `catalog` | `src/app/(storefront)/search/page.tsx` | `tests/e2e/search.spec.ts` | Phase 2 |
| FR-SEARCH-004 | P1 | Typo tolerance and synonym search matching. | `catalog` | `src/modules/catalog/search.service.ts` | `tests/unit/search.service.spec.ts` | Phase 2 |
| FR-SEARCH-005 | P1 | Autocomplete suggestions without exposing unpublished products. | `catalog` | `src/app/api/v1/search/autocomplete/route.ts` | `tests/integration/search.api.spec.ts` | Phase 2 |
| FR-SEARCH-006 | P1 | Record search analytics without storing unnecessary PII. | `audit` | `src/modules/audit/audit.service.ts` | `tests/unit/audit.service.spec.ts` | Phase 2 |
| FR-PDP-001 | P0 | Display product title, description, SKU, price, availability, media gallery. | `catalog` | `src/app/(storefront)/product/[slug]/page.tsx` | `tests/e2e/pdp.spec.ts` | Phase 2 |
| FR-PDP-002 | P0 | Support selectable variants (size, color, material). | `catalog` | `src/components/storefront/variant-selector.tsx` | `tests/e2e/pdp.spec.ts` | Phase 2 |
| FR-PDP-003 | P0 | Recalculate price and availability dynamically on variant change. | `catalog`, `inventory` | `src/components/storefront/pdp-view.tsx` | `tests/e2e/pdp.spec.ts` | Phase 2 |
| FR-PDP-004 | P0 | Prevent adding disabled, unpublished, or unavailable variant to cart. | `cart` | `src/modules/cart/cart.service.ts` | `tests/unit/cart.service.spec.ts` | Phase 3 |
| FR-PDP-005 | P0 | Display reliable shipping or delivery estimates. | `checkout` | `src/modules/checkout/shipping.service.ts` | `tests/unit/shipping.service.spec.ts` | Phase 3 |
| FR-PDP-006 | P1 | Display product attributes, care instructions, and related products. | `catalog` | `src/components/storefront/pdp-attributes.tsx` | `tests/e2e/pdp.spec.ts` | Phase 2 |
| FR-PDP-007 | P1 | Support accessible image zoom and full-size gallery viewer. | `ui` | `src/components/storefront/media-gallery.tsx` | `tests/e2e/pdp.spec.ts` | Phase 2 |
| FR-PDP-008 | P1 | Show customer reviews only if verified review feature is enabled. | `catalog` | `src/components/storefront/product-reviews.tsx` | `tests/unit/catalog.reviews.spec.ts` | Phase 2 |

### 2. Cart, Pricing & Customer Accounts
| PRD Req ID | Priority | Description | Domain Module | Target File(s) | Verification Test | Phase |
|---|---|---|---|---|---|---|
| FR-CART-001 | P0 | Add valid product variant to cart. | `cart` | `src/modules/cart/cart.service.ts` | `tests/unit/cart.service.spec.ts` | Phase 3 |
| FR-CART-002 | P0 | Update item quantities within stock and purchase limits. | `cart` | `src/modules/cart/cart.service.ts` | `tests/unit/cart.service.spec.ts` | Phase 3 |
| FR-CART-003 | P0 | Remove items from cart. | `cart` | `src/modules/cart/cart.service.ts` | `tests/unit/cart.service.spec.ts` | Phase 3 |
| FR-CART-004 | P0 | Recalculate subtotal, discounts, shipping, taxes, and total. | `cart`, `checkout` | `src/modules/checkout/pricing.engine.ts` | `tests/unit/pricing.engine.spec.ts` | Phase 3 |
| FR-CART-005 | P0 | Authoritative server price/stock validation; client totals never trusted. | `cart`, `checkout` | `src/modules/checkout/pricing.engine.ts` | `tests/unit/pricing.engine.spec.ts` | Phase 3 |
| FR-CART-006 | P0 | Persist cart for authenticated customers. | `cart` | `src/modules/cart/cart.repository.ts` | `tests/integration/cart.api.spec.ts` | Phase 3 |
| FR-CART-007 | P1 | Persist guest cart with secure opaque token hash. | `cart` | `src/modules/cart/cart.service.ts` | `tests/unit/cart.guest.spec.ts` | Phase 3 |
| FR-CART-008 | P1 | Merge guest and customer carts upon login with documented conflict rules. | `cart` | `src/modules/cart/cart.service.ts` | `tests/unit/cart.merge.spec.ts` | Phase 3 |
| FR-CART-009 | P1 | Warn customer when price or availability changes since adding. | `cart` | `src/modules/cart/cart.service.ts` | `tests/e2e/cart-price-change.spec.ts` | Phase 3 |
| FR-ACCOUNT-001 | P0 | Customer registration with validated email and password. | `auth` | `src/modules/auth/auth.service.ts` | `tests/unit/auth.service.spec.ts` | Phase 1 |
| FR-ACCOUNT-002 | P0 | Secure login and logout with session cookie invalidation. | `auth` | `src/modules/auth/session.service.ts` | `tests/integration/auth.api.spec.ts` | Phase 1 |
| FR-ACCOUNT-003 | P0 | Password reset using short-lived, single-use high-entropy token. | `auth` | `src/modules/auth/password-reset.service.ts` | `tests/unit/password-reset.spec.ts` | Phase 1 |
| FR-ACCOUNT-004 | P0 | Customers can view their own orders only (strict IDOR protection). | `orders` | `src/modules/orders/orders.service.ts` | `tests/integration/orders.idor.spec.ts` | Phase 4 |
| FR-ACCOUNT-005 | P1 | Manage profile and saved delivery addresses. | `auth`, `customers` | `src/modules/customers/customers.service.ts` | `tests/integration/customers.api.spec.ts` | Phase 1 |
| FR-ACCOUNT-006 | P1 | Account deletion requests subject to financial retention rules. | `customers` | `src/modules/customers/customers.service.ts` | `tests/unit/customer-deletion.spec.ts` | Phase 1 |
| FR-ACCOUNT-007 | P1 | Notify customers of important account security events. | `notifications` | `src/modules/notifications/notification.service.ts` | `tests/unit/notifications.spec.ts` | Phase 4 |

### 3. Checkout, Pricing, Taxes & Payments
| PRD Req ID | Priority | Description | Domain Module | Target File(s) | Verification Test | Phase |
|---|---|---|---|---|---|---|
| FR-CHECKOUT-001 | P0 | Guest and authenticated checkout flows. | `checkout` | `src/app/(storefront)/checkout/page.tsx` | `tests/e2e/checkout-flows.spec.ts` | Phase 3 |
| FR-CHECKOUT-002 | P0 | Collect contact details and delivery address. | `checkout` | `src/components/storefront/checkout-form.tsx` | `tests/e2e/checkout-flows.spec.ts` | Phase 3 |
| FR-CHECKOUT-003 | P0 | Server-side address validation and mandatory field checking. | `checkout` | `src/modules/checkout/checkout.validator.ts` | `tests/unit/checkout.validator.spec.ts` | Phase 3 |
| FR-CHECKOUT-004 | P0 | Present selectable shipping methods and fees before payment submission. | `checkout` | `src/modules/checkout/shipping.service.ts` | `tests/integration/checkout.quote.spec.ts` | Phase 3 |
| FR-CHECKOUT-005 | P0 | Recalculate totals server-side using active catalog, promotion, and tax rules. | `checkout` | `src/modules/checkout/pricing.engine.ts` | `tests/unit/pricing.engine.spec.ts` | Phase 3 |
| FR-CHECKOUT-006 | P0 | Present final order summary before confirming payment. | `checkout` | `src/components/storefront/order-summary.tsx` | `tests/e2e/checkout-flows.spec.ts` | Phase 3 |
| FR-CHECKOUT-007 | P0 | Prevent duplicate order creation via idempotency keys and click deduplication. | `checkout` | `src/modules/checkout/checkout.service.ts` | `tests/integration/checkout.idempotency.spec.ts` | Phase 4 |
| FR-CHECKOUT-008 | P0 | Clear recovery path when payment fails or is abandoned. | `checkout` | `src/app/(storefront)/checkout/recovery/page.tsx` | `tests/e2e/checkout-failure.spec.ts` | Phase 4 |
| FR-CHECKOUT-009 | P1 | Support optional delivery instructions with length and content sanitization. | `checkout` | `src/modules/checkout/checkout.validator.ts` | `tests/unit/checkout.validator.spec.ts` | Phase 3 |
| FR-PRICE-001 | P0 | Store money as integer minor units (cents) or exact decimal; never float. | `checkout`, `db` | `src/lib/money.ts`, `prisma/schema.prisma` | `tests/unit/money.spec.ts` | Phase 1 |
| FR-PRICE-002 | P0 | Store currency explicitly with every monetary amount. | `checkout`, `db` | `src/lib/money.ts`, `prisma/schema.prisma` | `tests/unit/money.spec.ts` | Phase 1 |
| FR-PRICE-003 | P0 | Apply discount-before-or-after-tax calculation rules consistently. | `checkout` | `src/modules/checkout/pricing.engine.ts` | `tests/unit/pricing.engine.spec.ts` | Phase 3 |
| FR-PRICE-004 | P0 | Revalidate price and promotion eligibility strictly at checkout submission. | `checkout` | `src/modules/checkout/pricing.engine.ts` | `tests/unit/pricing.engine.spec.ts` | Phase 3 |
| FR-TAX-001 | P0 | Configurable tax calculation rules and provider support. | `checkout` | `src/modules/checkout/tax.service.ts` | `tests/unit/tax.service.spec.ts` | Phase 3 |
| FR-TAX-002 | P0 | Persist tax rate, taxable base, and calculated tax on order snapshot. | `orders` | `src/modules/orders/orders.service.ts` | `tests/integration/orders.snapshot.spec.ts` | Phase 4 |
| FR-SHIP-001 | P0 | Configurable shipping methods, carrier rates, and eligibility rules. | `checkout` | `src/modules/checkout/shipping.service.ts` | `tests/unit/shipping.service.spec.ts` | Phase 3 |
| FR-SHIP-002 | P0 | Persist selected shipping method, code, and charge on order snapshot. | `orders` | `src/modules/orders/orders.service.ts` | `tests/integration/orders.snapshot.spec.ts` | Phase 4 |
| FR-SHIP-003 | P1 | Support free-shipping qualification thresholds and postal restrictions. | `checkout` | `src/modules/checkout/shipping.service.ts` | `tests/unit/shipping.service.spec.ts` | Phase 3 |
| FR-PAY-001 | P0 | Integrate official hosted/tokenized payment adapter (no raw card data). | `payments` | `src/modules/payments/payment.adapter.ts` | `tests/unit/payment.adapter.spec.ts` | Phase 4 |
| FR-PAY-002 | P0 | Prohibit storage of raw card PAN, CVV, or authentication credentials (PCI-DSS). | `payments` | `src/modules/payments/payment.adapter.ts` | `tests/unit/payment.adapter.spec.ts` | Phase 4 |
| FR-PAY-003 | P0 | Unique payment attempt reference linked to order/checkout reference. | `payments` | `src/modules/payments/payments.service.ts` | `tests/integration/payments.service.spec.ts` | Phase 4 |
| FR-PAY-004 | P0 | Server-to-server verification; never trust browser redirects for payment state. | `payments` | `src/modules/payments/payments.service.ts` | `tests/integration/payments.service.spec.ts` | Phase 4 |
| FR-PAY-005 | P0 | HMAC webhook signature verification and rejection of forged payloads. | `payments` | `src/app/api/v1/payments/webhooks/[provider]/route.ts` | `tests/integration/webhooks.spec.ts` | Phase 4 |
| FR-PAY-006 | P0 | Idempotent webhook event processing using unique provider event IDs. | `payments` | `src/modules/payments/webhook.inbox.ts` | `tests/unit/webhook.inbox.spec.ts` | Phase 4 |
| FR-PAY-007 | P0 | Handle delayed, duplicated, and out-of-order webhook events safely. | `payments` | `src/modules/payments/webhook.inbox.ts` | `tests/unit/webhook.inbox.spec.ts` | Phase 4 |
| FR-PAY-008 | P0 | Record provider transaction IDs and normalized payment states. | `payments` | `src/modules/payments/payments.service.ts` | `tests/integration/payments.service.spec.ts` | Phase 4 |
| FR-PAY-009 | P0 | Support full and partial refunds with payment provider reconciliation. | `payments` | `src/modules/payments/refunds.service.ts` | `tests/unit/refunds.service.spec.ts` | Phase 5 |
| FR-PAY-010 | P0 | Reconcile internal payment records with provider transaction reports. | `payments` | `src/modules/payments/reconciliation.job.ts` | `tests/unit/reconciliation.spec.ts` | Phase 5 |
| FR-PAY-011 | P1 | Support multiple payment methods through unified provider interface. | `payments` | `src/modules/payments/payment.factory.ts` | `tests/unit/payment.factory.spec.ts` | Phase 4 |
| FR-PAY-012 | P1 | Alert operations on repeated webhook failures or state mismatches. | `payments`, `ops`| `src/modules/payments/webhook.inbox.ts` | `tests/unit/webhook.inbox.spec.ts` | Phase 4 |

### 4. Orders, Fulfillment, Inventory & Catalog
| PRD Req ID | Priority | Description | Domain Module | Target File(s) | Verification Test | Phase |
|---|---|---|---|---|---|---|
| FR-ORDER-001 | P0 | Immutable order snapshot (items, variants, prices, taxes, addresses). | `orders` | `src/modules/orders/orders.service.ts` | `tests/integration/orders.snapshot.spec.ts` | Phase 4 |
| FR-ORDER-002 | P0 | Unique, non-guessable public reference separate from internal DB ID. | `orders` | `src/lib/identifiers.ts` | `tests/unit/identifiers.spec.ts` | Phase 4 |
| FR-ORDER-003 | P0 | Keep internal DB IDs private; never expose in public URLs or APIs. | `orders` | `src/lib/identifiers.ts` | `tests/unit/identifiers.spec.ts` | Phase 4 |
| FR-ORDER-004 | P0 | Transactional consistency between order creation and inventory reservation. | `orders`, `inventory` | `src/modules/orders/orders.service.ts` | `tests/integration/orders.tx.spec.ts` | Phase 4 |
| FR-ORDER-005 | P0 | Send order confirmation only when confirmed payment condition is met. | `orders`, `notifications` | `src/modules/orders/orders.service.ts` | `tests/integration/orders.confirmation.spec.ts` | Phase 4 |
| FR-FULFILL-001 | P0 | Authorized staff can view orders ready for packing in fulfillment queue. | `fulfillment` | `src/modules/fulfillment/fulfillment.service.ts` | `tests/integration/fulfillment.spec.ts` | Phase 5 |
| FR-FULFILL-002 | P0 | Staff can record packing and shipment dispatch details. | `fulfillment` | `src/modules/fulfillment/fulfillment.service.ts` | `tests/integration/fulfillment.spec.ts` | Phase 5 |
| FR-FULFILL-003 | P0 | Assign and store tracking number and shipping carrier. | `fulfillment` | `src/modules/fulfillment/fulfillment.service.ts` | `tests/integration/fulfillment.spec.ts` | Phase 5 |
| FR-FULFILL-004 | P1 | Customers can view carrier shipment tracking progress and links. | `orders` | `src/app/(storefront)/account/orders/[id]/page.tsx` | `tests/e2e/order-tracking.spec.ts` | Phase 5 |
| FR-FULFILL-005 | P1 | Support partial shipment fulfillment and tracking splits. | `fulfillment` | `src/modules/fulfillment/fulfillment.service.ts` | `tests/unit/fulfillment.split.spec.ts` | Phase 5 |
| FR-RETURN-001 | P0 | Enforce return eligibility window, item policy, and order status. | `returns` | `src/modules/returns/returns.service.ts` | `tests/unit/returns.service.spec.ts` | Phase 5 |
| FR-RETURN-002 | P0 | Record customer return reason, requested quantity, and condition. | `returns` | `src/modules/returns/returns.service.ts` | `tests/unit/returns.service.spec.ts` | Phase 5 |
| FR-RETURN-003 | P0 | Require role authorization for return request approval or rejection. | `returns`, `auth` | `src/modules/returns/returns.service.ts` | `tests/integration/returns.rbac.spec.ts` | Phase 5 |
| FR-RETURN-004 | P0 | Record refund amount, currency, provider reference, actor, and status. | `returns`, `payments` | `src/modules/payments/refunds.service.ts` | `tests/unit/refunds.service.spec.ts` | Phase 5 |
| FR-RETURN-005 | P0 | Do not mark refund complete until provider confirmation is verified. | `returns`, `payments` | `src/modules/payments/refunds.service.ts` | `tests/integration/returns.spec.ts` | Phase 5 |
| FR-RETURN-006 | P1 | Support partial item returns and restocking into inventory. | `returns`, `inventory` | `src/modules/returns/returns.service.ts` | `tests/integration/returns.restock.spec.ts` | Phase 5 |
| FR-RETURN-007 | P1 | Notify customer upon return approval, item receipt, and refund issuance. | `notifications` | `src/modules/notifications/notification.service.ts` | `tests/unit/notifications.spec.ts` | Phase 5 |
| FR-CAT-001 | P0 | Product lifecycle CRUD: draft, active, archived, and deleted states. | `catalog` | `src/modules/catalog/catalog.admin.service.ts` | `tests/integration/catalog.admin.spec.ts` | Phase 2 |
| FR-CAT-002 | P0 | Support simple products and multi-variant matrix products. | `catalog` | `src/modules/catalog/catalog.admin.service.ts` | `tests/integration/catalog.admin.spec.ts` | Phase 2 |
| FR-CAT-003 | P0 | Enforce unique SKU values across the entire store scope. | `catalog`, `db` | `prisma/schema.prisma`, `src/modules/catalog/` | `tests/unit/catalog.sku.spec.ts` | Phase 1 |
| FR-CAT-004 | P0 | Support hierarchical categories and multiple category assignments. | `catalog` | `src/modules/catalog/category.service.ts` | `tests/unit/category.service.spec.ts` | Phase 2 |
| FR-CAT-005 | P0 | Support configurable custom attributes and attribute types. | `catalog` | `src/modules/catalog/attributes.service.ts` | `tests/unit/attributes.service.spec.ts` | Phase 2 |
| FR-CAT-006 | P0 | Validate all mandatory fields before product publication. | `catalog` | `src/modules/catalog/catalog.validator.ts` | `tests/unit/catalog.validator.spec.ts` | Phase 2 |
| FR-CAT-007 | P0 | Require image alt text and enforce approved image MIME types/sizes. | `catalog` | `src/modules/catalog/media.service.ts` | `tests/unit/media.service.spec.ts` | Phase 2 |
| FR-CAT-008 | P1 | Support bulk product import/export with row-level validation errors. | `catalog` | `src/modules/catalog/bulk-catalog.service.ts` | `tests/unit/bulk-catalog.spec.ts` | Phase 2 |
| FR-CAT-009 | P1 | Maintain audit trail for product pricing, SKU, and status modifications. | `catalog`, `audit` | `src/modules/audit/audit.service.ts` | `tests/unit/audit.service.spec.ts` | Phase 2 |
| FR-INV-001 | P0 | Track on-hand, reserved, and available-to-sell stock separately. | `inventory` | `src/modules/inventory/inventory.service.ts` | `tests/unit/inventory.service.spec.ts` | Phase 3 |
| FR-INV-002 | P0 | ATS formula: `on_hand - reserved - safety_stock`. | `inventory` | `src/modules/inventory/inventory.service.ts` | `tests/unit/inventory.service.spec.ts` | Phase 3 |
| FR-INV-003 | P0 | Record all stock adjustments in immutable stock movements ledger. | `inventory` | `src/modules/inventory/stock-movements.ts` | `tests/unit/stock-movements.spec.ts` | Phase 3 |
| FR-INV-004 | P0 | Require documented business reason for all manual adjustments. | `inventory` | `src/modules/inventory/inventory.service.ts` | `tests/unit/inventory.service.spec.ts` | Phase 3 |
| FR-INV-005 | P0 | Prevent negative ATS stock balances unless explicit backorder enabled. | `inventory` | `src/modules/inventory/inventory.service.ts` | `tests/unit/inventory.service.spec.ts` | Phase 3 |
| FR-INV-006 | P0 | Atomic reservation via conditional SQL; zero overselling guarantee. | `inventory` | `src/modules/inventory/inventory.repository.ts` | `tests/integration/inventory.concurrency.spec.ts` | Phase 3 |
| FR-INV-007 | P0 | Reservation TTL expiration and automatic release on checkout timeout. | `inventory` | `src/modules/inventory/reservation.reaper.ts` | `tests/unit/reservation.reaper.spec.ts` | Phase 3 |
| FR-INV-008 | P0 | Convert active reservation to committed inventory deduction upon payment. | `inventory` | `src/modules/inventory/inventory.service.ts` | `tests/integration/orders.tx.spec.ts` | Phase 4 |
| FR-INV-009 | P0 | Prevent concurrent checkout race conditions on the final available stock. | `inventory` | `src/modules/inventory/inventory.repository.ts` | `tests/integration/inventory.concurrency.spec.ts` | Phase 3 |
| FR-INV-010 | P1 | Low-stock threshold alerts and notification triggers for inventory staff. | `inventory`, `notifications` | `src/modules/inventory/inventory.service.ts` | `tests/unit/inventory.alerts.spec.ts` | Phase 3 |
| FR-INV-011 | P1 | Support physical cycle counts and periodic inventory reconciliation. | `inventory` | `src/modules/inventory/cycle-count.service.ts` | `tests/unit/cycle-count.spec.ts` | Phase 3 |

### 5. Promotions, CMS, RBAC, Security & Operations
| PRD Req ID | Priority | Description | Domain Module | Target File(s) | Verification Test | Phase |
|---|---|---|---|---|---|---|
| FR-PROMO-001 | P0 | Support percentage and fixed-amount coupon discounts. | `promotions` | `src/modules/promotions/promotions.service.ts` | `tests/unit/promotions.service.spec.ts` | Phase 3 |
| FR-PROMO-002 | P0 | Configure date windows, usage limits, min spend, product/category scope. | `promotions` | `src/modules/promotions/promotions.service.ts` | `tests/unit/promotions.service.spec.ts` | Phase 3 |
| FR-PROMO-003 | P0 | Authoritative server-side promotion validation at cart and checkout. | `promotions` | `src/modules/promotions/promotions.service.ts` | `tests/unit/promotions.service.spec.ts` | Phase 3 |
| FR-PROMO-004 | P0 | Prevent promotion usage limit race conditions via atomic decrement. | `promotions` | `src/modules/promotions/promotions.service.ts` | `tests/integration/promo.race.spec.ts` | Phase 3 |
| FR-PROMO-005 | P0 | Enforce coupon stacking rules and reject incompatible combinations. | `promotions` | `src/modules/promotions/promotions.service.ts` | `tests/unit/promotions.service.spec.ts` | Phase 3 |
| FR-PROMO-006 | P1 | Support customer-specific and segment-restricted promotions. | `promotions` | `src/modules/promotions/promotions.service.ts` | `tests/unit/promotions.service.spec.ts` | Phase 3 |
| FR-PROMO-007 | P1 | Campaign analytics: redemption count, gross discounted value, conversion. | `promotions`, `reports` | `src/modules/reports/promotions.report.ts` | `tests/unit/reports.service.spec.ts` | Phase 5 |
| FR-CMS-001 | P0 | Authorized editors can create, edit, and archive dynamic content pages. | `cms` | `src/modules/cms/cms.service.ts` | `tests/integration/cms.spec.ts` | Phase 5 |
| FR-CMS-002 | P0 | Support distinct draft and published states for CMS pages. | `cms` | `src/modules/cms/cms.service.ts` | `tests/integration/cms.spec.ts` | Phase 5 |
| FR-CMS-003 | P0 | Authorized draft preview shielded from unauthenticated/public access. | `cms`, `auth` | `src/modules/cms/cms.service.ts` | `tests/integration/cms.spec.ts` | Phase 5 |
| FR-CMS-004 | P0 | Validate mandatory content fields, clean URLs, and media references. | `cms` | `src/modules/cms/cms.validator.ts` | `tests/unit/cms.validator.spec.ts` | Phase 5 |
| FR-CMS-005 | P1 | Support scheduled publication and automated unpublishing. | `cms` | `src/modules/cms/cms.scheduler.ts` | `tests/unit/cms.scheduler.spec.ts` | Phase 5 |
| FR-CMS-006 | P1 | Track full content revisions with author attribution and timestamp. | `cms` | `src/modules/cms/cms.repository.ts` | `tests/unit/cms.revisions.spec.ts` | Phase 5 |
| FR-CMS-007 | P1 | Authorized editors can rollback to previous content revisions. | `cms` | `src/modules/cms/cms.service.ts` | `tests/unit/cms.revisions.spec.ts` | Phase 5 |
| FR-CMS-008 | P1 | Multi-step approval workflow where editors cannot publish without review. | `cms`, `auth` | `src/modules/cms/cms.service.ts` | `tests/integration/cms.approval.spec.ts` | Phase 5 |
| FR-CMS-009 | P1 | Sanitize rich text inputs to prevent XSS and malicious scripts. | `cms` | `src/lib/sanitizer.ts` | `tests/unit/sanitizer.spec.ts` | Phase 5 |
| FR-REPORT-001 | P0 | Filter sales and orders by date range and business dimensions. | `reports` | `src/modules/reports/reports.service.ts` | `tests/unit/reports.service.spec.ts` | Phase 5 |
| FR-REPORT-002 | P0 | Consistent financial metric definitions (gross, net, AOV, returns). | `reports` | `src/modules/reports/reports.service.ts` | `tests/unit/reports.service.spec.ts` | Phase 5 |
| FR-REPORT-003 | P1 | Export approved reports to CSV format with pagination safeguards. | `reports` | `src/modules/reports/reports.export.ts` | `tests/unit/reports.export.spec.ts` | Phase 5 |
| FR-REPORT-004 | P1 | Restrict financial and executive reports to authorized roles only. | `reports`, `auth` | `src/modules/reports/reports.service.ts` | `tests/integration/reports.rbac.spec.ts` | Phase 5 |
| FR-REPORT-005 | P1 | Explicitly display report generation timezone and currency context. | `reports` | `src/modules/reports/reports.service.ts` | `tests/unit/reports.service.spec.ts` | Phase 5 |
| FR-REPORT-006 | P1 | Prevent CSV exports from leaking customer PII or unnecessary data. | `reports` | `src/modules/reports/reports.export.ts` | `tests/unit/reports.export.spec.ts` | Phase 5 |
| FR-RBAC-001 | P0 | Server-side permission check for every protected route (deny-by-default). | `auth` | `src/lib/rbac.guard.ts` | `tests/integration/rbac.guard.spec.ts` | Phase 1 |
| FR-RBAC-002 | P0 | Enforce 10-role permission matrix across platform domains. | `auth` | `src/lib/rbac.guard.ts` | `tests/integration/rbac.guard.spec.ts` | Phase 1 |
| FR-RBAC-003 | P0 | Enforce store/location scope restrictions for regional staff. | `auth` | `src/lib/rbac.guard.ts` | `tests/integration/rbac.guard.spec.ts` | Phase 1 |
| FR-AUDIT-001 | P0 | Append-only audit log with actor, action, target, timestamp, IP, diff. | `audit`, `db` | `src/lib/audit.ts`, `prisma/schema.prisma` | `tests/unit/audit.spec.ts` | Phase 1 |
| FR-AUDIT-002 | P0 | Audit all privileged events: auth, roles, prices, stock, cancels, refunds. | `audit` | `src/lib/audit.ts` | `tests/unit/audit.spec.ts` | Phase 1 |
| SEC-AUTH-001 | P0 | Secure password hashing (Argon2id or bcrypt) with strict strength policy. | `auth` | `src/modules/auth/password.ts` | `tests/unit/password.spec.ts` | Phase 1 |
| SEC-AUTH-002 | P0 | Secure HTTP-only, SameSite cookies with session rotation on privilege change. | `auth` | `src/modules/auth/session.service.ts` | `tests/integration/auth.api.spec.ts` | Phase 1 |
| SEC-AUTH-003 | P0 | Require MFA for privileged staff roles; support session revocation. | `auth` | `src/modules/auth/mfa.service.ts` | `tests/unit/mfa.spec.ts` | Phase 1 |
| SEC-AUTH-004 | P0 | Single-use password reset tokens with 15m TTL and timing-safe checks. | `auth` | `src/modules/auth/password-reset.service.ts` | `tests/unit/password-reset.spec.ts` | Phase 1 |
| SEC-APP-001 | P0 | Injection protection via parameterized SQL (Prisma ORM) and XSS encoding. | `lib` | `src/lib/sanitizer.ts` | `tests/unit/sanitizer.spec.ts` | Phase 1 |
| SEC-APP-002 | P0 | CSRF protection for state-changing requests and strict CORS policy. | `lib` | `src/middleware.ts` | `tests/integration/security-headers.spec.ts` | Phase 1 |
| SEC-APP-003 | P0 | Hardened security headers (CSP, HSTS, X-Content-Type-Options, Frame-Options). | `lib` | `src/middleware.ts` | `tests/integration/security-headers.spec.ts` | Phase 1 |
| SEC-APP-004 | P0 | Rate limiting on auth, reset, register, checkout, search, and webhooks. | `lib` | `src/lib/rate-limiter.ts` | `tests/unit/rate-limiter.spec.ts` | Phase 1 |
| SEC-APP-005 | P0 | File upload validation by MIME, magic bytes, size limit, and private storage. | `catalog`, `cms` | `src/lib/upload-validator.ts` | `tests/unit/upload-validator.spec.ts` | Phase 2 |
| SEC-DATA-001 | P0 | Encryption in transit (TLS 1.3) and secrets loaded from environment store. | `lib` | `src/lib/env.ts` | `tests/unit/env.spec.ts` | Phase 1 |
| SEC-PRIV-001 | P0 | Redact PII, passwords, and tokens from all application and audit logs. | `lib` | `src/lib/logger.ts` | `tests/unit/logger.spec.ts` | Phase 1 |
| SEC-PRIV-002 | P1 | Customer data deletion & export subject to legal/financial retention. | `customers` | `src/modules/customers/customers.service.ts` | `tests/unit/customer-deletion.spec.ts` | Phase 1 |
| FR-NOTIFY-001 | P0 | Transactional notifications triggered from authoritative backend events. | `notifications` | `src/modules/notifications/notification.service.ts` | `tests/unit/notifications.spec.ts` | Phase 4 |
| FR-NOTIFY-002 | P0 | Notification delivery failure must not rollback payment or order commit. | `notifications` | `src/modules/notifications/notification.service.ts` | `tests/unit/notifications.spec.ts` | Phase 4 |
| FR-NOTIFY-003 | P0 | Bounded exponential backoff retry for failed notifications. | `notifications` | `src/modules/notifications/notification.worker.ts` | `tests/unit/notifications.worker.spec.ts` | Phase 4 |
| FR-NOTIFY-004 | P0 | Prevent duplicate customer messages via event & template idempotency keys. | `notifications` | `src/modules/notifications/notification.service.ts` | `tests/unit/notifications.spec.ts` | Phase 4 |
| FR-NOTIFY-005 | P1 | Support configurable notification templates and localization. | `notifications` | `src/modules/notifications/template.engine.ts` | `tests/unit/notifications.template.spec.ts` | Phase 4 |
| FR-NOTIFY-006 | P1 | Strictly separate transactional notifications from marketing consent. | `notifications` | `src/modules/notifications/notification.service.ts` | `tests/unit/notifications.spec.ts` | Phase 4 |
| FR-NOTIFY-007 | P1 | Record delivery provider response and final dispatch status. | `notifications` | `src/modules/notifications/notification.repository.ts` | `tests/unit/notifications.spec.ts` | Phase 4 |
| OPS-LOG-001 | P0 | Structured JSON logging with request/correlation IDs and secret redaction. | `lib` | `src/lib/logger.ts` | `tests/unit/logger.spec.ts` | Phase 1 |
| OPS-METRIC-001| P0 | System telemetry: API latency (p95), error rates, DB pool saturation. | `lib` | `src/lib/metrics.ts` | `tests/unit/metrics.spec.ts` | Phase 1 |
| OPS-METRIC-002| P0 | Business telemetry: webhook lag, reservation drops, payment mismatches. | `ops` | `src/modules/ops/health.service.ts` | `tests/unit/ops.health.spec.ts` | Phase 4 |
| OPS-ALERT-001 | P0 | Actionable alerts with runbooks for 5xx spikes, DB saturation, payment fails. | `ops` | `src/modules/ops/alerts.ts` | `tests/unit/ops.alerts.spec.ts` | Phase 6 |
