"use client";

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

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-white flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
    >
      <div className="px-6 py-4 flex items-center justify-between border-b border-gyr-border-light">
        <button
          onClick={onClose}
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

        <div className="mt-8 pt-6 border-t border-gyr-border-light flex gap-4">
          {["Buscar", "Carrito", "Mi Cuenta"].map((item) => (
            <a
              key={item}
              href="#"
              className="border-b-2 border-gyr-primary px-4 py-3 text-sm font-bold text-gyr-primary-strong transition-colors duration-200 hover:bg-gyr-border-light focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
            >
              {item}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function MobileMenuTrigger({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) {
  return (
    <button
      onClick={() => setIsOpen(true)}
      aria-expanded={isOpen}
      className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg p-2 text-gyr-heading transition-colors hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
      aria-label="Abrir menú móvil"
    >
      <MenuIcon className="w-6 h-6" aria-hidden="true" />
    </button>
  );
}
