"use node";

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  canManageCustomer,
  canReadCustomer,
  isAdmin,
} from "@/lib/commercial-access";
import {
  CommercialError,
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
  notFoundResponse,
  requireCsrf,
  validationErrorResponse,
} from "@/lib/commercial-http";
import { serializeCustomer } from "@/lib/commercial-serializers";
import { UpdateCustomerApiSchema } from "@/lib/validations";

// GET /api/customers/[id] — Consultar cliente autorizado
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return errorResponse(auth.code!, auth.error, auth.status);
  }

  const { id } = await params;

  try {
    const customer = await db.customer.findFirst({
      where: { id, deletedAt: null },
    });

    if (!customer) {
      return notFoundResponse("CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
    }

    if (!canReadCustomer(customer, auth.session.userId, auth.roles)) {
      // Se responde 404 para no revelar la existencia de registros ajenos.
      return notFoundResponse("CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
    }

    return NextResponse.json({
      success: true,
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    return handleCommercialError(error, "Error consultando cliente:");
  }
}

// PATCH /api/customers/[id] — Actualizar cliente (ADMIN o VENDEDOR propietario)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return errorResponse(auth.code!, auth.error, auth.status);
  }

  const { id } = await params;

  try {
    const existing = await db.customer.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return notFoundResponse("CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
    }

    if (!canManageCustomer(existing, auth.session.userId, auth.roles)) {
      return forbiddenResponse("No puede administrar este cliente");
    }

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("JSON_INVALIDO", "El cuerpo debe ser JSON válido", 400);
    }

    const parsed = UpdateCustomerApiSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const data = parsed.data;

    if (data.isActive !== undefined && !isAdmin(auth.roles)) {
      return forbiddenResponse(
        "Solo ADMIN puede cambiar el estado de activación de un cliente"
      );
    }

    const finalPersonType = data.personType ?? existing.personType;
    const finalRazonSocial =
      data.razonSocial !== undefined ? data.razonSocial : existing.razonSocial;
    const finalPrimerNombre =
      data.primerNombre !== undefined
        ? data.primerNombre
        : existing.primerNombre;
    const finalPrimerApellido =
      data.primerApellido !== undefined
        ? data.primerApellido
        : existing.primerApellido;

    if (finalPersonType === "JURIDICA" && !finalRazonSocial) {
      return errorResponse(
        "VALIDATION_ERROR",
        "La razón social es obligatoria para persona jurídica",
        400
      );
    }

    if (
      finalPersonType === "NATURAL" &&
      (!finalPrimerNombre || !finalPrimerApellido)
    ) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Nombre y apellido son obligatorios para persona natural",
        400
      );
    }

    const updates: Prisma.CustomerUpdateInput = {
      updatedBy: { connect: { id: auth.session.userId } },
    };

    if (data.personType !== undefined) updates.personType = data.personType;
    if (data.documentType !== undefined) updates.documentType = data.documentType;
    if (data.pais !== undefined) updates.pais = normalizeText(data.pais);
    if (data.ciudad !== undefined) updates.ciudad = normalizeText(data.ciudad);
    if (data.departamento !== undefined) {
      updates.departamento = normalizeText(data.departamento);
    }
    if (data.direccion !== undefined) {
      updates.direccion = normalizeText(data.direccion);
    }
    if (data.telefono !== undefined) updates.telefono = normalizePhone(data.telefono);
    if (data.email !== undefined) updates.email = normalizeEmail(data.email);
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    const finalDocumentNumber =
      data.documentNumber !== undefined
        ? normalizeDocumentNumber(data.documentNumber)
        : existing.documentNumber;

    if (data.documentNumber !== undefined) {
      updates.documentNumber = finalDocumentNumber;
    }

    const finalDocumentType = data.documentType ?? existing.documentType;

    if (finalPersonType === "JURIDICA") {
      updates.razonSocial = normalizeText(finalRazonSocial ?? "");
      updates.primerNombre = null;
      updates.primerApellido = null;
    } else {
      updates.primerNombre = normalizeText(finalPrimerNombre ?? "");
      updates.primerApellido = normalizeText(finalPrimerApellido ?? "");
      updates.razonSocial = null;
    }

    const customer = await db.$transaction(async (tx) => {
      if (
        finalDocumentNumber &&
        (data.documentNumber !== undefined || data.documentType !== undefined)
      ) {
        const duplicate = await tx.customer.findFirst({
          where: {
            id: { not: id },
            documentType: finalDocumentType,
            documentNumber: finalDocumentNumber,
          },
        });

        if (duplicate) {
          throw new CommercialError(
            "IDENTIFICACION_DUPLICADA",
            "Ya existe un cliente con el mismo tipo y número de identificación",
            409
          );
        }
      }

      const updated = await tx.customer.update({
        where: { id },
        data: updates,
      });

      await tx.operationLog.create({
        data: {
          userId: auth.session.userId,
          action: "CUSTOMER_UPDATE",
          entityType: "Customer",
          entityId: id,
          details: {
            updatedBy: auth.session.userId,
            fields: Object.keys(data),
          },
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return errorResponse(
        "IDENTIFICACION_DUPLICADA",
        "Ya existe un cliente con el mismo tipo y número de identificación",
        409
      );
    }
    return handleCommercialError(error, "Error actualizando cliente:");
  }
}

// DELETE /api/customers/[id] — Desactivación lógica
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return errorResponse(auth.code!, auth.error, auth.status);
  }

  const { id } = await params;

  try {
    const existing = await db.customer.findFirst({ where: { id } });

    if (!existing) {
      return notFoundResponse("CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
    }

    if (!canManageCustomer(existing, auth.session.userId, auth.roles)) {
      return forbiddenResponse("No puede administrar este cliente");
    }

    if (existing.deletedAt !== null) {
      return errorResponse(
        "CLIENTE_YA_DESACTIVADO",
        "El cliente ya fue desactivado",
        409
      );
    }

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const customer = await db.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          updatedBy: { connect: { id: auth.session.userId } },
        },
      });

      await tx.operationLog.create({
        data: {
          userId: auth.session.userId,
          action: "CUSTOMER_DEACTIVATE",
          entityType: "Customer",
          entityId: id,
          details: {
            deactivatedBy: auth.session.userId,
            softDelete: true,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Cliente desactivado lógicamente",
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    return handleCommercialError(error, "Error desactivando cliente:");
  }
}
