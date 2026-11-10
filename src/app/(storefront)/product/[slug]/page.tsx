import * as React from "react";
import Link from "next/link";
import { PackageOpen, ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { PDPInteractive } from "@/components/storefront/pdp-interactive";
import { Button } from "@/components/ui/button";
import {
  catalogService,
  type CatalogProductDetail,
} from "@/modules/catalog/catalog.service";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;

  let product: CatalogProductDetail | null = null;
  try {
    product = await catalogService.getProductBySlug(slug);
  } catch {
    product = null;
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center space-y-4">
        <PackageOpen className="h-16 w-16 text-slate-400 mx-auto" />
        <h1 className="text-2xl font-bold text-slate-900">Product Not Found</h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          The product you are looking for is no longer available or the link may be invalid.
        </p>
        <div className="pt-2">
          <Link href="/#categories">
            <Button
              variant="primary"
              size="md"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to Catalog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Categories", href: "/#categories" },
    { name: product.category.name, href: `/category/${product.category.slug}` },
    { name: product.title, href: `/product/${product.slug}` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={breadcrumbs} />

      {/* Main Interactive PDP View (Gallery, Pricing, Variant Selection, Stock, Tabs) */}
      <PDPInteractive product={product} />
    </div>
  );
}
