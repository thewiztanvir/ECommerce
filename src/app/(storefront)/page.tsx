import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Headphones,
  Shirt,
  Armchair,
  Watch,
  Star,
  CheckCircle,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface FeaturedProduct {
  id: string;
  name: string;
  category: string;
  price: string;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  lowStock?: boolean;
  badge?: string;
  description: string;
}

const featuredProducts: FeaturedProduct[] = [
  {
    id: "prod_01",
    name: "Apex Pro Wireless ANC Headphones",
    category: "Electronics",
    price: "$299.00",
    rating: 4.9,
    reviewsCount: 248,
    inStock: true,
    badge: "Best Seller",
    description: "Lossless spatial audio with 40-hour battery life and custom planar magnetic drivers.",
  },
  {
    id: "prod_02",
    name: "Merino Wool Thermal Overshirt",
    category: "Apparel",
    price: "$145.00",
    rating: 4.8,
    reviewsCount: 112,
    inStock: true,
    lowStock: true,
    badge: "Low Stock",
    description: "Breathable Australian merino wool with reinforced double-stitch construction.",
  },
  {
    id: "prod_03",
    name: "Solid Walnut Ergonomic Desk Shelf",
    category: "Home & Living",
    price: "$189.00",
    rating: 5.0,
    reviewsCount: 84,
    inStock: true,
    badge: "Crafted by Hand",
    description: "Sustainably harvested American walnut with matte aluminum accessory risers.",
  },
  {
    id: "prod_04",
    name: "Precision Ceramic Pour-Over Set",
    category: "Home & Living",
    price: "$78.00",
    rating: 4.7,
    reviewsCount: 65,
    inStock: true,
    description: "Double-walled artisanal ceramic dripper paired with a borosilicate heatproof decanter.",
  },
];

const categoryCards = [
  {
    name: "Electronics",
    description: "High-fidelity audio, smart displays & workstation peripherals.",
    href: "/categories/electronics",
    icon: Headphones,
    itemCount: "128 items",
  },
  {
    name: "Apparel",
    description: "Technical outerwear, tailored essentials & sustainable woolens.",
    href: "/categories/apparel",
    icon: Shirt,
    itemCount: "94 items",
  },
  {
    name: "Home & Living",
    description: "Architectural lighting, studio furniture & culinary ceramics.",
    href: "/categories/home-living",
    icon: Armchair,
    itemCount: "76 items",
  },
  {
    name: "Accessories",
    description: "Full-grain leather goods, minimalist watches & everyday carry.",
    href: "/categories/accessories",
    icon: Watch,
    itemCount: "52 items",
  },
];

export default function StorefrontHomePage() {
  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* 1. Hero Section */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden bg-gradient-to-b from-brand-50/60 via-white to-white pt-12 sm:pt-20 lg:pt-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3 py-1 text-xs font-semibold text-brand-700">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Spring/Summer 2026 Collection Available</span>
              </div>

              <h1
                id="hero-heading"
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]"
              >
                Engineered for life.{" "}
                <span className="text-brand-600 block sm:inline">
                  Crafted without compromise.
                </span>
              </h1>

              <p className="max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed mx-auto lg:mx-0">
                Discover curated electronics, technical apparel, and architectural home pieces built with sustainable materials and verified longevity.
              </p>

              {/* Call to action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                <Link href="/products" className="w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
                  >
                    Explore Catalog
                  </Button>
                </Link>
                <Link href="#categories" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" fullWidth>
                    Browse Departments
                  </Button>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-4 text-center lg:text-left">
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">40k+</p>
                  <p className="text-xs text-slate-500">Delighted Shoppers</p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">99.8%</p>
                  <p className="text-xs text-slate-500">On-Time Delivery</p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">30-Day</p>
                  <p className="text-xs text-slate-500">Risk-Free Trial</p>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Card */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-400 opacity-20 blur-xl" />
                <Card className="relative overflow-hidden border-slate-200 shadow-xl bg-white p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <Badge variant="brand" dot>
                      Featured Spotlight
                    </Badge>
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> In Stock & Ready to Ship
                    </span>
                  </div>

                  <div className="aspect-[4/3] rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 flex flex-col items-center justify-center p-6 text-center">
                    <Headphones className="h-20 w-20 text-brand-600 mb-2 drop-shadow-sm" />
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                      FLAGSHIP HARDWARE
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-amber-500 text-xs">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-current" />
                      ))}
                      <span className="text-slate-600 font-semibold ml-1">4.9 (248 reviews)</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Apex Pro Wireless ANC
                    </h3>
                    <p className="text-xs text-slate-600 leading-normal">
                      Ultra-low latency studio playback with adaptive environmental noise cancelling.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-xs text-slate-400 block">Retail Price</span>
                      <span className="text-2xl font-black text-slate-900">$299.00</span>
                    </div>
                    <Link href="/products/apex-pro-wireless">
                      <Button variant="primary" size="md">
                        View Product
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Category Quick-Browse Grid */}
      <section
        id="categories"
        aria-labelledby="category-heading"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600 mb-1">
              Curated Departments
            </p>
            <h2
              id="category-heading"
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
            >
              Shop by Category
            </h2>
          </div>
          <Link
            href="/categories"
            className="inline-flex min-h-touch items-center text-sm font-semibold text-brand-600 hover:text-brand-700 group"
          >
            <span>View All Departments</span>
            <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categoryCards.map((category) => {
            const Icon = category.icon;
            return (
              <Link
                key={category.name}
                href={category.href}
                className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-xl"
              >
                <Card
                  variant="interactive"
                  className="h-full flex flex-col justify-between p-6 group-hover:border-brand-300"
                >
                  <div className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {category.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{category.itemCount}</span>
                    <span className="text-brand-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Browse <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Featured Products Highlight Grid */}
      <section
        aria-labelledby="featured-heading"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600 mb-1">
              Popular Releases
            </p>
            <h2
              id="featured-heading"
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
            >
              Featured Products
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex min-h-touch items-center text-sm font-semibold text-brand-600 hover:text-brand-700 group"
          >
            <span>See Complete Catalog</span>
            <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <Card
              key={product.id}
              className="flex flex-col justify-between overflow-hidden group hover:shadow-lg transition-shadow duration-200"
            >
              <div>
                {/* Product Media Placeholder */}
                <div className="relative aspect-square w-full bg-slate-100 flex items-center justify-center p-6 overflow-hidden">
                  <ShoppingBag className="h-16 w-16 text-slate-300 group-hover:scale-105 transition-transform duration-300" />
                  {product.badge && (
                    <div className="absolute top-3 left-3">
                      <Badge
                        variant={product.lowStock ? "warning" : "brand"}
                        size="sm"
                      >
                        {product.badge}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Card Information */}
                <div className="p-5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-brand-600">
                      {product.category}
                    </span>
                    <span className="flex items-center gap-1 text-amber-500 font-semibold">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {product.rating} ({product.reviewsCount})
                    </span>
                  </div>

                  <Link
                    href={`/products/${product.id}`}
                    className="block group-hover:text-brand-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                  >
                    <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-1">
                      {product.name}
                    </h3>
                  </Link>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>
                </div>
              </div>

              {/* Card Action & Price */}
              <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block leading-tight">Price</span>
                  <span className="text-lg font-black text-slate-900">{product.price}</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  aria-label={`Add ${product.name} to cart`}
                >
                  Add to Cart
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Storefront Reassurance & Confidence Banner */}
      <section
        aria-labelledby="confidence-heading"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="rounded-2xl bg-slate-900 px-6 py-12 sm:px-12 sm:py-16 text-white text-center sm:text-left">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <h2
                id="confidence-heading"
                className="text-2xl sm:text-3xl font-extrabold tracking-tight"
              >
                Join over 40,000 discerning shoppers worldwide.
              </h2>
              <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                Experience transparent pricing, instant inventory status, encrypted payments, and 30-day hassle-free returns on every single order.
              </p>
            </div>
            <div className="lg:col-span-4 flex justify-center lg:justify-end">
              <Link href="/register">
                <Button
                  variant="primary"
                  size="lg"
                  className="bg-brand-500 hover:bg-brand-400 text-white font-bold"
                >
                  Create an Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
