"use client";

import { useState } from "react";
import { ShoppingCart as CartIcon } from "lucide-react";
import { useCart } from "@/hooks/use-cart";

interface CartProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function CartDropdown({ isOpen, onToggle }: CartProps) {
  const { cart, itemCount } = useCart();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative"
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative p-2 text-gyr-heading hover:text-gyr-primary transition-colors duration-300">
        <CartIcon className="w-5 h-5" />
        {itemCount > 0 && (
          <span className="absolute top-1 right-1 bg-gyr-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
            {itemCount}
          </span>
        )}
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white border border-gyr-border border-opacity-10 rounded-2xl shadow-lg p-6 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex-1 max-h-64 overflow-y-auto pr-2">
            {cart.length === 0 ? (
              <p className="text-center text-gyr-text text-sm py-8">Tu carrito está vacío</p>
            ) : (
              cart.map((item, i) => (
                <div key={i} className="cart-item flex items-center gap-3 p-3 border-b border-gyr-border-light last:border-b-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-12 h-12 object-cover rounded-md bg-gyr-surface-light"
                    decoding="async"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gyr-heading">{item.name}</h4>
                    <p className="text-xs text-gyr-text">{item.quantity} unidad(es)</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-gyr-border-light pt-4">
            <div className="flex justify-between font-bold text-gyr-heading mb-4">
              <span>Total</span>
              <span>{itemCount} productos</span>
            </div>
            <button className="w-full bg-gyr-primary text-white font-semibold py-3 rounded-xl hover:bg-gyr-primary-hover transition-colors duration-300 shadow-btn-primary hover:shadow-btn-primary-hover">
              Finalizar Compra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
