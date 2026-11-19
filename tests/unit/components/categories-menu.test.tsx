// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
}));

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      href,
      children,
      className,
      ...rest
    }: {
      href: string;
      children?: import("react").ReactNode;
      className?: string;
    }) => createElement("a", { href, className, ...rest }, children),
  };
});

type CategoriesModule = typeof import("@/components/layout/categories-menu");

const CATEGORIES_PAYLOAD = {
  success: true,
  categories: [
    {
      id: "cat-1",
      name: "Alta Tensión",
      slug: "alta-tension",
      productCount: 2,
    },
    {
      id: "cat-2",
      name: "Herrajería",
      slug: "herrajeria",
      productCount: 0,
    },
  ],
};

const PRODUCTS_PAYLOAD = {
  success: true,
  products: [
    {
      id: "prd-1",
      slug: "cable",
      name: "Cable de potencia",
      imageUrl: null,
      category: { id: "cat-1" },
    },
    {
      id: "prd-2",
      slug: "poste",
      name: "Poste metálico",
      imageUrl: null,
      category: { id: "cat-1" },
    },
    {
      id: "prd-3",
      slug: "sin-categoria",
      name: "Producto sin categoría",
      imageUrl: null,
      category: null,
    },
    {
      id: "prd-4",
      slug: "sin-clave",
      name: "Producto sin clave de categoría",
      imageUrl: null,
    },
  ],
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

/**
 * El menú guarda la respuesta en una caché a nivel de módulo: cada prueba
 * necesita una instancia nueva del módulo para no heredar datos previos.
 */
async function importFreshModule(): Promise<CategoriesModule> {
  vi.resetModules();
  return import("@/components/layout/categories-menu");
}

describe("CategoriesMenu", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/categories")) {
        return jsonResponse(CATEGORIES_PAYLOAD);
      }
      return jsonResponse(PRODUCTS_PAYLOAD);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("agrupa los productos por category.id e ignora los que no tienen categoría", async () => {
    const { CategoryAccordion } = await importFreshModule();

    render(<CategoryAccordion />);

    const categoryButton = await screen.findByRole("button", {
      name: /Alta Tensión/,
    });

    const categoryItem = categoryButton.closest("li");
    const productLinks = Array.from(
      categoryItem?.querySelectorAll<HTMLAnchorElement>(
        "a[href^='/producto/']",
      ) ?? [],
    );

    expect(productLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/producto/cable",
      "/producto/poste",
    ]);

    expect(screen.queryByText("Producto sin categoría")).toBeNull();
    expect(screen.queryByText("Producto sin clave de categoría")).toBeNull();
  });

  it("hace solo dos peticiones aunque el menú y el acordeón se monten a la vez", async () => {
    const { CategoriesMenu, CategoryAccordion } = await importFreshModule();

    render(
      <>
        <CategoriesMenu />
        <CategoryAccordion />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Categorías" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain("/api/categories?parentId=&pageSize=100");
    expect(urls).toContain("/api/products?pageSize=100");
  });

  it("muestra el error y permite reintentar hasta cargar las categorías", async () => {
    let attempts = 0;

    fetchMock.mockImplementation(async (url: string) => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("fallo de red");
      }
      if (url.startsWith("/api/categories")) {
        return jsonResponse(CATEGORIES_PAYLOAD);
      }
      return jsonResponse(PRODUCTS_PAYLOAD);
    });

    const { CategoryAccordion } = await importFreshModule();

    render(<CategoryAccordion />);

    expect(
      await screen.findByText("No pudimos cargar las categorías."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByRole("button", { name: /Alta Tensión/ }),
    ).toBeTruthy();
    expect(
      screen.queryByText("No pudimos cargar las categorías."),
    ).toBeNull();
  });

  it("muestra el estado vacío con enlace al catálogo", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/categories")) {
        return jsonResponse({ success: true, categories: [] });
      }
      return jsonResponse({ success: true, products: [] });
    });

    const { CategoryAccordion } = await importFreshModule();

    render(<CategoryAccordion />);

    expect(await screen.findByText(/Próximamente/)).toBeTruthy();

    const catalogLink = screen.getByRole("link", { name: "Ver catálogo" });
    expect(catalogLink.getAttribute("href")).toBe("/catalogo");
  });
});
