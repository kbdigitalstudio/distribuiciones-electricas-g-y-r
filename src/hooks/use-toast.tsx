"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface ToastContextType {
  showToast: (message: string) => void;
  hideToast: () => void;
  visible: boolean;
  message: string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  const hideToast = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, visible, message }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de un ToastProvider");
  }
  return context;
}
