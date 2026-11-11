"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
}

export function Toast({ message, visible, onClose }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gyr-footer-bg text-white px-6 py-4 rounded-full shadow-2xl border border-white/[.2] animate-in fade-in slide-in-from-top-2 duration-300">
      <span className="text-sm font-semibold">{message}</span>
      <button
        onClick={onClose}
        className="text-white hover:text-gyr-primary transition-colors"
        aria-label="Cerrar notificación"
      >
        ×
      </button>
    </div>
  );
}
