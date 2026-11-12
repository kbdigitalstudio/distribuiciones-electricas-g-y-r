# 05 — API de clientes

## Convenciones generales

- Base: `/api/customers`.
- Autenticación: cookie de sesión HttpOnly `gyr_session` emitida por `/api/auth/login`.
- CSRF: toda mutación (`POST`, `PATCH`, `DELETE`) exige el header `x-csrf-token` con el token de la cookie `gyr_csrf_token`.
- Formato: JSON UTF-8.
- Errores: `{ "error": "mensaje", "code": "CODIGO", "details"?: {...} }`.
- Los permisos se verifican en el servidor en cada handler. El frontend no es fuente de autorización.
- No se exponen campos de autenticación (`passwordHash`, tokens) ni la clave de idempotencia de pedidos.

## Endpoints

| Método | Ruta | Rol permitido | CSRF |
|---|---|---|---|
| `GET` | `/api/customers` | ADMIN, VENDEDOR, CLIENTE (alcance propio) | No |
| `POST` | `/api/customers` | ADMIN, VENDEDOR | Sí |
| `GET` | `/api/customers/[id]` | ADMIN, VENDEDOR propietario, CLIENTE propio | No |
| `PATCH` | `/api/customers/[id]` | ADMIN, VENDEDOR propietario | Sí |
| `DELETE` | `/api/customers/[id]` | ADMIN, VENDEDOR propietario | Sí |

## GET /api/customers

### Parámetros de consulta

| Parámetro | Tipo | Default | Reglas |
|---|---|---|---|
| `page` | entero | `1` | Positivo |
| `pageSize` | entero | `20` | Positivo, máximo `100` |
| `search` | texto | — | Máximo 100 caracteres; busca en razón social, nombres, apellidos, documento y email |
| `personType` | enum | — | `NATURAL` o `JURIDICA` |
| `documentType` | enum | — | `CC`, `CE`, `NIT` o `PASSAPORTE` |
| `isActive` | `true`/`false` | — | Filtro de estado lógico |

Siempre se excluyen los registros con `deletedAt` distinto de nulo.

### Alcance por rol

| Rol | Filtro aplicado |
|---|---|
| ADMIN | Sin restricción |
| VENDEDOR | `createdById = usuario` **o** `userId = usuario` |
| CLIENTE | `userId = usuario` |
| INVENTARIO u otro | `403 FORBIDDEN` |

### Respuesta 200

```json
{
  "success": true,
  "customers": [
    {
      "id": "uuid",
      "personType": "NATURAL",
      "documentType": "CC",
      "documentNumber": "90123456",
      "razonSocial": null,
      "primerNombre": "Ana",
      "primerApellido": "Uno",
      "displayName": "Ana Uno",
      "pais": "Colombia",
      "ciudad": "Bogotá",
      "departamento": "Cundinamarca",
      "direccion": "Calle 1 # 2-3",
      "telefono": "+573001234567",
      "email": "ana@ejemplo.com",
      "isActive": true,
      "deletedAt": null,
      "userId": null,
      "createdById": "uuid-vendedor",
      "updatedById": "uuid-vendedor",
      "createdAt": "2026-11-11T00:00:00.000Z",
      "updatedAt": "2026-11-11T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

## POST /api/customers

### Cuerpo

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `personType` | enum | Sí | `NATURAL` o `JURIDICA` |
| `documentType` | enum | Sí | `CC`, `CE`, `NIT`, `PASSAPORTE` |
| `documentNumber` | texto | Sí | 3–50 caracteres; se normaliza |
| `razonSocial` | texto | Solo jurídica | 2–255 caracteres |
| `primerNombre` | texto | Solo natural | 1–100 caracteres |
| `primerApellido` | texto | Solo natural | 1–100 caracteres |
| `pais` | texto | No | Default `Colombia` |
| `ciudad` | texto | Sí | 2–100 caracteres |
| `departamento` | texto | Sí | 2–100 caracteres |
| `direccion` | texto | Sí | 3–500 caracteres |
| `telefono` | texto | Sí | 7–50 caracteres |
| `email` | texto | Sí | Email válido, máximo 255 |
| `isActive` | booleano | No | Default `true`; solo ADMIN puede crear inactivo |

### Normalización aplicada

- `documentNumber`: mayúsculas, sin espacios ni puntos. Conserva guiones y letras.
- `email`: minúsculas y sin espacios exteriores.
- `telefono`: conserva el `+` inicial y solo dígitos. No inventa indicativo.
- Textos: recorte y colapso de espacios internos.

### Reglas

1. La identificación debe ser única por `(documentType, documentNumber)`.
2. La verificación de duplicados incluye registros desactivados: el número queda reservado históricamente.
3. Si el rol es VENDEDOR, `isActive` se fuerza a `true`; no puede crear clientes inactivos.
4. `createdById` y `updatedById` se registran con el usuario autenticado.
5. Se crea un `OperationLog` con acción `CUSTOMER_CREATE` dentro de la misma transacción.
6. No se asigna `userId`. El vínculo con una cuenta de usuario no forma parte de esta API.

### Respuesta 201

```json
{
  "success": true,
  "customer": { "...": "campos del cliente" }
}
```

### Errores

| HTTP | Código | Causa |
|---|---|---|
| 400 | `JSON_INVALIDO` | Cuerpo no es JSON |
| 400 | `VALIDATION_ERROR` | Campos inválidos; incluye `details` por campo |
| 401 | `UNAUTHENTICATED` | Sin sesión válida |
| 403 | `CSRF_INVALID` | Token CSRF ausente o inválido |
| 403 | `FORBIDDEN` | Rol sin permiso de escritura |
| 404 | `USER_NOT_FOUND` | Usuario de sesión inexistente o inactivo |
| 409 | `IDENTIFICACION_DUPLICADA` | Documento ya registrado |
| 500 | `INTERNAL_ERROR` | Error no controlado |

## GET /api/customers/[id]

- Devuelve el cliente si está activo lógicamente (`deletedAt = null`).
- ADMIN accede a cualquiera.
- VENDEDOR accede a los que creó o a su propio registro vinculado.
- CLIENTE accede únicamente a su propio registro vinculado.
- Un registro ajeno responde `404 CLIENTE_NO_ENCONTRADO` para no revelar su existencia.
- Un registro eliminado también responde `404`.

## PATCH /api/customers/[id]

### Cuerpo

Todos los campos son opcionales, pero debe enviarse al menos uno:

`personType`, `documentType`, `documentNumber`, `razonSocial`, `primerNombre`, `primerApellido`, `pais`, `ciudad`, `departamento`, `direccion`, `telefono`, `email`, `isActive`.

### Reglas

1. Solo ADMIN o el VENDEDOR propietario puede editar.
2. CLIENTE nunca puede editar, ni siquiera su propio registro.
3. `isActive` solo puede cambiarlo ADMIN. Cualquier otro rol recibe `403`.
4. Si cambia `personType`, se valida la coherencia final:
   - Jurídica exige `razonSocial`; limpia nombres.
   - Natural exige nombre y apellido; limpia razón social.
5. Si cambia el documento o su tipo, se verifica duplicado contra otros clientes.
6. La edición deja `updatedById` y un `OperationLog` `CUSTOMER_UPDATE`.
7. Un cliente con `deletedAt` no puede editarse: la consulta previa responde `404`.

### Errores adicionales

| HTTP | Código | Causa |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Incoherencia de persona natural/jurídica |
| 403 | `FORBIDDEN` | No es propietario o intenta cambiar `isActive` sin ADMIN |
| 404 | `CLIENTE_NO_ENCONTRADO` | No existe o está eliminado |
| 409 | `IDENTIFICACION_DUPLICADA` | Documento ya usado por otro cliente |

## DELETE /api/customers/[id]

- Es una **desactivación lógica**, no un borrado físico.
- Marca `isActive = false`, `deletedAt = ahora` y `updatedById`.
- Registra `OperationLog` con acción `CUSTOMER_DEACTIVATE` y `softDelete: true`.
- Las cotizaciones y pedidos históricos permanecen intactos.
- Un cliente desactivado no puede recibir cotizaciones ni pedidos nuevos (`CLIENTE_NO_DISPONIBLE`).
- Un segundo `DELETE` responde `409 CLIENTE_YA_DESACTIVADO`.
- No existe endpoint de restauración. Un registro desactivado no se recupera por la API.

### Respuesta 200

```json
{
  "success": true,
  "message": "Cliente desactivado lógicamente",
  "customer": { "...": "cliente con isActive=false y deletedAt" }
}
```

## Matriz de autorización resumida

| Operación | ADMIN | VENDEDOR | CLIENTE | INVENTARIO |
|---|---|---|---|---|
| Listar | Todos | Creados o propio | Propio | 403 |
| Crear | Sí | Sí | 403 | 403 |
| Ver | Todos | Creados o propio | Propio | 404/403 |
| Editar | Todos | Creados o propio | 403 | 403 |
| Desactivar | Todos | Creados o propio | 403 | 403 |
| Cambiar `isActive` | Sí | 403 | 403 | 403 |

## Protección de datos personales

- Los serializadores solo devuelven campos comerciales.
- Nunca se devuelve `passwordHash` ni información de sesión.
- Los datos de contacto solo se entregan a roles autorizados sobre ese cliente.
- Los listados aplican alcance antes de paginar.
- Los accesos ajenos se responden como `404` para evitar enumeración.
- Los `OperationLog` guardan nombres de campos modificados y actor, no valores sensibles completos.

## Ejemplo de creación

```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "gyr_session=$SESSION; gyr_csrf_token=$CSRF" \
  -d '{
    "personType": "NATURAL",
    "documentType": "CC",
    "documentNumber": "90.123.456",
    "primerNombre": "Ana",
    "primerApellido": "Uno",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "direccion": "Calle 1 # 2-3",
    "telefono": "+57 300 123 4567",
    "email": "ANA@EJEMPLO.COM"
  }'
```

## Evidencia

- Implementación: `src/app/api/customers/route.ts`, `src/app/api/customers/[id]/route.ts`.
- Reglas: `src/lib/commercial-access.ts`, `src/lib/commercial.ts`.
- Validación: `CreateCustomerApiSchema`, `UpdateCustomerApiSchema`, `CustomerListQuerySchema`.
- Pruebas: 6 casos de integración de clientes en `tests/integration/commercial-api.test.ts` y 11 casos de alcance en `tests/unit/commercial-access.test.ts`.
