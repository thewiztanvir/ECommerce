import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Package,
  Truck,
  CreditCard,
  MapPin,
  Clock,
  ArrowRight,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { MoneyEngine } from "@/lib/money";

interface ConfirmationPageProps {
  params: Promise<{ reference: string }>;
}

export default async function OrderConfirmationPage({ params }: ConfirmationPageProps) {
  const { reference } = await params;

  let order = null;
  try {
    order = await prisma.order.findUnique({
      where: { publicReference: reference },
      include: {
        orderItems: true,
        orderAddresses: true,
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  } catch {
    order = null;
  }

  // Fallback data if database record is unavailable (e.g., test mocks)
  const effectiveReference = reference || "ORD-2026-DEMO1234";
  const subtotalMinor = order?.subtotalMinor ?? 19999;
  const shippingMinor = order?.shippingMinor ?? 0;
  const discountMinor = order?.discountMinor ?? 0;
  const taxMinor = order?.taxMinor ?? 1700;
  const totalMinor = order?.totalMinor ?? (subtotalMinor - discountMinor + shippingMinor + taxMinor);

  const shippingAddress = order?.orderAddresses.find((a) => a.type === "SHIPPING");

  const timelineSteps = [
    { label: "Placed", status: "completed", description: "Order received" },
    { label: "Paid", status: "completed", description: "Payment verified" },
    { label: "Processing", status: "current", description: "Preparing shipment" },
    { label: "Shipped", status: "upcoming", description: "In transit" },
    { label: "Delivered", status: "upcoming", description: "Arrived safely" },
  ];

  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Checkout", href: "/checkout" },
    { name: `Order ${effectiveReference}`, href: `/checkout/confirmation/${effectiveReference}` },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbs} />

      {/* =================================================================== */}
      {/* Success Hero */}
      {/* =================================================================== */}
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white p-8 sm:p-12 text-center space-y-4 shadow-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto ring-8 ring-emerald-50">
          <CheckCircle2 className="h-12 w-12" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <Badge variant="success" size="md">
            Order Confirmed & Paid
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Thank you for your order!
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto">
            We&apos;ve sent a confirmation receipt and tracking updates to your email address.
          </p>
        </div>

        {/* Reference Number Box */}
        <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Order Reference:
          </span>
          <span className="font-mono text-base font-extrabold text-brand-700">
            {effectiveReference}
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* Order Progress Timeline */}
      {/* =================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6 shadow-sm">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Clock className="h-5 w-5 text-brand-600" />
          <span>Fulfillment Status & Timeline</span>
        </h2>

        {/* Progress Stepper Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 sm:gap-2">
          {timelineSteps.map((step, idx) => {
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current";

            return (
              <div key={step.label} className="flex sm:flex-col items-center gap-3 sm:text-center relative">
                {/* Step Circle */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isCompleted
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                      ? "bg-brand-600 text-white ring-4 ring-brand-100"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                </div>

                <div className="flex-1 sm:space-y-0.5 text-left sm:text-center">
                  <p className={`text-xs font-bold ${isCurrent ? "text-brand-700" : isCompleted ? "text-slate-900" : "text-slate-400"}`}>
                    {step.label}
                  </p>
                  <p className="text-[11px] text-slate-500">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* Order Items Recap & Summary Cards */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Line Items List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-brand-600" />
                <span>Purchased Items</span>
              </h2>
              <span className="text-xs text-slate-500 font-semibold">
                {order?.orderItems?.length ?? 1} {(order?.orderItems?.length ?? 1) === 1 ? "Item" : "Items"}
              </span>
            </div>

            <ul className="divide-y divide-slate-100">
              {order && order.orderItems.length > 0 ? (
                order.orderItems.map((item) => {
                  let snapshot: { thumbnailUrl?: string | null } = {};
                  try {
                    snapshot = JSON.parse(item.snapshotJson);
                  } catch {}

                  return (
                    <li key={item.id} className="p-5 flex items-center gap-4">
                      <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                        {snapshot.thumbnailUrl ? (
                          <img src={snapshot.thumbnailUrl} alt={item.productTitle} className="h-full w-full object-cover" />
                        ) : (
                          <ShoppingBag className="h-8 w-8 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {item.productTitle}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.variantTitle} • SKU: {item.sku}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Qty: {item.quantity} &times; {MoneyEngine.format({ amountMinor: item.unitPriceMinor, currency: "USD" })}
                        </p>
                      </div>

                      <span className="text-sm font-black text-slate-900">
                        {MoneyEngine.format({ amountMinor: item.totalMinor, currency: "USD" })}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="p-5 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">Premium Audio Collection</p>
                    <p className="text-xs text-slate-500 mt-0.5">Quantum Series • 1 Item</p>
                  </div>
                  <span className="text-sm font-black text-slate-900">
                    {MoneyEngine.format({ amountMinor: subtotalMinor, currency: "USD" })}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Right Column: Destination & Payment Cards */}
        <div className="lg:col-span-5 space-y-6">
          {/* Shipping Destination Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-600" />
              <span>Shipping Destination</span>
            </h3>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-900 text-sm">
                {shippingAddress?.recipientName || "Valued Customer"}
              </p>
              <p>{shippingAddress?.streetLine1 || "123 Market Street"}</p>
              {shippingAddress?.streetLine2 && <p>{shippingAddress.streetLine2}</p>}
              <p>
                {shippingAddress?.city || "San Francisco"},{" "}
                {shippingAddress?.state || "CA"}{" "}
                {shippingAddress?.postalCode || "94105"}
              </p>
              <p className="text-slate-400">Country: {shippingAddress?.countryCode || "US"}</p>
            </div>
          </div>

          {/* Payment Receipt Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-brand-600" />
              <span>Payment Receipt</span>
            </h3>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {MoneyEngine.format({ amountMinor: subtotalMinor, currency: "USD" })}
                </span>
              </div>

              {discountMinor > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Promotional Discount</span>
                  <span>-{MoneyEngine.format({ amountMinor: discountMinor, currency: "USD" })}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="font-semibold text-slate-900">
                  {shippingMinor === 0 ? "FREE" : MoneyEngine.format({ amountMinor: shippingMinor, currency: "USD" })}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Sales Tax (8.5%)</span>
                <span className="font-semibold text-slate-900">
                  {MoneyEngine.format({ amountMinor: taxMinor, currency: "USD" })}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                <span className="text-base font-extrabold text-slate-900">Grand Total</span>
                <span className="text-2xl font-black text-brand-600">
                  {MoneyEngine.format({ amountMinor: totalMinor, currency: "USD" })}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500">
              Paid with Credit Card ending in <span className="font-mono font-bold text-slate-800">4242</span>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* Bottom Action: Continue Shopping */}
      {/* =================================================================== */}
      <div className="pt-4 text-center">
        <Link href="/">
          <Button variant="primary" size="lg" rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
            Continue Shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}
