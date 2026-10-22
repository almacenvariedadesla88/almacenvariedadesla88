# LUNARIA — La comodidad comienza en casa

Tienda online de **pijamas** de LUNARIA (Colombia): venta asistida por
WhatsApp, publicada en **https://tiendalunaria.github.io/lunaria/** desde
el repositorio `github.com/tiendalunaria/lunaria`. Sin frameworks, sin
build, sin backend: HTML + CSS + JS en un archivo, catálogo generado
automáticamente y panel de administración que publica la configuración
por API.

LUNARIA hereda el sistema completo de la tienda de IKI
(github.com/ikib2c/iki) con la estrategia del grupo de **un catálogo por
repositorio**: aquí vive solo la línea de pijamas (`l2`, proveedor
Sublimados Majestic). Identidad propia: paleta marfil cremoso / beige
avena / rosa empolvado / chocolate profundo, tipografía Cormorant
Garamond + Montserrat, logo con luna creciente, nube y rama de hojas,
y códigos de producto `LUN-XXXX` (ver `LUNARIA_Brief_Branding.md`).

---

## 1. Arquitectura de archivos

| Archivo / carpeta | Rol |
|---|---|
| `index.html` | Tienda completa (HTML + CSS + JS en un archivo). Todo el comportamiento vive aquí |
| `catalogo.js` | Catálogo activo (99 productos de pijamas). **Lo genera el cron**: no se edita a mano |
| `data/configuracion.js` | Configuración publicada desde el panel ("Publicar para TODOS"). La mantiene el panel vía API de GitHub: nadie la edita a mano |
| `legal.html` | 8 políticas con anclas; absorbe la configuración publicada (razón social, NIT, contacto) |
| `scripts/sync_catalogos.py` | Descarga el proveedor de pijamas, normaliza, cura, clasifica, escribe `catalogo.js` y el Excel |
| `.github/workflows/sync-catalogos.yml` | Cron cada 6 horas (+ manual): sincroniza, commitea y publica (con `pull --rebase` para absorber lo publicado por el panel) |
| `img/p/` | Imágenes rehospedadas de la tienda (miniaturas webp, hash del URL) |
| `generar_enlace_config.py` | **Local** (en `.gitignore`): arma el enlace de configuración de un solo toque (token) |
| `GitHub.txt` | **Local** (en `.gitignore`): donde vive el token de GitHub |
| `LUNARIA_Brief_Branding.md` | Manual de marca y del sistema publicado |
| `Sublimados_Majestic_Catalogo.xlsx` | Excel completo del proveedor, generado por el sync |
| `logo_120.png` / `logo_512.png` / `*_light.png` | Logo LUNARIA transparente en tamaños web |
| `favicon.ico`, `favicon-32/48.png`, `apple-touch-icon.png` | Símbolo luna + nube + hojas |
| `qr_lunaria.png` | QR hacia la tienda (tarjeta para compartir) |
| `banner_pijamas_1600x600.png` | Banner de categoría (fallback de burbujas) |
| `index (5).html`, `index_jugueteria.html` | **Legado de la clonación de IKI**: copia de referencia de la tienda original y de su catálogo de juguetería. No se sirven ni se mantienen; quedan intactos como respaldo (estrategia: un catálogo por repositorio) |
| `qa_admin_e2e.js`, `qa_aterrizaje_precios.js` | Suites E2E locales (ajustar rutas al checkout local antes de correr) |

---

## 2. Actualización del catálogo (pipeline completo)

El cron corre `scripts/sync_catalogos.py` cada 6 horas. El pipeline:

### 2.1 Descarga del proveedor

| Línea | Proveedor | Fuente | Categorías que alimenta |
|---|---|---|---|
| `l2` | Sublimados Majestic | Supabase REST (pijamasalmayor.com) | pijamas, conjuntos, pantalones, shorts, interior, enterizos, ninos, navidad |

Ante el cliente nunca aparece el nombre del proveedor: una sola marca
(LUNARIA). Las demás líneas del grupo (joyas, juguetes, bebé, urbana)
viven en sus propios repositorios.

### 2.2 Curación

Precio rango $18k–$110k, exige imagen, descarta ocultos y "(Copia)",
tallas y estampados como variantes (máx. 8). Clasificación por **nombre**
en 8 categorías de tienda (la "categoría" del proveedor viene sucia):

```
temporada (navidad/halloween/grinch/santa) > niños > pijamas/pareja >
enterizos/batolas > conjuntos/blusas > ropa interior > pantalones/trios >
shorts/bermudas > juanitas
```

| Categoría | Productos |
|---|---|
| Pijamas de pareja | 7 |
| Conjuntos y blusas | 16 |
| Pantalones y capris | 16 |
| Shorts y bermudas | 15 |
| Ropa interior y juanitas | 13 |
| Enterizos y batolas | 7 |
| Niños y niñas | 8 |
| Navidad y Halloween | 17 |

**99 productos visibles.**

### 2.3 Pijamas de familia: precio real por prenda

Majestic publica las pijamas de familia con precio **placeholder** ($3),
pero la tarjeta trae `precios_familia` con el precio real **por prenda y
talla** (dama, dama plus, caballero, 2XL unisex, niño 2/4–14/16). El sync
las expande en un producto por prenda:

- Nombre: `Pijama Familiar Navideña · Dama` (3 familias: de Personajes, Navideña y Grinch).
- **Tallas como chips**: niño con 2/4, 6/8, 10/12, 14/16; dama/caballero con Única/Plus/2XL.
- **Estampados de familia como chips**: Grinch, Reno, Santa y Mickey, Simpsons, Stitch, Avengers… (máx. 8).
- Se respetan las **opciones deshabilitadas** de cada tarjeta (match exacto por etiqueta).
- Piezas de niño también quedan en "Niños y niñas".

### 2.4 Nombres limpios y IDs permanentes (LUN-XXXX)

Typos del proveedor corregidos (`Corsert`→`Corset`, `Boddy`→`Body`, punto
final suelto). `catalogo.js` reutiliza el `id` (`m30`…) y el `cid`
(`LUN-0030`) de cada producto por clave **prefijo + nombre normalizado**
(`norm_clave`), tolerante a las correcciones de nombre: los enlaces de
pedidos viejos (`?art=LUN-XXXX`) y la curación del héroe/favoritos no se
rompen. Protecciones activas: `ID_FIJOS` / `CID_FIJOS` (restauraciones
manuales), `QUEMADOS_ID` / `QUEMADOS_CID` (números jamás reemitidos) y
guarda-red (si el catálogo nuevo queda con <50% de los previos, se
aborta y se conserva el vigente).

### 2.5 Imágenes propias

Las fotos de Majestic (Supabase) se **rehospedan y redimensionan** a
webp 640 px, ~46 KB promedio, en `img/p/` (rehost incremental por hash
del URL). Cero dominios ajenos en las fotos. Cadena de respaldo en la
tienda: foto fallida → siguiente de la galería → placeholder "LUNARIA"
de la categoría.

### 2.6 Cron de GitHub Actions

Cada 6 horas: checkout con historial completo → sync → `git add
catalogo.js *.xlsx img` → si hay cambios: commit `[skip ci]` →
**`git pull --rebase`** (absorbe lo publicado por el panel vía API) →
push.

---

## 3. Precios

`precioFinal = base × multiplicador × (1 + margen) → techo a $1.000`

Prioridad: **1)** precio exacto fijado en el panel → **2)** margen de
temporada → **3)** margen de categoría → **4)** margen global.

- **Redondeo COMERCIAL hacia arriba** (tope de $1.000 publicado): el
  precio siempre sube al múltiplo limpio ($54.400→$55.000).
- **Orden del catálogo**: de **menor a mayor precio** por defecto.
- Márgenes: las 8 categorías de pijamas al **60%**, global 25%.
- **Temporada navideña automática** del 15-nov al 6-ene: +10 puntos en
  la categoría `navidad`.

---

## 4. Panel de administración

Acceso: footer "Administración", `?admin` o Ctrl+Shift+A (clave de
conveniencia, no seguridad; fábrica `LUNARIA123*`).

- **Publicar para TODOS**: sube la configuración vigente a
  `data/configuracion.js` vía API de GitHub (`tiendalunaria/lunaria`),
  con **versión siempre creciente** y **sin la clave del panel**; todos
  los visitantes la ven en ~1 minuto.
- Editable sin tocar código: nombre, logo, WhatsApp, email, redes,
  datos legales, analítica (Pixel de Meta y GA4), héroe, favoritos,
  visibilidad de secciones/carruseles, catálogo de inventario,
  categorías visibles, ocultar productos, precio exacto por producto y
  márgenes por categoría.
- **Token de GitHub**: fine-grained, Contents Read and write, **solo este
  repositorio**; vive únicamente en el navegador y se puede cargar con el
  **enlace de configuración** de un solo toque (`python
  generar_enlace_config.py`, local).

---

## 5. Visibilidad (una sola fuente de verdad)

`prodVisible` (categoría viva + no oculto + catálogo no oculto) y
`catViva` gobiernan TODAS las superficies: grid, subnav, burbujas, chips,
menú móvil, carruseles, héroe, favoritos, buscador, upsells y footer.

---

## 6. Héroe y favoritos

- **Héroe de temporada** (solo escritorio, hasta 6 productos):
  `m85,m86,m59,m80,m81,m82` (Halloween y Navidad), con texto "Halloween
  y Navidad ya llegaron / Pijamas y outfits para toda la familia". Se
  cura desde el panel (heroIds).
- **Favoritos del carrusel**: 20 prendas con Halloween y Navidad al
  frente.
- Los IDs son estables: la curación sobrevive a los syncs.

---

## 7. Compra, buscador y dopamina

- **Checkout por fases** (pedido → datos → entrega → pago → notas) con
  validación en vivo y consecutivo `PED-YYYYMMDD-NNN`.
- **Vuelo al carrito** (WAAPI, respeta `prefers-reduced-motion`), badge
  con rebote y vibración en celulares.
- **Pedido SIEMPRE directo por wa.me** al **+57 313 243 4760**: WhatsApp
  abre con el chat listo; la hoja PNG del pedido se **descarga** para
  adjuntarla en el mismo chat (logo LUNARIA, código `LUN-XXXX` por
  artículo, Nequi 313 243 4760).
- **Buscador con cobertura total**: sin tildes/ñ, palabras sueltas en
  cualquier orden, código `LUN-XXXX` y SKU del proveedor.
- Eventos para el Pixel de Meta: `PageView`, `ViewContent`,
  `AddToCart`, `Search`, `InitiateCheckout` y **`Purchase` con el valor
  total** en COP (GA4 recibe los mismos eventos).

---

## 8. Pruebas

Suites E2E locales (jsdom/Playwright, ajustar rutas del checkout local
antes de correr): `qa_admin_e2e.js` (panel) y
`qa_aterrizaje_precios.js` (aterrizajes, precios exactos, carrito y
mensaje de WhatsApp).

---

## 9. Operación diaria

| Tarea | Cómo |
|---|---|
| Cambiar precios, héroe, favoritos, ocultar productos/categorías | Panel → "Ver cambios ahora" (previsualiza) → "Publicar para TODOS" |
| Previsualizar sin publicar | Panel → "Guardar en MI computador" (solo este navegador) |
| Configurar un navegador nuevo del panel | `python generar_enlace_config.py` → abrir el enlace una vez |
| Refrescar el catálogo ya | Pestana Actions → "Sincronizar catalogo" → Run workflow |
| Respaldar la configuración sin GitHub | Panel → "Copiar configuración (respaldo)" |
