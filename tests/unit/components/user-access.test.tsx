// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { UserAccess } from "@/components/layout/user-access";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ showToast }),
}));

const SESSION_USER = {
  id: "usr-1",
  nombre: "Ana Pérez",
  email: "ana@gyr.co",
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

describe("UserAccess", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showToast.mockClear();
    clearCookie("gyr_csrf_token");
    fetchMock = vi.fn(() => Promise.resolve(jsonResponse(401, {})));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("muestra el estado de carga sin ofrecer iniciar sesión", () => {
    fetchMock.mockImplementation(
      () => new Promise<Response>(() => undefined),
    );

    render(<UserAccess />);

    const button = screen.getByRole("button", {
      name: "Comprobando sesión",
    });

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-label")).not.toBe("Iniciar sesión");
  });

  it("consulta /api/auth/me al montar", async () => {
    render(<UserAccess />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/me");
    expect(init.credentials).toBe("same-origin");
  });

  it("muestra Iniciar sesión y abre el modal con 401", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(401, { error: "no sesión" })),
    );

    const onOpen = vi.fn();
    render(<UserAccess onOpen={onOpen} />);

    const button = await screen.findByRole("button", {
      name: "Iniciar sesión",
    });

    fireEvent.click(button);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("muestra un estado de error y reintenta al hacer clic", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(500, { error: "caída" })),
    );

    render(<UserAccess />);

    const button = await screen.findByRole("button", {
      name: /Error/,
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await screen.findByRole("button", { name: /Error/ });
  });

  it("muestra el nombre del usuario cuando la sesión es válida", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { user: SESSION_USER })),
    );

    render(<UserAccess />);

    const button = await screen.findByRole("button", {
      name: "Cuenta de Ana Pérez",
    });

    expect(button.getAttribute("aria-label")).toBe("Cuenta de Ana Pérez");
  });

  it("usa un panel de sesión como disclosure, sin roles de menú", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { user: SESSION_USER })),
    );

    render(<UserAccess />);

    const trigger = await screen.findByRole("button", {
      name: "Cuenta de Ana Pérez",
    });

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });

    expect(trigger.getAttribute("aria-controls")).toBe("user-session-menu");
    expect(document.getElementById("user-session-menu")).not.toBeNull();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.querySelector('[role="menuitem"]')).toBeNull();
  });

  it("cierra el panel con Escape y devuelve el foco al disparador", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { user: SESSION_USER })),
    );

    render(<UserAccess />);

    const trigger = await screen.findByRole("button", {
      name: "Cuenta de Ana Pérez",
    });

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(document.getElementById("user-session-menu")).not.toBeNull();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(document.getElementById("user-session-menu")).toBeNull();
    });

    expect(document.activeElement).toBe(trigger);
  });

  it("envía el token CSRF al cerrar sesión", async () => {
    document.cookie = "gyr_csrf_token=token-de-prueba; path=/";

    let meCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        meCalls += 1;
        return Promise.resolve(
          meCalls === 1
            ? jsonResponse(200, { user: SESSION_USER })
            : jsonResponse(401, {}),
        );
      }
      return Promise.resolve(jsonResponse(200, { success: true }));
    });

    render(<UserAccess />);

    const trigger = await screen.findByRole("button", {
      name: "Cuenta de Ana Pérez",
    });
    fireEvent.click(trigger);

    fireEvent.click(await screen.findByRole("button", { name: /Cerrar sesión/ }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Sesión cerrada");
    });

    const logoutCall = fetchMock.mock.calls.find(
      ([url]) => url === "/api/auth/logout",
    ) as [string, RequestInit] | undefined;

    expect(logoutCall).toBeTruthy();
    expect(logoutCall?.[1].method).toBe("POST");
    expect(logoutCall?.[1].credentials).toBe("same-origin");
    expect(
      (logoutCall?.[1].headers as Record<string, string>)["x-csrf-token"],
    ).toBe("token-de-prueba");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Iniciar sesión" }),
      ).toBeTruthy();
    });
  });

  it("mantiene la sesión y avisa cuando el cierre de sesión falla", async () => {
    let meCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        meCalls += 1;
        return Promise.resolve(
          meCalls === 1
            ? jsonResponse(200, { user: SESSION_USER })
            : jsonResponse(401, {}),
        );
      }
      return Promise.resolve(jsonResponse(500, { error: "no se pudo" }));
    });

    render(<UserAccess />);

    const trigger = await screen.findByRole("button", {
      name: "Cuenta de Ana Pérez",
    });
    fireEvent.click(trigger);

    fireEvent.click(await screen.findByRole("button", { name: /Cerrar sesión/ }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("No se pudo cerrar la sesión.");
    });

    expect(showToast).not.toHaveBeenCalledWith("Sesión cerrada");
    expect(
      screen.getByRole("button", { name: "Cuenta de Ana Pérez" }),
    ).toBeTruthy();
  });
});
