"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import {
  authErrorMessage,
  buildAuthPayload,
  validateAuthForm,
  type AuthFormValues,
  type AuthMode,
} from "@/lib/auth-form";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se invoca tras un login/registro exitoso para refrescar la sesión del header. */
  onSuccess?: () => void;
}

type AuthField = keyof AuthFormValues;

interface FieldConfig {
  key: AuthField;
  id: string;
  label: string;
  type: string;
  autoComplete: string;
}

const LOGIN_FIELDS: FieldConfig[] = [
  {
    key: "email",
    id: "auth-email",
    label: "Correo electrónico",
    type: "email",
    autoComplete: "email",
  },
  {
    key: "password",
    id: "auth-password",
    label: "Contraseña",
    type: "password",
    autoComplete: "current-password",
  },
];

const REGISTER_FIELDS: FieldConfig[] = [
  {
    key: "nombre",
    id: "auth-nombre",
    label: "Nombre completo",
    type: "text",
    autoComplete: "name",
  },
  {
    key: "email",
    id: "auth-email",
    label: "Correo electrónico",
    type: "email",
    autoComplete: "email",
  },
  {
    key: "password",
    id: "auth-password",
    label: "Contraseña",
    type: "password",
    autoComplete: "new-password",
  },
  {
    key: "telefono",
    id: "auth-telefono",
    label: "Teléfono",
    type: "tel",
    autoComplete: "tel",
  },
  {
    key: "direccion",
    id: "auth-direccion",
    label: "Dirección",
    type: "text",
    autoComplete: "street-address",
  },
  {
    key: "ciudad",
    id: "auth-ciudad",
    label: "Ciudad",
    type: "text",
    autoComplete: "address-level2",
  },
  {
    key: "departamento",
    id: "auth-departamento",
    label: "Departamento",
    type: "text",
    autoComplete: "address-level1",
  },
];

const INPUT_CLASS =
  "w-full px-3 py-2.5 min-h-[44px] border border-gyr-surface-editable rounded-lg bg-gyr-surface-alt text-gyr-heading placeholder:text-gyr-text/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]";

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [values, setValues] = useState<AuthFormValues>({
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<AuthField, string>>
  >({});
  const [generalError, setGeneralError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const fields = mode === "login" ? LOGIN_FIELDS : REGISTER_FIELDS;

  // Guarda el elemento que tenía el foco al abrir y lo devuelve al cerrar.
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      return;
    }

    const previous = previouslyFocusedRef.current;
    previouslyFocusedRef.current = null;
    if (previous && document.contains(previous)) {
      previous.focus();
    }
  }, [isOpen]);

  // El foco entra al primer campo del panel activo (al abrir y al cambiar de modo).
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, mode]);

  // El overlay no debe dejar scrollear el body con el modal abierto.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleChange = (key: AuthField, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFieldErrors({});
    setGeneralError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const errors = validateAuthForm(mode, values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError("");
      return;
    }

    setFieldErrors({});
    setGeneralError("");
    setSubmitting(true);

    try {
      const response = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(buildAuthPayload(mode, values)),
        },
      );

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setGeneralError(authErrorMessage(response.status, body));
        return;
      }

      showToast(mode === "login" ? "Sesión iniciada" : "Cuenta creada");
      onSuccess?.();
      onClose();
    } catch {
      setGeneralError(authErrorMessage(500, null));
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onKeyDown={handleKeyDown}
        className="flex max-h-[90vh] w-full max-w-[380px] flex-col overflow-hidden rounded-3xl border border-gyr-border-light bg-white shadow-auth"
      >
        <div className="relative shrink-0 px-6 pt-6 pb-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-gyr-text transition-colors hover:bg-gyr-surface-alt hover:text-gyr-heading focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
          <h2
            id="auth-title"
            className="pr-11 text-xl font-bold text-gyr-heading"
          >
            {mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
          </h2>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 pb-6">
          <form onSubmit={handleSubmit} aria-busy={submitting} noValidate>
            <div className="space-y-4 pt-2">
              {fields.map((field, index) => {
                const error = fieldErrors[field.key];
                return (
                  <div key={field.id} className="space-y-1">
                    <label
                      htmlFor={field.id}
                      className="block text-sm font-medium text-gyr-heading"
                    >
                      {field.label}
                    </label>
                    <input
                      ref={index === 0 ? firstFieldRef : undefined}
                      id={field.id}
                      name={field.key}
                      type={field.type}
                      value={values[field.key] ?? ""}
                      autoComplete={field.autoComplete}
                      onChange={(event) =>
                        handleChange(field.key, event.target.value)
                      }
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${field.id}-error` : undefined}
                      className={INPUT_CLASS}
                    />
                    {error ? (
                      <p id={`${field.id}-error`} className="text-sm text-gyr-danger">
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {generalError ? (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-gyr-danger-bg p-3 text-sm text-gyr-danger"
              >
                {generalError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-gyr-primary-strong px-4 font-semibold text-white shadow-btn-primary transition-colors duration-200 hover:bg-gyr-primary-strong/90 disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {submitting
                ? "Enviando…"
                : mode === "login"
                  ? "Entrar"
                  : "Crear cuenta"}
            </button>

            <p className="mt-4 text-center text-sm text-gyr-text">
              {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
              <button
                type="button"
                onClick={() =>
                  switchMode(mode === "login" ? "register" : "login")
                }
                className="inline-flex min-h-[44px] items-center px-1 font-semibold text-gyr-primary-strong hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
              >
                {mode === "login" ? "Regístrate" : "Inicia sesión"}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
