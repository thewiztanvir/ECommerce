"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/cart-context";
import { MoneyEngine } from "@/lib/money";

export function CartDrawer() {
  const {
    items,
    itemCount,
    isCartDrawerOpen,
    closeCartDrawer,
    updateQuantity,
    removeItem,
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

  const drawerRef = React.useRef<HTMLDivElement>(null);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);

  // Focus trap & ESC key handling
  React.useEffect(() => {
    if (!isCartDrawerOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCartDrawer();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );

        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [isCartDrawerOpen, closeCartDrawer]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setIsApplyingCoupon(true);
    await applyCoupon(couponInput);
    setIsApplyingCoupon(false);
    setCouponInput("");
  };

  if (!isCartDrawerOpen) return null;

  const freeShippingProgress = Math.min(
    100,
    Math.round((subtotalMinor / freeShippingThresholdMinor) * 100)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Cart Drawer"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={closeCartDrawer}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-md bg-white shadow-2xl flex flex-col"
        >
          {/* 1. Header */}
          <div className="flex h-16 sm:h-20 items-center justify-between border-b border-slate-200 px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Your Cart
              </h2>
              <span
                aria-live="polite"
                className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand-100 px-2 text-xs font-bold text-brand-700"
              >
                {itemCount}
              </span>
            </div>

            <button
              ref={closeBtnRef}
              type="button"
              onClick={closeCartDrawer}
              aria-label="Close shopping cart"
              className="inline-flex h-11 w-11 min-h-touch min-w-touch items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 transition-colors"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {/* 2. Free Shipping Progress Threshold */}
          {items.length > 0 && (
            <div className="border-b border-slate-100 bg-slate-50 px-4 sm:px-6 py-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  {isFreeShipping ? (
                    <span className="text-emerald-700 font-bold">
                      You unlocked FREE Express Shipping!
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
                      more for FREE Shipping
                    </span>
                  )}
                </span>
                <span>{freeShippingProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full transition-all duration-300 ${
                    isFreeShipping ? "bg-emerald-500" : "bg-brand-600"
                  }`}
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 3. Items List or Empty State */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {items.length > 0 ? (
              <ul
                role="list"
                aria-label="Cart items list"
                className="divide-y divide-slate-100"
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
                    <li key={item.id} className="py-4 flex gap-4">
                      {/* Zero-CLS Pre-reserved Aspect Square Thumbnail */}
                      <div className="relative h-20 w-20 min-w-[80px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <ShoppingBag className="h-8 w-8 text-slate-300" aria-hidden="true" />
                        )}
                      </div>

                      {/* Line Item Information */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <Link
                              href={`/product/${item.productSlug}`}
                              onClick={closeCartDrawer}
                              className="font-bold text-sm text-slate-900 hover:text-brand-600 line-clamp-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                            >
                              {item.title}
                            </Link>

                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              aria-label={`Remove ${item.title} from cart`}
                              className="inline-flex h-9 w-9 min-h-touch min-w-touch sm:min-h-0 sm:min-w-0 items-center justify-center text-slate-400 hover:text-rose-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>

                          {/* Variant Attributes */}
                          {Object.keys(item.attributes).length > 0 && (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {Object.entries(item.attributes)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" • ")}
                            </p>
                          )}
                        </div>

                        {/* Quantity Stepper & Price */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              aria-label={`Decrease quantity of ${item.title}`}
                              className="inline-flex h-8 w-8 min-h-touch min-w-touch sm:min-h-0 sm:min-w-0 items-center justify-center text-slate-600 hover:bg-slate-50 rounded-l-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                            >
                              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>

                            <span className="flex h-8 w-8 items-center justify-center text-xs font-bold text-slate-900 border-x border-slate-100">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= item.maxAvailableStock}
                              aria-label={`Increase quantity of ${item.title}`}
                              className="inline-flex h-8 w-8 min-h-touch min-w-touch sm:min-h-0 sm:min-w-0 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-extrabold text-slate-900 block">
                              {formattedLineTotal}
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-[11px] text-slate-400 block">
                                {formattedUnit} each
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              /* Empty State */
              <div className="h-full flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <ShoppingBag className="h-10 w-10" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    Your cart is empty
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    Explore our curated catalog to discover items built for performance and everyday life.
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/#categories" onClick={closeCartDrawer}>
                    <Button variant="primary" size="md">
                      Start Shopping
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 4. Footer & Order Summary (when items exist) */}
          {items.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-6 space-y-4">
              {/* Promo Code Input */}
              <div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
                      <Tag className="h-4 w-4 text-emerald-600" />
                      Coupon &ldquo;{appliedCoupon.code}&rdquo; applied ({appliedCoupon.description})
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="font-bold text-rose-600 hover:text-rose-700 underline text-xs ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                    <div className="flex gap-2">
                      <label htmlFor="drawer-coupon-input" className="sr-only">
                        Promotional coupon code
                      </label>
                      <input
                        id="drawer-coupon-input"
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

              {/* Order Summary Calculations */}
              <div className="space-y-1.5 text-xs sm:text-sm">
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
                  <span className="font-semibold text-slate-900">
                    {formattedShipping}
                  </span>
                </div>

                <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline text-base sm:text-lg font-black text-slate-900">
                  <span>Estimated Total</span>
                  <span className="text-xl sm:text-2xl text-brand-600">
                    {formattedEstimatedTotal}
                  </span>
                </div>
              </div>

              {/* Primary Checkout CTA */}
              <div className="space-y-2 pt-1">
                <Link href="/checkout" onClick={closeCartDrawer} className="block">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
                  >
                    Proceed to Checkout
                  </Button>
                </Link>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <Link
                    href="/cart"
                    onClick={closeCartDrawer}
                    className="hover:text-brand-600 font-semibold underline"
                  >
                    View Full Cart Page
                  </Link>

                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                    256-Bit SSL Encryption
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
