"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useCartWithToast } from "@/hooks/use-cart-with-toast";
import type { Product } from "@/data/products";

interface ProductDetailProps {
  product: Product;
}

export function ProductDetail({ product }: ProductDetailProps) {
  const { cart, isInCart, addItem } = useCartWithToast();
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <article className="bg-white border border-gyr-border-light rounded-4xl shadow-sm overflow-hidden flex flex-col lg:flex-row">
      <div className="lg:w-1/2 h-full relative">
        <div className="w-full h-[400px] flex items-center justify-center bg-gyr-surface-light overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain p-8"
            loading="lazy"
            decoding="async"
          />
          {!product.image && (
            <div className="flex flex-col items-center justify-center text-gyr-text">
              <ImageIcon className="w-16 h-16 mb-2 opacity-50" />
              <p className="text-sm">Imagen no disponible</p>
            </div>
          )}
        </div>
      </div>
      <div className="lg:w-1/2 p-8 flex flex-col">
        <div className="flex-1">
          <span className="text-xs font-semibold text-gyr-primary tracking-wide uppercase mb-2 block">
            {product.category}
          </span>
          <h1 className="text-3xl font-bold text-gyr-heading mb-4">
            {product.name}
          </h1>
          <div className="mb-6">
            <p className="text-gyr-text leading-relaxed">
              Producto de la línea de {product.category.toLowerCase()} de Distribuidores Eléctricos G y R.
              Consulte disponibilidad y precios a través de nuestros canales de contacto.
            </p>
          </div>
          <div className="mb-6 p-4 bg-gyr-surface-light rounded-xl border border-gyr-border-light">
            <p className="text-sm text-gyr-text mb-2">
              <strong className="text-gyr-heading">Categoría:</strong>{" "}
              {product.category}
            </p>
            <p className="text-sm text-gyr-text">
              <strong className="text-gyr-heading">Referencia:</strong> {product.slug}
            </p>
            <p className="text-sm text-gyr-text mt-2">
              <em className="text-rose-500">
                Precio y disponibilidad: a cotizar directamente con el equipo comercial.
              </em>
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={isInCart(product.slug)}
            className={`w-full py-4 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
              isInCart(product.slug)
                ? "bg-gyr-border-light text-gyr-text cursor-not-allowed"
                : "bg-gradient-to-r from-gyr-primary to-gyr-primary-hover text-white shadow-btn-primary hover:shadow-btn-primary-hover"
            }`}
          >
            {added ? (
              <>
                <span>✓</span>
                <span>Agregado</span>
              </>
            ) : isInCart(product.slug) ? (
              <span>Ya en el carrito</span>
            ) : (
              <>
                <span>🛒</span>
                <span>Agregar al carrito</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
