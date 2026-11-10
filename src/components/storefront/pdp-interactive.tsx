"use client";

import * as React from "react";
import {
  ShoppingBag,
  Check,
  ShieldCheck,
  Truck,
  RotateCcw,
  Minus,
  Plus,
  Package,
  Layers,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CatalogProductDetail, CatalogVariant } from "@/modules/catalog/catalog.service";

export interface PDPInteractiveProps {
  product: CatalogProductDetail;
}

export function PDPInteractive({ product }: PDPInteractiveProps) {
  const [selectedVariant, setSelectedVariant] = React.useState<CatalogVariant>(
    product.variants[0] || ({} as CatalogVariant)
  );
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
  const [quantity, setQuantity] = React.useState(1);
  const [isAddingToCart, setIsAddingToCart] = React.useState(false);
  const [addedToast, setAddedToast] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"description" | "specs" | "shipping">(
    "description"
  );

  const images = product.media.length > 0
    ? product.media
    : [{ id: "fallback", url: "", altText: product.title, isThumbnail: true }];

  const currentImage = images[selectedImageIndex] || images[0];

  const isOutOfStock = selectedVariant.stockStatus === "OUT_OF_STOCK";
  const maxAvailable = Math.max(1, selectedVariant.availableStock || 1);

  const handleVariantSelect = (variant: CatalogVariant) => {
    setSelectedVariant(variant);
    if (quantity > (variant.availableStock || 1)) {
      setQuantity(Math.max(1, variant.availableStock || 1));
    }
  };

  const handleQuantityDecrease = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleQuantityIncrease = () => {
    setQuantity((prev) => Math.min(maxAvailable, prev + 1));
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    setIsAddingToCart(true);

    setTimeout(() => {
      setIsAddingToCart(false);
      setAddedToast(true);
      setTimeout(() => setAddedToast(false), 3500);
    }, 400);
  };

  const stockBadgeVariant =
    selectedVariant.stockStatus === "IN_STOCK"
      ? "success"
      : selectedVariant.stockStatus === "LOW_STOCK"
      ? "warning"
      : "error";

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* ================================================================= */}
        {/* 1. Image Gallery (Zero-CLS Layout) */}
        {/* ================================================================= */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Display Image */}
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm">
            {currentImage.url ? (
              <img
                src={currentImage.url}
                alt={currentImage.altText || product.title}
                className="h-full w-full object-cover object-center transition-all duration-300"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300">
                <ShoppingBag className="h-28 w-28 text-slate-300" aria-hidden="true" />
                <span className="mt-3 text-xs font-mono uppercase tracking-widest text-slate-400">
                  {product.brandName || "ApexStore"}
                </span>
              </div>
            )}

            {/* Badges Overlay */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start z-10">
              {selectedVariant.savingsBadge && (
                <Badge variant="brand" size="md">
                  {selectedVariant.savingsBadge}
                </Badge>
              )}
              <Badge variant={stockBadgeVariant} size="md" dot>
                {selectedVariant.stockBadgeText}
              </Badge>
            </div>
          </div>

          {/* Thumbnail Selector */}
          {images.length > 1 && (
            <div
              role="region"
              aria-label="Product thumbnails"
              className="flex items-center gap-3 overflow-x-auto pb-2"
            >
              {images.map((img, idx) => {
                const isSelected = idx === selectedImageIndex;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    aria-label={`View product image ${idx + 1} of ${images.length}`}
                    aria-current={isSelected}
                    className={`relative h-20 w-20 min-h-touch min-w-touch shrink-0 overflow-hidden rounded-xl border-2 bg-slate-100 transition-all ${
                      isSelected
                        ? "border-brand-600 ring-2 ring-brand-100 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                  >
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.altText || `Thumbnail ${idx + 1}`}
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400 text-xs">
                        {idx + 1}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* 2. Product Purchase Column */}
        {/* ================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* Header & Brand */}
          <div className="space-y-2 border-b border-slate-200 pb-5">
            {product.brandName && (
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
                {product.brandName}
              </p>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {product.title}
            </h1>
            <p className="text-xs text-slate-500">
              SKU: <span className="font-mono text-slate-700">{selectedVariant.sku}</span>
              {selectedVariant.barcode && (
                <> &bull; Barcode: <span className="font-mono">{selectedVariant.barcode}</span></>
              )}
            </p>
          </div>

          {/* Pricing Row */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-slate-900">
                {selectedVariant.formattedPrice}
              </span>
              {selectedVariant.formattedCompareAtPrice && (
                <span className="text-base font-semibold text-slate-400 line-through">
                  {selectedVariant.formattedCompareAtPrice}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Taxes calculated at checkout. Free shipping on orders over $75.
            </p>
          </div>

          {/* Dynamic Variant Selector */}
          {product.variants.length > 1 && (
            <div className="space-y-3 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Option:
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {selectedVariant.title}
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="Product variant options"
                className="flex flex-wrap gap-2.5"
              >
                {product.variants.map((v) => {
                  const isSelected = v.id === selectedVariant.id;
                  const vOutOfStock = v.stockStatus === "OUT_OF_STOCK";

                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-disabled={vOutOfStock}
                      onClick={() => handleVariantSelect(v)}
                      className={`relative min-h-touch min-w-touch rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
                        isSelected
                          ? "border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-600 ring-offset-1"
                          : vOutOfStock
                          ? "border-slate-200 bg-slate-50 text-slate-400 opacity-60 hover:opacity-80"
                          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2`}
                    >
                      {v.title}
                      {vOutOfStock && (
                        <span className="ml-1 text-[10px] text-rose-500 font-normal">
                          (Out of Stock)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Selector & Add to Cart */}
          <div className="space-y-4 border-t border-slate-200 pt-5">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Quantity:
              </span>
              <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={handleQuantityDecrease}
                  disabled={quantity <= 1 || isOutOfStock}
                  aria-label="Decrease quantity"
                  className="inline-flex h-11 w-11 min-h-touch min-w-touch items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-l-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>

                <span
                  aria-label="Quantity"
                  className="flex h-11 w-12 items-center justify-center font-bold text-sm text-slate-900 border-x border-slate-200"
                >
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={handleQuantityIncrease}
                  disabled={quantity >= maxAvailable || isOutOfStock}
                  aria-label="Increase quantity"
                  className="inline-flex h-11 w-11 min-h-touch min-w-touch items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <span className="text-xs text-slate-500">
                {isOutOfStock
                  ? "Unavailable"
                  : selectedVariant.stockStatus === "LOW_STOCK"
                  ? `Max ${maxAvailable} available`
                  : "In stock"}
              </span>
            </div>

            {/* Main CTA */}
            <div className="space-y-2">
              <Button
                variant={isOutOfStock ? "secondary" : "primary"}
                size="lg"
                fullWidth
                disabled={isOutOfStock}
                isLoading={isAddingToCart}
                onClick={handleAddToCart}
                leftIcon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}
              >
                {isOutOfStock ? "Out of Stock" : "Add to Cart"}
              </Button>

              {/* Screen reader & visual feedback toast */}
              {addedToast && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 animate-in fade-in"
                >
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Added {quantity} &times; {product.title} to your cart.</span>
                </div>
              )}
            </div>
          </div>

          {/* Value Assurance Badges */}
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <div className="space-y-1">
              <Truck className="h-5 w-5 text-brand-600 mx-auto" aria-hidden="true" />
              <p className="text-[11px] font-semibold text-slate-800">Express Delivery</p>
              <p className="text-[10px] text-slate-500">Ships in 24 hrs</p>
            </div>
            <div className="space-y-1 border-x border-slate-200 px-2">
              <RotateCcw className="h-5 w-5 text-brand-600 mx-auto" aria-hidden="true" />
              <p className="text-[11px] font-semibold text-slate-800">30-Day Returns</p>
              <p className="text-[10px] text-slate-500">Hassle-free labels</p>
            </div>
            <div className="space-y-1">
              <ShieldCheck className="h-5 w-5 text-brand-600 mx-auto" aria-hidden="true" />
              <p className="text-[11px] font-semibold text-slate-800">2-Year Warranty</p>
              <p className="text-[10px] text-slate-500">100% Guaranteed</p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. Expandable Description, Specs & Shipping Tabs */}
      {/* ================================================================= */}
      <div className="border-t border-slate-200 pt-8">
        {/* Tab Headers */}
        <div
          role="tablist"
          aria-label="Product detailed information"
          className="flex border-b border-slate-200 overflow-x-auto gap-4 sm:gap-8"
        >
          <button
            type="button"
            role="tab"
            id="tab-description"
            aria-controls="panel-description"
            aria-selected={activeTab === "description"}
            onClick={() => setActiveTab("description")}
            className={`min-h-touch pb-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "description"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded`}
          >
            Product Description
          </button>

          <button
            type="button"
            role="tab"
            id="tab-specs"
            aria-controls="panel-specs"
            aria-selected={activeTab === "specs"}
            onClick={() => setActiveTab("specs")}
            className={`min-h-touch pb-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "specs"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded`}
          >
            Technical Specifications
          </button>

          <button
            type="button"
            role="tab"
            id="tab-shipping"
            aria-controls="panel-shipping"
            aria-selected={activeTab === "shipping"}
            onClick={() => setActiveTab("shipping")}
            className={`min-h-touch pb-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "shipping"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded`}
          >
            Shipping &amp; Returns
          </button>
        </div>

        {/* Tab Panels */}
        <div className="py-6">
          {activeTab === "description" && (
            <div
              role="tabpanel"
              id="panel-description"
              aria-labelledby="tab-description"
              className="prose prose-slate max-w-none text-sm text-slate-600 leading-relaxed space-y-4"
            >
              <p>{product.description}</p>
              <p>
                Every unit passes multi-stage inspection to ensure dimensional fidelity, structural longevity, and seamless compatibility with your everyday workflow.
              </p>
            </div>
          )}

          {activeTab === "specs" && (
            <div
              role="tabpanel"
              id="panel-specs"
              aria-labelledby="tab-specs"
              className="max-w-2xl text-sm"
            >
              <dl className="divide-y divide-slate-200">
                <div className="py-2.5 grid grid-cols-3">
                  <dt className="font-semibold text-slate-500">Brand</dt>
                  <dd className="col-span-2 text-slate-900 font-medium">{product.brandName || "ApexStore"}</dd>
                </div>
                <div className="py-2.5 grid grid-cols-3">
                  <dt className="font-semibold text-slate-500">SKU</dt>
                  <dd className="col-span-2 text-slate-900 font-mono">{selectedVariant.sku}</dd>
                </div>
                <div className="py-2.5 grid grid-cols-3">
                  <dt className="font-semibold text-slate-500">Department</dt>
                  <dd className="col-span-2 text-slate-900 font-medium">{product.category.name}</dd>
                </div>
                {Object.entries(selectedVariant.attributes).map(([k, v]) => (
                  <div key={k} className="py-2.5 grid grid-cols-3">
                    <dt className="font-semibold text-slate-500 capitalize">{k}</dt>
                    <dd className="col-span-2 text-slate-900 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {activeTab === "shipping" && (
            <div
              role="tabpanel"
              id="panel-shipping"
              aria-labelledby="tab-shipping"
              className="max-w-2xl text-sm text-slate-600 leading-relaxed space-y-3"
            >
              <h4 className="font-bold text-slate-900 text-base">Standard Shipping & Delivery</h4>
              <p>
                Orders placed before 2:00 PM EST ship the same business day. Standard tracked delivery takes 2–4 business days. Priority expedited overnight shipping is available at checkout.
              </p>
              <h4 className="font-bold text-slate-900 text-base pt-2">30-Day Satisfaction Guarantee</h4>
              <p>
                If you are not 100% satisfied with your purchase, you may initiate a return within 30 days of delivery for a full refund. Items must be in original condition with packaging.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
