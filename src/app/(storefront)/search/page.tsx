import * as React from "react";
import Link from "next/link";
import { Search as SearchIcon, Headphones, Shirt, Armchair } from "lucide-react";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { ProductCard } from "@/components/storefront/product-card";
import { FilterBar } from "@/components/storefront/filter-bar";
import { Pagination } from "@/components/storefront/pagination";
import {
  catalogService,
  type CatalogProductSummary,
} from "@/modules/catalog/catalog.service";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: "newest" | "price-asc" | "price-desc";
    minPrice?: string;
    maxPrice?: string;
    page?: string;
  }>;
}

const suggestedCategories = [
  { name: "Electronics", href: "/category/electronics", icon: Headphones },
  { name: "Apparel", href: "/category/apparel", icon: Shirt },
  { name: "Home & Living", href: "/category/home-living", icon: Armchair },
];

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = await searchParams;
  const searchTerm = query.q || "";

  const sortParam =
    query.sort === "price-asc"
      ? "price_asc"
      : query.sort === "price-desc"
      ? "price_desc"
      : "newest";

  const minPriceMinor = query.minPrice
    ? Math.round(parseFloat(query.minPrice) * 100)
    : undefined;

  const maxPriceMinor = query.maxPrice
    ? Math.round(parseFloat(query.maxPrice) * 100)
    : undefined;

  const currentPage = Math.max(1, parseInt(query.page || "1", 10));

  const listResult = await catalogService.listProducts({
    q: searchTerm || undefined,
    sort: sortParam,
    minPrice: minPriceMinor,
    maxPrice: maxPriceMinor,
    page: currentPage,
    limit: 12,
  });

  const products: CatalogProductSummary[] = listResult.items;
  const { total, totalPages } = listResult.pagination;

  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Search", href: "/search" },
    ...(searchTerm
      ? [
          {
            name: `"${searchTerm}"`,
            href: `/search?q=${encodeURIComponent(searchTerm)}`,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbs} />

      {/* Search Header Banner */}
      <div className="space-y-4 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {searchTerm ? (
              <>
                Showing results for{" "}
                <span className="text-brand-600">&ldquo;{searchTerm}&rdquo;</span>
              </>
            ) : (
              "Browse Catalog"
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {total} {total === 1 ? "match" : "matches"} found across product titles, descriptions, and brands.
          </p>
        </div>

        {/* Refine Search Input Bar */}
        <form
          action="/search"
          method="GET"
          className="relative flex max-w-lg items-center"
        >
          <label htmlFor="refine-search" className="sr-only">
            Refine search query
          </label>
          <input
            id="refine-search"
            type="search"
            name="q"
            defaultValue={searchTerm}
            placeholder="Search catalog by keyword or brand..."
            className="h-11 min-h-touch w-full rounded-lg border border-slate-300 bg-white pl-10 pr-24 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
          />
          <SearchIcon
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <button
            type="submit"
            className="absolute right-1.5 inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Search
          </button>
        </form>
      </div>

      {/* Filter and Sorting Bar */}
      <FilterBar
        currentSort={query.sort || "newest"}
        minPrice={query.minPrice || ""}
        maxPrice={query.maxPrice || ""}
        totalProducts={total}
      />

      {/* Results Grid or Friendly Empty State */}
      {products.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product: CatalogProductSummary) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl="/search"
            searchParams={{
              q: searchTerm,
              sort: query.sort,
              minPrice: query.minPrice,
              maxPrice: query.maxPrice,
            }}
          />
        </>
      ) : (
        /* Friendly Empty State with Popular Categories */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mx-auto">
            <SearchIcon className="h-8 w-8" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-slate-900">
              No matching products found
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              We couldn't find any products matching &ldquo;{searchTerm}&rdquo;. Check for spelling errors, try more general terms, or explore popular departments below.
            </p>
          </div>

          {/* Popular Category Suggestions */}
          <div className="pt-2 max-w-xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Explore Popular Departments
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {suggestedCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <Link
                    key={cat.href}
                    href={cat.href}
                    className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 shadow-sm hover:border-brand-300 hover:text-brand-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    <span>{cat.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
