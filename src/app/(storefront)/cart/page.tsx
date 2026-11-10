"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  ArrowRight,
  ShieldCheck,
  Tag,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { useCart } from "@/context/cart-context";
import { MoneyEngine } from "@/lib/money";

export default function FullCartPage() {
  const {
    items,
    itemCount,
    updateQuantity,
    removeItem,
    clearCart,
    formattedSubtotal,
    formattedShipping,
    formattedDiscount,
    formattedEstimatedTotal,
    isFreeShipping,
    freeShippingRemainingMinor,
    freeShippingThresholdMinor,
    subtotalMinor,
    appliedCoupon,
    couponError,
    couponSuccess,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [couponInput, setCouponInput] = React.useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setIsApplyingCoupon(true);
    await applyCoupon(couponInput);
    setIsApplyingCoupon(false);
    setCouponInput("");
  };

  const freeShippingProgress = Math.min(
    100,
    Math.round((subtotalMinor / freeShippingThresholdMinor) * 100)
  );

  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Shopping Cart", href: "/cart" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={breadcrumbs} />

      {/* Cart Page Title & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-200 pb-6 gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Shopping Cart
          </h1>
          <Badge variant="neutral" size="md">
            {itemCount} {itemCount === 1 ? "Item" : "Items"}
          </Badge>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline-offset-4 hover:underline self-start sm:self-auto"
          >
            Clear entire cart
          </button>
        )}
      </div>

      {items.length > 0 ? (
        /* Two-Column Responsive Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* =============================================================== */}
          {/* Left Column: Cart Line Items & Free Shipping Progress */}
          {/* =============================================================== */}
          <div className="lg:col-span-8 space-y-6">
            {/* Free Shipping Notification Banner */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                <span className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  {isFreeShipping ? (
                    <span className="text-emerald-700 font-bold">
                      Congratulations! You unlocked FREE Express Shipping!
                    </span>
                  ) : (
                    <span>
                      Add{" "}
                      <span className="font-bold text-brand-600">
                        {MoneyEngine.format({
                          amountMinor: freeShippingRemainingMinor,
                          currency: "USD",
                        })}
                      </span>{" "}
                      more to qualify for FREE Shipping
                    </span>
                  )}
                </span>
                <span>{freeShippingProgress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full transition-all duration-300 ${
                    isFreeShipping ? "bg-emerald-500" : "bg-brand-600"
                  }`}
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>

            {/* Line Items List */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <ul
                role="list"
                aria-label="Shopping cart items"
                className="divide-y divide-slate-200"
              >
                {items.map((item) => {
                  const formattedUnit = MoneyEngine.format({
                    amountMinor: item.unitPriceMinor,
                    currency: "USD",
                  });
                  const formattedLineTotal = MoneyEngine.format({
                    amountMinor: item.unitPriceMinor * item.quantity,
                    currency: "USD",
                  });

                  return (
                    <li key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                      {/* Thumbnail Container */}
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <ShoppingBag className="h-10 w-10 text-slate-300" aria-hidden="true" />
                        )}
                      </div>

                      {/* Content & Actions */}
                      <div className="flex-1 flex flex-col justify-between space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <Link
                              href={`/product/${item.productSlug}`}
                              className="font-bold text-base sm:text-lg text-slate-900 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded transition-colors"
                            >
                              {item.title}
                            </Link>

                            {/* Attributes */}
                            {Object.keys(item.attributes).length > 0 && (
                              <p className="text-xs text-slate-500 mt-1">
                                {Object.entries(item.attributes)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(" • ")}
                              </p>
                            )}

                            <span className="text-xs text-slate-400 block mt-0.5">
                              {formattedUnit} unit price
                            </span>
                          </div>

                          <div className="text-left sm:text-right">
                            <span className="text-lg font-black text-slate-900 block">
                              {formattedLineTotal}
                            </span>
                          </div>
                        </div>

                        {/* Controls Bar: Stepper & Remove */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-600">Qty:</span>
                            <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-sm">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                aria-label={`Decrease quantity of ${item.title}`}
                                className="inline-flex h-9 w-9 min-h-touch min-w-touch sm:min-h-0 sm:min-w-0 items-center justify-center text-slate-600 hover:bg-slate-100 rounded-l-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                              >
                                <Minus className="h-4 w-4" aria-hidden="true" />
                              </button>

                              <span className="flex h-9 w-10 items-center justify-center text-xs font-bold text-slate-900 border-x border-slate-200">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                disabled={item.quantity >= item.maxAvailableStock}
                                aria-label={`Increase quantity of ${item.title}`}
                                className="inline-flex h-9 w-9 min-h-touch min-w-touch sm:min-h-0 sm:min-w-0 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                              >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="inline-flex min-h-touch min-w-touch sm:min-h-0 sm:min-w-0 items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline p-1"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Back to Shopping Navigation */}
            <div className="pt-2">
              <Link
                href="/#categories"
                className="inline-flex min-h-touch items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 group"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <span>Continue Shopping</span>
              </Link>
            </div>
          </div>

          {/* =============================================================== */}
          {/* Right Column: Sticky Order Summary Card */}
          {/* =============================================================== */}
          <div className="lg:col-span-4 sticky top-24">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-lg p-6 space-y-6">
              <h2 className="text-xl font-extrabold text-slate-900 border-b border-slate-100 pb-4">
                Order Summary
              </h2>

              {/* Coupon Form */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Promotional Coupon
                </span>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
                      <Tag className="h-4 w-4 text-emerald-600" />
                      &ldquo;{appliedCoupon.code}&rdquo; ({appliedCoupon.description})
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="font-bold text-rose-600 hover:text-rose-700 underline ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                    <div className="flex gap-2">
                      <label htmlFor="cart-coupon-input" className="sr-only">
                        Enter promotional coupon
                      </label>
                      <input
                        id="cart-coupon-input"
                        type="text"
                        placeholder="Promo code (e.g. SUMMER20)"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        className="h-10 min-h-touch sm:min-h-0 rounded-lg border border-slate-300 bg-white px-3 text-xs uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 flex-1"
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        isLoading={isApplyingCoupon}
                      >
                        Apply
                      </Button>
                    </div>

                    {couponError && (
                      <p
                        role="alert"
                        className="text-xs font-semibold text-rose-600 flex items-center gap-1"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        {couponError}
                      </p>
                    )}
                    {couponSuccess && (
                      <p
                        role="status"
                        className="text-xs font-semibold text-emerald-600 flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {couponSuccess}
                      </p>
                    )}
                  </form>
                )}
              </div>

              {/* Line item breakdown */}
              <div className="space-y-3 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">{formattedSubtotal}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span>-{formattedDiscount}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>Estimated Shipping</span>
                  <span className="font-semibold text-slate-900">{formattedShipping}</span>
                </div>

                <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                  <div>
                    <span className="text-base font-extrabold text-slate-900 block">
                      Estimated Total
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Taxes calculated at checkout
                    </span>
                  </div>
                  <span className="text-2xl font-black text-brand-600">
                    {formattedEstimatedTotal}
                  </span>
                </div>
              </div>

              {/* Checkout CTA */}
              <div className="space-y-3 pt-2">
                <Link href="/checkout" className="block">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
                  >
                    Proceed to Checkout
                  </Button>
                </Link>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-1">
                  <ShieldCheck className="h-4 w-4 text-slate-500" />
                  <span>256-bit encrypted secure checkout</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 sm:p-16 text-center space-y-5 max-w-2xl mx-auto">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 mx-auto">
            <ShoppingBag className="h-10 w-10" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-slate-900">
              Your cart is currently empty
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Looks like you haven&apos;t added anything to your cart yet. Discover our curated catalog of electronics, apparel, and home essentials.
            </p>
          </div>

          <div className="pt-2">
            <Link href="/#categories">
              <Button variant="primary" size="lg">
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
