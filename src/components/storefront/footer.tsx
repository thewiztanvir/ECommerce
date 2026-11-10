"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Truck, RefreshCw, Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Footer() {
  const [newsletterEmail, setNewsletterEmail] = React.useState("");
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;

    setIsSubmitting(true);
    // Simulate newsletter subscription
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubscribed(true);
      setNewsletterEmail("");
    }, 600);
  };

  return (
    <footer className="border-t border-slate-200 bg-slate-50 text-slate-700">
      {/* Value Proposition & Reassurance Bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Truck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Free Express Shipping</p>
                <p className="text-xs text-slate-500">On all domestic orders over $75</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">30-Day Hassle-Free Returns</p>
                <p className="text-xs text-slate-500">Fast prepaid shipping labels</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">PCI-DSS Level 1 Secure</p>
                <p className="text-xs text-slate-500">256-bit encrypted transactions</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Authenticity Guaranteed</p>
                <p className="text-xs text-slate-500">100% verified genuine products</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Column Links Section */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand & Mission Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-xl text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-extrabold text-base">
                A
              </span>
              <span>ApexStore</span>
            </Link>
            <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
              Engineered for seamless digital commerce. Discover curated electronics, premium apparel, and elevated home essentials built to last.
            </p>

            {/* Newsletter form */}
            <div className="pt-2">
              <p className="font-semibold text-slate-900 text-sm mb-1.5">
                Subscribe to our newsletter
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Get 15% off your first order plus early access to seasonal drops.
              </p>

              {isSubscribed ? (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Thank you for subscribing! Check your inbox for your 15% promo code.</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="newsletter-email" className="sr-only">
                      Email address for newsletter
                    </label>
                    <input
                      id="newsletter-email"
                      type="email"
                      required
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="h-11 min-h-touch rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 flex-1"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      isLoading={isSubmitting}
                      className="shrink-0"
                    >
                      Subscribe
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    By subscribing, you agree to our Privacy Policy. Unsubscribe at any time.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Customer Service Column */}
          <div>
            <p className="font-semibold text-slate-900 text-sm tracking-wide uppercase mb-4">
              Customer Service
            </p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/help"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Help Center & FAQs
                </Link>
              </li>
              <li>
                <Link
                  href="/track-order"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Track Your Order
                </Link>
              </li>
              <li>
                <Link
                  href="/shipping"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Shipping & Delivery
                </Link>
              </li>
              <li>
                <Link
                  href="/returns"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>

          {/* About Us Column */}
          <div>
            <p className="font-semibold text-slate-900 text-sm tracking-wide uppercase mb-4">
              About ApexStore
            </p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/about"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Our Story
                </Link>
              </li>
              <li>
                <Link
                  href="/sustainability"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Sustainability
                </Link>
              </li>
              <li>
                <Link
                  href="/careers"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="/press"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Press & Media
                </Link>
              </li>
              <li>
                <Link
                  href="/store-locator"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Store Locator
                </Link>
              </li>
            </ul>
          </div>

          {/* Policies & Legal Column */}
          <div>
            <p className="font-semibold text-slate-900 text-sm tracking-wide uppercase mb-4">
              Policies & Legal
            </p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/return-policy"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Return Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/accessibility"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Accessibility Statement
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="inline-flex min-h-[36px] items-center text-slate-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                >
                  Cookie Preferences
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Sub-Footer */}
        <div className="mt-12 border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            &copy; {new Date().getFullYear()} ApexStore Inc. All rights reserved. Built to WCAG 2.2 AA accessibility standards.
          </p>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-600">Accepted Payments:</span>
            <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-mono text-slate-700">
              VISA
            </span>
            <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-mono text-slate-700">
              Mastercard
            </span>
            <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-mono text-slate-700">
              AMEX
            </span>
            <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-mono text-slate-700">
              Apple Pay
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
