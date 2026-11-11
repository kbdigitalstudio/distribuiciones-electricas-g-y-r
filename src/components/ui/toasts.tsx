"use client";

import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

export function Toasts() {
  const { visible, message, hideToast } = useToast();

  if (!visible) return null;

  return <Toast message={message} visible={visible} onClose={hideToast} />;
}
