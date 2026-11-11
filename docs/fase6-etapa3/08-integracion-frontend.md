# 08. Integración con el Frontend

## Estado de la integración

La integración con el frontend está **preparada pero no conectada** porque no hay una base de datos PostgreSQL operativa para consumir las APIs.

## Archivos originales NO modificados

| Archivo | Estado | Motivo |
|---------|--------|--------|
| `src/data/products.ts` | ✅ Intacto | Datos originales de los 34 productos |
| `src/components/sections/categories.tsx` | ✅ Intacto | Categorías de navegación frontend |
| `src/components/ui/cart.tsx` | ✅ Intacto | Carrito original (localStorage) |
| `src/app/checkout/page.tsx` | ✅ Intacto | Checkout original (localStorage) |
| `src/hooks/use-cart.tsx` | ✅ Intacto | Hook de carrito original |
| `src/app/layout.tsx` | ✅ Intacto | Layout original |
| `src/app/globals.css` | ✅ Intacto | Estilos corporativos |
| `next.config.ts` | ✅ Intacto | Configuración de Next.js |
| `tsconfig.json` | ✅ Intacto | Configuración de TypeScript |

## Comportamiento actual del frontend

Mientras no haya BD operativa, el frontend mantiene su comportamiento anterior:

- Los productos se leen de `src/data/products.ts` (datos estáticos)
- El carrito usa `localStorage` (clave `gyr-carrito`)
- Los precios muestran "A cotizar" (como en el diseño original)
- La navegación por categorías usa `CATEGORIES_DATA` estática

## Integración pendiente (requiere BD operativa)

Cuando se disponga de PostgreSQL, se podrá conectar:

1. Reemplazar la lectura de `src/data/products.ts` por llamadas a `GET /api/products`
2. Reemplazar `CATEGORIES_DATA` por llamadas a `GET /api/categories`
3. Conectar el carrito al backend (pendiente de Etapa 5)
4. Conectar el checkout al backend (pendiente de Etapa 5)

## Identidad visual

| Elemento | Estado |
|----------|--------|
| Logotipo GYR | ✅ Sin modificar |
| Colores corporativos | ✅ Sin modificar |
| Tipografías | ✅ Sin modificar |
| Imágenes de productos | ✅ Sin modificar (rutas originales) |
| Sombras, gradientes, fondos | ✅ Sin modificar |
