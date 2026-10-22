/* ============================================================
   QA SMOKE L4 — Producción (https://tiendalunaria.github.io/lunaria/)
   Solo lectura, sin compras. Corre diario (workflow qa-smoke.yml) y a mano.
   Uso local:  node qa_smoke_produccion.js
   URL alterne:QA_TIENDA_URL=https://... node qa_smoke_produccion.js
   Escribe smoke_resultado.txt (lo consume el workflow al abrir issue).
   ============================================================ */
const BASE = (process.env.QA_TIENDA_URL || "https://tiendalunaria.github.io/lunaria/").replace(/\/?$/, "/");
const UA = { "User-Agent": "lunaria-qa-smoke" };

const res = [];
const check = (ok, id, msg, extra) => {
  res.push({ ok: !!ok, id, msg, extra: extra === undefined ? "" : JSON.stringify(extra).slice(0, 400) });
  console.log((ok ? "PASS " : "FAIL ") + id + " " + msg + (ok ? "" : "  -> " + (extra === undefined ? "" : JSON.stringify(extra).slice(0, 400))));
};

async function pedir(url, opts) {
  const r = await fetch(url, { headers: UA, redirect: "follow", ...opts });
  return r;
}
const texto = async (u) => { const r = await pedir(u); return { st: r.status, t: r.ok ? await r.text() : "" }; };
const vivo = async (u) => { try { const r = await pedir(u, { method: "HEAD" }); return r.status; } catch (e) { return 0; } };

(async () => {
  console.log("== QA SMOKE L4 == " + BASE + " (" + new Date().toISOString() + ")\n");

  /* 1. Página principal */
  const home = await texto(BASE);
  check(home.st === 200, "1.1", "home HTTP 200", home.st);
  check(/<title>LUNARIA — La comodidad comienza en casa<\/title>/i.test(home.t), "1.2", "title con eslogan oficial");
  check(/og:title" content="LUNARIA — La comodidad comienza en casa"/i.test(home.t), "1.3", "og:title oficial");
  check(/rel="icon" href="favicon\.ico"/.test(home.t), "1.4", "favicon enlazado");
  check(/fonts\.googleapis\.com[^"]*Cormorant\+Garamond/.test(home.t) && /fonts\.googleapis\.com[^"]*Montserrat/.test(home.t), "1.5", "tipografias oficiales cargadas");
  check(/wa\.me\/573132434760|573132434760/.test(home.t), "1.6", "WhatsApp de pedidos presente");

  /* 2. catalogo.js */
  const cat = await texto(BASE + "catalogo.js?t=" + Date.now());
  check(cat.st === 200, "2.1", "catalogo.js HTTP 200", cat.st);
  const ps = [...cat.t.matchAll(/\{id:"([a-z]+)(\d+)",n:"((?:[^"\\]|\\.)*)",p:(\d+),cat:"([\w-]+)".*?cid:"LUN-(\d+)"/g)]
    .map(m => ({ id: m[1] + m[2], n: m[3], p: +m[4], cat: m[5], cid: "LUN-" + m[6], img: (cat.t.slice(m.index, m.index + 600).match(/img:"([^"]+)"/) || [])[1] }));
  check(ps.length >= 95, "2.2", "catalogo con >=95 productos visibles", ps.length);
  check(ps.every(x => x.p >= 10000), "2.3", "sin precios placeholder (<$10.000, familias sin expandir)", ps.filter(x => x.p < 10000).slice(0, 3).map(x => x.id + ":" + x.p));
  check(ps.every(x => x.p <= 200000), "2.4", "sin precios fuera de rango (> $200.000)", ps.filter(x => x.p > 200000).slice(0, 3).map(x => x.id + ":" + x.p));
  check(ps.every(x => /^LUN-\d{4}$/.test(x.cid)), "2.5", "todos con codigo LUN-XXXX");
  const conImg = ps.filter(x => x.img);
  check(conImg.length >= ps.length * 0.95, "2.6", ">=95% con imagen propia", conImg.length + "/" + ps.length);
  check(!/https?:\/\/(?!tiendalunaria)/.test(cat.t.replace(/https?:\/\/tiendalunaria[^"']*/g, "")) || !/https?:\/\/(?!tiendalunaria\.github\.io)[^"']*\.(jpg|png|webp)/i.test(cat.t), "2.7", "sin imagenes de dominios ajenos");

  /* 3. Muestra de imagenes (20 aleatorias) */
  const muestra = conImg.sort(() => Math.random() - 0.5).slice(0, 20);
  const rotas = [];
  for (const p of muestra) { const st = await vivo(BASE + p.img); if (st !== 200) rotas.push(p.id + ":" + st); }
  check(rotas.length === 0, "3.1", "muestra de 20 imagenes sin rotas", rotas);

  /* 4. data/configuracion.js */
  const cfg = await texto(BASE + "data/configuracion.js?t=" + Date.now());
  check(cfg.st === 200, "4.1", "configuracion HTTP 200", cfg.st);
  let conf = null;
  try { conf = JSON.parse(cfg.t.replace(/^[\s\S]*?window\.CONFIG_PUBLICADA\s*=\s*/, "").replace(/;\s*$/, "")); } catch (e) { conf = null; }
  check(!!conf, "4.2", "configuracion parsea como JSON");
  if (conf) {
    check(!/"claveAdmin"/.test(cfg.t), "4.3", "sin claveAdmin publicada");
    check(!/github_pat_/.test(cfg.t), "4.4", "sin token de GitHub publicado");
    check(typeof conf.version === "number", "4.5", "version numerica", conf.version);
    check((conf.tienda || {}).whatsappPedidos === "573132434760", "4.6", "WhatsApp vigente en config publicada", (conf.tienda || {}).whatsappPedidos);
  }

  /* 5. Legal y activos de marca */
  const legal = await texto(BASE + "legal.html");
  check(legal.st === 200, "5.1", "legal.html HTTP 200", legal.st);
  const activos = ["logo_120.png", "logo_120_light.png", "logo_512.png", "logo_512_light.png", "favicon.ico",
    "favicon-32.png", "favicon-48.png", "apple-touch-icon.png", "banner_pijamas_1600x600.png", "qr_lunaria.png"];
  const muertos = [];
  for (const a of activos) { const st = await vivo(BASE + a); if (st !== 200) muertos.push(a + ":" + st); }
  check(muertos.length === 0, "5.2", "10 activos de marca HTTP 200", muertos);

  /* 6. Deploy reciente de Pages (aviso, no bloquea si la API esta limitada) */
  try {
    const r = await fetch("https://api.github.com/repos/tiendalunaria/lunaria/actions/runs?per_page=15", { headers: UA });
    if (r.ok) {
      const runs = (await r.json()).workflow_runs || [];
      const last = runs.find(x => x.name === "pages build and deployment");
      check(!!last && (last.conclusion === "success" || last.status === "in_progress"), "6.1",
        "ultimo deploy de Pages " + (last ? last.conclusion || last.status : "n/d"), last && last.created_at);
    } else check(true, "6.1", "deploy Pages no verificado (API " + r.status + ")");
  } catch (e) { check(true, "6.1", "deploy Pages no verificado (sin red a la API)"); }

  /* Resumen + archivo para el workflow */
  const ok = res.filter(x => x.ok).length, total = res.length;
  const lineas = [
    "Fecha: " + new Date().toISOString(),
    "URL: " + BASE,
    "RESULTADO: " + ok + "/" + total + " PASS" + (ok === total ? "" : "  *** FALLO ***"),
    "",
    ...res.map(x => (x.ok ? "PASS " : "FAIL ") + x.id + " " + x.msg + (x.ok ? "" : " -> " + x.extra)),
  ].join("\n");
  require("fs").writeFileSync(__dirname + "/smoke_resultado.txt", lineas + "\n");
  console.log("\n===== " + ok + "/" + total + " PASS ===== " + (ok === total ? "PRODUCCION SANA" : "REVISAR YA"));
  process.exit(ok === total ? 0 : 1);
})().catch(e => {
  require("fs").writeFileSync(__dirname + "/smoke_resultado.txt", "FALLO GENERAL: " + (e && e.message || e) + "\n" + (e && e.stack || ""));
  console.error("FALLO GENERAL:", e && e.message || e);
  process.exit(1);
});
