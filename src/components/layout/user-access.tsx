"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

interface SessionUser {
  id: string;
  nombre: string | null;
  email: string;
}

interface UserAccessProps {
  onOpen?: () => void;
  /** Cambia cuando la sesión se renueva (login/registro exitoso) para refrescar el estado. */
  refreshToken?: number;
}

export function UserAccess({ onOpen, refreshToken = 0 }: UserAccessProps) {
  const { showToast } = useToast();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadSession = useCallback(async (): Promise<SessionUser | null> => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
      });
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as { user?: SessionUser };
      return body.user ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadSession().then((sessionUser) => {
      if (active) setUser(sessionUser);
    });
    return () => {
      active = false;
    };
  }, [loadSession, refreshToken]);

  // Cierra el menú de cuenta al hacer clic fuera o al pulsar Escape.
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      showToast("Sesión cerrada");
    } finally {
      const sessionUser = await loadSession();
      setUser(sessionUser);
    }
  };

  const displayName = user?.nombre ?? user?.email ?? "";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (user ? setMenuOpen((current) => !current) : onOpen?.())}
        aria-label={user ? `Cuenta de ${displayName}` : "Iniciar sesión"}
        aria-expanded={user ? menuOpen : undefined}
        aria-haspopup={user ? "menu" : undefined}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg p-2 text-gyr-heading transition-colors duration-300 hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
      >
        <UserIcon className="w-5 h-5" aria-hidden="true" />
        {user ? (
          <span className="hidden max-w-[140px] truncate text-sm font-medium lg:inline">
            {displayName}
          </span>
        ) : null}
      </button>

      {user && menuOpen ? (
        <div
          role="menu"
          aria-label="Sesión de usuario"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-gyr-border bg-white p-2 shadow-md"
        >
          <div className="border-b border-gyr-border-light px-3 py-2">
            <p className="truncate text-sm font-semibold text-gyr-heading">
              {displayName}
            </p>
            <p className="truncate text-xs text-gyr-text">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            className="mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-3 text-sm text-gyr-heading transition-colors hover:bg-gyr-surface-alt hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
