// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { AuthModal } from "@/components/ui/auth-modal";

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

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function getForm(): HTMLFormElement {
  const form = document.querySelector("form");
  if (!form) throw new Error("No se encontró el formulario de autenticación");
  return form;
}

function fillInput(label: string, value: string): void {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

function submitForm(): void {
  fireEvent.submit(getForm());
}

function AuthModalHarness({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Abrir
      </button>
      <AuthModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}

describe("AuthModal", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showToast.mockClear();
    fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, { success: true })));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renderiza el diálogo dentro de document.body", () => {
    render(<AuthModal isOpen onClose={() => undefined} />);

    const dialog = screen.getByRole("dialog");

    expect(dialog).toBeTruthy();
    expect(document.body.contains(dialog)).toBe(true);
  });

  it("marca todos los campos como obligatorios", () => {
    render(<AuthModal isOpen onClose={() => undefined} />);

    const inputs = Array.from(
      screen.getByRole("dialog").querySelectorAll("input"),
    );

    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input.hasAttribute("required")).toBe(true);
    }
  });

  it("enfoca el primer campo inválido y muestra el error con role alert", async () => {
    render(<AuthModal isOpen onClose={() => undefined} />);

    fillInput("Correo electrónico", "correo-invalido");
    submitForm();

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]?.textContent?.trim()).not.toBe("");

    const invalidInputs = screen
      .getByRole("dialog")
      .querySelectorAll<HTMLInputElement>('input[aria-invalid="true"]');

    expect(invalidInputs.length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(document.activeElement).toBe(invalidInputs[0]);
    });
  });

  it("cierra con Escape y devuelve el foco al elemento que lo abrió", async () => {
    render(<AuthModalHarness />);

    const trigger = screen.getByRole("button", { name: "Abrir" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("deshabilita el cambio de modo mientras la petición está en vuelo", async () => {
    fetchMock.mockImplementation(
      () => new Promise<Response>(() => undefined),
    );

    render(<AuthModal isOpen onClose={() => undefined} />);

    fillInput("Correo electrónico", "ana@gyr.co");
    fillInput("Contraseña", "secreto123");
    submitForm();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Regístrate" }).hasAttribute("disabled"),
      ).toBe(true);
    });
  });

  it("envía en login solo email y password", async () => {
    render(<AuthModal isOpen onClose={() => undefined} />);

    fillInput("Correo electrónico", "ana@gyr.co");
    fillInput("Contraseña", "secreto123");
    submitForm();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/login");

    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["email", "password"]);
    expect(payload).toEqual({
      email: "ana@gyr.co",
      password: "secreto123",
    });
  });

  it("envía en registro los siete campos exactos", async () => {
    render(<AuthModal isOpen onClose={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Regístrate" }));

    fillInput("Nombre completo", "Ana Pérez");
    fillInput("Correo electrónico", "ana@gyr.co");
    fillInput("Contraseña", "secreto123");
    fillInput("Teléfono", "3001234567");
    fillInput("Dirección", "Calle 1 # 2 - 3");
    fillInput("Ciudad", "Bogotá");
    fillInput("Departamento", "Cundinamarca");

    submitForm();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/register");

    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      "ciudad",
      "departamento",
      "direccion",
      "email",
      "nombre",
      "password",
      "telefono",
    ]);
  });

  it.each([
    [401, "Correo o contraseña incorrectos."],
    [409, "Ese correo ya está registrado."],
    [429, "Demasiados intentos."],
    [500, "No pudimos completar la operación."],
  ])(
    "muestra el error %i con role alert sin cerrar el modal",
    async (status, expectedText) => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse(status, { error: "fallo" })),
      );

      render(<AuthModal isOpen onClose={() => undefined} />);

      fillInput("Correo electrónico", "ana@gyr.co");
      fillInput("Contraseña", "secreto123");
      submitForm();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent ?? "").toContain(expectedText);

      expect(screen.getByRole("dialog")).toBeTruthy();
    },
  );

  it("limpia los campos y vuelve al modo login al reabrirse", async () => {
    render(<AuthModalHarness />);

    const trigger = screen.getByRole("button", { name: "Abrir" });
    fireEvent.click(trigger);

    await screen.findByRole("dialog");

    fillInput("Correo electrónico", "ana@gyr.co");
    fillInput("Contraseña", "secreto123");
    fireEvent.click(screen.getByRole("button", { name: "Regístrate" }));

    expect(
      screen.getByRole("heading", { name: "Crear Cuenta" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    fireEvent.click(trigger);

    await screen.findByRole("dialog");

    expect(screen.getByRole("heading", { name: "Iniciar Sesión" })).toBeTruthy();
    expect((screen.getByLabelText("Correo electrónico") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Contraseña") as HTMLInputElement).value).toBe("");
  });

  it("aborta la petición en vuelo al cerrar el modal", async () => {
    let capturedSignal: AbortSignal | null = null;

    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          capturedSignal = init?.signal ?? null;
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Abortado", "AbortError"));
          });
        }),
    );

    render(<AuthModalHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    fillInput("Correo electrónico", "ana@gyr.co");
    fillInput("Contraseña", "secreto123");
    submitForm();

    await waitFor(() => {
      expect(capturedSignal).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() => {
      expect((capturedSignal as AbortSignal | null)?.aborted).toBe(true);
    });
  });
});
