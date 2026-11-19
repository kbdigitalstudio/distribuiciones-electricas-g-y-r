"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid, Package } from "lucide-react";

/** Slugs de categoría que tienen página propia en el sitio. */
const CATEGORY_PAGE_SLUGS = new Set([
  "alta-tension",
  "media-tension",
  "baja-tension",
  "conductores-electricos",
  "tuberia",
  "transformadores",
  "interruptores-tomacorrientes",
  "maniobra",
  "medidores-energia",
  "puesta-tierra",
  "herrajeria",
  "cajas-tableros",
  "accesorios-red-ecologica",
  "accesorios-red-trenzada",
]);

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
}

interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  category?: { id: string } | null;
}

export interface MenuProduct {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  products: MenuProduct[];
}

interface MenuData {
  categories: MenuCategory[];
  productTotal: number;
}

type MenuStatus = "idle" | "loading" | "ready" | "error";

const LOAD_ERROR_MESSAGE = "No pudimos cargar las categorías.";
const EMPTY_MESSAGE = "Próximamente: estamos organizando nuestro catálogo.";

/** Caché en memoria del cliente: las 2 peticiones solo se hacen una vez. */
let cachedData: MenuData | null = null;
let pendingRequest: Promise<MenuData> | null = null;

function categoryHref(slug: string): string {
  return CATEGORY_PAGE_SLUGS.has(slug) ? `/${slug}` : "/catalogo";
}

async function requestMenuData(): Promise<MenuData> {
  const [categoriesResponse, productsResponse] = await Promise.all([
    fetch("/api/categories?parentId=&pageSize=100", {
      credentials: "same-origin",
    }),
    fetch("/api/products?pageSize=100", { credentials: "same-origin" }),
  ]);

  if (!categoriesResponse.ok || !productsResponse.ok) {
    throw new Error(LOAD_ERROR_MESSAGE);
  }

  const categoriesPayload = (await categoriesResponse.json()) as {
    categories?: ApiCategory[];
  };
  const productsPayload = (await productsResponse.json()) as {
    products?: ApiProduct[];
  };

  const productsByCategory = new Map<string, MenuProduct[]>();
  for (const product of productsPayload.products ?? []) {
    const categoryId = product.category?.id;
    if (!categoryId) continue;
    const current = productsByCategory.get(categoryId) ?? [];
    productsByCategory.set(categoryId, [
      ...current,
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: product.imageUrl ?? null,
      },
    ]);
  }

  const categories = (categoriesPayload.categories ?? []).map((category) => {
    const products = productsByCategory.get(category.id) ?? [];
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      productCount: category.productCount ?? products.length,
      products,
    };
  });

  return {
    categories,
    productTotal: productsPayload.products?.length ?? 0,
  };
}

/** Carga compartida por el mega-menú de escritorio y el acordeón móvil. */
export function useCategoriesData() {
  const [data, setData] = useState<MenuData | null>(cachedData);
  const [status, setStatus] = useState<MenuStatus>(
    cachedData ? "ready" : "idle",
  );

  const load = useCallback(async () => {
    if (cachedData) {
      setData(cachedData);
      setStatus("ready");
      return;
    }

    if (!pendingRequest) {
      pendingRequest = requestMenuData()
        .then((result) => {
          cachedData = result;
          return result;
        })
        .finally(() => {
          pendingRequest = null;
        });
    }

    setStatus("loading");
    try {
      const result = await pendingRequest;
      setData(result);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  return {
    categories: data?.categories ?? [],
    productTotal: data?.productTotal ?? 0,
    status,
    load,
  };
}

function ProductThumbnail({ product }: { product: MenuProduct }) {
  if (!product.imageUrl) {
    return (
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gyr-surface-alt"
      >
        <Package className="h-5 w-5 text-gyr-text" />
      </span>
    );
  }

  return (
    <img
      src={product.imageUrl}
      alt=""
      className="h-10 w-10 shrink-0 rounded-lg bg-gyr-surface-alt object-contain"
    />
  );
}

function ProductLinks({ products }: { products: MenuProduct[] }) {
  return (
    <ul className="divide-y divide-gyr-border-light">
      {products.map((product) => (
        <li key={product.id}>
          <Link
            href={`/producto/${product.slug}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-gyr-text transition-colors duration-200 hover:bg-gyr-surface-alt hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
          >
            <ProductThumbnail product={product} />
            <span className="font-medium">{product.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-gyr-danger px-4 text-sm font-semibold text-gyr-danger transition-colors hover:bg-gyr-danger-bg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
    >
      Reintentar
    </button>
  );
}

function EmptyState() {
  return (
    <div className="px-3 py-4 text-sm text-gyr-text">
      <p>{EMPTY_MESSAGE}</p>
      <Link
        href="/catalogo"
        className="mt-2 inline-flex min-h-[44px] items-center font-semibold text-gyr-primary-strong hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
      >
        Ver catálogo
      </Link>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2 p-1" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="h-10 animate-pulse rounded-lg bg-gyr-border-light" />
      ))}
    </div>
  );
}

/** Mega-menú de escritorio: 14 categorías (nivel 1) + productos (nivel 2). */
export function CategoriesMenu() {
  const router = useRouter();
  const { categories, productTotal, status, load } = useCategoriesData();
  const [open, setOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  // Clic fuera del panel lo cierra.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const resolvedActiveId = activeCategoryId ?? categories[0]?.id ?? null;
  const activeCategory =
    categories.find((category) => category.id === resolvedActiveId) ?? null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    // Sin `relative`: el panel se ancla al header (sticky) y ocupa todo su ancho.
    <div onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="categories-menu"
        aria-haspopup="true"
        className="inline-flex min-h-[44px] items-center gap-1 py-2 text-sm font-semibold uppercase text-gyr-text transition-colors duration-300 hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        Categorías
      </button>

      {open ? (
        <div
          id="categories-menu"
          ref={panelRef}
          aria-busy={status === "loading"}
          className="absolute inset-x-0 top-full z-50 rounded-b-2xl border-b border-gyr-border bg-white text-gyr-text font-normal normal-case shadow-md"
        >
          <div className="container px-4 py-6">
            <div className="grid grid-cols-[280px_1fr] gap-6">
              <div className="max-h-[420px] overflow-y-auto pr-2">
                {status === "loading" || status === "idle" ? (
                  <SkeletonList />
                ) : null}

                {status === "error" ? (
                  <div className="px-3 py-4 text-sm text-gyr-danger">
                    <p>{LOAD_ERROR_MESSAGE}</p>
                    <RetryButton onRetry={() => void load()} />
                  </div>
                ) : null}

                {status === "ready" && categories.length === 0 ? (
                  <EmptyState />
                ) : null}

                {status === "ready" && categories.length > 0 ? (
                  <ul className="space-y-1">
                    {categories.map((category) => {
                      const isActive = category.id === resolvedActiveId;
                      return (
                        <li key={category.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setActiveCategoryId(category.id)}
                            onFocus={() => setActiveCategoryId(category.id)}
                            onClick={() => {
                              setOpen(false);
                              router.push(categoryHref(category.slug));
                            }}
                            aria-expanded={isActive}
                            aria-controls="categories-flyout"
                            className={`flex w-full items-center justify-between gap-3 rounded-lg py-2.5 pl-3 pr-3 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)] ${
                              isActive
                                ? "border-l-2 border-gyr-primary-strong bg-gyr-surface-alt pl-[10px] text-gyr-primary-strong"
                                : "border-l-2 border-transparent text-gyr-heading hover:bg-gyr-surface-alt hover:text-gyr-primary-strong"
                            }`}
                          >
                            <span>{category.name}</span>
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="rounded-full bg-gyr-border-light px-2 py-0.5 text-xs text-gyr-text"
                              >
                                {category.productCount}
                              </span>
                              <span className="sr-only">
                                {category.productCount} productos
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              <div
                id="categories-flyout"
                className="border-l border-gyr-border-light pl-6"
              >
                {activeCategory ? (
                  <>
                    <h3 className="text-sm font-semibold uppercase text-gyr-heading">
                      {activeCategory.name}
                    </h3>
                    {activeCategory.products.length > 0 ? (
                      <ProductLinks products={activeCategory.products} />
                    ) : (
                      <p className="mt-2 text-sm text-gyr-text">
                        Esta categoría está en preparación.{" "}
                        <Link
                          href="/catalogo"
                          className="font-semibold text-gyr-primary-strong hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
                        >
                          Ver catálogo
                        </Link>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gyr-text">
                    Selecciona una categoría para ver sus productos.
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            {status === "ready"
              ? `Categorías cargadas: ${categories.length} categorías, ${productTotal} productos`
              : status === "error"
                ? LOAD_ERROR_MESSAGE
                : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Acordeón de categorías para el drawer móvil. */
export function CategoryAccordion() {
  const { categories, status, load } = useCategoriesData();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      {status === "loading" || status === "idle" ? (
        <SkeletonList />
      ) : null}

      {status === "error" ? (
        <div className="text-sm text-gyr-danger">
          <p>{LOAD_ERROR_MESSAGE}</p>
          <RetryButton onRetry={() => void load()} />
        </div>
      ) : null}

      {status === "ready" && categories.length === 0 ? (
        <EmptyState />
      ) : null}

      {status === "ready" && categories.length > 0 ? (
        <ul>
          {categories.map((category) => {
            const isExpanded = category.id === expandedId;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : category.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`mobile-category-${category.id}`}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 border-b border-gyr-border-light px-4 py-3 text-left text-sm font-medium text-gyr-heading transition-colors duration-200 hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
                >
                  <span>{category.name}</span>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="rounded-full bg-gyr-border-light px-2 py-0.5 text-xs text-gyr-text"
                    >
                      {category.productCount}
                    </span>
                    <span className="sr-only">
                      {category.productCount} productos
                    </span>
                  </span>
                </button>
                <ul
                  id={`mobile-category-${category.id}`}
                  hidden={!isExpanded}
                  className="border-l-2 border-gyr-border-light pl-4"
                >
                  {category.products.length > 0 ? (
                    category.products.map((product) => (
                      <li key={product.id}>
                        <Link
                          href={`/producto/${product.slug}`}
                          className="flex min-h-[44px] items-center gap-3 py-2 text-sm text-gyr-text transition-colors duration-200 hover:text-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
                        >
                          <ProductThumbnail product={product} />
                          <span className="font-medium">{product.name}</span>
                        </Link>
                      </li>
                    ))
                  ) : (
                    <li className="py-2 text-sm text-gyr-text">
                      En preparación.{" "}
                      <Link
                        href="/catalogo"
                        className="font-semibold text-gyr-primary-strong hover:underline"
                      >
                        Ver catálogo
                      </Link>
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
