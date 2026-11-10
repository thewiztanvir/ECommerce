import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApexStore — Premium E-Commerce Platform",
  description: "High-performance production-grade e-commerce storefront",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
