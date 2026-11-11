"use client";

import { useCart } from "./use-cart";
import { useToast } from "./use-toast";
import type { Product } from "@/data/products";

export function useCartWithToast() {
  const cart = useCart();
  const { showToast } = useToast();

  const addItemWithToast = (product: Product) => {
    cart.addItem(product);
    showToast(`${product.name} agregado al carrito`);
  };

  return {
    ...cart,
    addItem: addItemWithToast,
  };
}
