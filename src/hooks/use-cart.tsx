"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Product } from "@/data/products";

interface CartItem {
  id: string;
  name: string;
  image: string;
  category: string;
  slug: string;
  quantity: number;
}

const STORAGE_KEY = "gyr-cart";

interface CartContextType {
  cart: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (slug: string) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (slug: string) => boolean;
  getItemQuantity: (slug: string) => number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: CartItem[] = JSON.parse(stored);
        setCart(parsed);
      }
    } catch {
      // ignorar errores de parseo
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const addItem = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.slug === product.slug);
      if (existing) {
        return prev.map((item) =>
          item.slug === product.slug
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          id: `${product.slug}-${Date.now()}`,
          name: product.name,
          image: product.image,
          category: product.category,
          slug: product.slug,
          quantity: 1,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((slug: string) => {
    setCart((prev) => prev.filter((item) => item.slug !== slug));
  }, []);

  const updateQuantity = useCallback((slug: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(slug);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.slug === slug ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const isInCart = useCallback((slug: string) => {
    return cart.some((item) => item.slug === slug);
  }, [cart]);

  const getItemQuantity = useCallback((slug: string) => {
    const item = cart.find((i) => i.slug === slug);
    return item ? item.quantity : 0;
  }, [cart]);

  return (
    <CartContext.Provider value={{
      cart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      isInCart,
      getItemQuantity,
      itemCount,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe usarse dentro de un CartProvider");
  }
  return context;
}
