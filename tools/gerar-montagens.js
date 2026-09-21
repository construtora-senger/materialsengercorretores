// Gera as MONTAGENS DE PREVIA da selecao (assets/preview/sel/).
//
// Por que existem: desde a v333 nenhum envio leva foto anexada — o WhatsApp do
// celular passou a descartar a legenda quando vai arquivo, e a foto do imovel
// voltou a vir pela PREVIA DO LINK. So que o robo que monta essa previa nao
// roda JavaScript: ele so consegue mostrar uma imagem que ja exista, pronta, no
// site. A montagem das fachadas (a mesma que o site desenha na hora, em
// montarMosaicoLista) precisa entao estar gravada aqui antes.
//
// Uma imagem para cada combinacao de 2 a 4 empreendimentos, com o nome dos
// ids em ordem alfabetica, separados por "_" (a mesma chave que o app.js usa
// em chaveDaMontagem e que a ponte l/sel/<chave>/ carrega). A ordem dos
// paineis dentro da imagem segue a ordem do cadastro, como no site.
//
// Abre o site no Chromium (Playwright, o mesmo dos testes) e chama a funcao
// do proprio app.js, para a imagem ser identica a que o corretor ve na tela.
//
//   node tools/gerar-montagens.js          -> gera o que falta
//   node tools/gerar-montagens.js --tudo   -> regrava todas
//
// Rodar depois de trocar a capa de um empreendimento, ou de acrescentar um.
// Depois, node tools/gerar-pontes.js, que cria as pontes l/sel/.

const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const RAIZ = path.join(__dirname, "..");
const DESTINO = path.join(RAIZ, "assets", "preview", "sel");
const MAX = 4;             // igual ao MAX_MONTAGEM do app.js
const LARGURA = 1000;      // a previa do WhatsApp e pequena; 1000 px ja sobra
const QUALIDADE = 0.7;
const TUDO = process.argv.includes("--tudo");

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png",
};

function servir() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      let arquivo = path.join(RAIZ, rel);
      if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, "index.html");
      if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(arquivo)] || "application/octet-stream" });
      res.end(fs.readFileSync(arquivo));
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

// Todas as combinacoes de 2 a MAX ids, cada uma na ordem do cadastro.
function combinacoes(ids) {
  const saida = [];
  const anda = (inicio, atual) => {
    if (atual.length >= 2) saida.push([...atual]);
    if (atual.length === MAX) return;
    for (let i = inicio; i < ids.length; i++) anda(i + 1, [...atual, ids[i]]);
  };
  anda(0, []);
  return saida;
}

const chave = (ids) => [...ids].sort().join("_");

(async () => {
  const { server, base } = await servir();
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  await pagina.goto(base + "/", { waitUntil: "networkidle" });

  const ids = await pagina.evaluate(() => window.SENGER.EMPREENDIMENTOS.map((e) => e.id));
  const todas = combinacoes(ids);
  fs.mkdirSync(DESTINO, { recursive: true });

  let geradas = 0, puladas = 0, falhas = 0;
  for (const combo of todas) {
    const nome = `${chave(combo)}.jpg`;
    const arquivo = path.join(DESTINO, nome);
    if (!TUDO && fs.existsSync(arquivo)) { puladas++; continue; }
    const base64 = await pagina.evaluate(async ({ combo, largura, qualidade }) => {
      const emps = combo.map((id) => window.SENGER.EMPREENDIMENTOS.find((e) => e.id === id));
      const file = await window.__montarMosaicoLista(emps);
      if (!file) return null;
      const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = URL.createObjectURL(file); });
      if (!img) return null;
      const c = document.createElement("canvas");
      c.width = largura; c.height = Math.round(img.naturalHeight * largura / img.naturalWidth);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", qualidade).split(",")[1];
    }, { combo, largura: LARGURA, qualidade: QUALIDADE });
    if (!base64) { falhas++; console.error(`  ! sem montagem para ${nome}`); continue; }
    fs.writeFileSync(arquivo, Buffer.from(base64, "base64"));
    geradas++;
  }

  // Montagem de combinacao que nao existe mais (empreendimento removido) sai.
  const validas = new Set(todas.map((c) => `${chave(c)}.jpg`));
  let removidas = 0;
  for (const nome of fs.readdirSync(DESTINO)) {
    if (!validas.has(nome)) { fs.unlinkSync(path.join(DESTINO, nome)); removidas++; }
  }

  await navegador.close();
  server.close();
  const total = fs.readdirSync(DESTINO).reduce((s, n) => s + fs.statSync(path.join(DESTINO, n)).size, 0);
  console.log(`${geradas} montagem(ns) gerada(s), ${puladas} ja existiam, ${falhas} falha(s), ${removidas} removida(s).`);
  console.log(`${todas.length} combinacoes de 2 a ${MAX} empreendimentos · ${(total / 1024 / 1024).toFixed(1)} MB em assets/preview/sel/`);
  process.exit(falhas ? 1 : 0);
})();
