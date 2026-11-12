"use node";

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  canManageCommercial,
  customerScopeWhere,
  isAdmin,
} from "@/lib/commercial-access";
import {
  CommercialError,
  buildPagination,
  isPrismaUniqueError,
  normalizeDocumentNumber,
  normalizeEmail,
  normalizePhone,
  normalizeText,
} from "@/lib/commercial";
import {
  errorResponse,
  forbiddenResponse,
  handleCommercialError,
  requireCsrf,
  validationErrorResponse,
} from "@/lib/commercial-http";
import { serializeCustomer } from "@/lib/commercial-serializers";
import {
  CreateCustomerApiSchema,
  CustomerListQuerySchema,
} from "@/lib/validations";

// GET /api/customers — Listar clientes autorizados
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return errorResponse(auth.code!, auth.error, auth.status);
  }

  const scope = customerScopeWhere(auth.session.userId, auth.roles);
  if (!scope) {
    return forbiddenResponse("Acceso denegado: rol comercial no autorizado");
  }

  const query = CustomerListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );

  if (!query.success) {
    return validationErrorResponse(query.error);
  }

  try {
    const { page, pageSize, search, personType, documentType, isActive } =
      query.data;

    const filters: Prisma.CustomerWhereInput[] = [
      scope,
      { deletedAt: null },
    ];

    if (personType) filters.push({ personType });
    if (documentType) filters.push({ documentType });
    if (isActive !== undefined) filters.push({ isActive });

    if (search) {
      filters.push({
        OR: [
          { razonSocial: { contains: search, mode: "insensitive" } },
          { primerNombre: { contains: search, mode: "insensitive" } },
          { primerApellido: { contains: search, mode: "insensitive" } },
          { documentNumber: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.CustomerWhereInput = { AND: filters };

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      db.customer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      customers: customers.map(serializeCustomer),
      pagination: buildPagination(page, pageSize, total),
    });
  } catch (error) {
    return handleCommercialError(error, "Error listando clientes:");
  }
}

// POST /api/customers — Crear cliente (VENDEDOR/ADMIN)
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return errorResponse(auth.code!, auth.error, auth.status);
  }

  if (!canManageCommercial(auth.roles)) {
    return forbiddenResponse(
      "Acceso denegado: se requiere rol VENDEDOR o ADMIN"
    );
  }

  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("JSON_INVALIDO", "El cuerpo debe ser JSON válido", 400);
  }

  const parsed = CreateCustomerApiSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const data = parsed.data;
  const documentNumber = normalizeDocumentNumber(data.documentNumber);
  const email = normalizeEmail(data.email);
  const telefono = normalizePhone(data.telefono);

  const isJuridica = data.personType === "JURIDICA";

  try {
    const customer = await db.$transaction(async (tx) => {
      const duplicate = await tx.customer.findFirst({
        where: {
          documentType: data.documentType,
          documentNumber,
        },
      });

      if (duplicate) {
        throw new CommercialError(
          "IDENTIFICACION_DUPLICADA",
          "Ya existe un cliente con el mismo tipo y número de identificación",
          409
        );
      }

      const created = await tx.customer.create({
        data: {
          personType: data.personType,
          documentType: data.documentType,
          documentNumber,
          razonSocial: isJuridica
            ? normalizeText(data.razonSocial ?? "")
            : null,
          primerNombre: isJuridica
            ? null
            : normalizeText(data.primerNombre ?? ""),
          primerApellido: isJuridica
            ? null
            : normalizeText(data.primerApellido ?? ""),
          pais: normalizeText(data.pais),
          ciudad: normalizeText(data.ciudad),
          departamento: normalizeText(data.departamento),
          direccion: normalizeText(data.direccion),
          telefono,
          email,
          isActive: isAdmin(auth.roles) ? data.isActive : true,
          createdById: auth.session.userId,
          updatedById: auth.session.userId,
        },
      });

      await tx.operationLog.create({
        data: {
          userId: auth.session.userId,
          action: "CUSTOMER_CREATE",
          entityType: "Customer",
          entityId: created.id,
          details: {
            createdBy: auth.session.userId,
            fields: [
              "personType",
              "documentType",
              "documentNumber",
              "pais",
              "ciudad",
              "departamento",
              "email",
              "telefono",
            ],
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      { success: true, customer: serializeCustomer(customer) },
      { status: 201 }
    );
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return errorResponse(
        "IDENTIFICACION_DUPLICADA",
        "Ya existe un cliente con el mismo tipo y número de identificación",
        409
      );
    }
    return handleCommercialError(error, "Error creando cliente:");
  }
}
