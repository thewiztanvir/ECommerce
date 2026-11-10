"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowUpDown, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FilterBarProps {
  currentSort?: string;
  minPrice?: string;
  maxPrice?: string;
  totalProducts: number;
}

export function FilterBar({
  currentSort = "newest",
  minPrice = "",
  maxPrice = "",
  totalProducts,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [minPriceInput, setMinPriceInput] = React.useState(minPrice);
  const [maxPriceInput, setMaxPriceInput] = React.useState(maxPrice);
  const [sortSelect, setSortSelect] = React.useState(currentSort);

  const applyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    if (sortSelect && sortSelect !== "newest") {
      params.set("sort", sortSelect);
    } else {
      params.delete("sort");
    }

    if (minPriceInput.trim()) {
      params.set("minPrice", minPriceInput.trim());
    } else {
      params.delete("minPrice");
    }

    if (maxPriceInput.trim()) {
      params.set("maxPrice", maxPriceInput.trim());
    } else {
      params.delete("maxPrice");
    }

    params.delete("page"); // Reset page when filtering
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSortChange = (newSort: string) => {
    setSortSelect(newSort);
    const params = new URLSearchParams(searchParams.toString());
    if (newSort && newSort !== "newest") {
      params.set("sort", newSort);
    } else {
      params.delete("sort");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const resetFilters = () => {
    setMinPriceInput("");
    setMaxPriceInput("");
    setSortSelect("newest");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("sort");
    params.delete("minPrice");
    params.delete("maxPrice");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasActiveFilters = Boolean(
    minPrice || maxPrice || (currentSort && currentSort !== "newest")
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Count indicator */}
        <div className="text-xs sm:text-sm font-semibold text-slate-700">
          Showing <span className="text-brand-600 font-bold">{totalProducts}</span>{" "}
          {totalProducts === 1 ? "product" : "products"}
        </div>

        {/* Filter and Sort Form */}
        <form
          onSubmit={applyFilters}
          className="flex flex-wrap items-center gap-3 sm:gap-4"
        >
          {/* Price Range */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm">
            <span className="text-slate-500 font-medium">Price:</span>
            <div className="relative">
              <label htmlFor="filter-min-price" className="sr-only">
                Minimum price
              </label>
              <input
                id="filter-min-price"
                type="number"
                min="0"
                step="1"
                placeholder="Min $"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                className="h-10 min-h-touch sm:min-h-0 w-20 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
              />
            </div>
            <span className="text-slate-400">–</span>
            <div className="relative">
              <label htmlFor="filter-max-price" className="sr-only">
                Maximum price
              </label>
              <input
                id="filter-max-price"
                type="number"
                min="0"
                step="1"
                placeholder="Max $"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                className="h-10 min-h-touch sm:min-h-0 w-20 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Sorting Selector */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <label htmlFor="filter-sort-select" className="text-slate-500 font-medium">
              Sort:
            </label>
            <div className="relative">
              <select
                id="filter-sort-select"
                value={sortSelect}
                onChange={(e) => handleSortChange(e.target.value)}
                className="h-10 min-h-touch sm:min-h-0 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-xs font-medium text-slate-800 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 cursor-pointer"
              >
                <option value="newest">Newest Releases</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-touch sm:min-h-0 items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 underline-offset-4 hover:underline p-1"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
