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
  const [sessionRefresh, setSessionRefresh] = useState(0);

  return (
    <header id="masthead" className="site-header bg-white border-b border-gyr-border sticky top-0 z-40 shadow-xs">
      <div className="container header-container px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="site-branding flex items-center gap-3 md:flex-shrink-0">
          <Logo />
        </div>

        {/* `Navigation` ya renderiza su propio <nav>: evita dos landmarks sin nombre. */}
        <Navigation />

        <div className="header-actions flex items-center gap-4 md:gap-6">
          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gyr-heading transition-colors duration-300 hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
            aria-label="Buscar"
          >
            <SearchIcon className="w-5 h-5" aria-hidden="true" />
          </button>

          <CartDropdown
            isOpen={cartOpen}
            onToggle={() => setCartOpen(!cartOpen)}
          />

          <UserAccess
            onOpen={() => setAuthModalOpen(true)}
            refreshToken={sessionRefresh}
          />

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

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setSessionRefresh((current) => current + 1)}
      />
    </header>
  );
}
