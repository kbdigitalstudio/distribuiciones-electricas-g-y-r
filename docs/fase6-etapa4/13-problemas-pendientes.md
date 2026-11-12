# 13 — Problemas pendientes y decisiones abiertas

## Bloqueantes de producción

### 1. Migración de producción no ejecutada

- La migración `006` solo se aplicó en `gyr_test`.
- No se contactó la base de producción ni se ejecutó `prisma migrate deploy` contra ella.
- Antes de aplicar se deben correr las consultas de prevalidación de `04-migraciones.md` y tomar un respaldo restaurable.
- Requiere autorización expresa.

### 2. Login del storefront no integrado con la sesión backend

- El modal actual usa `localStorage`.
- La API comercial usa cookies HttpOnly.
- Sin integrar `/api/auth/login`, un usuario del storefront no obtiene sesión backend y el portal muestra estado anónimo.
- No se simularon datos para ocultar esta limitación.

## Riesgos altos

### 3. Sin política de reserva de inventario

- La creación y conversión solo validan disponibilidad en lectura.
- No se reserva ni descuenta stock.
- Dos pedidos concurrentes podrían sobrevender.
- Falta una decisión aprobada sobre reservas, descuento, liberación y expiración.

### 4. Sin integración de pagos

- `PAID` y `REFUNDED` no son alcanzables por API.
- No hay pasarela, conciliación, confirmación bancaria ni facturación electrónica.
- Los campos de pago quedan como referencia histórica.
- Habilitar `PAID` requiere una integración real autorizada y trazabilidad de la fuente de pago.

### 5. Sin política de impuestos ni descuentos

- `taxCents` siempre es `0`.
- `totalCents` siempre es igual a `subtotalCents`.
- No se aceptan descuentos ni impuestos del cliente.
- Falta una decisión comercial y tributaria antes de calcularlos.

### 6. Precio manual sin flujo de aprobación

- Un VENDEDOR o ADMIN puede fijar precio manual cuando no existe precio de catálogo.
- No hay aprobación de supervisor, límite por cliente, vigencia ni motivo obligatorio.
- La política comercial debe definir si esto es suficiente.

### 7. Vínculo Customer–User no gestionado por API

- `CreateCustomerApiSchema` no acepta `userId`.
- No existe endpoint para vincular una cuenta de usuario a un cliente.
- El acceso `CLIENTE` a su propio registro depende de un vínculo creado fuera de esta API.

### 8. Sin restauración de clientes desactivados

- `DELETE` marca `isActive = false` y `deletedAt`.
- `PATCH` y `GET` excluyen registros con `deletedAt`.
- Cambiar `isActive` a `true` no limpia `deletedAt`, por lo que no restaura la visibilidad.
- No existe endpoint de restauración.
- El documento queda reservado históricamente y no puede reutilizarse.

## Riesgos medios

### 9. Borrador vencido no puede marcarse EXPIRED

- La tabla aprobada solo permite `SENT → EXPIRED`.
- Un `DRAFT` vencido no puede pasar directamente a `EXPIRED`.
- Puede cancelarse.
- Se requiere una decisión para permitir `DRAFT → EXPIRED` o una operación administrativa específica.

### 10. La cotización no cambia de estado al convertirse

- Una cotización `SENT` sigue en `SENT` después de originar un pedido.
- El vínculo queda en `Order.quoteId`.
- Falta confirmar si el negocio espera que pase automáticamente a `ACCEPTED` o a otro estado.

### 11. Pruebas de integración sin middleware ni HTTP real

- Las pruebas invocan los Route Handlers directamente.
- Mockean `getSession` y `validateCsrfToken`.
- Validan lógica y PostgreSQL real, pero no el pipeline HTTP, el middleware ni las cookies reales.
- No hay E2E de navegador.

### 12. Sin límite de tasa específico para APIs comerciales

- No se añadió throttling por usuario, IP o cliente.
- El alcance aprobado no lo incluía.
- Debe evaluarse antes de exponer masivamente las APIs.

### 13. Paginación por offset

- `page`/`pageSize` puede desplazar resultados si se crean registros entre páginas.
- No se implementó paginación por cursor.
- Es aceptable para el volumen actual, pero debe revisarse a escala.

### 14. Retención de claves de idempotencia indefinida

- `Order.idempotencyKey` se conserva para siempre.
- No hay política de expiración ni limpieza.
- Es correcto para evitar duplicados históricos, pero crecerá con el tiempo.

### 15. Endpoints de precios preexistentes devuelven BigInt crudo

- Es un defecto de la Etapa 3.
- No se corrigió para no ampliar el alcance sin autorización.
- Los endpoints comerciales nuevos serializan centavos como cadenas.

### 16. Advertencias Prisma preexistentes

- Dos relaciones de inventario usan `onDelete: SetNull` sobre campos requeridos.
- No fueron introducidas por la Etapa 4.
- No se corrigieron para evitar cambios no autorizados.

### 17. Sin correos, WhatsApp, facturación electrónica ni notificaciones

- No se implementaron por restricción expresa.
- El cambio de estado no notifica a nadie.
- La conversión no envía comprobantes.

### 18. Sin formularios de alta o edición en el frontend

- El portal es de lectura y acciones de ciclo de vida.
- Crear clientes, cotizaciones y pedidos requiere API.
- Falta definir la experiencia de alta y sus validaciones de UI.

## Riesgos bajos

### 19. Colisión de número comercial

- El número usa 6 bytes aleatorios (48 bits) más la fecha.
- La probabilidad es muy baja y existe restricción única.
- Si ocurriera una colisión, la API responde `409 REGISTRO_DUPLICADO`; no reintenta automáticamente.

### 20. Sin edición de líneas de pedido

- Es intencional: los pedidos conservan snapshots inmutables.
- Corregir un pedido requiere cancelarlo y crear otro, o una operación futura autorizada.

### 21. Sin panel de auditoría

- Los historiales y `OperationLog` existen en base.
- No hay UI para consultarlos.
- Su lectura requeriría un endpoint administrativo adicional.

### 22. Sin exportación

- No hay CSV, PDF ni integración contable.
- No formaba parte del alcance.

## Decisiones que requieren confirmación

1. ¿La conversión debe cambiar el estado de la cotización?
2. ¿Se permite `DRAFT → EXPIRED`?
3. ¿Quién aprueba un precio manual y con qué límites?
4. ¿Se implementará reserva de inventario al crear pedidos?
5. ¿Cómo se vinculará un `Customer` con un `User`?
6. ¿Se necesita restauración de clientes desactivados?
7. ¿Qué política de impuestos y descuentos aplica?
8. ¿Qué integración de pagos se autorizará y cómo se trazará?
9. ¿Se requiere rate limiting comercial?
10. ¿Se integrará el login del storefront en la siguiente etapa?

## Estado

Ninguno de estos puntos fue resuelto inventando datos, reglas o integraciones. Quedan documentados para decisión expresa antes de la Etapa 5 o de cualquier despliegue a producción.
