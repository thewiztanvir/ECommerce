# Production-Level E-Commerce Platform — Project Overview

## 1. Executive Summary

This project is a production-grade, dual-facing e-commerce system built to the specifications of `Ecommerce_PRD.md`. The platform delivers a fast, trustworthy, accessible, and conversion-optimized storefront for customers alongside a secure, auditable, role-based back-office portal for store operations, inventory management, fulfillment, and content management.

## 2. Core Capabilities

### Customer Storefront
- **Discovery & Search:** Responsive product catalog with dynamic facet filters, deterministic sorting, and sub-700ms search.
- **Product Details:** Rich media galleries, multi-attribute variants (size, color, material), real-time stock availability, and accurate shipping estimates.
- **Cart & Pricing:** Authenticated customer carts, encrypted guest carts with automatic merge on login, server-authoritative pricing calculations with discounts, shipping, and taxes.
- **Atomic Checkout:** Nonce/idempotency-key protected order placement with atomic inventory reservations that mathematically prevent overselling.
- **Payments:** Hosted tokenized payment processing with server-to-server signature-verified webhook ingestion and replay protection.
- **Order Management & Returns:** Self-service order history, tracking links, and structured return requests.

### Operations & Back-Office
- **Catalog Management:** Product creation, variant matrix management, SKU uniqueness enforcement, category taxonomies, and media asset management.
- **Inventory Control:** Strict separation of on-hand, reserved, and available-to-sell stock; immutable stock movement ledger; manual adjustment auditing.
- **Order Fulfillment & Refunds:** Order state machine (Pending Payment $\rightarrow$ Confirmed $\rightarrow$ Processing $\rightarrow$ Packed $\rightarrow$ Shipped $\rightarrow$ Delivered), tracking number assignment, and authorized refund workflows.
- **Promotions & Coupons:** Percentage and fixed discounts, minimum order constraints, usage limits, and expiration windows.
- **CMS & Publishing:** Atomic content publishing, versioned drafts, promotional banners, and policy pages with strict XSS sanitization.
- **Security & RBAC:** Granular role-based access control across 10 roles (Super Admin, Store Admin, Catalog, Inventory, Order, Support, Marketing, Content, Finance, Analyst) with append-only tamper-resistant audit logs.

## 3. Technology Stack

- **Application Framework:** Next.js 15 (React 19, TypeScript 5, App Router).
- **Styling & UI:** Tailwind CSS, Radix UI Primitives, Lucide React.
- **Backend Architecture:** Modular Monolith with Next.js Route Handlers (`/api/v1`), Zod validation, Service-Repository pattern.
- **Database & Persistence:** PostgreSQL 16+ with Prisma ORM, raw SQL conditional locks for atomic stock reservation.
- **Caching & Queues:** Redis 7+ for rate-limiting, session revocation, and BullMQ worker queue.
- **Testing Suite:** Vitest (unit/integration), Supertest (API contract), Playwright (end-to-end), `@axe-core/playwright` (accessibility).
- **Containerization & CI/CD:** Multi-stage Docker, `docker-compose.yml`, GitHub Actions.

## 4. Repository Structure

```
├── .github/                # CI/CD workflows and automated checks
├── prisma/                 # PostgreSQL schema, migrations, and seed scripts
├── public/                 # Static assets, fonts, and icons
├── src/
│   ├── app/                # Next.js 15 App Router pages and API routes
│   │   ├── (storefront)/   # Public shopping customer journeys
│   │   ├── (admin)/        # RBAC-protected back-office management
│   │   └── api/v1/         # Versioned REST API endpoints
│   ├── components/         # Shared UI components and design system
│   │   ├── ui/             # Radix primitives & design token components
│   │   ├── storefront/     # Customer-facing shopping components
│   │   └── admin/          # Back-office tables, forms, and metric widgets
│   ├── modules/            # Domain services (Modular Monolith)
│   │   ├── auth/           # Identity, session, and RBAC
│   │   ├── catalog/        # Products, variants, categories, search
│   │   ├── inventory/      # Stock tracking, atomic reservation, ledger
│   │   ├── cart/           # Cart calculation, items, guest tokens
│   │   ├── checkout/       # Quotes, pricing engine, tax, shipping
│   │   ├── orders/         # Order FSM, snapshotting, fulfillment
│   │   ├── payments/       # Gateway adapter, webhooks, refunds
│   │   ├── promotions/     # Coupons, discount evaluation
│   │   ├── cms/            # Dynamic content, revisions, atomic publish
│   │   └── audit/          # Audit logging and outbox event publishing
│   ├── lib/                # Shared utilities, DB client, Zod schemas, logger
│   └── types/              # Domain TypeScript types and interfaces
├── tests/                  # Automated test suites
│   ├── unit/               # Domain logic unit tests
│   ├── integration/        # API and transactional integration tests
│   └── e2e/                # Playwright customer & admin end-to-end journeys
├── Ecommerce_PRD.md        # Primary product requirements document
└── [Documentation suite]   # Architecture, traceability, decisions, runbooks
```
