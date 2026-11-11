"use client";

import { useState } from "react";
import Link from "next/link";
import { useCartWithToast } from "@/hooks/use-cart-with-toast";

interface ProductCardProps {
  name: string;
  image: string;
  category?: string;
  slug?: string;
}

export function ProductCard({ name, image, category, slug }: ProductCardProps) {
  const { addItem, isInCart } = useCartWithToast();
  const [added, setAdded] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    const product = {
      slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
      name,
      image,
      category: category || "",
    };
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const isAlreadyInCart = isInCart(slug || name.toLowerCase().replace(/\s+/g, "-"));

  return (
    <article className="group relative block h-80 rounded-2xl overflow-hidden border border-gyr-border-light bg-white shadow-sm transition-card duration-400 hover:-translate-y-4 hover:shadow-lg">
      <div className="w-full h-full overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-img duration-600 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/[.9] to-transparent p-6 pt-24 text-left flex flex-col justify-end">
        {category && (
          <span className="text-xs font-semibold text-gyr-primary tracking-wide uppercase mb-1">
            {category}
          </span>
        )}
        {slug ? (
          <Link href={`/producto/${slug}`} className="block">
            <h3 className="text-lg font-bold text-white drop-shadow-md mb-2">
              {name}
            </h3>
          </Link>
        ) : (
          <h3 className="text-lg font-bold text-white drop-shadow-md mb-2">
            {name}
          </h3>
        )}
        <button
          onClick={handleAddToCart}
          className="bg-white text-gyr-primary font-semibold px-4 py-2 rounded-full hover:bg-gyr-primary hover:text-white transition-colors duration-300 w-fit self-start"
        >
          {added ? "✓ Agregado" : isAlreadyInCart ? "Ya en el carrito" : "Agregar"}
        </button>
      </div>
    </article>
  );
}
