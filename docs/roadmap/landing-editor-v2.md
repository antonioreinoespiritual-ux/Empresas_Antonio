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

- **P-1 — Profundidad máxima del árbol**: ¿cuántos niveles de anidamiento
  permitimos (`section > row > row > ...`)? Recomiendo un límite fijo bajo
  (p. ej. 4 niveles) validado por Zod — suficiente para toda composición
  razonable, y evita recursión no acotada en el renderer/CAS. Necesito tu
  ok sobre el número o el criterio.
- **P-2 — Proveedor de storage de media**: no asumido en el diseño. Candidatos
  razonables dado el stack actual (Vercel + Supabase): **Vercel Blob**
  (mismo proveedor de hosting, integración más simple) vs. **Supabase
  Storage** (mismo proyecto donde ya vive la base, un solo panel). Es una
  decisión de costo/operación tuya, no técnica pura.
- **P-3 — Alcance del "modo código"**: ¿alcanza con lectura/escritura
  directa del JSON de Composition (mi recomendación, cero riesgo nuevo), o
  querés además el evaluador de expresiones condicionales (§12, alcance
  mayor, todavía sin ejecución de código real pero más superficie a
  diseñar/probar)? Puede diferirse sin bloquear el resto.
- **P-4 — `write:media` como scope separado de `write:pages`**: ¿confirmás
  esa separación, o preferís que `write:pages` alcance para todo
  (más simple, menos granular)?
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

### Fase 5 — Subsistema de medios
- **Objetivo**: subir, listar y referenciar imágenes/video reales.
- **Toca**: `prisma/schema.prisma` (nuevo `Asset`), nuevo puerto
  `MediaStorage` + adaptador, nuevas rutas (`/media/upload-url`,
  `/media/assets`) en agent-api y en `apps/admin`, nodos `image`/`video`/`gallery`
  conectados de verdad (antes solo existían como schema).
- **Depende de**: resolver P-2 (proveedor) y P-4 (scope `write:media`).
- **Migraciones**: nueva tabla `Asset` — aditiva, sin tocar tablas
  existentes; grants nuevos en `agent_api_role` siguiendo el mismo
  criterio least-privilege ya documentado (`create_agent_api_role.sql`).
- **Riesgos**: nuevo proveedor externo = nuevo punto de fallo/costo — el
  upload debe ser resiliente a que el registro del `Asset` falle después
  de subir el binario (huérfano en storage, aceptable) vs. que el
  `Asset` referencie una URL que nunca se subió (peor, debe evitarse con
  el flujo de dos pasos ya descrito en §7).
- **Pruebas**: integración real contra el proveedor elegido (no mock) para
  el flujo completo subir→registrar→referenciar→renderizar.
- **Gate de cierre**: una imagen subida por un agente aparece en la
  landing pública con `next/image` optimizado.
- **Requiere de mí**: elegir proveedor (P-2), confirmar P-4, y (fuera de
  código) crear la cuenta/bucket real si el proveedor lo requiere — mismo
  tipo de paso "exclusivo de Antonio" que Edge Config en el plan anterior.

### Fase 6 — Editor visual humano (la fase de mayor esfuerzo)
- **Objetivo**: `apps/admin` gana una experiencia real para componer
  Compositions — **sub-faseada** por el riesgo/tamaño ya señalado:
  - **6a — edición estructurada del árbol** (recomendado empezar aquí):
    mismo espíritu que `landing-blocks-form.tsx` hoy, extendido a un árbol
    (expandir/colapsar contenedores, mover nodo por id ya no por índice,
    formulario de campos por tipo de nodo, selector de tokens de estilo en
    vez de inputs libres). Sin drag-and-drop todavía.
  - **6b — canvas visual/WYSIWYG** (evaluar recién con 6a en producción):
    arrastrar/soltar, preview inline en el propio canvas. Este es
    potencialmente un proyecto de frontend en sí mismo — no se estima en
    detalle hasta ver el uso real de 6a.
- **Toca**: `apps/admin/src/app/(dashboard)/offers/[id]/pages/*`,
  posible libería de rich text de cliente para 6a (necesita investigación
  aparte, ninguna está instalada hoy — ver §1.6).
- **Depende de**: Fases 1-5.
- **Riesgos**: es la fase con más superficie de UI nueva y la más fácil de
  sobre-invertir — de ahí la sub-fase.
- **Pruebas**: Playwright/Chromium real (mismo patrón ya usado para el
  panel `/agents` en F6 del Agent Access Layer).
- **Gate de cierre 6a**: un humano compone una landing completa con
  columnas/media/rich text sin tocar el Agent API, y coexiste sin
  conflicto con Pages creadas por agentes.
- **Requiere de mí**: aprobar seguir a 6b después de ver 6a en uso real.

### Fase 7 — Modo código para agentes/técnicos
- **Objetivo**: exponer edición directa del JSON completo de Composition
  como superficie "avanzada", más el evaluador de expresiones si P-3 lo
  pide.
- **Toca**: posiblemente ninguna ruta nueva (ya existe `PATCH /pages/:id`
  operando sobre el content completo) — puede ser solo documentación +
  gate de capability, no código nuevo, salvo que se construya el
  evaluador.
- **Depende de**: Fases 1-3, y P-3 resuelta.
- **Riesgos**: bajos, por diseño (§12/§13).
- **Pruebas**: casos de rechazo (Composition inválida vía PATCH directo se
  rechaza igual que hoy).
- **Gate de cierre**: un agente programador construye una Composition más
  elaborada que lo que el editor visual 6a expone, sin nueva superficie de
  riesgo.
- **Requiere de mí**: resolver P-3.

### Fase 8 — Hardening de seguridad (deuda preexistente)
- **Objetivo**: cerrar la brecha real encontrada en el diagnóstico (§1.6),
  no introducida por este plan pero visible mientras se trabaja esta área.
- **Toca**: sanitizador real sobre los 2 sitios `dangerouslySetInnerHTML`
  existentes, CSP básica en `apps/web`/`apps/admin`, `sandbox=` en los 4
  `<iframe>` existentes.
- **Depende de**: nada de lo anterior — puede adelantarse o correr en
  paralelo si preferís priorizarla antes.
- **Riesgos**: una CSP mal calibrada puede romper el `<iframe>` de VSL/PayPal
  — requiere probar contra checkout real antes de desplegar.
- **Pruebas**: verificación manual de que checkout/VSL/preview siguen
  funcionando con CSP activa.
- **Gate de cierre**: CSP activa en producción sin romper ningún flujo
  existente, sanitizador activo sobre HTML legacy.
- **Requiere de mí**: nada, salvo priorizar cuándo corre esta fase.

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
