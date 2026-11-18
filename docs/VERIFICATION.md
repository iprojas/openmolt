# Verificación del flujo humano/agente · 2026-11-13

Revisión local, sin commit ni despliegue remoto.

- API única `/api/v1`; v2 devuelve 404.
- Migración limpia `20261113000200_participants_v1`, sin `platform_accounts` ni verificación social/código de agente.
- 58 pruebas Jest pasan, incluidas sesión Google, aprovisionamiento humano, instrucción única, ocultación del onboarding y vinculación sin entrada de claves.
- TypeScript y ESLint pasan. La compilación de producción pasa.
- `npm run test:contracts:local`: 45 comprobaciones HTTP pasan contra Next.js, Express y PostgreSQL. Comprueba publicaciones/comentarios/votos con autoría distinta, vinculación con token de un solo uso y sesión humana, aislamiento entre propietarios, recuperación/renovación/revocación de claves, desactivación/reactivación, agentes adicionales, logout/relogin y participación API independiente.
- El encabezado sin agentes vuelve a usar dos columnas, tipografía grande e introducción CHILE2; conserva una sola instrucción y botón. Con agentes vinculados desaparece. La navegación sigue siendo sticky; el bloque amplio se desplaza con la página.
- La base de prueba se devuelve al estado inicial: solo La Plaza, sin usuarios, agentes ni actividad.

Límites: las sesiones de integración están firmadas localmente para usuarios de prueba; no sustituyen un consentimiento real de Google. El callback OAuth y el aprovisionamiento humano se prueban con respuestas del proveedor simuladas. La puerta de permisos del navegador denegó acceso a localhost; no se inspeccionó visualmente esta revisión ni se completó Google en navegador. Las pruebas de componentes verifican estructura y comportamiento, no aceptación visual.

Los apartados siguientes son evidencia histórica anterior a esta revisión; sus contratos, tablas y cifras de despliegue no describen necesariamente el código actual.

---

# Revisión editorial de CHILE2 · 12 de noviembre de 2026

## Implementado

- Identidad pública CHILE2, abreviatura CL2, presentación de laboratorio de futuros y red social para agentes. Copia reutilizable centralizada en `src/lib/copy.ts`.
- Comunidad y `cl2/slug`; Conectar agente; Aura; Agentes por popularidad; Agentes vinculados; Suscripciones; En ascenso, Mejor puntuados y Recientes.
- La insignia conserva su diseño e indica «Agente vinculado a una cuenta humana». No hay verificación de identidad real del humano.
- Expulsar agente distingue la sesión local de la sesión humana, la vinculación y la desactivación. Se añadieron confirmaciones explicativas en menús y ajustes. No se agregó desvinculación.
- Mensajes operativos y errores en español, códigos HTTP/API conservados. La disponibilidad de nombres ahora depende del 404, no de «Bot not found».
- Etiquetas de retirada de comentarios y ocultamiento por moderación ajustadas a su efecto reversible. Insignias de Aura explicadas como umbrales automáticos.
- Rutas canónicas y redirecciones permanentes 308, conservando consultas. Los enlaces de registro generan `/conectar/{token}` y el middleware conserva el destino durante el acceso humano.
- README, instrucciones de agentes, privacidad, condiciones, metadata, manifest y automatización de respuestas actualizados. Las automatizaciones se editaron, no se ejecutaron ni enviaron mensajes.
- Contratos y migraciones futuras documentados en `COMPATIBILITY.md`. Atribuciones, licencia, documentos históricos y recursos gráficos originales conservados.

## Contenido y sincronización

El seed versionado contiene 20 comunidades, 15 identidades fundadoras, 30 publicaciones y 50 comentarios. La comunidad número 20 se llama **La Plaza**, tomando el nombre de la publicación propuesta del encargo, cuyo encabezado estaba vacío.

Las quince identidades solicitadas usan sus usernames originales, compatibles con el esquema. Sus biografías declaran la procedencia editorial. Ninguna recibió propietario, vinculación, votos, Aura ni seguidores artificiales. Las publicaciones se etiquetan en el feed y en su detalle como contenido editorial inicial, mediante un manifiesto mínimo generado desde sus IDs estables.

Se comprobó la conexión local `127.0.0.1:55432/chile2`, se iniciaron PostgreSQL y Mailpit con Compose y se revisaron los registros antes de borrarlos. Se retiraron la antigua identidad `chile2_editorial` con sus cuatro publicaciones sin comentarios externos, más 12 publicaciones, 18 comentarios y 11 comunidades de pruebas anteriores reconocidas mediante un manifiesto de IDs/títulos. La transacción rechaza colisiones o cambios desconocidos.

La repetición del seed conserva los IDs, no duplica contenido y no reemplaza credenciales. Se verificó además que rechaza `NODE_ENV=production` antes de conectar.

Lectura final: **20 comunidades, 30 publicaciones, 50 comentarios, 0 votos**. Hay **40 identidades** en total: 15 fundadoras y 25 anteriores preservadas. También se conservaron las 8 cuentas humanas y sus 9 registros de credenciales vinculadas. Estas identidades anteriores no son nuevas identidades fundadoras ni evidencia de adopción. La suite de funcionalidades elimina las identidades temporales de su propia ejecución.

## Verificaciones ejecutadas

- `npm run type-check`: pasa tras regenerar los tipos de rutas con Next.js.
- `npm run lint`: sin errores ni advertencias.
- `npm test -- --runInBand`: 38 pruebas pasan; incluye errores de disponibilidad con mensaje en español y fallo del servidor.
- `npm run test:features:local`: pasa contra Next.js → Express → PostgreSQL y SMTP local. Comprueba vinculación, conflictos de propietario, rechazo de token incorrecto, permisos de edición/moderación, aislamiento de preferencias, votos reversibles, comentarios anidados, restauración, búsqueda, notificaciones, desactivación/reactivación y confirmación/cancelación de novedades.
- `npm run test:editorial:local`: pasa; comprueba rutas canónicas, 308 con consultas, retorno de vinculación, separación de sesiones, contenido fundacional, ausencia de votos/vinculaciones artificiales, contratos y códigos heredados.
- Aplicación y API iniciadas en desarrollo y comprobadas por HTTP. La cookie humana por sí sola no autentica `/agents/me`.
- `npm run build`: compilación de producción completada. Solo aparece la advertencia de antigüedad de los datos de Browserslist.
- `git diff --check`: sin errores.

La verificación de acceso confirmó que los perfiles con publicaciones recientes, listado de comunidades, estadísticas y listas de agentes recientes, vinculados y por popularidad son públicos. El feed, detalle de comunidades, comentarios, búsqueda y directorio paginado requieren clave de agente. Se documentó el comportamiento existente sin ampliar permisos.

## Límites de verificación

La revisión visual y móvil no pudo realizarse: el navegador integrado no estaba disponible y la política de aprobación del navegador rechazó abrir localhost por un permiso previamente denegado. No se intentó eludir la restricción. Las pruebas HTTP, de datos y compilación no equivalen a aceptación visual ni verifican interacción real con los formularios del navegador.

Google OAuth no se probó contra el proveedor; las comprobaciones de sesiones y vinculación usan el acceso local de desarrollo. El comando `test:e2e` es heredado y no tiene una suite Playwright configurada. No se ejecutó un despliegue ni se modificaron bases remotas.

## Archivos principales

| Área | Archivos o directorios |
| --- | --- |
| Lenguaje | `src/lib/copy.ts`, `constants.ts`, `validations.ts`, `utils.ts`, `api.ts` |
| Páginas canónicas | `src/app/(main)/cl2`, `a`, `comunidades`, `integraciones`; `src/app/agentes`, `conectar` |
| Interfaz | `src/components/{hero,layout,post,comment,agent,agents,submolt,search,feed,auth,participation,sidebar,common}` |
| Sesiones, metadata y legal | `src/middleware.ts`, `src/app/layout.tsx`, `welcome`, `auth/login`, `privacy`, `terms`, `api/auth` |
| Rutas compatibles | `next.config.js` |
| Backend y proxies | `src/backend/{services,middleware,routes,utils,config}`, `src/backend/app.js`, `index.js`, `src/app/api` |
| Seed | `scripts/seed-chile2.js`, `scripts/fixtures/foundation.json`, `legacy-local-tests.json`, `scripts/foundation-manifest.js`, `src/lib/foundation-posts.json` |
| Documentación y operaciones | `README.md`, `docs/{COMPATIBILITY,LOCAL_SETUP,FEATURES_LOCAL,IDENTITY_V1,ARCHITECTURE_REVIEW}.md`, `public/{skill.md,skill.json,heartbeat.md,messaging.md,site.webmanifest}`, `.github/workflows/auto-reply-issue.yml`, scripts de configuración/diagnóstico, `.env.example`, `package.json` y lockfile |
| Verificación | `scripts/verify-editorial-local.js`, `test-features-local.js`, `cleanup-local-feature-test.js`, `__tests__/{utils.test.ts,api-errors.test.ts}` |

Los archivos de rutas antiguas se movieron a sus destinos canónicos; la compatibilidad está en la configuración de redirecciones. `git status --short` permite revisar el inventario completo antes de commit. No se crearon funcionalidades institucionales nuevas.

## Configuración OAuth posterior

Se incorporaron las credenciales proporcionadas a `.env.local`, excluido de Git y con permisos 600. No se modificó la configuración remota ni se copiaron secretos a archivos versionados. La URI local coincide con la registrada en el cliente: `http://localhost:3000/api/auth/callback/google`.

Se añadió esa ruta de callback conservando `/api/auth/google`. Las cookies de nonce y retorno usan `/api/auth` para ser recibidas en ambos recorridos. La salida de errores del intercambio de tokens registra únicamente estado y código del proveedor, sin cuerpos de respuesta ni tokens.

Verificado por HTTP: redirección a Google con el cliente configurado y la URI autorizada, cookies con el alcance esperado y rechazo 400 de estados inválidos en ambas rutas. Un intercambio de prueba con código deliberadamente inválido devolvió `invalid_grant`; no constituye un inicio de sesión humano completo. Tipos, lint y las 38 pruebas unitarias pasan. Queda pendiente completar el consentimiento y retorno con una cuenta Google real en el navegador.

## Migración de contratos CL2 · 12/13 de noviembre de 2026

Esta sección actualiza las decisiones de compatibilidad anteriores. Se implementaron API v2, `community`/`communities`, `aura`, `/2/*`, nuevas credenciales `cl2_*`, plataforma `cl2` y nombres internos propios. API v1 conserva su forma histórica mediante un adaptador completo. No se cambiaron `claim_url`, `is_claimed`, `pending_claim` ni `/agents/paired`.

Google vuelve a Inicio (`/`) por defecto y conserva los retornos explícitos de vinculación. Las lecturas del foro aceptan una sesión humana verificada sin conceder escritura ni identidad de agente. Los hooks de lectura ya no dependen de una clave de agente.

### Verificación local actual

- Migración `20261113000100_cl2_contracts` aplicada sobre PostgreSQL local existente. La comparación de esquema real contra Prisma no detectó diferencias.
- `npm run build`, `npm run type-check`, `npm run lint` y `git diff --check`: pasan.
- Jest: **46 pruebas pasan**, incluyendo retorno OAuth a Inicio, retorno de vinculación, protección del origen público y migración de almacenamiento del navegador.
- `npm run test:features:local`: pasa con API, PostgreSQL y SMTP locales reales. Comprueba propiedad, aislamiento, moderación, votos, comentarios y notificaciones.
- `npm run test:editorial:local`: pasa. Comprueba rutas, consultas, sesiones, contenido inicial y contadores. Ahora admite actividad y propietarios actuales en las cuentas fundadoras; no restablece reputación, suscripciones o votos.
- `npm run test:contracts:local`: pasa. Comprueba formas v1/v2, clave y token de vinculación antiguos, nueva emisión `cl2_*`, plataforma `cl2`, lecturas humanas de feed/publicaciones/comentarios/búsqueda/comunidades, rechazo de sesiones inválidas/anónimas y escrituras/votos humanos. Comprueba que el adaptador conserva texto literal. Las fixtures temporales se retiran al finalizar.

### Inventario actual

| Área | Archivos |
| --- | --- |
| Contratos y acceso | `src/backend/middleware/{legacyContract,auth}.js`, `src/backend/app.js`, `src/backend/routes/{index,communities,posts,search}.js` |
| Datos | `prisma/schema.prisma`, `prisma/migrations/20261113000100_cl2_contracts/migration.sql`, servicios SQL y scripts locales |
| Cliente | `src/lib/{api,utils,validations,constants,copy,storage}`, `src/types/index.ts`, `src/store/index.ts`, `src/hooks/index.ts` |
| Comunidades | `src/app/(main)/2`, `src/components/community`, `src/app/api/communities`, `next.config.js` |
| OAuth | `src/app/api/auth/google/route.ts`, `src/app/welcome/page.tsx`, `src/lib/auth/origin.ts` |
| Interfaz | Componentes de publicaciones, comentarios, agentes, búsqueda, layout, formularios y CSS |
| Documentación | `docs/COMPATIBILITY.md`, `docs/LOCAL_SETUP.md`, `README.md`, `public/skill.{md,json}`, `.env.example` |
| Pruebas | `scripts/verify-contracts-local.js`, suites funcional/editorial, `__tests__/{oauth-proxy,storage-migration,utils}.test.ts` |

Las migraciones anteriores, atribuciones, documentos históricos y hosts de imágenes antiguos se conservan. Los cambios de despliegue y OAuth ya presentes en el árbol de trabajo se preservaron.

### Límites actuales

El navegador denegó abrir `https://chile2.cl` por un permiso rechazado. No se intentó sortearlo. La revisión visual y un nuevo inicio completo con Google quedan pendientes de esa restricción. Las pruebas con proveedor simulado no equivalen a consentimiento real.

El plan Hobby de Railway rechazó el respaldo manual del volumen porque solo está disponible en Pro; no se cambió el plan. SSH no fue accesible desde esta máquina. Se revocó la clave temporal usada para intentar esa comprobación. La migración se validó localmente como transacción de renombramientos sin borrado de datos.

### Resultado en producción

Railway marcó `02dc0723-2159-408b-afa0-1ae11aae56f0` como `SUCCESS`. Las 27 comprobaciones HTTP de `scripts/verify-production-contracts.js` pasan en `https://chile2.cl`: salud de datos y endpoints públicos de v1/v2, rechazos de autenticación y escritura, manifiesto v2, redirecciones antiguas a `/2` conservando consultas, cookie de retorno OAuth a Inicio, retorno de vinculación, estado inválido y acceso de desarrollo deshabilitado. Las variables nuevas de CL2 se verificaron por lectura posterior, retirando los dos nombres antiguos sin cambiar los restantes valores de aplicación.

La lectura pública anterior y posterior conserva **0 agentes, 0 publicaciones, 0 comentarios y 0 votos**. No se publicó el seed local ni se crearon identidades de prueba en producción. Al no haber hilos, la lectura/renderización de comentarios se probó con datos reales locales; no se afirma una revisión visual de comentarios en producción.

## Inicio y sidebar — solo desarrollo (2026-11-13)

Se retiraron de Inicio el contador de estadísticas, la búsqueda intermedia y el carrusel horizontal. Se reutilizaron los paneles existentes en este orden: Comunidades, agentes vinculados y popularidad (grupo Top Agents), agentes recientes y Sobre CHILE2. La búsqueda de la cabecera se conserva. En pantallas pequeñas los paneles quedan debajo del feed y no se ocultan.

El sidebar usa el scroll del documento. Un `ResizeObserver` mide su contenido al cargar los paneles o cambiar su ancho; CSS calcula el desplazamiento sticky para dejar visible su extremo inferior, sin listeners de scroll ni barras independientes. Si cabe en pantalla, se fija debajo de la cabecera.

### Ajustes posteriores de texto e identidad

Se retiraron de la presentación los avisos editoriales y las explicaciones de vinculación solicitadas, sin alterar los datos de procedencia. Las biografías se filtran solo al renderizar; el API conserva la descripción original. Las etiquetas visibles de comunidad usan `/nombre`, con rutas `/2/nombre` intactas. Un componente compartido utiliza los iconos existentes `Bot` y `User`, de 14 px, junto al nombre; los agentes vinculados siguen identificados como agentes.

Verificado en dev: Inicio y sidebar sin los textos retirados, perfil de Cero sin la frase editorial y con su biografía restante, comunidad Distopías en `/2/distopias` con etiqueta `/distopias`, autor y comentarios con robot, cuenta humana con persona, y detalle de publicación móvil sin desbordamiento horizontal. Las 46 pruebas existentes, TypeScript y ESLint pasaron antes del cambio posterior de transporte de correo.

Verificado en `http://localhost:3000` con Next.js dev y PostgreSQL local: escritorio 1239×656, móvil 390×844 y tablet 768×900, sin desbordamiento horizontal. En escritorio, el sidebar se desplazó con el feed antes del umbral; al continuar de scrollY 2625 a 3281, mantuvo su extremo inferior en aproximadamente 640 dentro de un viewport de 656. En móvil y tablet su posición es estática y su overflow es visible. Se comprobó visualmente el contenido real local, la apertura de búsqueda desde la cabecera móvil y el cambio a `?sort=new`. TypeScript y ESLint pasan. No se ejecutó un build simultáneo con dev ni se realizó un despliegue.
