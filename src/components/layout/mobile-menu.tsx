"use client";

import { useEffect, useRef } from "react";
import { X, Menu as MenuIcon } from "lucide-react";

import { CategoryAccordion } from "./categories-menu";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const MENU_ITEMS = [
  { name: "Inicio", href: "/" },
  { name: "Nosotros", href: "/nosotros" },
  { name: "Contacto", href: "/contacto" },
  { name: "Catálogo", href: "/catalogo" },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TRIGGER_ID = "mobile-menu-trigger";

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // El drawer declara `aria-modal`: atrapa el foco, cierra con Escape y
  // devuelve el foco al disparador.
  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        document.getElementById(TRIGGER_ID)?.focus();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const closeAndRestoreFocus = () => {
    onClose();
    document.getElementById(TRIGGER_ID)?.focus();
  };

  return (
    <div
      id="mobile-navigation"
      ref={dialogRef}
      className="fixed inset-0 z-40 bg-white flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
    >
      <div className="px-6 py-4 flex items-center justify-between border-b border-gyr-border-light">
        <button
          ref={closeButtonRef}
          onClick={closeAndRestoreFocus}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gyr-text transition-colors hover:text-gyr-heading hover:bg-gyr-surface-alt focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
          aria-label="Cerrar menú"
        >
          <X className="w-6 h-6" aria-hidden="true" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        <ul className="flex flex-col gap-1">
          {MENU_ITEMS.map((item) => (
            <li key={item.name}>
              <a
                href={item.href}
                className="flex min-h-[44px] items-center border-b border-gyr-border-light px-4 py-3 text-base font-semibold transition-colors duration-200 hover:bg-gyr-border-light hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
              >
                {item.name}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-8 pt-6 border-t border-gyr-border-light">
          <h3 className="text-xs font-semibold uppercase text-gyr-text mb-4">
            Categorías
          </h3>
          <CategoryAccordion />
        </div>
      </nav>
    </div>
  );
}

export function MobileMenuTrigger({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  return (
    <button
      id={TRIGGER_ID}
      onClick={() => setIsOpen(true)}
      aria-expanded={isOpen}
      aria-controls="mobile-navigation"
      className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg p-2 text-gyr-heading transition-colors hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
      aria-label="Abrir menú móvil"
    >
      <MenuIcon className="w-6 h-6" aria-hidden="true" />
    </button>
  );
}
