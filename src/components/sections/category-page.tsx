"use client";

import Link from "next/link";
import { useCartWithToast } from "@/hooks/use-cart-with-toast";
import { useState } from "react";
import type { Product } from "@/data/products";

interface CategoryPageProps {
  categoryName: string;
  heroImage?: string;
  products: Product[];
}

export function CategoryPage({ categoryName, heroImage, products }: CategoryPageProps) {
  const { addItem, isInCart } = useCartWithToast();
  const [addedSlug, setAddedSlug] = useState<string | null>(null);

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    addItem(product);
    setAddedSlug(product.slug);
    setTimeout(() => setAddedSlug(null), 2000);
  };

  function HeroSmall({ title, imageUrl }: { title: string; imageUrl?: string }) {
    return (
      <section className="hero-small relative py-16 md:py-24 text-center overflow-hidden mb-12">
        <div className="absolute inset-0 bg-black/[.6] z-0" />
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Hero background"
            className="absolute inset-0 w-full h-full object-cover z-[-1]"
            decoding="async"
          />
        ) : null}
        <div className="container relative z-10 px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            {title}
          </h1>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16">
      <div className="container px-4">
        {heroImage && (
          <HeroSmall title={categoryName} imageUrl={heroImage} />
        )}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gyr-heading mb-2">
            {categoryName}
          </h2>
          <p className="text-gyr-text">
            Explora nuestra línea de productos de {categoryName.toLowerCase()}.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const added = addedSlug === product.slug;
            const inCart = isInCart(product.slug);
            return (
              <article
                key={product.name}
                className="group relative block h-80 rounded-2xl overflow-hidden border border-gyr-border-light bg-white shadow-sm transition-card duration-400 hover:-translate-y-4 hover:shadow-lg"
              >
                <div className="w-full h-full overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover transition-img duration-600 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/[.9] to-transparent p-6 pt-24 text-left flex flex-col justify-end">
                  <span className="text-xs font-semibold text-gyr-primary tracking-wide uppercase mb-1">
                    {categoryName}
                  </span>
                  <Link
                    href={`/producto/${product.slug}`}
                    className="block"
                  >
                    <h3 className="text-lg font-bold text-white drop-shadow-md mb-2">
                      {product.name}
                    </h3>
                  </Link>
                  <button
                    onClick={(e) => handleAddToCart(e, product)}
                    className="bg-white text-gyr-primary font-semibold px-4 py-2 rounded-full hover:bg-gyr-primary hover:text-white transition-colors duration-300 w-fit self-start"
                  >
                    {added
                      ? "✓ Agregado"
                      : inCart
                        ? "Ya en el carrito"
                        : "Agregar"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
