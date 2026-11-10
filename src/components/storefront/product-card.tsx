import * as React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CatalogProductSummary } from "@/modules/catalog/catalog.service";

export interface ProductCardProps {
  product: CatalogProductSummary;
  priority?: boolean;
}

export function ProductCard({ product }: ProductCardProps) {
  const stockBadgeVariant =
    product.stockStatus === "IN_STOCK"
      ? "success"
      : product.stockStatus === "LOW_STOCK"
      ? "warning"
      : "error";

  return (
    <Card className="group relative flex flex-col justify-between overflow-hidden rounded-xl border-slate-200 bg-white transition-all duration-200 hover:shadow-lg hover:border-slate-300">
      <div>
        {/* Zero-CLS Pre-reserved Aspect Square Thumbnail */}
        <div className="relative aspect-square w-full overflow-hidden bg-slate-100 flex items-center justify-center">
          {product.thumbnailUrl ? (
            <img
              src={product.thumbnailUrl}
              alt={product.title}
              loading="lazy"
              className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-slate-300 group-hover:scale-105 transition-transform">
              <ShoppingBag className="h-16 w-16" aria-hidden="true" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mt-2">
                {product.brandName || "ApexStore"}
              </span>
            </div>
          )}

          {/* Badges Overlay */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start z-10">
            {product.savingsBadge && (
              <Badge variant="brand" size="sm">
                {product.savingsBadge}
              </Badge>
            )}
            <Badge variant={stockBadgeVariant} size="sm" dot>
              {product.stockBadgeText}
            </Badge>
          </div>
        </div>

        {/* Content Container */}
        <div className="p-4 sm:p-5 space-y-2">
          {product.brandName && (
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {product.brandName}
            </p>
          )}

          <Link
            href={`/product/${product.slug}`}
            className="block text-slate-900 group-hover:text-brand-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
          >
            <h3 className="text-sm sm:text-base font-bold leading-snug line-clamp-2">
              {product.title}
            </h3>
          </Link>

          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>
      </div>

      {/* Pricing & PDP Link Footer */}
      <div className="border-t border-slate-100 p-4 sm:p-5 pt-3 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-slate-900">
              {product.formattedPrice}
            </span>
            {product.formattedCompareAtPrice && (
              <span className="text-xs text-slate-400 line-through">
                {product.formattedCompareAtPrice}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            {product.availableStock > 0 ? "Includes taxes" : "Currently unavailable"}
          </span>
        </div>

        <Link
          href={`/product/${product.slug}`}
          className="inline-flex h-9 min-h-touch min-w-touch sm:min-h-0 sm:min-w-0 items-center justify-center rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 transition-colors"
        >
          View Details
        </Link>
      </div>
    </Card>
  );
}
