"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Check,
  Truck,
  CreditCard,
  Lock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShoppingBag,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { useCart } from "@/context/cart-context";
import { MoneyEngine } from "@/lib/money";
import {
  SHIPPING_RATES,
  ShippingMethod,
  CheckoutAddressInput,
  CheckoutCustomerInput,
  CheckoutPaymentInput,
} from "@/lib/validations/checkout.schema";

const TAX_RATE_BPS = 850; // 8.5%
const FREE_SHIPPING_THRESHOLD_MINOR = 7500; // $75.00

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items,
    itemCount,
    subtotalMinor,
    appliedCoupon,
    clearCart,
  } = useCart();

  // Multi-step state: 1 = Shipping & Contact, 2 = Delivery Method, 3 = Payment
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3>(1);

  // Idempotency key generated once per checkout session
  const [idempotencyKey] = React.useState(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `chk_${crypto.randomUUID()}`;
    }
    return `chk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  });

  // Step 1: Customer Contact & Shipping Address Form
  const [customer, setCustomer] = React.useState<CheckoutCustomerInput>({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  const [address, setAddress] = React.useState<CheckoutAddressInput>({
    recipientName: "",
    streetLine1: "",
    streetLine2: "",
    city: "",
    state: "",
    postalCode: "",
    countryCode: "US",
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Step 2: Shipping Method
  const [shippingMethod, setShippingMethod] = React.useState<ShippingMethod>("STANDARD");

  // Step 3: Payment Details
  const [payment, setPayment] = React.useState<CheckoutPaymentInput>({
    cardNumber: "",
    cardholderName: "",
    expiry: "",
    cvc: "",
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Autofill if logged-in customer profile exists
  React.useEffect(() => {
    async function loadCustomerProfile() {
      try {
        const res = await fetch("/api/v1/customers/profile");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const p = json.data;
            setCustomer((prev) => ({
              email: p.email || prev.email,
              firstName: p.firstName || prev.firstName,
              lastName: p.lastName || prev.lastName,
              phone: p.phone || prev.phone,
            }));
            setAddress((prev) => ({
              ...prev,
              recipientName: prev.recipientName || `${p.firstName || ""} ${p.lastName || ""}`.trim(),
            }));
          }
        }
      } catch {
        // Guest or unauthenticated browsing
      }
    }
    loadCustomerProfile();
  }, []);

  // Autofill test credit card helper
  const handleFillDemoCard = () => {
    setPayment({
      cardNumber: "4242 4242 4242 4242",
      cardholderName: (address.recipientName || `${customer.firstName} ${customer.lastName}`).trim() || "Jane Doe",
      expiry: "12/28",
      cvc: "123",
    });
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!customer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!customer.firstName.trim()) {
      newErrors.firstName = "First name is required.";
    }
    if (!customer.lastName.trim()) {
      newErrors.lastName = "Last name is required.";
    }
    if (!address.recipientName.trim()) {
      newErrors.recipientName = "Full recipient name is required.";
    }
    if (!address.streetLine1.trim()) {
      newErrors.streetLine1 = "Street address is required.";
    }
    if (!address.city.trim()) {
      newErrors.city = "City is required.";
    }
    if (!address.state.trim()) {
      newErrors.state = "State is required.";
    }
    if (!address.postalCode.trim() || address.postalCode.trim().length < 3) {
      newErrors.postalCode = "Valid postal code is required.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 3 Validation
  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    const sanitizedCard = payment.cardNumber.replace(/\s+/g, "");
    if (!/^\d{15,16}$/.test(sanitizedCard)) {
      newErrors.cardNumber = "Enter a valid 15 or 16-digit card number.";
    }
    if (!payment.cardholderName.trim()) {
      newErrors.cardholderName = "Cardholder name is required.";
    }
    if (!/^(0[1-9]|1[0-2])\/?([2-9][0-9])$/.test(payment.expiry.trim())) {
      newErrors.expiry = "Use MM/YY format.";
    }
    if (!/^\d{3,4}$/.test(payment.cvc.trim())) {
      newErrors.cvc = "3 or 4 digits required.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Synchronize recipient name with customer first/last name if empty
  const handleCustomerNameChange = (field: "firstName" | "lastName", value: string) => {
    const updated = { ...customer, [field]: value };
    setCustomer(updated);
    if (!address.recipientName || address.recipientName === `${customer.firstName} ${customer.lastName}`.trim()) {
      setAddress((prev) => ({
        ...prev,
        recipientName: `${updated.firstName} ${updated.lastName}`.trim(),
      }));
    }
  };

  // Calculations for Order Summary Sidebar
  const isFreeStandard = subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR;
  let shippingMinor = SHIPPING_RATES[shippingMethod].basePriceMinor;
  if (shippingMethod === "STANDARD" && isFreeStandard) {
    shippingMinor = 0;
  }

  let discountMinor = 0;
  if (appliedCoupon && subtotalMinor > 0) {
    if (appliedCoupon.discountType === "PERCENTAGE") {
      discountMinor = Math.round((subtotalMinor * appliedCoupon.discountValue) / 100);
    } else if (appliedCoupon.discountType === "FIXED") {
      discountMinor = Math.min(subtotalMinor, appliedCoupon.discountValue);
    }
  }

  const taxableSubtotal = Math.max(0, subtotalMinor - discountMinor);
  const taxMinor = Math.round((taxableSubtotal * TAX_RATE_BPS) / 10000);
  const grandTotalMinor = taxableSubtotal + shippingMinor + taxMinor;

  // Handle Order Placement
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const payload = {
        customer,
        shippingAddress: address,
        shippingMethod,
        payment: {
          ...payment,
          cardNumber: payment.cardNumber.replace(/\s+/g, ""),
        },
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          productSlug: i.productSlug,
          title: i.title,
          variantTitle: i.variantTitle,
          unitPriceMinor: i.unitPriceMinor,
          thumbnailUrl: i.thumbnailUrl,
        })),
        couponCode: appliedCoupon?.code || undefined,
        idempotencyKey,
      };

      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to place order. Please review your details and try again.");
      }

      // Success! Clear cart and navigate to confirmation
      clearCart();
      const ref = json.data?.reference || `ORD-2026-${Date.now().toString(36).toUpperCase()}`;
      router.push(`/checkout/confirmation/${encodeURIComponent(ref)}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "An unexpected error occurred during order submission.");
      setIsSubmitting(false);
    }
  };

  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Shopping Cart", href: "/cart" },
    { name: "Checkout", href: "/checkout" },
  ];

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 mx-auto">
          <ShoppingBag className="h-10 w-10" aria-hidden="true" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Your Cart is Empty
        </h1>
        <p className="text-slate-500 max-w-md mx-auto text-sm">
          Please add at least one item to your cart before proceeding to checkout.
        </p>
        <Link href="/#categories">
          <Button variant="primary" size="lg">
            Browse Catalog
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={breadcrumbs} />

      {/* Checkout Title & Progress Indicator */}
      <div className="space-y-4">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Secure Checkout
        </h1>

        {/* Wizard Step Tracker */}
        <nav aria-label="Checkout Steps" className="py-2">
          <ol className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-semibold">
            {/* Step 1 */}
            <li className="flex items-center gap-2">
              <span
                aria-current={currentStep === 1 ? "step" : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  currentStep === 1
                    ? "bg-brand-600 text-white ring-4 ring-brand-100"
                    : currentStep > 1
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {currentStep > 1 ? <Check className="h-4 w-4" /> : "1"}
              </span>
              <span className={currentStep === 1 ? "text-slate-900 font-bold" : "text-slate-500"}>
                Shipping & Contact
              </span>
            </li>

            <span className="h-0.5 w-6 sm:w-12 bg-slate-200" aria-hidden="true" />

            {/* Step 2 */}
            <li className="flex items-center gap-2">
              <span
                aria-current={currentStep === 2 ? "step" : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  currentStep === 2
                    ? "bg-brand-600 text-white ring-4 ring-brand-100"
                    : currentStep > 2
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {currentStep > 2 ? <Check className="h-4 w-4" /> : "2"}
              </span>
              <span className={currentStep === 2 ? "text-slate-900 font-bold" : "text-slate-500"}>
                Delivery Method
              </span>
            </li>

            <span className="h-0.5 w-6 sm:w-12 bg-slate-200" aria-hidden="true" />

            {/* Step 3 */}
            <li className="flex items-center gap-2">
              <span
                aria-current={currentStep === 3 ? "step" : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  currentStep === 3
                    ? "bg-brand-600 text-white ring-4 ring-brand-100"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                3
              </span>
              <span className={currentStep === 3 ? "text-slate-900 font-bold" : "text-slate-500"}>
                Payment
              </span>
            </li>
          </ol>
        </nav>
      </div>

      {/* Main 2-Column Checkout Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Multi-Step Forms */}
        <div className="lg:col-span-8 space-y-6">
          {/* =============================================================== */}
          {/* STEP 1: Customer Contact & Shipping Address */}
          {/* =============================================================== */}
          <div
            className={`rounded-2xl border transition-all ${
              currentStep === 1
                ? "border-brand-600/50 bg-white shadow-md ring-1 ring-brand-500/20 p-6 sm:p-8"
                : "border-slate-200 bg-slate-50/50 p-5 sm:p-6 cursor-pointer hover:bg-slate-50"
            }`}
            onClick={() => {
              if (currentStep > 1) setCurrentStep(1);
            }}
          >
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    currentStep > 1 ? "bg-emerald-100 text-emerald-800" : "bg-brand-100 text-brand-800"
                  }`}
                >
                  {currentStep > 1 ? <Check className="h-4 w-4" /> : "1"}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Customer Contact & Shipping Address
                </h2>
              </div>
              {currentStep > 1 && (
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                >
                  Edit
                </button>
              )}
            </div>

            {currentStep === 1 ? (
              <div className="space-y-6 pt-2">
                {/* Contact Information */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                    Contact Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="chk-first-name" className="block text-xs font-semibold text-slate-700 mb-1">
                        First Name *
                      </label>
                      <input
                        id="chk-first-name"
                        type="text"
                        value={customer.firstName}
                        onChange={(e) => handleCustomerNameChange("firstName", e.target.value)}
                        className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                          errors.firstName ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                        }`}
                        placeholder="e.g. Jane"
                      />
                      {errors.firstName && <p className="text-xs text-rose-600 mt-1">{errors.firstName}</p>}
                    </div>

                    <div>
                      <label htmlFor="chk-last-name" className="block text-xs font-semibold text-slate-700 mb-1">
                        Last Name *
                      </label>
                      <input
                        id="chk-last-name"
                        type="text"
                        value={customer.lastName}
                        onChange={(e) => handleCustomerNameChange("lastName", e.target.value)}
                        className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                          errors.lastName ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                        }`}
                        placeholder="e.g. Doe"
                      />
                      {errors.lastName && <p className="text-xs text-rose-600 mt-1">{errors.lastName}</p>}
                    </div>

                    <div>
                      <label htmlFor="chk-email" className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        id="chk-email"
                        type="email"
                        value={customer.email}
                        onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                        className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                          errors.email ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                        }`}
                        placeholder="jane.doe@example.com"
                      />
                      {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <label htmlFor="chk-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                        Phone Number (optional)
                      </label>
                      <input
                        id="chk-phone"
                        type="tel"
                        value={customer.phone || ""}
                        onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                        className="h-11 min-h-touch w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                    Shipping Destination
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="chk-recipient-name" className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Recipient Name *
                      </label>
                      <input
                        id="chk-recipient-name"
                        type="text"
                        value={address.recipientName}
                        onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
                        className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                          errors.recipientName ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                        }`}
                        placeholder="Jane Doe"
                      />
                      {errors.recipientName && <p className="text-xs text-rose-600 mt-1">{errors.recipientName}</p>}
                    </div>

                    <div>
                      <label htmlFor="chk-street-1" className="block text-xs font-semibold text-slate-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        id="chk-street-1"
                        type="text"
                        value={address.streetLine1}
                        onChange={(e) => setAddress({ ...address, streetLine1: e.target.value })}
                        className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                          errors.streetLine1 ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                        }`}
                        placeholder="123 Market Street"
                      />
                      {errors.streetLine1 && <p className="text-xs text-rose-600 mt-1">{errors.streetLine1}</p>}
                    </div>

                    <div>
                      <label htmlFor="chk-street-2" className="block text-xs font-semibold text-slate-700 mb-1">
                        Apartment, Suite, Unit (optional)
                      </label>
                      <input
                        id="chk-street-2"
                        type="text"
                        value={address.streetLine2 || ""}
                        onChange={(e) => setAddress({ ...address, streetLine2: e.target.value })}
                        className="h-11 min-h-touch w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
                        placeholder="Apt 4B"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="chk-city" className="block text-xs font-semibold text-slate-700 mb-1">
                          City *
                        </label>
                        <input
                          id="chk-city"
                          type="text"
                          value={address.city}
                          onChange={(e) => setAddress({ ...address, city: e.target.value })}
                          className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                            errors.city ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                          }`}
                          placeholder="San Francisco"
                        />
                        {errors.city && <p className="text-xs text-rose-600 mt-1">{errors.city}</p>}
                      </div>

                      <div>
                        <label htmlFor="chk-state" className="block text-xs font-semibold text-slate-700 mb-1">
                          State / Province *
                        </label>
                        <input
                          id="chk-state"
                          type="text"
                          value={address.state}
                          onChange={(e) => setAddress({ ...address, state: e.target.value })}
                          className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                            errors.state ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                          }`}
                          placeholder="CA"
                        />
                        {errors.state && <p className="text-xs text-rose-600 mt-1">{errors.state}</p>}
                      </div>

                      <div>
                        <label htmlFor="chk-postal" className="block text-xs font-semibold text-slate-700 mb-1">
                          Postal / ZIP Code *
                        </label>
                        <input
                          id="chk-postal"
                          type="text"
                          value={address.postalCode}
                          onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                          className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                            errors.postalCode ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                          }`}
                          placeholder="94105"
                        />
                        {errors.postalCode && <p className="text-xs text-rose-600 mt-1">{errors.postalCode}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Continue CTA */}
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      if (validateStep1()) {
                        setCurrentStep(2);
                      }
                    }}
                    rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
                  >
                    Continue to Delivery Method
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-600 space-y-0.5">
                <p className="font-semibold text-slate-900">{address.recipientName || `${customer.firstName} ${customer.lastName}`}</p>
                <p>{address.streetLine1}{address.streetLine2 ? `, ${address.streetLine2}` : ""}</p>
                <p>{address.city}, {address.state} {address.postalCode}</p>
                <p className="text-slate-500">{customer.email}</p>
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* STEP 2: Shipping Method Selection */}
          {/* =============================================================== */}
          <div
            className={`rounded-2xl border transition-all ${
              currentStep === 2
                ? "border-brand-600/50 bg-white shadow-md ring-1 ring-brand-500/20 p-6 sm:p-8"
                : "border-slate-200 bg-slate-50/50 p-5 sm:p-6 cursor-pointer hover:bg-slate-50"
            }`}
            onClick={() => {
              if (currentStep > 2) setCurrentStep(2);
            }}
          >
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    currentStep > 2 ? "bg-emerald-100 text-emerald-800" : "bg-brand-100 text-brand-800"
                  }`}
                >
                  {currentStep > 2 ? <Check className="h-4 w-4" /> : "2"}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Delivery Method
                </h2>
              </div>
              {currentStep > 2 && (
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                >
                  Edit
                </button>
              )}
            </div>

            {currentStep === 2 ? (
              <div className="space-y-6 pt-2">
                <div role="radiogroup" aria-label="Available Shipping Methods" className="space-y-3">
                  {/* Standard Shipping */}
                  <label
                    htmlFor="sm-standard"
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      shippingMethod === "STANDARD"
                        ? "border-brand-600 bg-brand-50/40 ring-2 ring-brand-600"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        id="sm-standard"
                        type="radio"
                        name="shipping-method"
                        value="STANDARD"
                        checked={shippingMethod === "STANDARD"}
                        onChange={() => setShippingMethod("STANDARD")}
                        className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {SHIPPING_RATES.STANDARD.name}
                          </span>
                          {isFreeStandard && (
                            <Badge variant="success" size="sm">
                              FREE Over $75
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {SHIPPING_RATES.STANDARD.estimate}
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-slate-900">
                      {isFreeStandard ? "FREE" : "$7.50"}
                    </span>
                  </label>

                  {/* Express Shipping */}
                  <label
                    htmlFor="sm-express"
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      shippingMethod === "EXPRESS"
                        ? "border-brand-600 bg-brand-50/40 ring-2 ring-brand-600"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        id="sm-express"
                        type="radio"
                        name="shipping-method"
                        value="EXPRESS"
                        checked={shippingMethod === "EXPRESS"}
                        onChange={() => setShippingMethod("EXPRESS")}
                        className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                      />
                      <div>
                        <span className="font-bold text-sm text-slate-900">
                          {SHIPPING_RATES.EXPRESS.name}
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {SHIPPING_RATES.EXPRESS.estimate}
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-slate-900">$15.00</span>
                  </label>

                  {/* Overnight Priority */}
                  <label
                    htmlFor="sm-overnight"
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      shippingMethod === "OVERNIGHT"
                        ? "border-brand-600 bg-brand-50/40 ring-2 ring-brand-600"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        id="sm-overnight"
                        type="radio"
                        name="shipping-method"
                        value="OVERNIGHT"
                        checked={shippingMethod === "OVERNIGHT"}
                        onChange={() => setShippingMethod("OVERNIGHT")}
                        className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                      />
                      <div>
                        <span className="font-bold text-sm text-slate-900">
                          {SHIPPING_RATES.OVERNIGHT.name}
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {SHIPPING_RATES.OVERNIGHT.estimate}
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-slate-900">$25.00</span>
                  </label>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={() => setCurrentStep(1)}
                    leftIcon={<ArrowLeft className="h-5 w-5" aria-hidden="true" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => setCurrentStep(3)}
                    rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
                  >
                    Continue to Payment
                  </Button>
                </div>
              </div>
            ) : currentStep > 2 ? (
              <div className="text-xs text-slate-600 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-slate-900">{SHIPPING_RATES[shippingMethod].name}</span>
                  <span className="text-slate-400 mx-2">•</span>
                  <span>{SHIPPING_RATES[shippingMethod].estimate}</span>
                </div>
                <span className="font-bold text-slate-900">
                  {shippingMethod === "STANDARD" && isFreeStandard ? "FREE" : MoneyEngine.format({ amountMinor: shippingMinor, currency: "USD" })}
                </span>
              </div>
            ) : null}
          </div>

          {/* =============================================================== */}
          {/* STEP 3: Payment Details */}
          {/* =============================================================== */}
          <div
            className={`rounded-2xl border transition-all ${
              currentStep === 3
                ? "border-brand-600/50 bg-white shadow-md ring-1 ring-brand-500/20 p-6 sm:p-8"
                : "border-slate-200 bg-slate-50/50 p-5 sm:p-6"
            }`}
          >
            <div className="flex items-center gap-3 pb-4">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  currentStep === 3 ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                3
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Payment Details
              </h2>
            </div>

            {currentStep === 3 && (
              <form onSubmit={handlePlaceOrder} className="space-y-6 pt-2">
                {/* Demo Card Helper Callout */}
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-brand-900 flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-brand-600" />
                      Mock Sandbox Payment Provider
                    </span>
                    <p className="text-brand-700">
                      Use test card <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-brand-900">4242 4242 4242 4242</code>, Exp: <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-brand-900">12/28</code>, CVC: <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-brand-900">123</code>.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleFillDemoCard}
                  >
                    Autofill Test Card
                  </Button>
                </div>

                {/* Card Inputs */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="chk-card-number" className="block text-xs font-semibold text-slate-700 mb-1">
                      Card Number *
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="chk-card-number"
                        type="text"
                        maxLength={19}
                        value={payment.cardNumber}
                        onChange={(e) => setPayment({ ...payment, cardNumber: e.target.value })}
                        className={`h-11 min-h-touch w-full rounded-lg border pl-10 pr-4 text-sm font-mono text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                          errors.cardNumber ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                        }`}
                        placeholder="4242 4242 4242 4242"
                      />
                      <CreditCard className="pointer-events-none absolute left-3 h-5 w-5 text-slate-400" />
                    </div>
                    {errors.cardNumber && <p className="text-xs text-rose-600 mt-1">{errors.cardNumber}</p>}
                  </div>

                  <div>
                    <label htmlFor="chk-cardholder" className="block text-xs font-semibold text-slate-700 mb-1">
                      Cardholder Name *
                    </label>
                    <input
                      id="chk-cardholder"
                      type="text"
                      value={payment.cardholderName}
                      onChange={(e) => setPayment({ ...payment, cardholderName: e.target.value })}
                      className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                        errors.cardholderName ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                      }`}
                      placeholder="Jane Doe"
                    />
                    {errors.cardholderName && <p className="text-xs text-rose-600 mt-1">{errors.cardholderName}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="chk-card-expiry" className="block text-xs font-semibold text-slate-700 mb-1">
                        Expiration (MM/YY) *
                      </label>
                      <input
                        id="chk-card-expiry"
                        type="text"
                        maxLength={5}
                        value={payment.expiry}
                        onChange={(e) => setPayment({ ...payment, expiry: e.target.value })}
                        className={`h-11 min-h-touch w-full rounded-lg border px-3 text-sm font-mono text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                          errors.expiry ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                        }`}
                        placeholder="12/28"
                      />
                      {errors.expiry && <p className="text-xs text-rose-600 mt-1">{errors.expiry}</p>}
                    </div>

                    <div>
                      <label htmlFor="chk-card-cvc" className="block text-xs font-semibold text-slate-700 mb-1">
                        CVC *
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="chk-card-cvc"
                          type="text"
                          maxLength={4}
                          value={payment.cvc}
                          onChange={(e) => setPayment({ ...payment, cvc: e.target.value })}
                          className={`h-11 min-h-touch w-full rounded-lg border pl-10 pr-4 text-sm font-mono text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${
                            errors.cvc ? "border-rose-500 focus-visible:ring-rose-200" : "border-slate-300 focus-visible:border-brand-600 focus-visible:ring-brand-100"
                          }`}
                          placeholder="123"
                        />
                        <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
                      </div>
                      {errors.cvc && <p className="text-xs text-rose-600 mt-1">{errors.cvc}</p>}
                    </div>
                  </div>
                </div>

                {serverError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800"
                  >
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                {/* Final Place Order Button */}
                <div className="pt-2 space-y-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    leftIcon={<Lock className="h-5 w-5" aria-hidden="true" />}
                  >
                    {isSubmitting
                      ? "Processing Payment..."
                      : `Place Order & Pay ${MoneyEngine.format({ amountMinor: grandTotalMinor, currency: "USD" })}`}
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                    <span>256-bit encrypted • Idempotent payment token</span>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary Sidebar (Sticky) */}
        <div className="lg:col-span-4 sticky top-24">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-lg p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-extrabold text-slate-900">
                Order Summary
              </h2>
              <Badge variant="neutral" size="sm">
                {itemCount} {itemCount === 1 ? "Item" : "Items"}
              </Badge>
            </div>

            {/* Line items thumbnail recap */}
            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto space-y-3 pt-1">
              {items.map((item) => (
                <li key={item.id} className="pt-3 first:pt-0 flex items-center gap-3">
                  <div className="h-14 w-14 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <ShoppingBag className="h-6 w-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {MoneyEngine.format({ amountMinor: item.unitPriceMinor * item.quantity, currency: "USD" })}
                  </span>
                </li>
              ))}
            </ul>

            {/* Price Breakdown */}
            <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {MoneyEngine.format({ amountMinor: subtotalMinor, currency: "USD" })}
                </span>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount ({appliedCoupon.code})</span>
                  <span>-{MoneyEngine.format({ amountMinor: discountMinor, currency: "USD" })}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Shipping ({SHIPPING_RATES[shippingMethod].name})</span>
                <span className="font-semibold text-slate-900">
                  {shippingMethod === "STANDARD" && isFreeStandard
                    ? "FREE"
                    : MoneyEngine.format({ amountMinor: shippingMinor, currency: "USD" })}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Estimated Sales Tax (8.5%)</span>
                <span className="font-semibold text-slate-900">
                  {MoneyEngine.format({ amountMinor: taxMinor, currency: "USD" })}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                <span className="text-base font-extrabold text-slate-900">
                  Grand Total
                </span>
                <span className="text-2xl font-black text-brand-600">
                  {MoneyEngine.format({ amountMinor: grandTotalMinor, currency: "USD" })}
                </span>
              </div>
            </div>

            {/* Money-Back Guarantee & Return policy */}
            <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">Risk-Free 30-Day Guarantee</p>
              <p>Return any unused item within 30 days for a complete, effortless refund.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
