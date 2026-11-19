"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

interface SessionUser {
  id: string;
  nombre: string | null;
  email: string;
}

/** Estados posibles de la comprobación de sesión. */
type SessionStatus = "loading" | "authenticated" | "anonymous" | "error";

interface SessionResult {
  user: SessionUser | null;
  status: SessionStatus;
}

interface UserAccessProps {
  onOpen?: () => void;
  /** Cambia cuando la sesión se renueva (login/registro exitoso) para refrescar el estado. */
  refreshToken?: number;
}

/** La cookie CSRF no es httpOnly: el cliente la lee y la envía en `x-csrf-token`. */
const CSRF_COOKIE_NAME = "gyr_csrf_token";

function readCookie(name: string): string | null {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

export function UserAccess({ onOpen, refreshToken = 0 }: UserAccessProps) {
  const { showToast } = useToast();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestIdRef = useRef(0);

  const loadSession = useCallback(async (): Promise<SessionResult> => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
      });

      if (response.status === 401) {
        return { user: null, status: "anonymous" };
      }

      if (!response.ok) {
        return { user: null, status: "error" };
      }

      const body = (await response.json()) as { user?: SessionUser };
      const sessionUser = body.user ?? null;
      return {
        user: sessionUser,
        status: sessionUser ? "authenticated" : "anonymous",
      };
    } catch {
      return { user: null, status: "error" };
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const result = await loadSession();
    // Una respuesta obsoleta no puede pisar a la más reciente.
    if (requestIdRef.current !== requestId) return;
    setUser(result.user);
    setStatus(result.status);
  }, [loadSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession, refreshToken]);

  // Cierra el menú de cuenta al hacer clic fuera o al pulsar Escape.
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const csrfToken = readCookie(CSRF_COOKIE_NAME);
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });

      if (!response.ok) {
        showToast("No se pudo cerrar la sesión.");
        return;
      }

      showToast("Sesión cerrada");
      setMenuOpen(false);
      const result = await loadSession();
      setUser(result.user);
      setStatus(result.status);
    } catch {
      showToast("No se pudo cerrar la sesión.");
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = user?.nombre ?? user?.email ?? "";
  const isAuthenticated = status === "authenticated" && user !== null;

  const buttonLabel = isAuthenticated
    ? `Cuenta de ${displayName}`
    : status === "loading"
      ? "Comprobando sesión"
      : status === "error"
        ? "Error de sesión"
        : "Iniciar sesión";

  const handleClick = () => {
    if (status === "loading") return;
    if (status === "error") {
      setStatus("loading");
      void refreshSession();
      return;
    }
    if (isAuthenticated) {
      setMenuOpen((current) => !current);
      return;
    }
    onOpen?.();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        aria-label={buttonLabel}
        aria-busy={status === "loading"}
        aria-expanded={isAuthenticated ? menuOpen : undefined}
        aria-controls={isAuthenticated ? "user-session-menu" : undefined}
        disabled={status === "loading"}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg p-2 text-gyr-heading transition-colors duration-300 hover:text-gyr-primary-strong disabled:cursor-wait disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
      >
        <UserIcon className="w-5 h-5" aria-hidden="true" />
        {isAuthenticated ? (
          <span className="hidden max-w-[140px] truncate text-sm font-medium lg:inline">
            {displayName}
          </span>
        ) : null}
      </button>

      {isAuthenticated && menuOpen ? (
        <div
          id="user-session-menu"
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
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-3 text-sm text-gyr-heading transition-colors hover:bg-gyr-surface-alt hover:text-gyr-primary-strong disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
