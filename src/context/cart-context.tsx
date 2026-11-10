"use client";

import * as React from "react";
import { MoneyEngine } from "@/lib/money";

export interface CartItem {
  id: string;
  variantId: string;
  productId?: string;
  productSlug: string;
  title: string;
  variantTitle?: string;
  attributes: Record<string, string>;
  unitPriceMinor: number;
  compareAtPriceMinor: number | null;
  quantity: number;
  thumbnailUrl: string | null;
  maxAvailableStock: number;
}

export interface AppliedCoupon {
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number; // percentage (e.g. 20) or minor units (e.g. 1000 for $10)
  description: string;
}

export interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  estimatedTotalMinor: number;
  formattedSubtotal: string;
  formattedShipping: string;
  formattedDiscount: string;
  formattedEstimatedTotal: string;
  isFreeShipping: boolean;
  freeShippingThresholdMinor: number;
  freeShippingRemainingMinor: number;
  appliedCoupon: AppliedCoupon | null;
  couponError: string | null;
  couponSuccess: string | null;
  isCartDrawerOpen: boolean;
  addItem: (item: Omit<CartItem, "id"> & { id?: string }) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  toggleCartDrawer: () => void;
}

const CartContext = React.createContext<CartContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY = "apex_cart_session_v1";
const FREE_SHIPPING_THRESHOLD_MINOR = 7500; // $75.00
const STANDARD_SHIPPING_MINOR = 999; // $9.99

// Valid promotional coupons for storefront demonstrations
const VALID_COUPONS: Record<string, AppliedCoupon> = {
  SUMMER20: {
    code: "SUMMER20",
    discountType: "PERCENTAGE",
    discountValue: 20,
    description: "20% off your entire order",
  },
  WELCOME15: {
    code: "WELCOME15",
    discountType: "PERCENTAGE",
    discountValue: 15,
    description: "15% off first order",
  },
  APEX10: {
    code: "APEX10",
    discountType: "FIXED",
    discountValue: 1000,
    description: "$10 off orders over $50",
  },
};

export interface CartProviderProps {
  children: React.ReactNode;
  initialItems?: CartItem[];
  initialCoupon?: AppliedCoupon | null;
  initialIsOpen?: boolean;
}

export function CartProvider({
  children,
  initialItems = [],
  initialCoupon = null,
  initialIsOpen = false,
}: CartProviderProps) {
  const [items, setItems] = React.useState<CartItem[]>(initialItems);
  const [appliedCoupon, setAppliedCoupon] = React.useState<AppliedCoupon | null>(initialCoupon);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = React.useState<string | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = React.useState(initialIsOpen);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // 1. Hydrate from localStorage on client mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          setItems(parsed.items);
        }
        if (parsed.coupon) {
          setAppliedCoupon(parsed.coupon);
        }
      }
    } catch {
      // LocalStorage unavailable or corrupt
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // 2. Persist to localStorage on change
  React.useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          items,
          coupon: appliedCoupon,
        })
      );
    } catch {
      // Quota exceeded or private browsing
    }
  }, [items, appliedCoupon, isHydrated]);

  // Derived Totals
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotalMinor = items.reduce(
    (sum, item) => sum + item.unitPriceMinor * item.quantity,
    0
  );

  const isFreeShipping = subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR;
  const shippingMinor =
    subtotalMinor > 0 && !isFreeShipping ? STANDARD_SHIPPING_MINOR : 0;

  const freeShippingRemainingMinor = Math.max(
    0,
    FREE_SHIPPING_THRESHOLD_MINOR - subtotalMinor
  );

  // Compute discount
  let discountMinor = 0;
  if (appliedCoupon && subtotalMinor > 0) {
    if (appliedCoupon.discountType === "PERCENTAGE") {
      discountMinor = Math.round(
        (subtotalMinor * appliedCoupon.discountValue) / 100
      );
    } else if (appliedCoupon.discountType === "FIXED") {
      discountMinor = Math.min(subtotalMinor, appliedCoupon.discountValue);
    }
  }

  const estimatedTotalMinor = Math.max(
    0,
    subtotalMinor - discountMinor + shippingMinor
  );

  const formattedSubtotal = MoneyEngine.format({
    amountMinor: subtotalMinor,
    currency: "USD",
  });
  const formattedShipping = isFreeShipping
    ? "FREE"
    : MoneyEngine.format({ amountMinor: shippingMinor, currency: "USD" });
  const formattedDiscount = MoneyEngine.format({
    amountMinor: discountMinor,
    currency: "USD",
  });
  const formattedEstimatedTotal = MoneyEngine.format({
    amountMinor: estimatedTotalMinor,
    currency: "USD",
  });

  // Actions
  const addItem = React.useCallback(
    (item: Omit<CartItem, "id"> & { id?: string }) => {
      setItems((prev) => {
        const existingIndex = prev.findIndex(
          (i) => i.variantId === item.variantId
        );

        if (existingIndex > -1) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          const newQty = Math.min(
            existing.maxAvailableStock,
            existing.quantity + item.quantity
          );
          updated[existingIndex] = { ...existing, quantity: newQty };
          return updated;
        }

        const newItem: CartItem = {
          ...item,
          id: item.id || `cart_item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        };
        return [...prev, newItem];
      });

      // Automatically open drawer on successful addition
      setIsCartDrawerOpen(true);
    },
    []
  );

  const updateQuantity = React.useCallback(
    (itemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(itemId);
        return;
      }
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            const clamped = Math.min(item.maxAvailableStock, quantity);
            return { ...item, quantity: clamped };
          }
          return item;
        })
      );
    },
    []
  );

  const removeItem = React.useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const clearCart = React.useCallback(() => {
    setItems([]);
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponSuccess(null);
  }, []);

  const applyCoupon = React.useCallback(async (code: string) => {
    setCouponError(null);
    setCouponSuccess(null);

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setCouponError("Please enter a valid coupon code.");
      return false;
    }

    const foundCoupon = VALID_COUPONS[normalizedCode];
    if (!foundCoupon) {
      setCouponError(`Coupon code "${normalizedCode}" is invalid or expired.`);
      return false;
    }

    setAppliedCoupon(foundCoupon);
    setCouponSuccess(`Coupon "${normalizedCode}" applied successfully!`);
    return true;
  }, []);

  const removeCoupon = React.useCallback(() => {
    setAppliedCoupon(null);
    setCouponSuccess(null);
    setCouponError(null);
  }, []);

  const openCartDrawer = React.useCallback(() => setIsCartDrawerOpen(true), []);
  const closeCartDrawer = React.useCallback(() => setIsCartDrawerOpen(false), []);
  const toggleCartDrawer = React.useCallback(
    () => setIsCartDrawerOpen((prev) => !prev),
    []
  );

  const value: CartContextValue = {
    items,
    itemCount,
    subtotalMinor,
    shippingMinor,
    discountMinor,
    estimatedTotalMinor,
    formattedSubtotal,
    formattedShipping,
    formattedDiscount,
    formattedEstimatedTotal,
    isFreeShipping,
    freeShippingThresholdMinor: FREE_SHIPPING_THRESHOLD_MINOR,
    freeShippingRemainingMinor,
    appliedCoupon,
    couponError,
    couponSuccess,
    isCartDrawerOpen,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    openCartDrawer,
    closeCartDrawer,
    toggleCartDrawer,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartOptional() {
  return React.useContext(CartContext);
}

export function useCart() {
  const context = React.useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
