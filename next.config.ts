import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Tailwind CSS 4 no se procesa por sí solo con Turbopack: hay que registrar
  // el loader oficial. Sin esta regla, `@import "tailwindcss"` y `@theme`
  // llegan al navegador sin compilar y no se genera ninguna utilidad.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
