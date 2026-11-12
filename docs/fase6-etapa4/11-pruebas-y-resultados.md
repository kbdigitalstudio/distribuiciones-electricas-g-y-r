# 11 — Pruebas y resultados

## Entorno

- Fecha de ejecución: 11 de noviembre de 2026.
- Sistema: Windows, PowerShell.
- Node/Next: el proyecto existente `gyr-next`.
- Base de datos: PostgreSQL desechable en `127.0.0.1:55432`, base `gyr_test`.
- La base de producción en el puerto `5432` no se utilizó.
- Variables usadas:

```powershell
$env:DATABASE_URL="postgresql://postgres@127.0.0.1:55432/gyr_test?schema=public"
$env:TEST_DATABASE_URL=$env:DATABASE_URL
$env:JWT_SECRET="test-secret-at-least-32-characters-long"
$env:JWT_REFRESH_SECRET="test-refresh-secret-at-least-32-characters-long"
```

## Resultados de verificación

| Comando | Resultado |
|---|---|
| `npx prisma validate` | Esquema válido. 2 advertencias preexistentes de `SetNull` |
| `npx prisma generate` | Cliente Prisma generado correctamente |
| `npx tsc --noEmit` | Sin errores |
| `npm run build` | Compilación exitosa |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `npx prisma migrate deploy` (test) | “No pending migrations to apply.” |
| `npx vitest run` | **9 archivos, 117 pruebas aprobadas** |
| `npx vitest run tests/unit` | **7 archivos, 77 pruebas aprobadas** |
| `npx vitest run tests/integration/commercial-api.test.ts` | **28 pruebas aprobadas** |

### Advertencias preexistentes

`npx prisma validate` reporta dos advertencias:

```
The `onDelete` referential action of a relation should not be set to `SetNull`
when a referenced field is required.
```

Corresponden a relaciones de inventario (`createdBy`) existentes antes de la Etapa 4. No se modificaron para no ampliar el alcance.

### Salida del build

El build incluye las nuevas rutas:

```
/api/customers
/api/customers/[id]
/api/quotes
/api/quotes/[id]
/api/quotes/[id]/convert
/api/quotes/[id]/items
/api/quotes/[id]/status
/api/orders
/api/orders/[id]
/api/orders/[id]/items
/api/orders/[id]/status
/perfil
```

No se presentaron errores de compilación nuevos de la Etapa 4.

### Auditoría de dependencias

```
found 0 vulnerabilities
```

No se ejecutó `npm audit fix --force`.

## Pruebas unitarias

| Archivo | Pruebas | Cobertura |
|---|---:|---|
| `tests/unit/commercial-rules.test.ts` | 19 | Transiciones, importes, normalización, numeración, idempotencia |
| `tests/unit/commercial-items.test.ts` | 10 | Productos, precios de catálogo/manuales, cantidades, stock |
| `tests/unit/commercial-serializers.test.ts` | 9 | Serialización de dinero, PII, snapshots, historiales |
| `tests/unit/commercial-access.test.ts` | 11 | Roles, alcance por registro y filtros |
| `tests/unit/validations.test.ts` | 7 | Esquemas Zod, incluidos los comerciales |
| `tests/unit/inventory-rules.test.ts` | 15 | Reglas de inventario preexistentes |
| `tests/unit/roles.test.ts` | 6 | Jerarquía de roles preexistente |
| **Total** | **77** | |

## Pruebas de integración reales con PostgreSQL

Archivo: `tests/integration/commercial-api.test.ts`.

Las pruebas crean sus propios usuarios, roles, productos, precios, inventario, clientes, cotizaciones y pedidos, y limpian los datos al finalizar. No usan mocks de base de datos.

| Bloque | Pruebas | Qué verifica |
|---|---:|---|
| Clientes | 6 | Normalización, duplicados, alcance, aislamiento, baja lógica, rechazo posterior |
| Cotizaciones | 7 | Snapshots, totales, precio manual, productos inactivos, vencimiento, reemplazo de líneas, transiciones, historial, aislamiento |
| Conversión | 6 | Copia de precios, stock intacto, idempotencia, doble conversión, estados inválidos, aceptada vencida, cancelación bloqueada, concurrencia |
| Pedidos | 7 | Creación directa, idempotencia por header/cuerpo, stock insuficiente, cliente inactivo, permisos, transiciones, historial, concurrencia |
| Seguridad | 2 | 401 sin sesión, 403 sin CSRF en 10 mutaciones, IDs inválidos |
| **Total** | **28** | |

### Casos destacados

- Documento con puntos/espacios se normaliza y se detecta duplicado aunque cambie el formato.
- VENDEDOR no ve clientes de otro vendedor.
- CLIENTE solo ve su propio cliente, cotizaciones y pedidos.
- Cotización con precio de catálogo rechaza precio manual.
- Producto sin precio de catálogo exige precio manual autorizado.
- Reemplazo de líneas conserva las anteriores con `deletedAt`.
- Conversión conserva precios y no descuenta stock.
- Conversión repetida con la misma clave devuelve el mismo pedido.
- Conversión con clave distinta devuelve `COTIZACION_YA_CONVERTIDA`.
- Cotización aceptada vencida se puede convertir.
- Cotización convertida no se puede cancelar.
- Pedido directo sin precio de catálogo se rechaza.
- `PAID` se rechaza con `PAGO_NO_AUTORIZADO`.
- 6 creaciones concurrentes con la misma clave producen 1 solo pedido.
- 5 conversiones concurrentes con la misma clave producen 1 solo pedido.

## Pruebas de inventario preexistentes

Se ejecutaron 12 pruebas de integración de inventario dentro de la suite completa. Todas aprobaron. No se modificó su lógica.

## Suite completa

```
Test Files  9 passed (9)
     Tests  117 passed (117)
```

### Registros esperados en stderr

Durante las pruebas negativas aparecen logs esperados:

- `prisma:error Unique constraint failed on the fields: (idempotencyKey)` en las carreras de idempotencia.
- `InventoryRuleError: La cantidad reservada es menor que la cantidad a liberar` en pruebas de inventario.

Estos logs provienen de casos que **deben** fallar y no representan pruebas fallidas.

## Qué no se probó

- Migración o lectura contra la base de producción.
- Pruebas HTTP reales a través del servidor Next completo.
- Pruebas de navegador/E2E con cookies, CSRF y clics reales.
- Pruebas de carga o estrés.
- Pagos, correos, WhatsApp, facturación electrónica o integraciones externas.
- Restauración de un cliente desactivado, porque no existe endpoint.

## Limitaciones metodológicas

1. Las pruebas de integración invocan los Route Handlers directamente y mockean `getSession` y `validateCsrfToken`. Validan la lógica del handler y la base real, pero no el middleware ni el transporte HTTP.
2. El middleware se verificó por revisión y compilación, no por una prueba de extremo a extremo.
3. No se presentan resultados simulados como reales: todo lo anterior se ejecutó contra PostgreSQL `gyr_test`.
4. La base de producción no fue contactada.

## Conclusión

La Etapa 4 cuenta con:

- 77 pruebas unitarias.
- 28 pruebas de integración comercial contra PostgreSQL.
- 12 pruebas de integración de inventario preexistentes.
- 117 pruebas totales aprobadas.
- Validación de esquema, generación de cliente, typecheck, build y auditoría de dependencias sin errores nuevos.

Las limitaciones están documentadas y no se ocultan como éxitos.
