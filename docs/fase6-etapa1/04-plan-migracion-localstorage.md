# 04. Plan de Migración de LocalStorage

Este documento define un plan seguro y progresivo para sustituir el uso actual de `localStorage` por una solución basada en servidor y base de datos. Es un **plan de preparación** — no se ejecuta en esta etapa.

## Estado actual de LocalStorage

| Clave | Contenido | Sensibilidad | Problema |
|-------|-----------|--------------|----------|
| `gyr-carrito` | Productos del carrito (slug, nombre, imagen, categoría, cantidad) | Baja | Manipulable por el usuario; no hay validación de stock ni precios |
| `user` | Usuario (nombre, email, teléfono, dirección, ciudad, departamento, `isAuthenticated`, `profileComplete`) | Alta | `isAuthenticated` falsificable; datos personales en texto plano |
| `orders` | Órdenes simuladas (orderId, customer, items, banco, tipoPersona, fecha) | Alta | Sin servidor, sin cifrado, orderId predecible (`Date.now()`) |
| `cart` | (usado en checkout) Items del carrito | Baja | Mismo problema que `gyr-carrito` |

## Principios del plan de migración

1. **Migración progresiva por módulo:** no se reemplaza todo de una vez.
2. **Doble escritura durante transición:** escribir en localStorage y en servidor simultáneamente, validar que coincidan.
3. **Validación en servidor como fuente de verdad:** al finalizar, el servidor valida precios, stock y autenticación; el cliente solo refleja estado.
4. **No perder datos del usuario durante la migración:** ofrecer ruta de migración para carritos activos.
5. **No introducir datos comerciales inventados:** los productos siguen sin precio hasta que GYR los proporcione.

## Fases de migración

### Fase A: Preparación (Esta etapa — Etapa 1)
- Documentar claves de localStorage actuales y su contenido.
- Definir esquemas de validación para cada dominio (carrito, usuario, orden).
- Preparar contratos API para carrito, autenticación y pedidos.

### Fase B: Autenticación (Etapa 2)
- Reemplazar `user` en localStorage por sesión de servidor (cookie HttpOnly, Secure, SameSite=Strict).
- Mantener `localStorage` como caché de solo lectura temporal durante la transición.
- Validar `isAuthenticated` en servidor, no en cliente.

### Fase C: Carrito (Etapa 3)
- Migrar `gyr-carrito` y `cart` a tabla de carrito en base de datos asociada al usuario autenticado.
- Para usuarios no autenticados: carrito anónimo con ID en cookie (no localStorage).
- Validar stock y disponibilidad en servidor al agregar items.

### Fase D: Pedidos y órdenes (Etapa 5)
- Reemplazar `orders` en localStorage por tabla de pedidos en base de datos.
- `orderId` generado como UUID v4 en servidor (no `Date.now()`).
- Estados de pedido gestionados en servidor: `pending_payment` → `paid` → `fulfilled` / `cancelled`.

### Fase E: Limpieza (Post-producción)
- Eliminar lecturas/escrituras a `localStorage` para datos sensibles.
- Mantener localStorage solo para preferencias de UI (tema, idioma) si corresponde.

## Mapa de sustitución

| Dominio | Origen actual | Destino futuro | Validación |
|---------|--------------|----------------|------------|
| Autenticación | `localStorage.user` | Sesión servidor (cookie) | Servidor valida token/sesión |
| Carrito | `localStorage.gyr-carrito` | Tabla `cart_items` en BD | Servidor valida stock y producto existe |
| Órdenes | `localStorage.orders` | Tabla `orders` en BD | Servidor valida cliente, items, precios |
| Datos de cliente | `localStorage.user` | Tabla `customers` en BD | Servidor valida formato documento (NIT/CC) |

## Riesgos de la migración

| Riesgo | Mitigación |
|--------|------------|
| Usuario con carrito en localStorage pierde items al migrar | Ofrecer "importar carrito" en primera visita tras migración |
| Doble escritura causa inconsistencia | Validar en servidor que localStorage coincida con BD; si no, priorizar BD |
| Sesión robada via XSS | Cookie HttpOnly + Content Security Policy |
| Precios manipulados en cliente antes de migrar | Nunca confiar en precios del cliente; siempre consultar BD |

## Pruebas de validación de la migración (definidas aquí, ejecutadas en etapas futuras)

1. **Carrito persistente:** agregar item, recargar página, el item persiste (ahora desde BD).
2. **Autenticación real:** intentar acceder a `/checkout` con `localStorage.user = {isAuthenticated: true}` — debe fallar (servidor rechaza).
3. **Stock validado:** agregar más items de los disponibles — servidor rechaza con error de stock insuficiente.
4. **Order ID no predecible:** verificar que `orderId` sea UUID v4, no timestamp.
