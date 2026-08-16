# Editor de landings v2 — ARCH-LANDING-EDITOR-02 / PLAN-LANDING-EDITOR-02

> **Estado**: propuesta de arquitectura + plan de fases, pendiente de
> aprobación de Antonio. **Nada de este documento está implementado.**
> No se toca código hasta la aprobación explícita, y aun aprobado, las
> **decisiones pendientes** marcadas en la §21 deben resolverse antes de
> empezar la fase que dependa de cada una.
>
> Este documento se apoya en una auditoría completa del sistema actual
> (código real, con archivo y línea citados) hecha antes de proponer nada
> — ver §1.
>
> **Decisiones resueltas por Antonio (2026-08-11)**: P-1 = 4 niveles de
> profundidad máxima (confirmado, ver §21). P-2 a P-6 = se aplican mis
> recomendaciones por defecto por ahora, a confirmar puntualmente cuando
> cada fase que depende de ellas esté por empezar (Fase 5 para P-2/P-4,
> Fase 7 para P-3, ahora mismo para P-5/P-6 — ver §21 para el detalle de
> cada default). **Fase 1 ya está cerrada** — ver estado dentro de §23.

---

## 1. Diagnóstico del editor actual

Auditoría completa (no resumen): `packages/core/src/domain/content/`
(page-content.ts, page.entity.ts, block-operations.ts,
block-type-catalog.ts, theme-id.ts), `packages/ui/src/blocks/*`,
`packages/ui/src/themes/*`, `apps/admin/src/app/(dashboard)/offers/[id]/pages/*`,
`apps/agent-api/src/app/api/v1/agent/pages/**`, `apps/agent-api/src/lib/openapi.ts`,
`prisma/schema.prisma`, y grep dirigido de rich-text/CSP/sandboxing/media
en todo el repo.

**Lo que existe hoy, con precisión:**

1. `Page.content` es JSON validado en dominio por `kind` (LANDING/CHECKOUT/THANK_YOU),
   nunca en Postgres. Para LANDING hay **dos formatos que coexisten sin
   migración forzada**: uno legacy (campos planos: `heroTitle`, `bodyHtml`,
   etc.) y uno de bloques (`{blocks: LandingBlock[]}`). `parseLandingPageContent`
   elige el schema según la forma del JSON; **nunca convierte uno en el
   otro** — es el precedente directo de cómo este documento propone
   convivir con un tercer formato nuevo (§17).
2. **8 tipos de bloque**, cerrados por `z.discriminatedUnion`, cada uno con
   campos fijos: `hero`, `vsl`, `benefits`, `testimonials`, `faq`,
   `guarantee`, `cta`, `richText`. Todo bloque tiene `id` (string, asignado
   por quien lo crea) — es el mecanismo que ya permite que un agente
   direccione un bloque puntual (`PATCH .../blocks/{blockId}`).
3. **Un array plano, sin jerarquía.** No hay columnas, grids, ni contenedores
   anidados. Reordenar es "reemplazar el array completo de ids" — no hay
   mover-a-posición ni agrupar.
4. **`richText.html` es la única grieta de confianza real**: HTML crudo,
   sin sanitizar, renderizado con `dangerouslySetInnerHTML` — igual que el
   `bodyHtml` legacy. Ambos sitios llevan un comentario explícito
   asumiendo que solo un admin autenticado los escribe. **No hay sanitizador
   en ninguna parte del repo, no hay CSP, no hay ningún `sandbox=` en los
   4 `<iframe>` existentes.** Esto no es una regresión de esta propuesta —
   es el estado real hoy, y esta propuesta lo hereda como riesgo a acotar
   (§20, §22 fase de hardening).
5. **No existe ningún concepto de media/asset.** Toda imagen/video es un
   `z.string().url()` que alguien ya subió a otro lado. Cero tabla, cero
   proveedor de storage, cero pipeline de upload.
6. **No hay ninguna librería de rich text, sanitización ni markdown** en
   ningún `package.json` del monorepo (tiptap/slate/lexical/dompurify/etc.
   — cero coincidencias). Se construye desde cero, no se integra algo
   existente parcialmente.
7. **El editor humano es de formularios estructurados**, no WYSIWYG:
   `landing-blocks-form.tsx` mantiene un array en `useState`, con
   reordenamiento **por índice** (botones ↑/↓) — a pesar de que el dominio
   ya direcciona bloques por `id`. Cada tipo de bloque tiene su propio
   formulario de campos fijos (`block-fields.tsx`), sin editor de texto
   enriquecido — el campo `html` de `richText` es un `<Textarea>` plano.
8. **El formulario legacy y el editor de bloques se muestran juntos**, para
   la misma Page, y ambos escriben al mismo `content` — "quien guarde
   último gana" (comentario explícito en el propio código).
9. **El sistema de temas ya es sólido y reusable**: 4 presets
   (`premium-light`, `premium-dark`, `editorial`, `high-conversion`), cada
   uno con 18 colores + 5 presets de estilo (fuente, radios, botones,
   cards, spacing), traducidos a ~30 variables CSS por
   `themeToCssVars()` y aplicados vía un `ThemeProvider` que es **Server
   Component puro** (sin JS de cliente). El tema es por `Offer`, no por
   Page — todas las Pages de una Offer comparten tema. **Este sistema de
   tokens es la base correcta sobre la que extender estilos por elemento
   (§5), no algo que haya que reemplazar.**
10. **El Agent Access Layer ya tiene una superficie de escritura completa
    y madura** sobre bloques: crear Page, PATCH de contenido completo (CAS
    vía `If-Match`/`version`), add/update/remove de un bloque puntual,
    reorder, variantes A/B, publish/unpublish/preview — todo con
    Idempotency-Key, rate limiting, auditoría atómica y scopes
    (`read`/`write:pages`/`publish:pages`) + `allowedOfferIds`. **Este es
    el activo más valioso a preservar intacto**: es la razón por la que
    la propuesta generaliza este mismo patrón en vez de inventar uno
    nuevo (§4, §14).
11. **El único límite de arquitectura verificado por máquina** (no por
    convención) es `packages/core/.dependency-cruiser.cjs`, y solo
    protege las capas dentro de `packages/core` (domain no importa
    application/infra, application no importa infra). **No hay ninguna
    regla que impida que `apps/web`/`apps/admin` importen lo que sea de
    `packages/ui`/`packages/core`** — la separación domain↔UI (p. ej.
    `theme-id.ts` no importa `packages/ui`) es solo un comentario en
    código, no una regla de CI.

**Conclusión del diagnóstico**: no hay que rescatar nada roto — el sistema
actual es coherente y deliberado dentro de su alcance (8 bloques, array
plano, temas por Offer, Agent API completo sobre esa forma). El problema
es que ese alcance es angosto para lo que Antonio pide. La evolución
correcta es **generalizar los mismos patrones que ya funcionan**
(contenido validado por Zod, discriminado por tipo, direccionable por id,
con CAS/idempotencia/auditoría genéricos sobre "escribir en `Page.content`")
hacia un modelo más expresivo — no reemplazarlos.

---

## 2. Objetivo del nuevo sistema

Permitir landings visualmente libres y sofisticadas (media rica, layouts
compuestos, texto con estilo por tramo, elementos decorativos) **sin**:

- introducir HTML/CSS arbitrario como mecanismo principal;
- romper ninguna Page/bloque/theme/flujo existente;
- perder la capacidad de que un agente componga/publique sin intervención
  de UI;
- convertir el modo código en una vía de ejecución arbitraria en servidor;
- convertir cada landing en una aplicación/deploy independiente.

El mecanismo para lograrlo es **generalizar de "array plano de 8 bloques"
a "árbol de nodos sobre un catálogo cerrado de primitivas"**, con estilos
acotados a un sistema de tokens (no CSS libre), rich text estructurado (no
HTML libre), y una capa de medios como subsistema nuevo pero acotado.

---

## 3. Arquitectura propuesta (resumen ejecutivo)

```
Page.content (JSON, sin cambios de columna)
  └─ parsePageContent(kind, raw)              ← existente, gana una 3ª rama
       ├─ legacy (flat fields)                ← existente, intacto
       ├─ blocks ({blocks: LandingBlock[]})    ← existente, intacto
       └─ composition ({version:"composition-1", root: Node})   ← NUEVO

Node (nuevo, packages/core/src/domain/content/composition/)
  ├─ container nodes: "section" | "row"        (tienen children: Node[])
  └─ element nodes: "richText" | "image" | "video" | "gallery" | "icon"
                   | "divider" | "button" | "spacer" | "shape"
                   | "legacyBlock"  ← envuelve 1 de los 8 LandingBlock
                                       existentes tal cual (reuso total)

Cada Node: {id, type, content: <por tipo, Zod cerrado>, style?: StyleProps, children?}

StyleProps (nuevo) — SIEMPRE tokens, nunca CSS libre:
  spacing (escala cerrada) | color (token del Theme o BrandOverride ya
  existente) | typography (escala cerrada) | responsive overrides por
  breakpoint (base/md/lg, cerrado)

RichText (nuevo, no HTML) — árbol tipo Portable Text:
  RichTextDoc = Block[]      Block = {style: "p"|"h1".."h4", children: Span[]}
  Span = {text, marks: ("bold"|"italic"|"underline"|"strike"|"highlight"
                        |"link"|"color:<token>"|"size:<escala>")[]}

Renderer (packages/ui):
  CompositionRenderer(root, theme) — misma forma que LandingRenderer hoy:
  switch puro sobre node.type → 1 componente por tipo, mismos primitives
  (Section/Container/Grid/Card/...) + los 8 componentes de bloque
  existentes reusados 1:1 dentro de "legacyBlock".

Agent API (apps/agent-api) — generaliza el patrón blocks/reorder/variants
  ya existente a nodos direccionables por id dentro del árbol, mismo CAS
  (If-Match/version), misma Idempotency-Key, misma auditoría, mismo scope
  write:pages. Nuevo subsistema de medios bajo un scope propio (§15).

Modo código = edición directa del mismo JSON validado por el mismo Zod,
  nunca ejecución de código (§12).
```

**Por qué un árbol y no seguir con un array plano con más tipos de bloque**:
columnas/grids/secciones anidadas son inherentemente jerárquicos — forzar
eso en un array plano obliga a "bloques de layout" que simulan jerarquía
con convención (p. ej. "estos 3 bloques consecutivos son una fila"), lo
cual es exactamente el tipo de fragilidad implícita que ya causó un bug
real esta sesión (F4, variantes rompiendo una asunción implícita de F2).
Un árbol explícito hace la estructura real, no convencional.

---

## 4. Modelo de contenido futuro

`Composition = { version: "composition-1", root: SectionNode }`. Raíz
siempre una lista de `section`. Cada `section` contiene `row`s; cada `row`
contiene columnas (una `row` con N hijos = N columnas, con `span` cerrado
tipo grid de 12, igual de cerrado que el resto — nunca `flex-basis: 37.2%`
libre); cada columna contiene nodos elemento (hoja) o, si se decide
permitirlo, otra `row` anidada (decisión de profundidad máxima — ver §21
pendiente P-1).

Todo Node comparte: `id` (string, mismo rol/ADR-04 que hoy), `type`
(cerrado), `content` (por tipo), `style?` (§5), y `children?` solo en
container nodes. **Nunca** un campo `html`/`css`/`script` libre en ningún
nodo nuevo — la única vía a HTML libre sigue siendo el `richText` legacy
de bloques viejos, contenido y no extendido.

---

## 5. Modelo de estilos

`StyleProps` es un objeto Zod cerrado, no un string de CSS:

```ts
StyleProps = {
  spacing?: { top?: SpacingToken; bottom?: SpacingToken; x?: SpacingToken },
  background?: { colorToken?: ThemeColorToken; imageAssetId?: string; overlay?: OverlayToken },
  typography?: { sizeToken?: TypeScaleToken; weightToken?: WeightToken; alignToken?: "start"|"center"|"end" },
  color?: { textToken?: ThemeColorToken },
  layout?: { widthToken?: WidthScaleToken; heightToken?: HeightScaleToken },
  responsive?: { md?: Partial<StyleProps>; lg?: Partial<StyleProps> },  // override cerrado, no media queries libres
}
```

`SpacingToken`/`TypeScaleToken`/etc. son uniones cerradas (p. ej.
`"xs"|"sm"|"md"|"lg"|"xl"|"2xl"`), igual de cerradas que
`FontPreset`/`RadiusPreset` ya existentes en `packages/ui/src/themes/types.ts`.
`ThemeColorToken` referencia uno de los 18 roles de color que un `Theme`
ya define — nunca un hex libre, salvo a través del `BrandOverride` que
**ya existe hoy** (`primaryColor`/`accentColor`) como única puerta de
escape, sin ampliarla. Esto responde directamente al "no quiero CSS
arbitrario si existe una arquitectura mejor": la hay, y ya está construida
(`themeToCssVars`) — este modelo solo le agrega más puntos de enganche.

---

## 6. Modelo de rich text

Árbol cerrado tipo Portable Text/Slate (nunca HTML libre), full Zod:

```ts
RichTextSpan = { text: string; marks: RichTextMark[] }
RichTextMark = "bold" | "italic" | "underline" | "strike" | "highlight"
             | { type: "link"; href: string /* z.string().url(), protocolo https/mailto */ }
             | { type: "colorToken"; token: ThemeColorToken }
             | { type: "sizeToken"; token: TypeScaleToken }
RichTextBlockNode = { style: "p"|"h1"|"h2"|"h3"|"h4"; children: RichTextSpan[] }
RichTextDoc = RichTextBlockNode[]
```

Serialización a JSX es una función pura y determinista (mismo patrón que
`LandingRenderer` hoy) — nunca `dangerouslySetInnerHTML`. Esto satisface
"una parte negra, otra roja, una palabra más grande, negrita, resaltada,
todo en el mismo párrafo" con seguridad estructural: **XSS es imposible
por construcción**, porque nunca se parsea ni inyecta una cadena HTML —
solo se recorre un árbol de datos ya validado por Zod.

El `richText` de bloques legacy (`html` crudo) **no se toca ni se migra**;
sigue existiendo, sigue sin sanitizar, sigue acotado a Pages viejas (riesgo
ya presente hoy, contenido y no expandido — ver hardening en §22 fase 8).

---

## 7. Modelo multimedia

**Nuevo subsistema**, no existe nada hoy:

- Prisma: `model Asset { id, kind: IMAGE|VIDEO, url, width?, height?, altText, provider, createdAt }`
  — sin FK obligatoria a Offer (biblioteca compartible entre Offers, igual
  que hoy `Theme` es cerrado y reusable).
- Puerto `MediaStorage` en `application/` (mismo patrón hexagonal que
  `PaymentProvider`), adaptador concreto en `infrastructure/` — **el
  proveedor concreto es una decisión pendiente (§21, P-2)**, no se asume.
- Flujo: `POST /media/upload-url` devuelve una URL firmada; el cliente
  (admin o agente) sube el binario directo al storage, nunca a través de
  la función serverless (evita el mismo tipo de problema de recursos
  ajustado esta sesión con `connection_limit`); luego
  `POST /media/assets` registra el `Asset` con la URL final.
- Nodo `image`/`video`/`gallery` referencia `assetId`, nunca una URL
  suelta nueva (las URLs sueltas existentes en bloques legacy no cambian).
- Video: soporta embed externo (VSL vía URL, como ya existe) y video
  propio subido (con `posterAssetId`, autoplay solo si hay poster + mute,
  mismo criterio que ya usa `VideoFrame` hoy).
- Optimización/responsive: usar `next/image` para `Asset` con `width`/`height`
  conocidos — hoy no hay ningún pipeline de optimización, se introduce
  recién cuando hay una tabla real de la que leer dimensiones.

---

## 8. Layouts / composición

`section` (ancho completo, fondo/overlay propios) → `row` (grid de 12,
columnas como hijos con `span` 1-12) → elemento. Sin posicionamiento
absoluto libre (ningún `top/left` arbitrario) — todo layout es flujo
normal + grid de columnas, consistente con "no CSS arbitrario". Elementos
decorativos (`shape`, `divider`, `spacer`) son nodos elemento normales, no
un mecanismo aparte.

## 9. Responsive

`StyleProps.responsive.{md,lg}` como override parcial cerrado — mismo
StyleProps, subconjunto de campos, nunca media queries libres. Grid de
columnas colapsa a 1 columna por defecto por debajo de `md` salvo que se
especifique `span` explícito por breakpoint (mismo cierre: unión de
valores válidos, no números libres).

## 10. Themes y design tokens

No se reemplaza nada de `packages/ui/src/themes/` — se **extiende**:
nuevos tokens (`TypeScaleToken`, `SpacingToken`, `WidthScaleToken`, etc.)
viven junto a los `*Preset` ya existentes, se traducen a variables CSS
adicionales en `themeToCssVars` (misma función, más entradas). Los 4
presets actuales siguen funcionando sin cambios — Composition simplemente
tiene más tokens de los que tirar.

## 11. Bloques actuales vs. nuevos primitives

Los 8 `LandingBlock` **no se deprecan ni se reimplementan**. Se exponen
dentro de Composition a través de un nodo `legacyBlock` que envuelve el
`LandingBlock` tal cual y delega en el componente de bloque existente
(`HeroBlock`, `VslBlock`, etc.) sin cambios. Un agente/admin puede mezclar
"un `hero` clásico" con "una `row` de 3 columnas nueva" en la misma
Composition. Los primitives nuevos (`richText` estructurado, `image`,
`video`, `gallery`, `icon`, `divider`, `button`, `spacer`, `shape`,
`section`, `row`) son el vocabulario de composición libre; los bloques
legacy son "recetas" pre-armadas disponibles dentro de ese vocabulario.

## 12. Extensibilidad por código

**Recomendación explícita: no ejecución de código, sí edición de datos
más profunda.** Justificación: la auditoría (§1.6) confirma que hoy no
existe ningún sandbox, CSP, ni aislamiento — construir un sandbox de
ejecución real y seguro (VM aislada, iframe con CSP estricta, build/deploy
por Page) es un proyecto aparte, de alto riesgo, y choca directo con "no
quiero que cada landing sea un deploy independiente imposible de
mantener" — así que no se construye ahora (§13, §22 explícitamente fuera
de alcance).

"Modo código" para un agente/usuario técnico significa: **acceso de
lectura/escritura directa al JSON de Composition completo**, sin pasar por
los endpoints granulares (add-node/update-node) — sigue siendo el mismo
`Page.content`, mismo CAS, mismo Zod, mismo pipeline de render. Un agente
programador puede construir un árbol mucho más elaborado que lo que un
editor visual expone por UI, porque el editor visual es una vista parcial
sobre la misma capacidad, no un límite del modelo. Si además se quiere
lógica condicional simple (mostrar/ocultar un nodo según una condición,
interpolar un texto), se puede agregar una **expresión declarativa
cerrada** (gramática propia, interpretada por código propio — nunca
`eval`/`new Function`/una VM de JS) evaluada server-side sobre un conjunto
fijo de variables (campos de Offer/Price/Customer ya expuestos), nunca con
acceso a red/DB/filesystem. Esto es una decisión de alcance, no de
seguridad — puede diferirse completa a una fase posterior sin bloquear
nada (§21 P-3).

## 13. Sandbox/seguridad del modo código

Dado el diseño de §12 (datos, no código), **la sandbox es el propio Zod**:
ningún nodo puede tener una clave no declarada, ningún campo de texto es
HTML, toda URL pasa por `z.string().url()` + allowlist de protocolo
(https/mailto, nunca `javascript:`), y el render es siempre React
server-side sobre datos ya validados — no hay superficie de inyección
porque no hay parseo de strings-como-código en ningún punto de la
tubería. Si en el futuro se agrega el evaluador de expresiones de §12,
su sandbox es "no tiene APIs, solo aritmética/booleanos/string sobre un
scope fijo" — mucho menor superficie que cualquier sandbox de código real,
y no requiere infraestructura nueva (nada de vm2/Firecracker/iframes).

## 14. Compatibilidad con Agent API

Generalización, no reemplazo, del patrón ya maduro en
`apps/agent-api/src/app/api/v1/agent/pages/`:

- Todas las rutas actuales (`POST /pages`, `PATCH /pages/:id`,
  `POST/PATCH/DELETE .../blocks[/:id]`, `/reorder`, `/variants`,
  `/publish`, `/unpublish`, `/preview`) **quedan exactamente igual**,
  siguen operando sobre Pages en formato `blocks`/legacy.
- Nuevas rutas, mismo scope `write:pages`, mismo `If-Match`/CAS, misma
  Idempotency-Key, misma auditoría, mismo `allowedOfferIds`:
  `POST/PATCH/DELETE /pages/:id/nodes[/:nodeId]` (generaliza
  add/update/remove de bloque a "nodo en cualquier profundidad del
  árbol"), `POST /pages/:id/nodes/reorder` (generaliza reorder, con un
  `parentNodeId` opcional para reordenar dentro de un contenedor
  específico). Todas reusan `loadLandingPageForAgentWrite` extendido para
  reconocer el nuevo shape.
- `GET /pages/:id` sigue devolviendo `content` tal cual esté (legacy,
  blocks o composition) — un agente que solo sabe leer JSON ya funciona;
  uno que entiende el nuevo shape puede componer.
- `openapi.ts` gana el nuevo schema (`CompositionSchema` vía
  `zodToJsonSchema`, igual que hoy con `landingBlocksContentSchema`) y las
  nuevas rutas — nada de lo existente cambia de forma.

## 15. Permisos/capabilities nuevas para agentes

- `write:pages` y `publish:pages` se **reusan sin cambios** para todo lo
  de Composition — sigue siendo el mismo recurso (`Page.content`), no uno
  nuevo.
- **Nuevo scope: `write:media`** — subir/gestionar Assets es un recurso
  distinto (con costo de storage real, a diferencia de editar JSON), así
  que se gatea aparte. Un `ApiClient` puede tener `write:pages` sin
  `write:media` (compone con assets ya existentes pero no sube nuevos) —
  decisión de producto pendiente si esa separación es la deseada (§21 P-4).
- `allowedOfferIds` sigue aplicando igual a Composition Pages (pertenecen
  a una Offer, igual que hoy).

## 16. Compatibilidad hacia atrás

Ninguna Page existente cambia de formato jamás de forma automática.
`parsePageContent`/`parseLandingPageContent` gana una tercera rama,
exactamente como ya convive legacy+blocks hoy sin conversión forzada.
`landing-page-view.tsx` gana una tercera rama de render. Checkout y
Thank-you **quedan fuera de alcance de esta evolución** — sus schemas de
contenido no se toacn (confirmar con Antonio si eso es correcto, §21 P-5).
Nada de concurrencia/versionado/auditoría/idempotencia cambia — todo eso
ya es genérico sobre "escribir en `Page.content`" y sigue siéndolo.

## 17. Estrategia de migración

**No hay migración forzada, nunca.** Una Page vieja se queda vieja para
siempre salvo acción explícita y humana. Se ofrece (fase tardía, opcional)
una herramienta de conversión **no destructiva**: lee una Page en formato
`blocks`, genera una Composition equivalente envolviendo cada bloque en
`legacyBlock` dentro de una única `section`/`row` de 1 columna, la guarda
como una nueva versión de esa misma Page (respetando CAS) **solo si el
humano lo pide desde el panel**, nunca en batch ni automático. Esto es
directamente el mismo patrón ya usado y probado en este repo para
`page_variant_label_unique` (migración aditiva, cero downtime, sin tocar
filas existentes salvo explícito).

## 18. Performance

Server Components para el árbol completo (mismo patrón que
`ThemeProvider`/`LandingRenderer` hoy — cero JS de cliente para
renderizar). `next/image` para Assets con dimensiones conocidas (nuevo,
justificado por §7). Presupuesto: ninguna Composition debería pesar más
que "N nodos hoja", el árbol en sí no agrega overhead de red (sigue siendo
un único `Page.content` JSON, mismo tamaño de fila que hoy). Profundidad
máxima del árbol se acota explícitamente (§21 P-1) para que el server
component no recurse sin límite sobre contenido no confiable.

## 19. Accesibilidad

Rich text serializa a HTML semántico real (`h1`-`h4`, no `div` con
estilo visual de heading). Todo nodo `image` requiere `altText` (ya es
buena práctica en los bloques existentes — `avatarUrl` no lo exige hoy,
pero `Asset.altText` sí será obligatorio). Nodos decorativos (`shape`,
`divider`, `spacer`) se renderizan con `aria-hidden="true"`. El editor
visual (fase humana, §22 fase 6) debe tener paridad de teclado para
reordenar/agrupar — no solo mouse — igual que el editor actual ya evita
JS y usa `<details>` nativo donde puede.

## 20. Seguridad

Cubierto en detalle en §12/§13. Adicional: URLs de link/media siempre
`z.string().url()` + allowlist de protocolo. El upload de media pasa por
URL firmada de corta duración (nunca credenciales de storage expuestas al
cliente). Hardening de deuda preexistente (no introducida por esta
propuesta, pero que toca la misma área): agregar un sanitizador real
(p. ej. `sanitize-html` o `dompurify` server-side) sobre los dos sitios
`dangerouslySetInnerHTML` existentes, y una `Content-Security-Policy`
básica en `apps/web` — ninguna de las dos cosas existe hoy (§1.6), esta
evolución es la oportunidad natural de cerrarlas sin que sean bloqueantes
del resto del plan (fase 8, §22).

## 21. Decisiones pendientes — requieren tu aprobación explícita antes de construir

Por instrucción tuya, señalo cada decisión estructural encontrada durante
el diseño. No avanzo ninguna fase que dependa de una de estas sin tu
respuesta:

- **P-1 — Profundidad máxima del árbol** — ✅ resuelta: 4 niveles
  (`section > row > row(inner) > elemento`), validado por el propio schema
  de Zod (no un chequeo manual aparte). Ver Fase 1.
- **P-2 — Proveedor de storage de media** — ✅ resuelta: **Supabase
  Storage**. Antonio delegó la elección técnica; se prefirió sobre Vercel
  Blob porque el proyecto Supabase ya existente (`empresas-antonio`, mismo
  donde vive Postgres en producción — confirmado vía ADR-015) significa
  cero cuenta/proveedor nuevo, solo un bucket dentro de un proyecto que ya
  existe. Ver Fase 5.
- **P-3 — Alcance del "modo código"** — ✅ resuelta: **Opción A**,
  lectura/escritura directa del JSON de Composition, sin el evaluador de
  expresiones condicionales (§12) — diferido indefinidamente, se retoma
  solo si aparece un caso de uso real. Ver Fase 7.
- **P-4 — `write:media` como scope separado de `write:pages`** — ✅
  resuelta: separado, confirmado por Antonio. Ver Fase 5.
- **P-5 — Checkout/Thank-you fuera de alcance**: confirmo que esta
  evolución es solo para Pages `kind: LANDING`. Si querés que
  Checkout/Thank-you también ganen composición libre en algún momento, es
  una extensión natural del mismo modelo pero la marco explícitamente
  fuera de este plan salvo que digas lo contrario.
- **P-6 — Herramienta de conversión legacy→Composition (§17)**: ¿la
  querés en el alcance de este plan, o la dejamos como "no construir
  todavía" (§22)? No es necesaria para que Composition funcione — las
  Pages viejas siguen funcionando sin ella indefinidamente.

## 22. Qué NO construir todavía

- Sandbox de ejecución de código real (VM/iframe con CSP/build-per-Page) —
  explícitamente desaconsejado, no solo diferido (§12).
- Editor visual tipo canvas/WYSIWYG con drag-and-drop libre de posición
  absoluta — se construye edición estructurada del árbol primero (mismo
  espíritu que el editor de bloques actual, extendido a nodos), un canvas
  visual real es una iniciativa de frontend grande y separada, a evaluar
  recién con Composition ya estable en producción.
- Herramienta de conversión legacy→Composition (P-6, salvo que la pidas
  ahora).
- Evaluador de expresiones condicionales (P-3, salvo que lo pidas ahora).
- Cualquier integración de IA generativa de diseño/imágenes — no mencionada
  por vos, no asumida.
- CSP/sanitizador real — deuda preexistente, se cierra en fase de
  hardening (8) pero no es prerequisito de las fases 1-5.

## 23. Roadmap completo por fases

Cada fase sigue el mismo criterio de cierre que ya usa este repo
(boundaries + typecheck + lint + build en los workspaces afectados, tests
de integración contra Postgres real, smoke test end-to-end antes de
declarar la fase cerrada).

### Fase 1 — Fundaciones de dominio (sin superficie visible) — ✅ CERRADA (2026-08-11)

**Entregado**: `packages/core/src/domain/content/composition/` (`style-tokens.ts`,
`safe-url.ts`, `rich-text.ts`, `node.ts`, barrel `index.ts`) + extracción de
`landing-blocks.ts` (los 8 `LandingBlock` movidos fuera de `page-content.ts`
para que `composition/node.ts` pudiera reusar `landingBlockSchema` en su
nodo `legacyBlock` sin crear un import circular — `page-content.ts`
re-exporta todo igual, cero cambio para los consumidores existentes). P-1
(4 niveles de profundidad) implementado como **garantía estructural del
propio schema** (`innerRowNodeSchema` solo admite elementos como hijos,
nunca otra fila), no como un validador que camina el árbol aparte.

`page-content.ts` reconoce la 3ª forma (`hasCompositionShape`, marcador
`version: "composition-1"`) sin riesgo de reclasificar contenido legacy o
de bloques real. `toLandingBlocks` rechaza explícitamente el contenido
Composition con un `DomainError` claro en vez de fallar con un acceso a
campo `undefined`.

**Efecto lateral necesario, fuera del alcance original de la fase pero
requerido para no romper el pipeline**: `apps/web/src/components/landing-page-view.tsx`
tipa su `content` como `LandingPageContent`, que ahora incluye
`CompositionContent` — sin tocar el renderer (eso es Fase 2), se agregó una
rama explícita que lanza un error claro si algún día llega contenido
Composition antes de que exista `CompositionRenderer`, en vez de dejar que
TypeScript la ignorara y accediera a campos legacy inexistentes en runtime.
Ninguna Page real puede tener ese contenido hoy — no hay ningún endpoint
que lo escriba — así que esta rama es inalcanzable en la práctica.

**Verificado**:
- `pnpm run boundaries` → sin violaciones (95 módulos, 249 dependencias).
- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build` → verde en los 7
  workspaces.
- Suite completa de `packages/core` contra Postgres 16 real (las 8
  migraciones aplicadas) → **160/160 tests verdes, 7 skipped** (138 previos
  + 22 nuevos de `composition-content.test.ts`, cero regresión — los 11
  tests existentes de `page-content-blocks.test.ts` siguen pasando
  exactamente igual).
- Casos de rechazo probados explícitamente: 5º nivel de anidamiento
  (row-dentro-de-row-dentro-de-row), `columnSpan` fuera de 1-12, token de
  color fuera de la lista cerrada, mark de rich text desconocido, y
  `safeLinkUrlSchema` rechazando `javascript:`/`data:` y aceptando
  `https:`/`mailto:`.


- **Objetivo**: los schemas Zod nuevos (Node, StyleProps, RichTextDoc,
  Composition) existen, están probados exhaustivamente, y
  `parsePageContent` reconoce la 3ª forma — pero nada los escribe ni
  renderiza todavía.
- **Toca**: `packages/core/src/domain/content/` (nuevo subdirectorio
  `composition/`), extensión de `page-content.ts`.
- **Depende de**: resolver P-1 (profundidad máxima).
- **Migraciones**: ninguna (JSON, sin columna nueva).
- **Riesgos**: diseñar mal el shape ahora es caro de cambiar después — por
  eso esta fase es solo dominio + pruebas, sin apuro de exponerla.
- **Pruebas**: unitarias exhaustivas de cada schema + casos de rechazo
  (profundidad excedida, tipo de nodo inválido, mark de rich text
  desconocido, URL con protocolo no permitido).
- **Gate de cierre**: 100% de los schemas con tests de caso válido +
  inválido; `parsePageContent` con test que confirma que Pages
  legacy/blocks existentes siguen parseando exactamente igual (regresión
  cero).
- **Requiere de mí (Antonio)**: aprobar P-1.

### Fase 2 — Renderer de lectura (`CompositionRenderer`) — ✅ CERRADA (2026-08-14)

**Entregado**: `packages/ui/src/composition/` (nuevo subpath `@repo/ui/composition`):
un componente por tipo de nodo (`RichTextNode`, `ImageNode`, `VideoNode`,
`GalleryNode`, `IconNode`, `DividerNode`, `ButtonNode`, `SpacerNode`,
`ShapeNode`, `LegacyBlockNode`), `RowNode` (recursivo — renderiza tanto una
row de nivel 2 como, como mucho, una row anidada de nivel 3, terminando
solo porque el propio schema de dominio no permite un 4º nivel de fila),
`SectionNode` y `CompositionRenderer` (raíz, mismo contrato que
`LandingRenderer`: `(Composition, theme) → JSX`, sin efectos secundarios).

- `style-runtime.tsx`: traduce `StyleProps` a CSS real — **nunca clases de
  Tailwind construidas dinámicamente** (`text-${token}` sería purgado del
  bundle de producción porque Tailwind no puede ver contenido que vive en
  Postgres, no en el código fuente); todo pasa por `style` inline o por
  `var(--color-*)` (las mismas custom properties que `ThemeProvider` ya
  escribe). Los overrides `responsive.md/lg` se aplican vía un `<style>`
  Server Component con `@media` scoped por `data-node-id` — sigue siendo
  CSS derivado de tokens cerrados, nunca CSS libre.
- `legacyBlock` reusa el dispatch de bloques existente 1:1: se extrajo
  `LandingBlockDispatch` de `LandingRenderer.tsx` (antes un `switch` inline)
  para que `LegacyBlockNode` lo reuse sin duplicar el switch de 8 casos —
  cero reimplementación de Hero/Vsl/Benefits/etc.
- `image`/`video` (fuente `asset`)/`gallery`: sin Fase 5 (subsistema de
  medios) todavía no existe ningún `Asset` real que resolver — renderizan
  un placeholder honesto y accesible (`role="img"` + `aria-label`/altText
  visible) en vez de simular una imagen que no existe. `video` con fuente
  `embed` sí es 100% real ya (reusa `VideoFrame`, funciona igual que en un
  bloque `vsl` clásico).
- Columnas: cada hijo directo de una row es un ítem de un grid de 12
  (`grid-template-columns` vía Tailwind `grid-cols-12`), con `gridColumn`
  calculado en `RowNode` a partir de `style.layout.columnSpan` de cada
  hijo (default: 12 = ancho completo si no se especifica).
- `apps/web/src/components/landing-page-view.tsx`: la 3ª rama (antes un
  `throw` deliberado de Fase 1) ahora renderiza de verdad vía
  `CompositionRenderer`.

**Verificado**:
- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build` → verde en los 7
  workspaces.
- `packages/core`: 160/160 tests siguen verdes (Fase 2 no tocó dominio).
- **Smoke test real de punta a punta** (mismo criterio que el resto del
  plan — nunca solo tipos/build): se insertó directamente en Postgres real
  una Page `PUBLISHED` con una Composition de fixture que ejercita los 11
  tipos de nodo, incluida una row anidada (`row` dentro de `row`), rich
  text con 3 estilos distintos combinados en el mismo `h1` (color+tamaño
  por token, negrita+resaltado), un `legacyBlock` (`cta`) y columnas reales
  (6+6, luego 4+8 en la fila anidada). Se sirvió con un servidor real de
  `apps/web` (`next dev`) y se pidió la URL pública por HTTP: **200**, sin
  errores ni warnings de servidor, con el HTML esperado: `h1` semántico con
  los 3 tramos de estilo correctos (`color:var(--color-destructive)`,
  `font-size:36px`, `<mark><strong>`), el link real (`href="https://example.com"`),
  8 grids de 12 columnas con los spans correctos (`span 6`, `span 4`,
  `span 8`, `span 12` por defecto), el placeholder de imagen/gallery con su
  `altText`, y el bloque legacy (`cta`) renderizado con su copy real. 32
  nodos con `data-node-id` presentes en el DOM (deja el terreno preparado
  para que Fase 6, el editor visual, pueda direccionar cualquier nodo por
  id directo en el DOM).


- **Objetivo**: dado un árbol válido (construido a mano en fixtures de
  test, no todavía por ningún endpoint), se renderiza correctamente con
  el sistema de temas existente. `landing-page-view.tsx` reconoce la
  3ª forma.
- **Toca**: `packages/ui/src/blocks/` (o un nuevo `packages/ui/src/composition/`),
  `apps/web/src/components/landing-page-view.tsx`.
- **Depende de**: Fase 1.
- **Riesgos**: nodo `legacyBlock` debe reusar los componentes de bloque
  existentes sin duplicar lógica — verificar con un test que compara
  el HTML de un `hero` renderizado vía `blocks` clásico contra el mismo
  `hero` envuelto en `legacyBlock` dentro de una Composition (deben
  coincidir).
- **Pruebas**: snapshot/estructura por tipo de nodo; smoke visual manual
  (no hay Playwright de `apps/web` hoy, evaluar si conviene agregarlo aquí
  o diferirlo).
- **Gate de cierre**: una Composition de fixture con los 11 tipos de nodo
  presentes renderiza sin error en local contra Postgres real (aunque la
  Page se inserte a mano en la DB para probar, sin endpoint todavía).
- **Requiere de mí**: nada nuevo, sigue P-1 ya aprobado.

### Fase 3 — Escritura vía Agent API (agentes primero, como ya se hizo con bloques) — ✅ CERRADA (2026-08-14)

**Entregado**:
- `packages/core/src/domain/content/composition/tree-operations.ts`:
  `addNodeToComposition`, `updateNodeInComposition`,
  `removeNodeFromComposition`, `reorderChildrenInComposition` — puras, sin
  I/O, mismo criterio que `block-operations.ts` pero recorriendo un árbol
  por `id` en cualquier profundidad (no un array plano). La validación de
  profundidad/tipo **no es un chequeo escrito a mano**: cada función clona,
  muta el clon como JS plano, y siempre re-valida el árbol completo con
  `compositionContentSchema` antes de devolverlo — si el resultado viola
  P-1 (profundidad máxima) o cualquier otra regla del schema, el propio
  `compositionContentSchema.parse` lo rechaza.
- `COMPOSITION_ROOT_ID = "root"`: id sentinel para operar directo sobre
  `composition.root` (agregar/reordenar sections de nivel más alto) con la
  misma función genérica que opera sobre cualquier nodo interno — sin una
  ruta/función separada solo para sections.
- Agent API (`apps/agent-api`), mismo patrón exacto que blocks/reorder de
  F4 del Agent Access Layer (auth + scope `write:pages` + `allowedOfferIds`
  + CAS vía `If-Match` + `Idempotency-Key` + auditoría atómica, sin
  infraestructura nueva):
  - `POST /pages/:id/nodes` — agrega un nodo (`parentNodeId` omitido =
    section nueva al nivel más alto).
  - `PATCH /pages/:id/nodes/:nodeId` — patch de `content`/`style` (nunca
    `type`/`id`/`children`, rechazado en el body con `.strict()` manual
    antes de tocar dominio).
  - `DELETE /pages/:id/nodes/:nodeId`.
  - `POST /pages/:id/nodes/reorder` — reordena los hijos directos de
    cualquier contenedor.
  - **Ninguna ruta nueva para crear la Page inicial**: `POST /pages` (F4)
    ya acepta un `content` en formato `composition-1` desde Fase 1 sin
    ningún cambio — confirmado con el smoke test.
  - `apps/agent-api/src/lib/agent-composition.ts`: `loadCompositionPageForAgentWrite`
    (envuelve `loadLandingPageForAgentWrite` de F4 + verifica que el
    content ya esté en formato `composition-1`, 400 `invalid_content_format`
    si no).
  - `openapi.ts`: `PAGE_CONTENT_SCHEMA` ahora incluye Composition en su
    `oneOf`, nuevo `components.schemas.CompositionNode`, y los 3 paths
    nuevos documentados.

**Verificado**:
- `pnpm run boundaries`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build`
  → verde en los 7 workspaces.
- `packages/core`: **175/175 tests** (160 previos + 15 nuevos de
  `composition-tree-operations.test.ts`, cero regresión), incluidos casos
  de rechazo explícitos (agregar una row dentro de una row ya anidada,
  parentId inexistente, parentId que no es contenedor, id duplicado).
- `apps/agent-api`: 11/11 tests — `openapi.test.ts` sigue validando el
  documento contra el meta-schema oficial de OpenAPI 3.1 con las 3 rutas
  nuevas incluidas, y el chequeo de "rutas documentadas == rutas reales en
  disco" actualizado.
- **Smoke test HTTP real de punta a punta** contra una instancia local en
  vivo (`apps/agent-api` + Postgres real + una ApiKey real emitida por
  `manage-agent-clients.mjs`): `whoami` → `POST /pages` con `content`
  `composition-1` (201, confirma que F4 ya soporta esto sin cambios) →
  `POST .../nodes` agregando una section al root (sin `parentNodeId`) →
  `POST .../nodes` agregando un nodo dentro de un contenedor específico →
  `POST .../nodes` agregando una fila anidada (nivel 3, permitido) →
  **`POST .../nodes` agregando una fila dentro de esa fila ya anidada
  (nivel 5) → `400` real, con el `ZodError` completo en el body** (la
  garantía de profundidad de P-1 confirmada end-to-end, no solo en tests
  unitarios) → `PATCH .../nodes/:id` actualizando `style` → intento de
  patch con `type` → `400 invalid_body` rechazado → `POST .../nodes/reorder`
  → `DELETE .../nodes/:id` del único hijo de un contenedor → **`400`
  correcto** (`.min(1)` de children lo impide — un contenedor nunca queda
  vacío) → `publish` → verificado sirviendo la Page real por HTTP en
  `apps/web` (`200`, contenido y `href` reales presentes en el HTML).


- **Objetivo**: un agente puede crear una Page en formato Composition y
  operarla nodo por nodo — primera vez que existe una vía real de
  escritura.
- **Toca**: `apps/agent-api/src/app/api/v1/agent/pages/**` (nuevas rutas
  `nodes`/`nodes/reorder`), `apps/agent-api/src/lib/openapi.ts`.
- **Depende de**: Fases 1-2.
- **Migraciones**: ninguna.
- **Riesgos**: el mismo tipo de bug real ya visto en F4 de blocks
  (variante vs. primaria) puede repetirse con "nodo dentro de qué padre" —
  mitigar con el mismo tipo de test de concurrencia/CAS ya usado
  (`packages/core/test/agent-access-concurrency.integration.test.ts`,
  extendido).
- **Pruebas**: integración contra Postgres real (CAS, idempotencia,
  auditoría) + script de smoke E2E análogo a
  `scripts/e2e-agent-smoke.mjs` pero para Composition.
- **Gate de cierre**: ciclo completo agente (crear → agregar nodos
  anidados → reordenar dentro de un contenedor → publicar → preview) verde
  de punta a punta contra una instancia real.
- **Requiere de mí**: nada nuevo.

### Fase 4 — Rich text estructurado — ✅ CERRADA (2026-08-15, sin código nuevo)
- **Objetivo**: el nodo `richText` nuevo (no el legacy) soporta spans con
  múltiples marks dentro del mismo párrafo, serializado sin HTML.
- **Hallazgo al abrir esta fase**: el objetivo ya estaba completamente
  entregado como efecto colateral de las Fases 1-3, sin ningún gap —
  `richTextDocSchema`/`richTextMarkSchema` (Fase 1) ya cubren los 8 marks
  (`bold`/`italic`/`underline`/`strike`/`highlight`/`link`/`colorToken`/`sizeToken`)
  combinables libremente por span; `RichTextNode.tsx` (Fase 2) ya serializa
  cada mark a JSX semántico (nunca HTML libre) y los apila correctamente
  cuando varios marks caen sobre el mismo span; y las rutas genéricas de
  nodo de Fase 3 (`POST/PATCH/DELETE .../nodes`) ya escriben/leen `richText`
  igual que cualquier otro tipo de nodo, sin ruta especial. No se escribió
  ni modificó código de producción en esta fase — solo verificación.
- **Verificado**:
  - Test de dominio ya existente (`composition-content.test.ts`, Fase 1):
    marks combinados válidos, mark desconocido rechazado, `link` con
    protocolo inválido (`javascript:`/`data:`) rechazado por
    `safeLinkUrlSchema`.
  - **Smoke HTTP real de punta a punta** (nueva, esta fase): un agente crea
    una Page `composition-1` con un `richText` que combina un heading `h2`
    y un párrafo de una sola oración con 5 spans, cada uno con una
    combinación de marks distinta (`bold`; `italic`+`underline`;
    `highlight`+`strike`; `colorToken`+`sizeToken`; `link`) → intento de
    agregar un segundo `richText` con un mark `link` de protocolo
    `javascript:` → **rechazado con `400` real** (mismo `safeLinkUrlSchema`
    que ya protege `button.href`) → `publish` → HTML servido por
    `apps/web` inspeccionado directamente, confirmando cada mark render
    correcto y apilado sobre el mismo span:
    `<h2 class="...">Subtitulo semantico</h2>`,
    `<strong>...</strong>`, `<u><em>...</em></u>`, `<s><mark>...</mark></s>`,
    `<span style="color:var(--color-destructive);font-size:24px">...</span>`,
    `<a href="https://example.com/oferta" class="underline">...</a>` — los
    5 estilos distintos en la misma oración, gate de cierre cumplido tal
    cual está escrito.
- **Requiere de mí**: nada — P-3 (evaluador de expresiones) sigue diferida,
  no la pidió nadie en esta fase.

### Fase 5 — Subsistema de medios — ✅ CERRADA EN CÓDIGO (2026-08-15), pendiente de aprovisionamiento real por Antonio

**Decisiones resueltas** (P-2, P-4 — ver §21): **Supabase Storage** (mismo
proyecto donde ya vive Postgres en producción, confirmado vía ADR-015 — cero
cuenta/proveedor nuevo, a diferencia de Vercel Blob) y **`write:media` como
scope separado** de `write:pages`.

**Entregado**:
- `prisma/schema.prisma`: nuevo `model Asset` (`kind`, `url`, `width?`,
  `height?`, `altText`, `provider`, `createdAt`) — aditivo, sin FK a Offer
  (biblioteca compartida), migración `20260815094616_add_asset_table`.
- Dominio: `Asset`/`AssetKind` (`domain/content/media-asset.entity.ts`),
  `extensionForContentType` — lista cerrada de content-type→extensión por
  kind (`domain/content/media-content-type.ts`), `collectAssetIds` — recorre
  el árbol de una Composition juntando todo `assetId` referenciado
  (`image`, `video` con `source.kind === "asset"` + `posterAssetId`,
  `gallery`) en cualquier profundidad, para resolverlos en un solo
  roundtrip.
- Aplicación: puertos `AssetRepository` y `MediaStorage` (hexagonal, mismo
  patrón que `PaymentProvider`); casos de uso `createMediaUploadUrl` (genera
  un path aleatorio server-side — nunca uno que mande el cliente — y pide
  la URL firmada) y `registerAsset` (computa `url` desde `path` vía
  `MediaStorage.publicUrlFor`, **nunca un valor que mande el cliente** —
  cierra el mismo tipo de vector que `safeLinkUrlSchema` ya cierra dentro
  de Composition). Ninguno de los dos requiere `Idempotency-Key` (mismo
  criterio que `POST /pages/:id/preview`, F5 del Agent Access Layer: un
  duplicado no es dañino, ver §7 riesgos).
- Infraestructura: `PrismaAssetRepository`; `SupabaseStorageMediaAdapter`
  (`@supabase/supabase-js`, `createSignedUploadUrl`/`getPublicUrl`).
- Agent API (scope `write:media` nuevo, además de `read` para listar):
  `POST /media/upload-url` (primer paso — URL firmada), `POST /media/assets`
  (segundo paso — registra tras subir, valida el `path` contra el shape
  exacto que genera `upload-url` como defensa en profundidad),
  `GET /media/assets` (paginado). Documentadas en `openapi.ts` +
  `components.schemas.Asset`.
- `apps/admin`: panel `/media` mínimo (F5, no el editor visual de F6) —
  grid de Assets + formulario de subida (`upload-form.tsx`: pide la URL
  firmada, hace `PUT` directo al storage desde el navegador, registra el
  Asset; lee `width`/`height` reales de imágenes client-side, video se
  registra sin dimensiones).
- Renderer (`packages/ui/src/composition`): `assets: AssetMap` enhebrado
  por `CompositionRenderer → SectionNode → RowNode → ElementDispatch` hacia
  `ImageNode`/`VideoNode`/`GalleryNode`, que ahora resuelven el `assetId`
  real vía `next/image`/`<video>` — el placeholder "pendiente Fase 5" queda
  solo para un `assetId` que no resuelve (Asset borrado, o entorno sin el
  bucket configurado). `apps/web/next.config.mjs` y `apps/admin/next.config.mjs`
  allow-listan el host remoto vía `MEDIA_PUBLIC_HOST`.
- `landing-page-view.tsx`: usa `collectAssetIds` + `assets.findByIds` para
  resolver todo antes de renderizar — `CompositionRenderer` nunca hace I/O.
- `create_agent_api_role.sql`: grant nuevo `SELECT, INSERT` sobre `assets`
  (sin `UPDATE`/`DELETE` — un Asset es inmutable una vez registrado).

**Verificado**:
- `pnpm run boundaries`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build`
  → verde en los 7 workspaces (incluye el build de Next de los 3 apps con
  la nueva ruta `/media` de `apps/admin` en el output).
- `packages/core`: **181/181 tests** (175 previos + 6 nuevos: 2 de
  `collectAssetIds`, 4 de `createMediaUploadUrl`/`registerAsset` con fakes
  en memoria — validación de content-type, generación de path, y que `url`
  se computa server-side y nunca desde un valor suelto del caller).
- `apps/agent-api`: 11/11 — `openapi.test.ts` sigue validando el documento
  contra el meta-schema oficial con las 3 rutas de `/media` incluidas.
- **Smoke HTTP real de punta a punta**, con env vars de Supabase Storage
  apuntando a un project ref inexistente a propósito (para separar qué se
  puede verificar sin el bucket real de Antonio de qué no):
  - `POST /media/upload-url` con `contentType` no soportado → `400` antes
    de tocar la red; con un scope sin `write:media` → `403 missing_scope`;
    con `contentType` válido → alcanza el código real y falla con `500`
    (`fetch failed` contra el project ref falso, log confirmado) — **la
    plumbing completa está probada hasta el borde exacto de lo que
    requiere el bucket real**.
  - `POST /media/assets` → **funciona de punta a punta sin red real**
    (`publicUrlFor` es cómputo local, no HTTP): registra un Asset, calcula
    su `url` pública, lo persiste, lo devuelve; un `path` con forma
    inválida (`../../etc/passwd`) se rechaza con `400`; `GET /media/assets`
    lo lista.
  - Un agente crea una Page `composition-1` con un nodo `image` referenciando
    ese Asset real, publica, y `apps/web` sirve `200` con un `<img>` real
    generado por `next/image` (`srcSet`/`width`/`height`/`alt` correctos,
    proxied vía `/_next/image` con el host de `MEDIA_PUBLIC_HOST`
    allow-listado) — el gate de cierre del plan, cumplido de punta a punta
    salvo el único tramo que exige el bucket real.
- **No verificado en esta sesión** (requiere el bucket real, ver abajo):
  la llamada en vivo a `createSignedUploadUrl` contra un proyecto Supabase
  real, y por lo tanto el flujo completo `PUT` del binario vía el panel
  `/media`.

**Requiere de Antonio antes de que esto funcione en producción**:
1. Crear un bucket **público** en el proyecto Supabase real (`empresas-antonio`)
   — nombre sugerido `landing-media`, sin objeción técnica a otro nombre.
2. Configurar en cada entorno de Vercel que lo necesite
   (`apps/agent-api`, `apps/admin` para subir; `apps/web`+`apps/admin` para
   servir) las env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   (secreta — nunca en git), `MEDIA_BUCKET` (el nombre del bucket), y
   `MEDIA_PUBLIC_HOST` (el host público de Storage de ese proyecto, para
   que `next/image` lo allow-liste).
3. Ejecutar contra la base real el bloque nuevo de
   `prisma/agent-access-layer/create_agent_api_role.sql` (`GRANT SELECT,
   INSERT ON "assets" TO agent_api_role`) y correr `pnpm prisma:deploy`
   para aplicar la migración de `Asset` — mismo procedimiento manual ya
   usado para toda migración/grant anterior de este plan.
4. Sin scope `write:media` ninguna ApiKey existente puede subir medios
   todavía (F1-F5 nunca lo emitieron) — reemitir con
   `--scopes ...,write:media` las que lo necesiten, igual que se hizo con
   `write`/`publish:pages` en su momento.

### Fase 6a — Editor visual humano: edición estructurada del árbol — ✅ CERRADA (2026-08-15)

**Decisión tomada**: sin librería de rich text de cliente (§1.6, "necesita
investigación aparte") — controles estructurados (toggles de marca, no
contentEditable/WYSIWYG) sobre el mismo `richTextDocSchema` cerrado de Fase
4, evitando instalar una dependencia pesada antes de ver uso real. 6b
(canvas WYSIWYG) sigue exactamente donde estaba: sin arrancar, pendiente de
aprobación de Antonio tras ver 6a en uso real.

**Entregado** — todo en `apps/admin/src/app/(dashboard)/offers/[id]/pages/composition/`,
cero cambios de backend:
- `composition-form.tsx`: estado de la Composition completa en el cliente;
  **todas** las mutaciones (agregar/actualizar/eliminar/mover nodo) pasan
  por las mismas funciones puras de dominio que ya usa el Agent Access
  Layer (`addNodeToComposition`/`updateNodeInComposition`/
  `removeNodeFromComposition`/`reorderChildrenInComposition`, Fase 3) —
  nunca una reimplementación paralela de la lógica de árbol. Guarda con el
  mismo `savePageAction`/CAS de `page.version` que ya usan los demás forms
  de esta página (`parsePageContent` ya soportaba `composition-1` desde
  Fase 2/3 — cero cambios de backend para que esto funcionara).
- `node-tree.tsx`: árbol expandible/colapsable, mover por id (no por
  índice), menú de "agregar" contextual por tipo de contenedor (section
  solo admite row; row de nivel 2 admite elemento o una row anidada más;
  row anidada solo admite elemento — refleja la profundidad máxima de P-1
  sin un chequeo de profundidad aparte, el propio `addNodeToComposition` la
  hace cumplir). Sin drag-and-drop (alcance de 6a, según lo planeado).
- `node-defaults.ts`: un nodo nuevo siempre nace ya válido contra el schema
  (nunca un placeholder vacío) — necesario porque, a diferencia del editor
  de bloques legacy, `addNodeToComposition` re-valida el árbol completo en
  el momento de agregar, no recién al guardar.
- `node-content-editor.tsx` + `style-editor.tsx`: formulario por tipo de
  nodo (uno por cada `ElementNode`, más `section`/`row`), selectores sobre
  el vocabulario cerrado de tokens (`spacingTokenSchema.options`, etc. —
  una sola fuente de verdad, nunca un catálogo duplicado a mano), incluido
  `columnSpan` (1-12) cuando el nodo es hijo directo de una row.
  `legacyBlock` reusa `BlockFields` tal cual (view/edit, no se ofrece en el
  menú de "agregar nuevo" — scope acotado a componer con las primitivas
  nuevas).
- `rich-text-editor.tsx`: bloques (p/h1-h4) con spans editables y toggles
  de marca (bold/italic/underline/strike/highlight/link/colorToken/
  sizeToken) sobre el árbol cerrado de `richTextDocSchema` (Fase 4).
- `asset-picker.tsx`: selector sobre la biblioteca real de Fase 5 (grid de
  miniaturas, click para elegir) — nunca un input de URL suelta. Usado por
  image/video/gallery y por `background.imageAssetId` del style editor.
- `media/actions.ts`: nueva `listAssetsAction` (Server Action, sin
  paginación — alcanza para el tamaño actual de la biblioteca).
- `page.tsx`: agrega `<CompositionForm>` como primer editor de la página
  (arriba de los tres preexistentes — legacy JSON, bloques, Composition
  conviven, "gana el que se guardó al último", mismo criterio ya
  documentado para los otros dos), y ensancha el contenedor
  (`max-w-2xl` → `max-w-5xl`) para el layout de dos columnas
  árbol+editor.

**Verificado**:
- `pnpm run boundaries`/`typecheck`/`lint`/`build` verdes en los 7
  workspaces; **181/181** tests de `packages/core` y **11/11** de
  `apps/agent-api` sin cambios (6a no toca ni dominio ni agent-api).
- **Playwright/Chromium real** (mismo patrón que el panel `/agents` de F6
  del Agent Access Layer), de punta a punta contra la app real corriendo:
  login como AdminUser real, slug, edición de un span de rich text con
  marca `bold`, agregar un nodo `image` bajo una row, elegirle un Asset
  real de la biblioteca vía el picker, mover el nodo con "↑", editar su
  `columnSpan` a 12, guardar, **recargar la página y confirmar que el
  árbol completo (section→row→richText+image, con el Asset y el estilo)
  persiste exactamente igual** — coexistiendo sin romper los otros tres
  editores de la misma Page (todos muestran el mismo slug y estado
  `Borrador` tras el guardado). Encontrado y corregido en el camino: el
  selector de Assets solo cargaba la biblioteca al abrirse, así que un
  Asset ya asignado se veía como "ninguno seleccionado" hasta abrir el
  selector una vez — ahora carga al montarse.
- **Gate de cierre 6a cumplido**: un humano compuso una landing con
  columnas (`columnSpan`), media real (Asset de Fase 5) y rich text con
  estilo, sin tocar el Agent API, sobre la misma Page/CAS que un agente
  usaría.

**Requiere de Antonio**: ninguna acción de infraestructura — 6a no agrega
tablas, env vars ni servicios nuevos.

### Fase 6b — Drag-and-drop sobre el árbol — ✅ CERRADA (2026-08-15)

**Decisión tomada** (aprobada explícitamente por Antonio): drag-and-drop
sobre el mismo árbol expandible de 6a — nunca el canvas visual con render
en vivo (la otra opción evaluada, de costo varias veces mayor y con más
riesgo de UX en un primer intento). Los botones ↑/↓ de 6a se conservan
intactos, nunca se reemplazan — el drag es un agregado, no una migración,
y queda como respaldo accesible por teclado/lector de pantalla.

**Entregado** — todo en el mismo directorio de 6a, cero cambios de
dominio/backend:
- Nueva dependencia `@dnd-kit/core` + `@dnd-kit/sortable` +
  `@dnd-kit/utilities` en `apps/admin` (~15kb con gzip entre las tres) — la
  única librería nueva de todo el editor visual, evaluada explícitamente
  contra el criterio de 6a de no instalar dependencias pesadas sin uso real
  detrás.
- `node-tree.tsx`: un solo `DndContext` envuelve todo el árbol; cada
  contenedor (root, section, row/innerRow) es su propio `SortableContext`
  acotado a sus hijos directos — el patrón estándar de dnd-kit para listas
  anidadas multi-contenedor. Cada nodo es arrastrable por un handle "⠿"
  dedicado (no la fila completa, para no interferir con click-to-select).
  Una zona de "soltar al final" (`DropEndZone`) por contenedor permite
  apuntar al final de una lista con más de un hijo; con un solo hijo no
  hace falta — soltar sobre ese hijo ya inserta dentro del contenedor.
  `DragOverlay` muestra la etiqueta del nodo mientras se arrastra.
- `composition-form.tsx`: nuevo `handleDragMove`, que **compone** las
  mismas tres funciones puras de dominio ya usadas por 6a
  (`removeNodeFromComposition` + `addNodeToComposition` +
  `reorderChildrenInComposition`, Fase 3) — mismo padre origen/destino es
  un solo `reorder`; padre distinto es `remove` + `add` + `reorder` para
  ubicarlo en la posición exacta soltada. Cero lógica de árbol nueva: la
  regla de profundidad máxima (P-1) y la de "ningún contenedor sin hijos"
  (`children.min(1)` del schema) se heredan gratis de esas tres funciones,
  incluida la protección contra mover un nodo dentro de su propio
  descendiente (el `remove` deja de existir el destino antes de que el
  `add` lo intente usar, y revienta con `NotFoundError` en vez de corromper
  el árbol).
- **Sin cambios en apps/agent-api ni packages/core**: 6b es una
  reorganización client-side de las mismas mutaciones que un agente ya
  puede hacer por API — nunca una superficie nueva de escritura.

**Verificado**:
- `pnpm run boundaries`/`typecheck`/`lint`/`build` verdes en los 7
  workspaces; **181/181** tests de `packages/core` sin cambios (6b no toca
  dominio).
- **Playwright/Chromium real**, arrastrando con eventos de mouse reales
  (no `dragTo` nativo — dnd-kit usa pointer events, no HTML5 drag-and-drop)
  contra la app real corriendo: (1) reordenar dos elementos dentro de la
  misma fila por drag; (2) mover un elemento de una fila a otra dentro de
  la misma sección; (3) mover una fila completa (con sus elementos) de una
  sección a otra; (4) intentar mover el único hijo restante de una fila a
  otro contenedor — **rechazado correctamente, árbol sin cambios**,
  confirmando que la protección de "contenedor sin hijos" hereda del
  schema sin chequeo aparte. Guardado y recarga de página confirman que el
  árbol resultante (tras los tres movimientos válidos) persiste exacto —
  coexistiendo con los otros tres editores de la misma Page, mismo
  criterio de cierre que 6a.

**Requiere de Antonio**: ninguna acción de infraestructura — 6b no agrega
tablas, env vars ni servicios nuevos.

### Fase 7 — Modo código para agentes/técnicos — ✅ CERRADA (2026-08-15, sin código nuevo)

**P-3 resuelta** (decisión de Antonio): **Opción A** — lectura/escritura
directa del JSON completo de Composition, **sin** evaluador de expresiones
condicionales. Esa mitad queda en "qué NO construir todavía" (§22); se
retoma solo si aparece un caso de uso real de lógica condicional dentro de
una landing.

**Hallazgo al cerrar la fase**: la Opción A **ya estaba 100% construida
desde Fase 3** — `POST /pages` y `PATCH /pages/:id` aceptan el JSON
completo de `composition-1` sin ningún endpoint nuevo (`performAgentPageWrite`
→ `executeAgentPageWrite` → `parsePageContent` valida contra el mismo
`compositionContentSchema` cerrado, sea que el contenido llegue completo o
nodo-por-nodo vía `/nodes`), y ya estaba documentado en `openapi.ts`. Cero
código nuevo en `apps/agent-api`/`packages/core` — el objetivo de la fase
ya estaba cumplido, solo faltaba cerrarla explícitamente y probar
directamente el único camino que Fase 3 no había ejercitado.

**Entregado** — un solo archivo de tests, `packages/core/test/agent-access-concurrency.integration.test.ts`:
- Rechazo de una Composition inválida (`section` sin ninguna `row`) enviada
  como **JSON completo** vía `executeAgentPageWrite` (el mismo camino que
  `PATCH /pages/:id`, sin pasar por `/nodes`) — Fase 3 ya probaba rechazo
  vía los endpoints granulares, pero nunca vía escritura de JSON completo
  directa; confirma `400 invalid_content` y **cero** `Page`/`AgentAuditLog`
  huérfanos (mismo patrón atómico que el resto de F2).
- Gate de cierre ejercitado directamente: un agente construye, **en una
  sola escritura**, una Composition de 3 sections con 2 rows cada una
  (una con row anidada, P-1 nivel 4) — más elaborada que lo que 6a arma en
  un paso, porque el editor visual agrega un nodo por vez desde la UI —
  y se persiste exacta.

**Verificado**: `pnpm run boundaries`/`typecheck`/`lint`/`build` verdes en
los 7 workspaces; `packages/core` **183/183** tests (181 previos + 2
nuevos), `apps/agent-api` **11/11** sin cambios (ninguna ruta se tocó).

**Requiere de Antonio**: nada — Fase 7 no agrega tablas, env vars ni
servicios nuevos.

### Fase 8 — Hardening de seguridad (deuda preexistente) — ✅ CERRADA (2026-08-15)

**Entregado**:
- `packages/ui/src/sanitize.ts` (`sanitizeRichTextHtml`, nueva dependencia
  `sanitize-html` — la única del paquete): allowlist cerrada de tags de
  prosa (encabezados, párrafos, listas, links, formato básico, `img`),
  esquemas de URL restringidos a `http`/`https`/`mailto` (`data:` solo en
  `img`, para pegar un base64 chico), `rel="noopener noreferrer"` forzado
  en cualquier link. Usado en los 2 sitios reales (`RichTextBlock.tsx` de
  bloques, `landing-page-view.tsx` de `bodyHtml` legacy) — el tercer
  resultado de buscar `dangerouslySetInnerHTML` (`style-runtime.tsx`) no
  cuenta: inyecta CSS generado desde tokens cerrados, nunca texto de
  usuario, y ya tenía su propio comentario justificándolo desde antes.
- `packages/ui/src/primitives/iframe-sandbox.ts` (`VIDEO_IFRAME_SANDBOX`):
  una sola constante compartida por los 4 `<iframe>` (`VideoFrame.tsx`
  — reusado por `VslBlock` y `VideoNode` — más los 2 iframes directos de
  `landing-page-view.tsx` y `gracias/[checkoutSessionId]/page.tsx`).
  `allow-scripts allow-same-origin allow-presentation allow-popups` — sin
  token de fullscreen: **verificado contra Chromium real que
  `allow-fullscreen` no existe como flag de `sandbox`** (el navegador lo
  descarta con un warning en consola); fullscreen ya lo habilita el
  atributo `allowFullScreen` de cada iframe, independiente de `sandbox`.
  Encontrado y corregido durante la verificación de abajo, no en el
  diseño inicial.
- `apps/web/next.config.mjs` y `apps/admin/next.config.mjs`: CSP vía
  `headers()`, más `X-Content-Type-Options`/`X-Frame-Options`/
  `Referrer-Policy`. `frame-src`/`img-src` amplios a propósito (`https:`)
  en vez de una allow-list fija — el VSL es una URL que el admin tipea
  libre (cualquier proveedor), y las imágenes de Composition vienen de
  `MEDIA_PUBLIC_HOST` (Supabase Storage, dinámico); restringir a
  proveedores anticipados rompería el primer caso no previsto.
  `apps/web` suma `checkout.wompi.co` a `script-src`/`connect-src` (el
  único origen externo real que carga: el widget de pago) — PayPal no
  necesita nada, su flujo es un redirect de página completa a
  `approveUrl`, nunca un iframe/XHR embebido (confirmado leyendo
  `checkout-form.tsx`, no documentación). `apps/admin` no tiene checkout
  ni VSL, así que su `frame-src` es `'none'`. Ambas relajan `script-src`
  or `connect-src` con `'unsafe-eval'`/`ws://localhost:*` solo en dev
  (Next usa `eval` para Fast Refresh) — la CSP de producción no los
  incluye.

**Verificado**:
- `pnpm run boundaries`/`typecheck`/`lint`/`build` verdes en los 7
  workspaces.
- **Playwright/Chromium real** contra ambas apps en modo producción
  (`next start`, la CSP real de producción, no la relajada de dev):
  - Una Page real con `bodyHtml` = `<p>Texto legítimo</p><script>...) +
    `<img src=x onerror="...">` — el `<script>` desaparece del todo, el
    `onerror` se elimina, `window.__xssFired` nunca se define. Confirmado
    contra el HTML sanitizado real servido por `/[slug]`, no solo contra
    la función en aislamiento.
  - Un VSL real (`https://www.youtube.com/embed/...`) sirve con el
    `<iframe sandbox="allow-scripts allow-same-origin allow-presentation
    allow-popups">` esperado, sin ningún error de `sandbox` inválido en
    consola (acá se encontró y corrigió el bug de `allow-fullscreen`) y
    sin ningún "Refused to frame/connect/load" de CSP.
  - `/login` (ambas apps), `/checkout/[offerId]` — cero mensajes de CSP en
    consola del navegador.
  - Crear un Product/Offer real vía Server Action en `apps/admin` bajo la
    CSP de producción funciona sin cambios — confirma que `connect-src
    'self'` no rompe el mecanismo de Server Actions de Next.js.
- **Límite honesto de esta verificación**: no se pudo probar un checkout
  real de Wompi/PayPal de punta a punta — este entorno no tiene
  credenciales reales (`WOMPI_PUBLIC_KEY` vacía en `.env.example`). El
  origen `checkout.wompi.co` en la CSP está calibrado contra el código
  fuente del widget (`wompi-widget.ts`) y documentación pública de Wompi,
  no contra una transacción real. Recomendado: un smoke test manual de un
  checkout real de Wompi antes de confiar en esto al 100%, apenas haya
  credenciales de sandbox/producción disponibles.

**Requiere de Antonio**: nada de infraestructura — Fase 8 no agrega
tablas, env vars ni servicios nuevos. Sí pendiente: **verificar un
checkout real de Wompi** con la CSP activa la primera vez que se use con
credenciales reales (ver límite de arriba).

### Fase 9 — Migración opcional + cierre
- **Objetivo**: (solo si P-6 lo pide) herramienta de conversión no
  destructiva legacy/blocks → Composition, documentación final,
  checklist de cierre.
- **Depende de**: todas las anteriores.
- **Requiere de mí**: resolver P-6; y los mismos pasos "exclusivos de
  Antonio" que ya aparecieron en el plan anterior si el proveedor de
  media (P-2) requiere configuración manual de cuenta/bucket.

---

## 24. Dependencias entre fases

```
Fase 1 (dominio) ──▶ Fase 2 (renderer) ──▶ Fase 3 (Agent API) ──┬─▶ Fase 4 (rich text)
                                                                  ├─▶ Fase 7 (modo código)
Fase 3 ──▶ Fase 5 (medios, además depende de P-2/P-4) ──▶ Fase 6 (editor visual, además depende de 4)
Fase 8 (hardening) — independiente, puede correr en paralelo con cualquiera
Fase 9 — depende de todas
```

## 25. Pruebas por fase

Cubierto dentro de cada fase en §23. Patrón consistente con el resto del
repo: unitarias de dominio sin I/O, integración contra Postgres 16 real
(no mocks) para todo lo que toca `Page.content`/CAS/auditoría, smoke E2E
HTTP real para Agent API, Playwright/Chromium real para UI nueva de
`apps/admin`.

## 26. Criterios objetivos de cierre (por fase)

Ya especificados como "Gate de cierre" dentro de cada fase en §23 — todos
son verificables (test verde, ciclo E2E real corrido, comparación de
salida idéntica en el caso de `legacyBlock`), no subjetivos.

## 27. Definition of Done global

El editor v2 está "hecho" cuando:

1. Toda Page existente (legacy y blocks) sigue funcionando sin cambio de
   comportamiento, verificado con los tests de regresión de Fase 1.
2. Un agente puede crear una Composition con columnas, media real, rich
   text con estilos mixtos, y publicarla — de punta a punta, sin usar el
   editor visual.
3. Un humano puede hacer lo mismo desde `apps/admin` (Fase 6a como mínimo).
4. Ningún nodo nuevo permite HTML/CSS/JS libre — todo pasa por Zod +
   tokens.
5. El modo código no ejecuta nada en servidor — solo lee/escribe el mismo
   JSON validado.
6. `pnpm run boundaries`, typecheck, lint, build y la suite completa de
   `packages/core` siguen en verde en cada fase, sin excepciones.
7. La brecha de sanitización/CSP preexistente quedó cerrada (Fase 8),
   no solo documentada.

---

## Resumen para decidir

Antes de que yo empiece la Fase 1 necesito tu respuesta a **P-1 a P-6**
(§21) — o al menos a P-1, que es la única que bloquea el primer commit de
código. El resto puede resolverse fase por fase, en el momento en que esa
fase empiece, sin frenar el trabajo de las fases anteriores.
