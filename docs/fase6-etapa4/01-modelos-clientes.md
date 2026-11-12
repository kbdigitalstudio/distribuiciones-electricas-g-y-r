# 01 — Modelos de clientes

## Alcance

La Etapa 4 reutiliza el modelo `Customer` existente. No se creó un segundo modelo de clientes ni se duplicaron tablas. Los cambios son aditivos y compatibles con los registros históricos.

## Modelo `Customer`

| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | UUID | No | Clave primaria |
| `userId` | UUID | Sí | Vínculo opcional con `User` para autoservicio del cliente |
| `personType` | `PersonType` | No | `NATURAL` o `JURIDICA` |
| `documentType` | `DocumentType` | No | `CC`, `CE`, `NIT` o `PASSAPORTE` |
| `documentNumber` | Texto | Sí | Identificación normalizada |
| `razonSocial` | Texto | Sí | Obligatoria para persona jurídica |
| `primerNombre` | Texto | Sí | Obligatorio para persona natural |
| `primerApellido` | Texto | Sí | Obligatorio para persona natural |
| `pais` | Texto | No | Por defecto `Colombia` |
| `ciudad` | Texto | Sí | Ciudad comercial |
| `departamento` | Texto | Sí | Departamento comercial |
| `direccion` | Texto | Sí | Dirección comercial |
| `telefono` | Texto | Sí | Teléfono normalizado |
| `email` | Texto | Sí | Email en minúsculas |
| `isActive` | Booleano | No | Estado lógico |
| `deletedAt` | Timestamp | Sí | Fecha de baja lógica |
| `createdById` | UUID | Sí | Usuario que creó el registro |
| `updatedById` | UUID | Sí | Usuario de la última edición |
| `createdAt` | Timestamp | No | Alta |
| `updatedAt` | Timestamp | No | Última modificación |

### Relaciones

- `user`: vínculo opcional con `User` (`onDelete: SetNull`).
- `createdBy` / `updatedBy`: trazabilidad de actores (`onDelete: SetNull`).
- `quotes`: cotizaciones del cliente.
- `orders`: pedidos del cliente.

## Reglas implementadas

1. **Unicidad de identificación**
   - Restricción única compuesta `(documentType, documentNumber)`.
   - Se retiró la unicidad global anterior sobre `documentNumber`, que impedía reutilizar el mismo número en tipos de documento distintos.
2. **Normalización**
   - Documento: mayúsculas, sin espacios ni puntos. Conserva guiones y letras.
   - Email: minúsculas y sin espacios exteriores.
   - Teléfono: conserva `+` inicial y solo dígitos; no inventa código de país.
   - Texto: recorta y colapsa espacios internos.
3. **Duplicados**
   - La API rechaza un documento ya existente con `409 IDENTIFICACION_DUPLICADA`.
   - La restricción de base de datos protege ante concurrencia.
4. **Borrado lógico**
   - `DELETE /api/customers/[id]` marca `isActive = false` y `deletedAt`.
   - No se elimina físicamente el registro ni sus cotizaciones o pedidos.
   - Un cliente eliminado no puede recibir cotizaciones ni pedidos nuevos.
5. **Actores**
   - `createdById` y `updatedById` se registran en cada alta y edición.
   - Cada operación comercial crea un `OperationLog`.
6. **Datos personales**
   - Los serializadores devuelven solo campos comerciales.
   - Nunca se expone `passwordHash` ni datos de autenticación.
   - El acceso está limitado por rol y por vínculo con el cliente.

## Reglas de autorización del modelo

- `ADMIN`: lectura y administración de todos los clientes.
- `VENDEDOR`: lectura y administración de clientes que creó o de su propio registro vinculado.
- `CLIENTE`: lectura únicamente de su propio registro; no puede crear ni editar.
- `INVENTARIO` y roles no comerciales: sin acceso.

## Decisiones no inventadas

- No se agregaron cupos de crédito, listas de precios por cliente, descuentos, retenciones ni condiciones de pago.
- No se agregó categoría de cliente, sector económico ni código interno.
- El vínculo `userId` sigue siendo opcional; la política de autoregistro y aprobación de clientes no está definida.
- No se eliminó ningún campo preexistente.

## Índices y restricciones relevantes

- `@@unique([documentType, documentNumber])`
- Índices: `userId`, `documentNumber`, `isActive`, `deletedAt`, `createdById`, `updatedById`.
- `CHECK` de documento y país no vacíos.
- Claves foráneas de actores con `ON DELETE SET NULL`.

## Evidencia

- Esquema: `prisma/schema.prisma`.
- Migración: `prisma/migrations/006_comercial_clientes_cotizaciones_pedidos/migration.sql`.
- Pruebas de integración: `tests/integration/commercial-api.test.ts`.
- Pruebas unitarias de reglas y serialización: `tests/unit/commercial-rules.test.ts`, `tests/unit/commercial-serializers.test.ts`.
