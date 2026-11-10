import * as React from "react";
import Link from "next/link";
import { PackageOpen, RotateCcw } from "lucide-react";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { ProductCard } from "@/components/storefront/product-card";
import { FilterBar } from "@/components/storefront/filter-bar";
import { Pagination } from "@/components/storefront/pagination";
import { Button } from "@/components/ui/button";
import {
  catalogService,
  type CatalogProductSummary,
} from "@/modules/catalog/catalog.service";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: "newest" | "price-asc" | "price-desc";
    minPrice?: string;
    maxPrice?: string;
    page?: string;
  }>;
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const query = await searchParams;

  let categoryDetail = null;
  try {
    categoryDetail = await catalogService.getCategoryBySlug(slug);
  } catch {
    categoryDetail = null;
  }

  if (!categoryDetail) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center space-y-4">
        <PackageOpen className="h-16 w-16 text-slate-400 mx-auto" />
        <h1 className="text-2xl font-bold text-slate-900">Category Not Found</h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          The requested category could not be located. It may have been renamed or moved.
        </p>
        <div className="pt-2">
          <Link href="/#categories">
            <Button variant="primary" size="md">
              Browse Departments
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
    categorySlug: slug,
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
    { name: "Categories", href: "/#categories" },
    ...(categoryDetail.parent
      ? [
          {
            name: categoryDetail.parent.name,
            href: `/category/${categoryDetail.parent.slug}`,
          },
        ]
      : []),
    { name: categoryDetail.name, href: `/category/${categoryDetail.slug}` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={breadcrumbs} />

      {/* Category Header */}
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          {categoryDetail.name}
        </h1>
        {categoryDetail.description && (
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            {categoryDetail.description}
          </p>
        )}
      </div>

      {/* Filter and Sorting Bar */}
      <FilterBar
        currentSort={query.sort || "newest"}
        minPrice={query.minPrice || ""}
        maxPrice={query.maxPrice || ""}
        totalProducts={total}
      />

      {/* Product Grid or Empty State */}
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
            baseUrl={`/category/${slug}`}
            searchParams={{
              sort: query.sort,
              minPrice: query.minPrice,
              maxPrice: query.maxPrice,
            }}
          />
        </>
      ) : (
        /* Empty State */
        <div className="min-h-[300px] rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <PackageOpen className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              No products found in this category
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              We couldn't find any products matching your current filter criteria. Try resetting your filters to explore available items.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            {(query.minPrice || query.maxPrice) && (
              <Link href={`/category/${slug}`}>
                <Button variant="outline" size="sm" leftIcon={<RotateCcw className="h-4 w-4" />}>
                  Reset Filters
                </Button>
              </Link>
            )}
            <Link href="/#categories">
              <Button variant="primary" size="sm">
                Explore Other Categories
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
