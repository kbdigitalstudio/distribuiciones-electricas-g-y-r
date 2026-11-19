/**
 * Seed idempotente del catálogo público de GYR.
 *
 * - Fuente de verdad: `src/data/products.ts` (los mismos productos y las mismas
 *   imágenes que las páginas estáticas del sitio).
 * - NO inventa datos comerciales: sin precios, sin SKU, sin stock.
 *   El catálogo muestra "A cotizar" (precio null en la API).
 * - Nunca modifica filas existentes: `update: {}` solo crea lo que falta,
 *   así que se puede ejecutar en cada build sin pisar cambios del equipo.
 *
 * Uso: `npx prisma db seed` (configurado en package.json → prisma.seed).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

/**
 * Categorías = páginas de categoría reales del sitio.
 * `slug` coincide con la ruta pública (`/slug`).
 * `imageUrl` solo cuando el archivo existe en /public/images.
 */
export const CATEGORIES = {
  "Alta Tensión": {
    slug: "alta-tension",
    imageUrl: "/images/alta-tension/alta-tension.jpg",
  },
  "Media Tensión": { slug: "media-tension", imageUrl: null },
  "Baja Tensión": { slug: "baja-tension", imageUrl: null },
  "Conductores Eléctricos": {
    slug: "conductores-electricos",
    imageUrl: "/images/conductores-electricos.png",
  },
  "Transformadores": {
    slug: "transformadores",
    imageUrl: "/images/transformadores.png",
  },
  "Tubería": { slug: "tuberia", imageUrl: "/images/tuberia.png" },
  "Interruptores y Tomacorrientes": {
    slug: "interruptores-tomacorrientes",
    imageUrl: "/images/interruptores-tomacorrientes.png",
  },
  "Maniobra": { slug: "maniobra", imageUrl: "/images/maniobra.png" },
  "Medidores de Energía": {
    slug: "medidores-energia",
    imageUrl: "/images/medidores-energia.png",
  },
  "Puesta a Tierra": {
    slug: "puesta-tierra",
    imageUrl: "/images/puesta-tierra.png",
  },
  "Herrajería": { slug: "herrajeria", imageUrl: "/images/herrajeria.png" },
  "Cajas y Tableros": {
    slug: "cajas-tableros",
    imageUrl: "/images/cajas-tableros.png",
  },
  "Accesorios para Red Ecológica": {
    slug: "accesorios-red-ecologica",
    imageUrl: "/images/accesorios-red-ecologica.png",
  },
  "Accesorios para Red Trenzada": {
    slug: "accesorios-red-trenzada",
    imageUrl: "/images/accesorios-red-trenzada.png",
  },
};

/** Productos que viven en su propia página y no en la categoría de products.ts. */
const PRODUCT_CATEGORY_OVERRIDE = {
  "interruptores-tomacorrientes": "Interruptores y Tomacorrientes",
};

const PRODUCT_PATTERN =
  /slug:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",\s*\n\s*category:\s*"([^"]+)",\s*\n\s*image:\s*"([^"]+)"/g;

/** Lee los productos del archivo de datos del sitio. Lanza si el formato cambió. */
export function parseProducts(source) {
  const products = [...source.matchAll(PRODUCT_PATTERN)].map(
    ([, slug, name, category, imageUrl]) => ({
      slug,
      name,
      category: PRODUCT_CATEGORY_OVERRIDE[slug] ?? category,
      imageUrl,
    })
  );

  if (products.length === 0) {
    throw new Error(
      "Seed abortado: no se leyó ningún producto de src/data/products.ts (cambió el formato)."
    );
  }

  return products;
}

/** Agrupa los productos por categoría y valida que cada categoría exista. */
export function buildSeedPlan(products) {
  const plan = new Map();

  for (const [name, meta] of Object.entries(CATEGORIES)) {
    plan.set(name, { ...meta, name, products: [] });
  }

  for (const product of products) {
    const category = plan.get(product.category);
    if (!category) {
      throw new Error(
        `Seed abortado: el producto "${product.slug}" apunta a la categoría "${product.category}", que no está en CATEGORIES.`
      );
    }
    category.products.push(product);
  }

  return [...plan.values()];
}

async function seed() {
  const require = createRequire(import.meta.url);
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const products = parseProducts(
    readFileSync(join(root, "src", "data", "products.ts"), "utf8")
  );
  const plan = buildSeedPlan(products);

  const idsByCategory = new Map();
  for (const category of plan) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        name: category.name,
        slug: category.slug,
        description: `Explora nuestra línea de productos de ${category.name.toLowerCase()}.`,
        imageUrl: category.imageUrl,
        level: 1,
        isActive: true,
      },
    });
    idsByCategory.set(category.name, row.id);
  }

  let processed = 0;
  for (const category of plan) {
    for (const product of category.products) {
      await prisma.product.upsert({
        where: { slug: product.slug },
        update: {},
        create: {
          name: product.name,
          slug: product.slug,
          imageUrl: product.imageUrl,
          categoryId: idsByCategory.get(category.name),
          isActive: true,
        },
      });
      processed += 1;
    }
  }

  const [categoryCount, productCount] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
  ]);

  console.log(
    `Seed OK: ${plan.length} categorías, ${processed} productos procesados (BD: ${categoryCount} categorías, ${productCount} productos).`
  );

  await prisma.$disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed().catch((error) => {
    console.error("Seed FALLIDO:", error);
    process.exitCode = 1;
  });
}
