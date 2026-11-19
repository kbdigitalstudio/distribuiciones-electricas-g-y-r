# Reporte TDD — `tests/unit/auth-form.test.ts` (estado RED)

> Contrato fuente de verdad: `api-contract.md` → sección **4. Módulo nuevo con contrato fijo (para TDD)**.
> Autor del test: @tdd-guide. **La implementación de `src/lib/auth-form.ts` NO existe y NO fue escrita por este agente**
> (corresponde a @frontend-react).

## Archivo creado

- `C:\Proyectos\GYR\gyr-next\tests\unit\auth-form.test.ts`

## Casos cubiertos (21 casos)

### `buildAuthPayload` (2)

1. `login` devuelve **solo** `{ email, password }`: se pasan también los campos de registro y se verifica
   con `Object.keys(payload).sort()` que no hay claves extra ni valores `undefined`
   (`toEqual` de Vitest ignora claves con valor `undefined`, por eso se adds la aserción explícita de claves).
2. `register` devuelve los **7 campos exactos** (`nombre`, `email`, `password`, `telefono`, `direccion`,
   `ciudad`, `departamento`), sin claves extra y sin `undefined`.

### `validateAuthForm` — login (3)

3. Email inválido (`"correo-invalido"`) → error en `email` (y **no** en `password`).
4. Password vacía (`""`) → error en `password` (y **no** en `email`).
5. Valores válidos → objeto de errores vacío `{}`.

### `validateAuthForm` — register (10)

6-12. Falta **cada uno** de los 7 campos obligatorios (uno por test, generado en bucle):
   `nombre`, `email`, `password`, `telefono`, `direccion`, `ciudad`, `departamento` → error en ese campo.
13. Password de 7 caracteres (`"1234567"`) → error en `password` (mínimo 8).
14. Email inválido → error en `email`.
15. Los 7 campos válidos → objeto de errores vacío `{}`.

### `authErrorMessage` (6)

16. `401` → `"Correo o contraseña incorrectos."` y **no** contiene el email (`"ana@ejemplo.com"`) presente en el body.
17. `409` → `"Ese correo ya está registrado."`.
18. `429` → `"Demasiados intentos. Espera unos minutos e inténtalo de nuevo."`.
19. `400` con `details: { email: ["Email inválido"] }` → el mensaje contiene `"Email inválido"`.
20. `500` → `"No pudimos completar la operación. Inténtalo de nuevo."`.
21. Body nulo / inesperado (`null`, `undefined`, string, `details` no-objeto, status `0`) → **no lanza**
    y devuelve siempre un string no vacío.

## Comando ejecutado

```bash
npx vitest run tests/unit/auth-form.test.ts
```

## Salida real del fallo (RED)

```
 RUN  v4.0.18 C:/Proyectos/GYR/gyr-next

 ❯ tests/unit/auth-form.test.ts (0 test)
node.exe :
En línea: 1 Carácter: 1
+ & "C:\Program Files\nodejs/node.exe" "C:\Program Files\nodejs/node_mo ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError

⎯⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/unit/auth-form.test.ts [ tests/unit/auth-form.test.ts ]
Error: Cannot find package '@/lib/auth-form' imported from 'C:/Proyectos/GYR/gyr-next/tests/unit/auth-form.test.ts'
 ❯ tests/unit/auth-form.test.ts:2:1
     1| import { describe, expect, it } from "vitest";
     2| import {
       |         ^
     3|   authErrorMessage,
     4|   buildAuthPayload,
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 Test Files  1 failed (1)
      Tests  no tests
   Start at  22:25:56
   Duration  803ms (transform 278ms, setup 34ms, import 0ms, tests 0ms, environment 0ms)
```

**Estado RED confirmado:** el suite falla porque el módulo `src/lib/auth-form.ts` todavía no existe.
Ese es exactamente el fallo esperado antes de la implementación (GREEN).

## Alcance respetado

- Solo se creó `tests/unit/auth-form.test.ts` y este reporte.
- **No** se modificó ningún otro archivo de tests ni código de producción.
- **No** se creó `src/lib/auth-form.ts` (lo implementa @frontend-react).
- Sin dependencias nuevas, sin jsdom, sin Testing Library (entorno `node` de Vitest).
