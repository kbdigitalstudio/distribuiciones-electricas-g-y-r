"use strict";

import Link from "next/link";

import { CategoriesMenu } from "./categories-menu";

const NAV_ITEMS = [
  { name: "Inicio", href: "/" },
  { name: "Nosotros", href: "/nosotros" },
  { name: "Contacto", href: "/contacto" },
  { name: "Catálogo", href: "/catalogo" },
];

export function Navigation() {
  return (
    <nav id="site-navigation" className="main-navigation hidden md:flex gap-8 items-center">
      <ul className="flex gap-8 text-sm font-semibold uppercase text-gyr-heading">
        {NAV_ITEMS.map((item) => (
          <li key={item.name}>
            <Link
              href={item.href}
              className="inline-flex min-h-[44px] items-center text-gyr-text transition-colors duration-300 hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
            >
              {item.name}
            </Link>
          </li>
        ))}
        <li>
          <CategoriesMenu />
        </li>
      </ul>
    </nav>
  );
}
