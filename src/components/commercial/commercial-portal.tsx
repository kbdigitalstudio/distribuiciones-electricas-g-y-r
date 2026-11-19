"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Package,
  RefreshCw,
  Users,
} from "lucide-react";

/**
 * Portal comercial progresivo.
 *
 * Consume la API real de la Etapa 4 con la sesión HttpOnly existente. No usa
 * datos de ejemplo: si no hay sesión backend, no consulta ni muestra registros.
 *
 * Alcance de esta integración:
 * - Consulta paginada de cotizaciones, pedidos y clientes autorizados.
 * - Detalle de líneas con precios históricos (snapshots).
 * - Acciones de ciclo de vida permitidas por la API: enviar/aceptar/cancelar
 *   cotizaciones, convertir a pedido y cancelar pedidos pendientes.
 *
 * Pendiente para una siguiente etapa: formularios de alta y edición, y el
 * inicio de sesión del storefront contra /api/auth/login (hoy es local).
 */

const CSRF_COOKIE = "gyr_csrf_token";

type Tab = "quotes" | "orders" | "customers";

interface SessionState {
  status: "loading" | "anonymous" | "authenticated" | "error";
  nombre?: string;
  email?: string;
  roles?: string[];
  error?: string;
}

interface ItemRow {
  id: string;
  productName: string | null;
  productSku: string | null;
  quantity: number;
  unitPriceCents: string;
  subtotalCents: string;
  pricingSource: string;
}

interface QuoteRow {
  id: string;
  quoteNumber: string;
  status: string;
  customer: { displayName: string };
  responsable: { nombre: string };
  subtotalCents: string;
  taxCents: string;
  totalCents: string;
  validUntil: string;
  createdAt?: string;
  isExpired: boolean;
  notes: string | null;
  items?: ItemRow[];
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  customer: { displayName: string };
  responsable: { nombre: string };
  quote: { id: string; quoteNumber: string } | null;
  subtotalCents: string;
  taxCents: string;
  totalCents: string;
  notes: string | null;
  items?: ItemRow[];
}

interface CustomerRow {
  id: string;
  displayName: string;
  personType: string;
  documentType: string;
  documentNumber: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  departamento: string | null;
  isActive: boolean;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
  }
}

const QUOTE_STATUS: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
};

const ORDER_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  FULFILLED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  EXPIRED: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-rose-50 text-rose-700",
  PENDING_PAYMENT: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
  FULFILLED: "bg-blue-50 text-blue-700",
  REFUNDED: "bg-slate-100 text-slate-700",
};

function formatMoney(cents: string): string {
  const value = Number(cents) / 100;

  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`));

  return entry ? decodeURIComponent(entry.slice(CSRF_COOKIE.length + 1)) : null;
}

async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (options.method && options.method !== "GET") {
    const csrf = readCsrfToken();
    if (!csrf) {
      throw new ApiError(
        "No se encontró el token CSRF. Vuelva a iniciar sesión.",
        "CSRF_MISSING",
        403
      );
    }
    headers["x-csrf-token"] = csrf;
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    credentials: "same-origin",
    cache: "no-store",
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    throw new ApiError(
      (payload.error as string) ?? "La operación no pudo completarse",
      (payload.code as string) ?? "ERROR",
      response.status
    );
  }

  return payload as T;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {QUOTE_STATUS[status] ?? ORDER_STATUS[status] ?? status}
    </span>
  );
}

function ItemsTable({ items }: { items?: ItemRow[] }) {
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-gyr-text">Sin líneas registradas para mostrar.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-gyr-border-light text-xs uppercase tracking-wide text-gyr-text">
            <th className="py-2 pr-3 font-semibold">Producto</th>
            <th className="py-2 pr-3 font-semibold">Cantidad</th>
            <th className="py-2 pr-3 font-semibold">Precio unitario</th>
            <th className="py-2 pr-3 font-semibold">Subtotal</th>
            <th className="py-2 font-semibold">Origen</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-gyr-border-light/70 last:border-0"
            >
              <td className="py-2 pr-3">
                <span className="font-medium text-gyr-heading">
                  {item.productName ?? "Producto"}
                </span>
                {item.productSku ? (
                  <span className="ml-2 text-xs text-gyr-text">
                    {item.productSku}
                  </span>
                ) : null}
              </td>
              <td className="py-2 pr-3">{item.quantity}</td>
              <td className="py-2 pr-3">{formatMoney(item.unitPriceCents)}</td>
              <td className="py-2 pr-3">{formatMoney(item.subtotalCents)}</td>
              <td className="py-2">
                {item.pricingSource === "MANUAL" ? "Manual" : "Catálogo"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CommercialPortal() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [tab, setTab] = useState<Tab>("quotes");
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const canSeeCustomers = Boolean(
    session.roles?.includes("ADMIN") || session.roles?.includes("VENDEDOR")
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const data = await apiRequest<{
          user?: { nombre?: string; email?: string; roles?: string[] };
        }>("/api/auth/me");

        if (cancelled) return;

        setSession({
          status: "authenticated",
          nombre: data.user?.nombre,
          email: data.user?.email,
          roles: data.user?.roles ?? [],
        });
      } catch (requestError) {
        if (cancelled) return;

        if (requestError instanceof ApiError && requestError.status === 401) {
          setSession({ status: "anonymous" });
          return;
        }

        setSession({
          status: "error",
          error:
            requestError instanceof Error
              ? requestError.message
              : "No se pudo verificar la sesión",
        });
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (session.status !== "authenticated") return;

    if (tab === "customers" && !canSeeCustomers) {
      setTab("quotes");
      return;
    }

    let cancelled = false;

    async function loadRows() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "10",
        });

        if (search) params.set("search", search);
        if (statusFilter && tab !== "customers") {
          params.set("status", statusFilter);
        }

        const path =
          tab === "quotes"
            ? "/api/quotes"
            : tab === "orders"
              ? "/api/orders"
              : "/api/customers";

        const data = await apiRequest<{
          quotes?: QuoteRow[];
          orders?: OrderRow[];
          customers?: CustomerRow[];
          pagination?: Pagination;
        }>(`${path}?${params.toString()}`);

        if (cancelled) return;

        setQuotes(data.quotes ?? []);
        setOrders(data.orders ?? []);
        setCustomers(data.customers ?? []);
        setPagination(
          data.pagination ?? {
            page,
            pageSize: 10,
            total: 0,
            totalPages: 0,
          }
        );
      } catch (requestError) {
        if (cancelled) return;

        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar los registros"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRows();

    return () => {
      cancelled = true;
    };
  }, [session.status, tab, page, search, statusFilter, refreshTick, canSeeCustomers]);

  const applySearch = useCallback(() => {
    setPage(1);
    setSearch(searchInput.trim());
  }, [searchInput]);

  const changeTab = useCallback((next: Tab) => {
    setTab(next);
    setPage(1);
    setStatusFilter("");
    setExpandedId(null);
    setError(null);
    setMessage(null);
  }, []);

  const runAction = useCallback(
    async (id: string, action: () => Promise<void>, successMessage: string) => {
      setActionId(id);
      setError(null);
      setMessage(null);

      try {
        await action();
        setMessage(successMessage);
        setRefreshTick((value) => value + 1);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo completar la acción"
        );
      } finally {
        setActionId(null);
      }
    },
    []
  );

  function changeQuoteStatus(quote: QuoteRow, status: string): void {
    if (
      status === "CANCELLED" &&
      !window.confirm(`¿Cancelar la cotización ${quote.quoteNumber}?`)
    ) {
      return;
    }

    void runAction(
      quote.id,
      async () => {
        await apiRequest(`/api/quotes/${quote.id}/status`, {
          method: "POST",
          body: { status },
        });
      },
      `Cotización ${quote.quoteNumber} actualizada.`
    );
  }

  function convertQuote(quote: QuoteRow): void {
    if (
      !window.confirm(
        `¿Convertir la cotización ${quote.quoteNumber} en un pedido?`
      )
    ) {
      return;
    }

    void runAction(
      quote.id,
      async () => {
        const csrf = readCsrfToken();
        if (!csrf) {
          throw new ApiError(
            "No se encontró el token CSRF. Vuelva a iniciar sesión.",
            "CSRF_MISSING",
            403
          );
        }

        const response = await fetch(`/api/quotes/${quote.id}/convert`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf,
            "idempotency-key": crypto.randomUUID(),
          },
          credentials: "same-origin",
          body: JSON.stringify({}),
        });

        const payload = (await response.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;

        if (!response.ok) {
          throw new ApiError(
            (payload.error as string) ?? "No se pudo convertir la cotización",
            (payload.code as string) ?? "ERROR",
            response.status
          );
        }
      },
      `Cotización ${quote.quoteNumber} convertida en pedido.`
    );
  }

  function cancelOrder(order: OrderRow): void {
    if (!window.confirm(`¿Cancelar el pedido ${order.orderNumber}?`)) {
      return;
    }

    void runAction(
      order.id,
      async () => {
        await apiRequest(`/api/orders/${order.id}/status`, {
          method: "POST",
          body: { status: "CANCELLED" },
        });
      },
      `Pedido ${order.orderNumber} cancelado.`
    );
  }

  if (session.status === "loading") {
    return (
      <section className="mt-10 rounded-4xl border border-gyr-border-light bg-white p-8 shadow-sm">
        <p className="text-sm text-gyr-text">Verificando sesión comercial…</p>
      </section>
    );
  }

  if (session.status === "anonymous") {
    return (
      <section className="mt-10 rounded-4xl border border-gyr-border-light bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-gyr-primary-strong-strong mb-3">
          Actividad comercial
        </h2>
        <p className="text-gyr-text">
          El acceso comercial usa una sesión segura del servidor. En este
          momento no hay una sesión backend activa, por lo que no se consultan
          cotizaciones, pedidos ni clientes.
        </p>
        <p className="mt-3 text-sm text-gyr-text">
          El inicio de sesión del storefront contra la API queda pendiente para
          una siguiente integración. No se muestran datos de ejemplo.
        </p>
      </section>
    );
  }

  if (session.status === "error") {
    return (
      <section className="mt-10 rounded-4xl border border-rose-200 bg-rose-50 p-8">
        <h2 className="text-2xl font-bold text-rose-700 mb-3">
          Actividad comercial
        </h2>
        <p className="text-sm text-rose-700">
          {session.error ?? "No se pudo verificar la sesión comercial."}
        </p>
      </section>
    );
  }

  const rows = tab === "quotes" ? quotes : tab === "orders" ? orders : [];

  return (
    <section className="mt-10 rounded-4xl border border-gyr-border-light bg-white p-6 md:p-8 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gyr-primary-strong">
            Actividad comercial
          </h2>
          <p className="text-sm text-gyr-text">
            {session.nombre ? `${session.nombre} · ` : ""}
            {session.roles?.join(", ") || "Sin rol comercial"}
          </p>
        </div>
        <p className="text-xs text-gyr-text">
          Datos reales autorizados por el servidor. Los importes se muestran en
          COP.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "quotes"}
          onClick={() => changeTab("quotes")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "quotes"
              ? "bg-gyr-primary-strong text-white"
              : "bg-gyr-surface-light text-gyr-heading hover:bg-gyr-border-light"
          }`}
        >
          <FileText className="w-4 h-4" /> Cotizaciones
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "orders"}
          onClick={() => changeTab("orders")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "orders"
              ? "bg-gyr-primary-strong text-white"
              : "bg-gyr-surface-light text-gyr-heading hover:bg-gyr-border-light"
          }`}
        >
          <Package className="w-4 h-4" /> Pedidos
        </button>
        {canSeeCustomers ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "customers"}
            onClick={() => changeTab("customers")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "customers"
                ? "bg-gyr-primary-strong text-white"
                : "bg-gyr-surface-light text-gyr-heading hover:bg-gyr-border-light"
            }`}
          >
            <Users className="w-4 h-4" /> Clientes
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center mb-5">
        <div className="flex flex-1 gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applySearch();
            }}
            placeholder={
              tab === "customers"
                ? "Buscar por nombre, documento o email"
                : "Buscar por número o cliente"
            }
            className="w-full rounded-lg border border-gyr-border bg-gyr-surface-light px-4 py-2 text-sm focus:border-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
            aria-label="Buscar registros"
          />
          <button
            type="button"
            onClick={applySearch}
            className="rounded-lg bg-gyr-primary-strong px-4 py-2 text-sm font-semibold text-white hover:bg-gyr-primary-strong-hover transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
          >
            Buscar
          </button>
        </div>

        {tab !== "customers" ? (
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gyr-border bg-gyr-surface-light px-4 py-2 text-sm focus:border-gyr-primary-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {tab === "quotes"
              ? Object.entries(QUOTE_STATUS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))
              : Object.entries(ORDER_STATUS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
          </select>
        ) : null}

        <button
          type="button"
          onClick={() => setRefreshTick((value) => value + 1)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gyr-border px-4 py-2 text-sm font-semibold text-gyr-heading hover:border-gyr-primary-strong transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {message ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-gyr-text">
          Cargando registros…
        </p>
      ) : tab === "customers" ? (
        customers.length === 0 ? (
          <p className="py-8 text-center text-sm text-gyr-text">
            No hay clientes autorizados para mostrar.
          </p>
        ) : (
          <ul className="divide-y divide-gyr-border-light">
            {customers.map((customer) => (
              <li key={customer.id} className="py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-gyr-heading">
                      {customer.displayName}
                    </p>
                    <p className="text-sm text-gyr-text">
                      {customer.documentType} {customer.documentNumber ?? "—"} ·{" "}
                      {customer.ciudad ?? "Sin ciudad"}
                    </p>
                    <p className="text-sm text-gyr-text">
                      {customer.email ?? "Sin email"} ·{" "}
                      {customer.telefono ?? "Sin teléfono"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      customer.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {customer.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gyr-text">
          {tab === "quotes"
            ? "No hay cotizaciones para mostrar."
            : "No hay pedidos para mostrar."}
        </p>
      ) : (
        <ul className="divide-y divide-gyr-border-light">
          {tab === "quotes"
            ? quotes.map((quote) => {
                const expanded = expandedId === quote.id;
                const busy = actionId === quote.id;

                return (
                  <li key={quote.id} className="py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : quote.id)
                        }
                        className="flex flex-1 items-center gap-3 text-left"
                        aria-expanded={expanded}
                      >
                        <span className="font-semibold text-gyr-heading">
                          {quote.quoteNumber}
                        </span>
                        <span className="text-sm text-gyr-text">
                          {quote.customer.displayName}
                        </span>
                        {expanded ? (
                          <ChevronUp className="w-4 h-4 text-gyr-text" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gyr-text" />
                        )}
                      </button>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm text-gyr-text">
                          {formatDate(quote.createdAt ?? quote.validUntil)}
                        </span>
                        <span className="font-semibold text-gyr-heading">
                          {formatMoney(quote.totalCents)}
                        </span>
                        <StatusBadge status={quote.status} />
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-4 rounded-xl bg-gyr-surface-light p-4">
                        <div className="mb-3 grid grid-cols-1 gap-2 text-sm text-gyr-text md:grid-cols-2">
                          <p>
                            Responsable:{" "}
                            <span className="text-gyr-heading">
                              {quote.responsable.nombre}
                            </span>
                          </p>
                          <p>
                            Vigencia:{" "}
                            <span className="text-gyr-heading">
                              {formatDate(quote.validUntil)}
                            </span>
                            {quote.isExpired ? " (vencida)" : ""}
                          </p>
                          <p>
                            Subtotal:{" "}
                            <span className="text-gyr-heading">
                              {formatMoney(quote.subtotalCents)}
                            </span>
                          </p>
                          <p>
                            Impuestos:{" "}
                            <span className="text-gyr-heading">
                              {formatMoney(quote.taxCents)}
                            </span>
                          </p>
                        </div>

                        <ItemsTable items={quote.items} />

                        {quote.notes ? (
                          <p className="mt-3 text-sm text-gyr-text">
                            Observaciones: {quote.notes}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {quote.status === "DRAFT" ? (
                            <>
                              <button
                                type="button"
                                disabled={busy || quote.isExpired}
                                onClick={() =>
                                  changeQuoteStatus(quote, "SENT")
                                }
                                className="rounded-lg bg-gyr-primary-strong px-3 py-2 text-xs font-semibold text-white hover:bg-gyr-primary-strong-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
                              >
                                Marcar enviada
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  changeQuoteStatus(quote, "CANCELLED")
                                }
                                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : null}

                          {quote.status === "SENT" ? (
                            <>
                              <button
                                type="button"
                                disabled={busy || quote.isExpired}
                                onClick={() =>
                                  changeQuoteStatus(quote, "ACCEPTED")
                                }
                                className="rounded-lg bg-gyr-primary-strong px-3 py-2 text-xs font-semibold text-white hover:bg-gyr-primary-strong-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
                              >
                                Aceptar
                              </button>
                              {quote.isExpired ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    changeQuoteStatus(quote, "EXPIRED")
                                  }
                                  className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Marcar vencida
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  changeQuoteStatus(quote, "CANCELLED")
                                }
                                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : null}

                          {quote.status === "SENT" ||
                          quote.status === "ACCEPTED" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => convertQuote(quote)}
                              className="rounded-lg border border-gyr-primary-strong px-3 py-2 text-xs font-semibold text-gyr-primary-strong hover:bg-gyr-surface-alt disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gyr-focus)]"
                            >
                              Convertir a pedido
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })
            : orders.map((order) => {
                const expanded = expandedId === order.id;
                const busy = actionId === order.id;

                return (
                  <li key={order.id} className="py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : order.id)
                        }
                        className="flex flex-1 items-center gap-3 text-left"
                        aria-expanded={expanded}
                      >
                        <span className="font-semibold text-gyr-heading">
                          {order.orderNumber}
                        </span>
                        <span className="text-sm text-gyr-text">
                          {order.customer.displayName}
                        </span>
                        {expanded ? (
                          <ChevronUp className="w-4 h-4 text-gyr-text" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gyr-text" />
                        )}
                      </button>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-gyr-heading">
                          {formatMoney(order.totalCents)}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-4 rounded-xl bg-gyr-surface-light p-4">
                        <div className="mb-3 grid grid-cols-1 gap-2 text-sm text-gyr-text md:grid-cols-2">
                          <p>
                            Responsable:{" "}
                            <span className="text-gyr-heading">
                              {order.responsable.nombre}
                            </span>
                          </p>
                          <p>
                            Cotización de origen:{" "}
                            <span className="text-gyr-heading">
                              {order.quote?.quoteNumber ?? "Pedido directo"}
                            </span>
                          </p>
                          <p>
                            Subtotal:{" "}
                            <span className="text-gyr-heading">
                              {formatMoney(order.subtotalCents)}
                            </span>
                          </p>
                          <p>
                            Impuestos:{" "}
                            <span className="text-gyr-heading">
                              {formatMoney(order.taxCents)}
                            </span>
                          </p>
                        </div>

                        <ItemsTable items={order.items} />

                        {order.notes ? (
                          <p className="mt-3 text-sm text-gyr-text">
                            Observaciones: {order.notes}
                          </p>
                        ) : null}

                        {order.status === "PENDING_PAYMENT" ? (
                          <div className="mt-4">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => cancelOrder(order)}
                              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Cancelar pedido
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
        </ul>
      )}

      {pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between text-sm text-gyr-text">
          <span>
            Página {pagination.page} de {pagination.totalPages} ·{" "}
            {pagination.total} registro(s)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-gyr-border px-3 py-1.5 font-semibold text-gyr-heading disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages || loading}
              onClick={() =>
                setPage((value) =>
                  Math.min(pagination.totalPages, value + 1)
                )
              }
              className="rounded-lg border border-gyr-border px-3 py-1.5 font-semibold text-gyr-heading disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
