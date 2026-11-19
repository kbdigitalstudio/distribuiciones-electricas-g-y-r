# Review report - commit 0f8087d

- Diff revisado: 4904e6c..0f8087d
- Alcance: mega-menu de categorias (desktop + movil), modal de login/registro, estado de sesion y contratos asociados.
- Resultado: BLOCK - 0 CRITICAL, 2 HIGH, 10 MEDIUM, 3 LOW.
- Nota de alcance: las ubicaciones corresponden al objeto del commit 0f8087d, no al working tree.

## CRITICAL

No se encontraron issues CRITICAL en este commit.

## HIGH

### HIGH-01 - El drawer movil declara ser modal, pero no controla el foco

- Archivo:linea: src/components/layout/mobile-menu.tsx:23-28,52-57
- Que falla: el drawer declara role="dialog" y aria-modal="true", pero no mueve el foco dentro, no atrapa Tab/Shift+Tab, no cierra con Escape y no devuelve el foco al disparador. Este commit anade el acordeon con 14 categorias y decenas de enlaces dentro de ese modal, por lo que el teclado puede recorrer el contenido oculto detras del overlay y el foco puede perderse al cerrar. Es un bloqueo de accesibilidad WCAG 2.2 AA.
- Fix minimo: anadir en MobileMenu un ref al dialogo, foco inicial en "Cerrar menu", un listener de teclado que cierre con Escape y mantenga Tab dentro del dialogo, y restaurar el foco al trigger al cerrar. Una alternativa nativa es usar dialog con showModal() y close().

### HIGH-02 - No hay pruebas automatizadas para la nueva UI interactiva

- Archivo:linea: src/components/layout/categories-menu.tsx:74-167,245-502; src/components/ui/auth-modal.tsx:104-355; src/components/layout/user-access.tsx:20-131
- Que falla: se anaden mas de 1.100 lineas de UI interactiva sin ninguna prueba automatizada de componentes. Los 101 tests unitarios pasan, pero ninguno importa CategoriesMenu, AuthModal o UserAccess; la evidencia E2E mencionada en el resumen es manual y no quedo versionada. Quedan sin regresion los errores de foco, Escape, payload, retry, error de red y estado de sesion.
- Fix minimo: versionar pruebas automatizadas minimas: agrupacion/cache y error/retry del menu; payload exacto, validacion, 401/409/429/500, foco atrapado/devuelto y Escape del modal; carrera de /api/auth/me y logout. Usar el stack de tests existente y cubrir como minimo happy path + error path.

## MEDIUM

### MEDIUM-01 - El submit de auth puede competir con un cambio de modo

- Archivo:linea: src/components/ui/auth-modal.tsx:173-213,338-348
- Que falla: el cambio Login/Registro sigue habilitado mientras hay un submit en vuelo. handleSubmit conserva el mode del render en que se envio: si el usuario cambia a "Registrate" durante un login, un 401 aparece en el formulario de registro y un 200 puede iniciar sesion y cerrar el modal inesperadamente. Ademas, la peticion no se aborta al cerrar ni tiene timeout, por lo que un request colgado deja submitting=true y bloquea incluso una reapertura.
- Fix minimo: deshabilitar el cambio de modo mientras submitting sea true, abortar la peticion al cerrar/desmontar y anadir un timeout nativo con AbortSignal.timeout(). Opcionalmente guardar el modo enviado y descartar una respuesta cuyo contexto ya cambio.

### MEDIUM-02 - El modal conserva la contrasena y los errores al cerrarse

- Archivo:linea: src/components/ui/auth-modal.tsx:107-115,167-171,208,219,248,262
- Que falla: AuthModal permanece montado en Header; al cerrar no se limpian values, fieldErrors, generalError ni mode. La contrasena y el error anterior sobreviven al cierre y vuelven a aparecer al reabrir el modal.
- Fix minimo: centralizar el cierre en un handleClose() que limpie valores (incluida la contrasena), errores y modo antes de llamar onClose(), y usar ese handler en Escape, overlay, boton y exito.

### MEDIUM-03 - Estado de sesion desconocido se presenta como usuario anonimo

- Archivo:linea: src/components/layout/user-access.tsx:22,26-49,90-104
- Que falla: user igual a null significa a la vez "todavia no compruebe la sesion" y "sesion confirmada como anonima". Antes de terminar GET /api/auth/me, el boton aparece como "Iniciar sesion" y un usuario autenticado puede abrir el modal de login. Ademas, un 500 o error de red se convierte silenciosamente en anonimo.
- Fix minimo: separar loading, authenticated, anonymous y error. Deshabilitar o esperar el click durante la comprobacion inicial y diferenciar 401 de 5xx/red antes de limpiar user.

### MEDIUM-04 - El logout no valida CSRF

- Archivo:linea: src/components/layout/user-access.tsx:72-84; contexto servidor src/app/api/auth/logout/route.ts:7-37
- Que falla: el logout es un POST autenticado que cambia estado, pero el cliente no envia x-csrf-token y el servidor no llama a validateCsrfToken. Una peticion cross-site puede intentar invalidar la cookie de sesion. SameSite=strict es una defensa adicional, no reemplaza la validacion CSRF y el entorno permite configurar COOKIE_SAMESITE. Login y registro si son publicos por diseno y usan JSON same-origin; el problema aplica al logout.
- Fix minimo: leer la cookie CSRF no-httpOnly y enviar x-csrf-token; exigir validateCsrfToken en POST /api/auth/logout (o validar Origin). El cambio de servidor es necesario aunque el cliente se actualice.

### MEDIUM-05 - El logout puede mostrar exito falso y dejar una promesa rechazada

- Archivo:linea: src/components/layout/user-access.tsx:72-84,118-126
- Que falla: handleLogout solo tiene finally: un error de red produce una promesa rechazada no manejada y ningun mensaje; una respuesta no-2xx muestra igualmente "Sesion cerrada". El usuario puede creer que cerro sesion cuando el servidor no lo confirmo.
- Fix minimo: capturar el error, comprobar response.ok, mostrar exito solo tras confirmacion y un mensaje de fallo en caso contrario. Anadir estado loggingOut para impedir doble submit.

### MEDIUM-06 - La semantica del menu de cuenta no coincide con su teclado

- Archivo:linea: src/components/layout/user-access.tsx:51-70,90-127
- Que falla: el popup declara role="menu", role="menuitem" y aria-haspopup="menu", pero no implementa el patron de menu con flechas, no tiene aria-controls y Escape no devuelve el foco al boton. Si el foco esta en "Cerrar sesion", Escape desmonta ese elemento y el foco cae al body.
- Fix minimo: la correccion minima es tratarlo como disclosure: quitar roles de menu, conservar aria-expanded, anadir aria-controls y devolver el foco al trigger en Escape. Si se mantiene role="menu", implementar el patron ARIA completo.

### MEDIUM-07 - Los campos obligatorios no exponen required a assistive tech

- Archivo:linea: src/components/ui/auth-modal.tsx:24-30,289-302
- Que falla: los campos obligatorios del contrato no exponen el estado required a tecnologias asistivas: no hay required ni aria-required. noValidate evita la validacion visual del navegador, pero no elimina la semantica accesible del atributo.
- Fix minimo: anadir required=true a la configuracion de los 2 campos de login y 7 de registro y propagarlo al input; aria-required es la alternativa explicita.

### MEDIUM-08 - Los errores de validacion local no se anuncian

- Archivo:linea: src/components/ui/auth-modal.tsx:177-181,279-307
- Que falla: los errores de validacion local aparecen visualmente, pero no se anuncian: los parrafos de error no estan en una region live y el foco permanece en "Entrar" o "Crear cuenta". aria-describedby solo sirve si el usuario vuelve a enfocar cada input.
- Fix minimo: mover el foco al primer campo invalido al enviar y/o envolver el resumen de errores en role="alert" o aria-live="polite". Mantener el aria-describedby por campo ya implementado.

### MEDIUM-09 - El overlay de auth queda encerrado en el stacking context del header

- Archivo:linea: src/components/ui/auth-modal.tsx:245-257; contexto src/components/layout/header.tsx:22
- Que falla: el overlay usa z-50, pero esta dentro del header sticky con z-40, que crea un stacking context. Su z-50 queda encerrado en el contexto del header; controles siblings con z-50 (por ejemplo WhatsApp) se dibujan por encima del overlay y pueden recibir clicks mientras el modal declara ser modal.
- Fix minimo: renderizar AuthModal mediante createPortal hacia document.body (o como sibling del header) y asignar un z-index superior al de los overlays globales.

### MEDIUM-10 - El boton de categoria de escritorio queda en 40 px

- Archivo:linea: src/components/layout/categories-menu.tsx:333-347
- Que falla: el boton de categoria de escritorio mide aproximadamente 40 px (text-sm mas py-2.5), por debajo del objetivo de 44 px requerido para controles del proyecto. El resto de controles nuevos si usa min-h-[44px].
- Fix minimo: anadir min-h-[44px] al boton de categoria y verificar en navegador el ancho y alto final de cada objetivo.

## LOW

### LOW-01 - Hay dos disparadores visibles del menu movil

- Archivo:linea: src/components/layout/header.tsx:25-31,58-61; src/components/layout/mobile-menu.tsx:75-84
- Que falla: por debajo de 768 px se renderizan dos disparadores visibles de menu. Solo uno declara aria-expanded; ninguno declara aria-controls, por lo que la relacion con el drawer no es coherente.
- Fix minimo: renderizar un solo trigger y enlazarlo con aria-controls="mobile-navigation" y el id del dialogo.

### LOW-02 - aria-haspopup anuncia un menu que no existe

- Archivo:linea: src/components/layout/categories-menu.tsx:289-296
- Que falla: aria-haspopup="true" implica un popup de tipo menu, pero el panel no tiene semantica de menu ni navegacion por flechas. aria-expanded y aria-controls ya describen el comportamiento disclosure.
- Fix minimo: quitar aria-haspopup o usar el valor que corresponda a un patron realmente implementado.

### LOW-03 - La nueva miniatura usa img sin optimizacion de Next

- Archivo:linea: src/components/layout/categories-menu.tsx:181-186
- Que falla: la nueva miniatura usa img y ESLint reporta @next/next/no-img-element. No hay src, width ni height para pista de optimizacion, aunque las clases fijan el tamano visual.
- Fix minimo: usar next/image con dimensiones 40x40 y remotePatterns para los hosts del catalogo; si el host es dinamico o no permitido, mantener img con loading="lazy", decoding="async", width y height y documentarlo.

## Verificaciones ejecutadas

- git diff --check 4904e6c..0f8087d: PASS, sin whitespace errors.
- npx tsc --noEmit: PASS, sin errores.
- npx vitest run tests/unit: PASS, 9 archivos y 101/101 tests. No cubren los componentes modificados; ver HIGH-02.
- ESLint sobre archivos tocados: 0 errores; 3 warnings de img y 1 aviso por CSS fuera de la config de ESLint.
- Tailwind CSS 4.3.3, compilacion aislada de candidatos: PASS. outline-3, outline-offset-2, outline-[var(--color-gyr-focus)], bg-gyr-danger-bg, hover:bg-gyr-primary-strong/90 y grid-cols-[280px_1fr] generan CSS valido. focus-visible:outline-[var(--color-gyr-focus)] produce outline-color: var(--color-gyr-focus).
- Contraste calculado: #0f766e sobre blanco 5.47:1; #b91c1c sobre #fef2f2 5.91:1; #626262 sobre blanco 6.10:1. Los tokens nuevos de texto, cursor y foco cumplen AA.
- Contrato API: PASS. Login usa email + password; registro usa 7 campos exactos; hay dos GET en paralelo; la agrupacion usa product.category.id; la cache y pendingRequest se comparten entre desktop y movil; los listeners de documento tienen cleanup.
- Seguridad del diff: sin dangerouslySetInnerHTML, secretos ni almacenamiento de tokens en cliente. La sesion del servidor usa cookie httpOnly y SameSite strict por defecto. Confirmado: login/registro son publicos por diseno; logout si requiere la correccion CSRF indicada.
- Dependencias y licencias: sin dependencias nuevas. lucide-react ya estaba instalada; licencia ISC (iconos Feather MIT).

## Veredicto

**No aprobar todavia.** Resolver primero HIGH-01 y HIGH-02, y despues los MEDIUM de interaccion y auth.

Los puntos positivos estan correctamente resueltos: se elimino el 3D inexistente, el modal de auth tiene focus trap y retorno de foco propios, no hay XSS, el payload y la agrupacion respetan el contrato, las dos peticiones son paralelas y la cache compartida deduplica la carga.

Nota de concurrencia: el working tree mostro cambios sin commit durante la revision, incluidos cambios en src/components/ui/auth-modal.tsx con un handleClose() que limpia el formulario. Este informe evalua exclusivamente el commit 0f8087d y no esos cambios; por eso MEDIUM-02 sigue registrado para el objeto revisado.


