"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [flipped, setFlipped] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/[.8] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[380px] h-[520px] mx-auto perspective-1200"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`relative w-full h-full transition-transform duration-800 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform-style-preserve-3d ${
            flipped ? "rotate-y-180" : ""
          }`}
        >
          {/* Cara Login */}
          <div
            className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-[24px] border border-black/[.05] shadow-auth p-10 flex flex-col"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gyr-heading transition-colors z-20"
              aria-label="Cerrar"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex-1 flex flex-col items-center justify-center pt-4">
              <h2 className="text-2xl font-bold text-gyr-heading mb-6 text-center">
                Iniciar Sesión
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
                className="w-full space-y-4"
              >
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    required
                    className="w-full px-4 py-3 border border-gyr-surface-editable rounded-lg bg-gyr-surface-alt focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 border border-gyr-surface-editable rounded-lg bg-gyr-surface-alt focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-gyr-primary to-gyr-primary-hover text-white font-bold py-3 rounded-lg shadow-auth-btn hover:shadow-[0_6px_20px_rgba(37,211,102,0.4)] transition-all duration-300"
                >
                  Entrar
                </button>
                <p className="mt-4 text-sm text-gyr-text text-center">
                  ¿No tienes cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => setFlipped(true)}
                    className="text-gyr-primary font-semibold hover:underline"
                  >
                    Regístrate
                  </button>
                </p>
              </form>
            </div>
          </div>

          {/* Cara Register */}
          <div
            className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-[24px] border border-black/[.05] shadow-auth p-10 flex flex-col transform rotate-y-180"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gyr-heading transition-colors z-20"
              aria-label="Cerrar"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex-1 flex flex-col items-center justify-center pt-4">
              <h2 className="text-2xl font-bold text-gyr-heading mb-6 text-center">
                Crear Cuenta
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
                className="w-full space-y-4"
              >
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Juan Pérez"
                    required
                    className="w-full px-4 py-3 border border-gyr-surface-editable rounded-lg bg-gyr-surface-alt focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    required
                    className="w-full px-4 py-3 border border-gyr-surface-editable rounded-lg bg-gyr-surface-alt focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 border border-gyr-surface-editable rounded-lg bg-gyr-surface-alt focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-gyr-primary to-gyr-primary-hover text-white font-bold py-3 rounded-lg shadow-auth-btn hover:shadow-[0_6px_20px_rgba(37,211,102,0.4)] transition-all duration-300"
                >
                  Registrarse
                </button>
                <p className="mt-4 text-sm text-gyr-text text-center">
                  ¿Ya tienes cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => setFlipped(false)}
                    className="text-gyr-primary font-semibold hover:underline"
                  >
                    Inicia sesión
                  </button>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
