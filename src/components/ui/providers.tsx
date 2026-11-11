"use client";

import { CartProvider } from "@/hooks/use-cart";
import { ToastProvider } from "@/hooks/use-toast";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ToastProvider>
      <CartProvider>{children}</CartProvider>
    </ToastProvider>
  );
}
