// Gera a PREVIA DO LINK de cada empreendimento (assets/preview/<id>.jpg) a
// partir da CAPA dele (o campo hero do data.js).
//
// Regra do dono (v456, 26/10/2026): "quero sempre que va junto nos envios dos
// empreendimentos a imagem da capa daquele empreendimento, regra para todos
// eles". A previa e a imagem que o WhatsApp mostra ao lado do link do
// empreendimento e de cada unidade dele (og:image das pontes l/<emp>/). Ate a
// v455 ela era um JPEG feito a mao, e em 8 dos 10 empreendimentos era OUTRA
// foto, nao a capa.
//
// A previa sai em 1200 x 630 (o formato do WhatsApp), com a capa cobrindo a
// imagem inteira, centrada — o mesmo desenho que o painel faz sozinho quando
// o dono troca a capa (gerarPreviaDaCapa, em admin/index.html).
//
// assets/preview/capas.json guarda, para cada empreendimento, de qual arquivo
// de capa (e com qual SHA-256) a previa foi feita. E por ele que o
// tools/validar.js acusa previa que ficou para tras.
//
//   node tools/gerar-previas.js          -> refaz so o que esta diferente da capa
//   node tools/gerar-previas.js --tudo   -> refaz todas
//
// Depois, se a capa de algum empreendimento mudou, lembre das montagens da
// selecao (node tools/gerar-montagens.js) — elas tambem desenham a capa.

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const RAIZ = path.join(__dirname, "..");
const DESTINO = path.join(RAIZ, "assets", "preview");
const MANIFESTO = path.join(DESTINO, "capas.json");
const LARGURA = 1200, ALTURA = 630, QUALIDADE = 0.85;
const TUDO = process.argv.includes("--tudo");

const TIPOS = {
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".html": "text/html; charset=utf-8",
};

function servir() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const arquivo = path.join(RAIZ, rel);
      if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
        if (rel === "") { res.writeHead(200, { "Content-Type": TIPOS[".html"] }); res.end("<!doctype html><title>previas</title>"); return; }
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(arquivo).toLowerCase()] || "application/octet-stream" });
      res.end(fs.readFileSync(arquivo));
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

const sha256 = (arquivo) => crypto.createHash("sha256").update(fs.readFileSync(arquivo)).digest("hex");

function lerManifesto() {
  try { return JSON.parse(fs.readFileSync(MANIFESTO, "utf8")); } catch (e) { return {}; }
}

(async () => {
  const fonte = fs.readFileSync(path.join(RAIZ, "data.js"), "utf8");
  const { EMPREENDIMENTOS } = new Function(fonte.replace(/window\.SENGER[\s\S]*$/, "") + "; return { META, EMPREENDIMENTOS };")();
  const ativos = EMPREENDIMENTOS.filter((e) => e.confirmado !== false && e.hero);
  const manifesto = lerManifesto();

  const pendentes = ativos.filter((emp) => {
    const capa = path.join(RAIZ, emp.hero);
    if (!fs.existsSync(capa)) { console.error(`  ! ${emp.id}: a capa ${emp.hero} nao existe`); return false; }
    const previa = path.join(DESTINO, `${emp.id}.jpg`);
    const feita = manifesto[emp.id];
    return TUDO || !fs.existsSync(previa) || !feita || feita.capa !== emp.hero || feita.sha256 !== sha256(capa);
  });

  if (!pendentes.length) {
    console.log(`Todas as ${ativos.length} previas ja sao da capa atual. Nada a fazer.`);
    return;
  }

  const { server, base } = await servir();
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  await pagina.goto(`${base}/`);

  let falhas = 0;
  for (const emp of pendentes) {
    // O mesmo desenho de gerarPreviaDaCapa, no painel: a capa cobre a imagem
    // inteira (1200 x 630), centrada, e o que sobra e cortado por igual.
    const base64 = await pagina.evaluate(async ({ src, largura, altura, qualidade }) => {
      const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
      if (!img) return null;
      const c = document.createElement("canvas");
      c.width = largura; c.height = altura;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      const s = Math.max(largura / img.naturalWidth, altura / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.drawImage(img, (largura - w) / 2, (altura - h) / 2, w, h);
      return c.toDataURL("image/jpeg", qualidade).split(",")[1];
    }, { src: `${base}/${emp.hero}`, largura: LARGURA, altura: ALTURA, qualidade: QUALIDADE });
    if (!base64) { falhas++; console.error(`  ! ${emp.id}: nao consegui abrir a capa ${emp.hero}`); continue; }
    fs.writeFileSync(path.join(DESTINO, `${emp.id}.jpg`), Buffer.from(base64, "base64"));
    manifesto[emp.id] = { capa: emp.hero, sha256: sha256(path.join(RAIZ, emp.hero)) };
    console.log(`  ${emp.id}: previa refeita a partir de ${emp.hero}`);
  }

  await navegador.close();
  server.close();

  // Empreendimento que saiu do cadastro sai do manifesto.
  const ids = new Set(ativos.map((e) => e.id));
  for (const id of Object.keys(manifesto)) if (!ids.has(id)) delete manifesto[id];
  const ordenado = Object.fromEntries(Object.keys(manifesto).sort().map((id) => [id, manifesto[id]]));
  fs.writeFileSync(MANIFESTO, JSON.stringify(ordenado, null, 2) + "\n");

  console.log(`${pendentes.length - falhas} previa(s) refeita(s), ${falhas} falha(s). Manifesto em assets/preview/capas.json.`);
  process.exit(falhas ? 1 : 0);
})();
