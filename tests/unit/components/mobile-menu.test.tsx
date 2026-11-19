// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { MobileMenu, MobileMenuTrigger } from "@/components/layout/mobile-menu";

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
      children?: ReactNode;
      className?: string;
    }) => createElement("a", { href, className, ...rest }, children),
  };
});

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true");
}

function MenuHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <MobileMenuTrigger isOpen={isOpen} setIsOpen={setIsOpen} />
      <MobileMenu isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

describe("MobileMenu", () => {
  beforeEach(() => {
    // El acordeón de categorías queda en estado de carga: el drawer no depende
    // de datos de red para probar el foco y el diálogo.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("expone el drawer como diálogo modal con id mobile-navigation", () => {
    render(
      <MobileMenu isOpen onClose={() => undefined} />,
    );

    const drawer = screen.getByRole("dialog");

    expect(drawer).toBeTruthy();
    expect(drawer.getAttribute("id")).toBe("mobile-navigation");
    expect(drawer.getAttribute("aria-modal")).toBe("true");
  });

  it("mueve el foco al botón Cerrar menú al abrir el drawer", async () => {
    render(<MenuHarness />);

    fireEvent.click(screen.getByRole("button", { name: /abrir menú móvil/i }));

    const closeButton = await screen.findByRole("button", {
      name: "Cerrar menú",
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });
  });

  it("mantiene el foco dentro del drawer al tabular y al tabular hacia atrás", async () => {
    render(<MenuHarness />);

    fireEvent.click(screen.getByRole("button", { name: /abrir menú móvil/i }));

    const drawer = await screen.findByRole("dialog");
    const focusables = getFocusableElements(drawer);

    expect(focusables.length).toBeGreaterThan(1);

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;

    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: "Tab" });

    await waitFor(() => {
      expect(document.activeElement).toBe(first);
      expect(drawer.contains(document.activeElement)).toBe(true);
    });

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });

    await waitFor(() => {
      expect(document.activeElement).toBe(last);
      expect(drawer.contains(document.activeElement)).toBe(true);
    });
  });

  it("cierra con Escape y devuelve el foco al trigger del menú móvil", async () => {
    render(<MenuHarness />);

    fireEvent.click(screen.getByRole("button", { name: /abrir menú móvil/i }));

    const drawer = await screen.findByRole("dialog");

    fireEvent.keyDown(drawer, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    const trigger = document.getElementById("mobile-menu-trigger");

    expect(trigger).not.toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("expone el trigger con aria-controls, aria-expanded e id propios", async () => {
    render(<MenuHarness />);

    const trigger = screen.getByRole("button", { name: /abrir menú móvil/i });

    expect(trigger.getAttribute("id")).toBe("mobile-menu-trigger");
    expect(trigger.getAttribute("aria-controls")).toBe("mobile-navigation");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    await screen.findByRole("dialog");

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});
