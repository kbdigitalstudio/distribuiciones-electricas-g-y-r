"use strict";

import Link from "next/link";

const NAV_ITEMS = [
  { name: "Inicio", href: "/" },
  { name: "Nosotros", href: "/nosotros" },
  { name: "Contacto", href: "/contacto" },
  { name: "Catálogo", href: "/catalogo" },
];

const PRODUCT_CATEGORIES = [
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
];

export function Navigation() {
  return (
    <nav id="site-navigation" className="main-navigation hidden md:flex gap-8 items-center">
      <ul className="flex gap-8 text-sm font-semibold text-uppercase text-gyr-heading">
        {NAV_ITEMS.map((item) => (
          <li key={item.name}>
            <Link
              href={item.href}
              className="text-gyr-text hover:text-gyr-primary transition-colors duration-300"
            >
              {item.name}
            </Link>
          </li>
        ))}
        <li className="relative group">
          <Link
            href="/alta-tension"
            className="text-gyr-text hover:text-gyr-primary transition-colors duration-300 flex items-center gap-1"
          >
            Productos
          </Link>
          <ul
            className="absolute top-full left-0 mt-2 w-48 bg-white border border-gyr-border rounded-xl shadow-md py-2 flex flex-col gap-0 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-300"
          >
            {PRODUCT_CATEGORIES.map((cat) => (
              <li key={cat.name}>
                <Link
                  href={cat.href}
                  className="block px-5 py-2.5 text-sm text-gyr-text hover:bg-gyr-border-light hover:text-gyr-primary transition-colors duration-200"
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      </ul>
    </nav>
  );
}
