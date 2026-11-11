"use client";

import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";

import { Logo } from "./logo";
import { Navigation } from "./navigation";
import { MobileMenu, MobileMenuTrigger } from "./mobile-menu";
import { SearchModal } from "../ui/search";
import { CartDropdown } from "../ui/cart";
import { UserAccess } from "./user-access";
import { AuthModal } from "../ui/auth-modal";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <header id="masthead" className="site-header bg-white border-b border-gyr-border sticky top-0 z-40 shadow-xs">
      <div className="container header-container px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="site-branding flex items-center gap-3 md:flex-shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="mobile-menu-trigger md:hidden p-2"
            aria-label="Abrir menú"
          >
            <img src="/images/barra-de-menus.png" alt="Menú" className="w-6 h-auto" />
          </button>
          <Logo />
        </div>

        <nav className="hidden md:flex">
          <Navigation />
        </nav>

        <div className="header-actions flex items-center gap-4 md:gap-6">
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg text-gyr-heading hover:text-gyr-primary transition-colors duration-300"
            aria-label="Buscar"
          >
            <SearchIcon className="w-5 h-5" />
          </button>

          <CartDropdown
            isOpen={cartOpen}
            onToggle={() => setCartOpen(!cartOpen)}
          />

          <UserAccess onOpen={() => setAuthModalOpen(true)} />

          <MobileMenuTrigger
            isOpen={mobileMenuOpen}
            setIsOpen={setMobileMenuOpen}
          />
        </div>
      </div>

      {mobileMenuOpen && (
        <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      )}

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </header>
  );
}
