# 05. API de Precios

## Endpoints implementados

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|--------|
| GET | `/api/products/[id]/prices` | Consultar historial de precios | Público |
| POST | `/api/products/[id]/prices` | Registrar nuevo precio | ADMIN |
| GET | `/api/products/[id]/price` | Consultar precio vigente | Público |

## Modelo de precios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `priceCents` | BIGINT | Importe en centavos (no punto flotante) |
| `currency` | VARCHAR(3) | Moneda, default "COP" |
| `validFrom` | DateTime | Fecha de inicio de vigencia |
| `validTo` | DateTime | Fecha de fin de vigencia (null = indefinido) |
| `isActive` | Boolean | Si el precio está activo |

## Reglas de negocio

| Regla | Implementación |
|-------|---------------|
| Centavos, no float | `priceCents` tipo BIGINT para evitar errores de punto flotante |
| Historial conservado | Al registrar un nuevo precio, los anteriores se desactivan (`isActive = false`) pero no se eliminan |
| No sobrescribir | Cada precio es un registro nuevo con su propia vigencia |
| Precio vigente | Se consulta por fecha actual dentro del rango `validFrom` <= ahora <= `validTo` (o `validTo` null) |
| Sin precio | Si no hay precio vigente, la API retorna `price: null` (permite mostrar "A cotizar") |
| Vigencia válida | `validTo` debe ser posterior a `validFrom` |

## Ejemplo de respuesta (sin precio)

```json
{
  "success": true,
  "product": { "id": "...", "name": "...", "slug": "..." },
  "price": null,
  "message": "A cotizar"
}
```

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/app/api/products/[id]/prices/route.ts` | GET historial, POST registrar |
| `src/app/api/products/[id]/price/route.ts` | GET precio vigente |
