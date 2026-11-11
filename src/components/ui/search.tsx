"use client";

import { useState } from "react";

export function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/[.8] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative bg-white w-full max-w-lg p-6 rounded-3xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gyr-heading transition-colors"
          aria-label="Cerrar buscador"
        >
          ×
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="flex gap-3"
        >
          <input
            type="search"
            placeholder="Buscar productos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-3 border-2 border-gyr-border rounded-xl text-base focus:outline-none focus:border-gyr-primary bg-gyr-surface-light transition-all duration-300"
          />
          <button
            type="submit"
            className="bg-gyr-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-gyr-primary-hover transition-colors duration-300"
          >
            Buscar
          </button>
        </form>
      </div>
    </div>
  );
}
