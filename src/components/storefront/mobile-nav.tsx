"use client";

import * as React from "react";
import Link from "next/link";
import { X, Search, ShoppingBag, User, LogIn, ChevronRight, Home, Sparkles, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CategoryItem {
  name: string;
  href: string;
  description?: string;
}

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: CategoryItem[];
  user?: { firstName: string; email: string } | null;
  cartItemCount?: number;
}

const defaultCategories: CategoryItem[] = [
  { name: "Electronics", href: "/category/electronics", description: "Audio, computing & smart gadgets" },
  { name: "Apparel", href: "/category/apparel", description: "Modern everyday essentials & outerwear" },
  { name: "Home & Living", href: "/category/home-living", description: "Design-forward interior & kitchenware" },
  { name: "New Arrivals", href: "/products?sort=newest", description: "Latest seasonal product drops" },
];

export function MobileNav({
  isOpen,
  onClose,
  categories = defaultCategories,
  user = null,
  cartItemCount = 0,
}: MobileNavProps) {
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);

  // Focus management & keyboard event listeners
  React.useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore upon close
    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus close button on open
    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    // ESC key listener & focus trap
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation menu"
    >
      {/* Backdrop with blur & smooth transition */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer Panel */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out"
      >
        {/* Drawer Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-black text-base shadow-sm">
              A
            </span>
            <span>ApexStore</span>
          </Link>

          {/* Close Button - Minimum 44x44px Touch Target */}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="inline-flex h-11 w-11 min-h-touch min-w-touch items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 transition-colors"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Search Input in Mobile Drawer */}
        <div className="border-b border-slate-100 p-4">
          <form
            action="/search"
            method="GET"
            onSubmit={() => onClose()}
            className="relative flex items-center"
          >
            <Search
              className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              placeholder="Search products..."
              className="h-11 min-h-touch w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:bg-white focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
            />
          </form>
        </div>

        {/* Navigation Categories List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Departments
          </p>
          <nav className="mt-2 space-y-1">
            {categories.map((category) => (
              <Link
                key={category.href}
                href={category.href}
                onClick={onClose}
                className="group flex min-h-touch items-center justify-between rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <div>
                  <div className="font-medium text-slate-900 group-hover:text-brand-600">
                    {category.name}
                  </div>
                  {category.description && (
                    <div className="text-xs text-slate-500 line-clamp-1">
                      {category.description}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </nav>

          <hr className="my-4 border-slate-200" />

          {/* Secondary Quick Links */}
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Discover
          </p>
          <div className="mt-2 space-y-1">
            <Link
              href="/deals"
              onClick={onClose}
              className="flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Special Offers & Deals</span>
            </Link>
            <Link
              href="/help"
              onClick={onClose}
              className="flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <HelpCircle className="h-4 w-4 text-slate-400" />
              <span>Customer Help & FAQ</span>
            </Link>
          </div>
        </div>

        {/* Drawer Footer: User Profile / Auth & Cart */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-sm">
                  {user.firstName[0]?.toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {user.firstName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <Link
                href="/account"
                onClick={onClose}
                className="inline-flex min-h-touch items-center text-xs font-medium text-brand-600 hover:underline"
              >
                My Account
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() => {
                  onClose();
                  window.location.href = "/login";
                }}
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => {
                  onClose();
                  window.location.href = "/register";
                }}
              >
                Register
              </Button>
            </div>
          )}

          {/* Cart Link in Mobile Footer */}
          <Link
            href="/cart"
            onClick={onClose}
            className="flex min-h-touch w-full items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-slate-600" />
              <span>Shopping Cart</span>
            </div>
            <span
              aria-live="polite"
              className="inline-flex h-5 items-center justify-center rounded-full bg-brand-600 px-2 text-xs font-bold text-white"
            >
              {cartItemCount}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
