"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingBag,
  User as UserIcon,
  Menu,
  ChevronDown,
  LogOut,
  Package,
  Settings,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNav, CategoryItem } from "./mobile-nav";

export interface HeaderProps {
  user?: {
    id?: string;
    firstName: string;
    email: string;
    role?: string;
  } | null;
  cartItemCount?: number;
  initialSearchQuery?: string;
}

const mainCategories: CategoryItem[] = [
  { name: "Electronics", href: "/categories/electronics", description: "Audio, gadgets & laptops" },
  { name: "Apparel", href: "/categories/apparel", description: "Everyday essentials & seasonal collections" },
  { name: "Home & Living", href: "/categories/home-living", description: "Furniture, decor & kitchen accessories" },
];

export function Header({
  user = null,
  cartItemCount = 0,
  initialSearchQuery = "",
}: HeaderProps) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState(initialSearchQuery);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = React.useState(false);
  const accountDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAccountDropdownOpen(false);
      }
    }
    if (isAccountDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAccountDropdownOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md transition-shadow">
        {/* Top utility notification bar */}
        <div className="hidden bg-slate-900 px-4 py-1.5 text-center text-xs font-medium text-slate-200 sm:block">
          <span>Free express shipping on all orders over $75. 30-day effortless returns.</span>
        </div>

        {/* Main header row */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-16 sm:h-20">
          {/* Left section: Hamburger button (mobile) & Brand logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              className="inline-flex h-11 w-11 min-h-touch min-w-touch items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 lg:hidden"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>

            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-extrabold text-lg shadow-sm">
                A
              </span>
              <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900">
                ApexStore
              </span>
            </Link>
          </div>

          {/* Center section: Category Nav Links (Desktop) */}
          <nav
            aria-label="Main store navigation"
            className="hidden lg:flex items-center gap-1 xl:gap-2"
          >
            {mainCategories.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="inline-flex min-h-touch items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:text-brand-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 transition-colors"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              href="/deals"
              className="inline-flex min-h-touch items-center rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 transition-colors"
            >
              Sale
            </Link>
          </nav>

          {/* Desktop Search Bar */}
          <div className="hidden md:flex flex-1 max-w-xs lg:max-w-sm">
            <form
              role="search"
              onSubmit={handleSearchSubmit}
              className="relative w-full flex items-center"
            >
              <label htmlFor="header-search-desktop" className="sr-only">
                Search products
              </label>
              <input
                id="header-search-desktop"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog, brands, items..."
                className="h-11 min-h-touch w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-20 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:bg-white focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 transition-colors"
              />
              <Search
                className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <button
                type="submit"
                aria-label="Submit search"
                className="absolute right-1.5 inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                Search
              </button>
            </form>
          </div>

          {/* Right section: User Account & Cart triggers */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Account trigger */}
            {user ? (
              <div className="relative" ref={accountDropdownRef}>
                <button
                  type="button"
                  id="user-menu-button"
                  aria-expanded={isAccountDropdownOpen}
                  aria-haspopup="true"
                  onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                  className="inline-flex min-h-touch min-w-touch items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-xs">
                    {user.firstName[0]?.toUpperCase()}
                  </div>
                  <span className="hidden xl:inline text-left">
                    <span className="block text-xs font-normal text-slate-500">Hello,</span>
                    <span className="block font-semibold text-slate-900 leading-none">
                      {user.firstName}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </button>

                {/* Dropdown menu */}
                {isAccountDropdownOpen && (
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-50 focus:outline-none animate-in fade-in-80"
                  >
                    <div className="border-b border-slate-100 px-4 py-2.5">
                      <p className="text-xs font-normal text-slate-500">Signed in as</p>
                      <p className="truncate text-sm font-semibold text-slate-900">{user.email}</p>
                    </div>

                    <Link
                      href="/account/orders"
                      role="menuitem"
                      onClick={() => setIsAccountDropdownOpen(false)}
                      className="flex min-h-touch items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Package className="h-4 w-4 text-slate-400" />
                      <span>My Orders</span>
                    </Link>

                    <Link
                      href="/account"
                      role="menuitem"
                      onClick={() => setIsAccountDropdownOpen(false)}
                      className="flex min-h-touch items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Settings className="h-4 w-4 text-slate-400" />
                      <span>Account Settings</span>
                    </Link>

                    {user.role && user.role !== "CUSTOMER" && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        onClick={() => setIsAccountDropdownOpen(false)}
                        className="flex min-h-touch items-center gap-2.5 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        <Settings className="h-4 w-4 text-brand-600" />
                        <span>Admin Console</span>
                      </Link>
                    )}

                    <div className="border-t border-slate-100 my-1" />

                    <form action="/api/v1/auth/logout" method="POST">
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex min-h-touch w-full items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4 text-rose-600" />
                        <span>Sign Out</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  href="/login"
                  className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 transition-colors"
                >
                  <UserIcon className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
                <Link
                  href="/register"
                  className="hidden md:inline-flex min-h-touch items-center justify-center rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Cart Button */}
            <Link
              href="/cart"
              aria-label={`Shopping cart with ${cartItemCount} items`}
              className="relative inline-flex h-11 min-h-touch min-w-touch items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 sm:px-3.5 text-slate-800 shadow-sm hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 transition-colors"
            >
              <ShoppingBag className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span className="hidden sm:inline text-sm font-semibold">Cart</span>
              <span
                aria-live="polite"
                aria-atomic="true"
                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white leading-none"
              >
                {cartItemCount}
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile search bar (under top header on small viewports) */}
        <div className="border-t border-slate-100 px-4 py-2.5 md:hidden">
          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className="relative flex items-center"
          >
            <label htmlFor="header-search-mobile" className="sr-only">
              Search products
            </label>
            <input
              id="header-search-mobile"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="h-11 min-h-touch w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-20 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:bg-white focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
            />
            <Search
              className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <button
              type="submit"
              className="absolute right-1.5 inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              Search
            </button>
          </form>
        </div>
      </header>

      {/* Slide-out mobile drawer */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        categories={mainCategories}
        user={user}
        cartItemCount={cartItemCount}
      />
    </>
  );
}
