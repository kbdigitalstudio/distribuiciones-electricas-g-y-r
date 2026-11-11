"use client";

import { useState } from "react";
import { X, Menu as MenuIcon } from "lucide-react";

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
    >
      <div className="px-6 py-4 flex items-center justify-between border-b border-gyr-border-light">
        <button
          onClick={onClose}
          className="text-gyr-text hover:text-gyr-primary transition-colors"
          aria-label="Cerrar menú"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-1 px-6 py-6 space-y-4">
        <ul className="flex flex-col gap-1">
          {MENU_ITEMS.map((item) => (
            <li key={item.name}>
              <a
                href={item.href}
                className="block px-4 py-3 text-base font-semibold border-b border-gyr-border-light hover:bg-gyr-border-light hover:text-gyr-primary transition-colors duration-200"
              >
                {item.name}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-8 pt-6 border-t border-gyr-border-light">
          <h3 className="text-xs font-semibold uppercase text-gyr-text mb-4">
            Productos
          </h3>
          <ul className="flex flex-col gap-1">
            {[
            { name: "Alta Tensión", href: "/alta-tension" },
            { name: "Media Tensión", href: "/media-tension" },
            { name: "Baja Tensión", href: "/baja-tension" },
            { name: "Conductores Eléctricos", href: "/conductores-electricos" },
            { name: "Tubería", href: "/tuberia" },
            { name: "Aislamiento y Protección", href: "/aislamiento-proteccion" },
            { name: "Transformadores", href: "/transformadores" },
            { name: "Puesta a Tierra", href: "/puesta-tierra" },
            { name: "Herrajería", href: "/herrajeria" },
            { name: "Cajas y Tableros", href: "/cajas-tableros" },
            { name: "Maniobra", href: "/maniobra" },
            { name: "Medidores de Energía", href: "/medidores-energia" },
            { name: "Accesorios Red Ecológica", href: "/accesorios-red-ecologica" },
            { name: "Accesorios Red Trenzada", href: "/accesorios-red-trenzada" },
            { name: "Interruptores y Tomacorrientes", href: "/interruptores-tomacorrientes" },
          ].map((cat) => (
              <li key={cat.name}>
                <a
                  href={cat.href}
                  className="block px-4 py-3 text-sm text-gyr-text border-b border-gyr-border-light hover:bg-gyr-border-light hover:text-gyr-primary transition-colors duration-200"
                >
                  {cat.name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 pt-6 border-t border-gyr-border-light flex gap-4">
          {["Buscar", "Carrito", "Mi Cuenta"].map((item) => (
            <a
              key={item}
              href="#"
              className="px-4 py-3 text-sm font-bold text-gyr-primary border-b-2 border-gyr-primary hover:bg-gyr-border-light transition-colors duration-200"
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
      className="md:hidden p-2 text-gyr-heading hover:text-gyr-primary transition-colors"
      aria-label="Abrir menú móvil"
    >
      <MenuIcon className="w-6 h-6" />
    </button>
  );
}
