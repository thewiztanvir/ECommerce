import * as React from "react";
import { getServerSession } from "@/modules/auth/session.service";
import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { CartProvider } from "@/context/cart-context";
import { CartDrawer } from "@/components/storefront/cart-drawer";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: { firstName: string; email: string; role?: string } | null = null;

  try {
    const session = await getServerSession();
    if (session.isLoggedIn && session.user) {
      user = {
        firstName: session.user.firstName || session.user.email.split("@")[0],
        email: session.user.email,
        role: session.user.roles?.[0],
      };
    }
  } catch {
    // Graceful fallback during static generation or build-time evaluation
    user = null;
  }

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
        {/* WCAG 2.2 AA Skip-to-content accessibility link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-600"
        >
          Skip to main content
        </a>

        {/* Primary Storefront Header with responsive navigation & search */}
        <Header user={user} />

        {/* Main Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 focus:outline-none"
        >
          {children}
        </main>

        {/* Storefront Footer */}
        <Footer />

        {/* Global Cart Slide-out Drawer */}
        <CartDrawer />
      </div>
    </CartProvider>
  );
}
