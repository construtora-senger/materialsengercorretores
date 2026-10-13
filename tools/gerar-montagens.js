// Gera as MONTAGENS DE PREVIA da selecao (assets/preview/sel/).
//
// Por que existem: desde a v333 nenhum envio leva foto anexada — o WhatsApp do
// celular passou a descartar a legenda quando vai arquivo, e a foto do imovel
// voltou a vir pela PREVIA DO LINK. So que o robo que monta essa previa nao
// roda JavaScript: ele so consegue mostrar uma imagem que ja exista, pronta, no
// site. A montagem das fachadas (a mesma que o site desenha na hora, em
// montarMosaicoLista) precisa entao estar gravada aqui antes.
//
// Uma imagem para cada combinacao de 2 ou mais empreendimentos (v334: ate os
// 10 de uma vez), com o nome dos
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
//
// v418 — grava tambem assets/preview/portfolio.jpg, a previa do link do
// sistema (l/portfolio/), que o botao Compartilhar do topo manda para outros
// corretores. Ver desenharPortfolio, logo abaixo.

const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const RAIZ = path.join(__dirname, "..");
const DESTINO = path.join(RAIZ, "assets", "preview", "sel");
const MAX = 10;            // igual ao MAX_MONTAGEM do app.js
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

// v418 — a previa do link do sistema: as fachadas de todos os predios (os
// empreendimentos com unidades; loteamentos e "Outros Imoveis" ficam fora da
// imagem), no estilo da montagem da selecao — faixas diagonais, filetes bronze,
// a marca em serifada. Desenhada aqui, e nao pelo montarMosaicoLista, para a
// montagem da selecao continuar exatamente como esta: la sao no maximo 6
// faixas, com o "+N", e o nome fica centrado mais para a esquerda. Roda dentro
// da pagina (pagina.evaluate), por isso nao usa nada de fora dela.
async function desenharPortfolio() {
  const emps = window.SENGER.EMPREENDIMENTOS.filter((e) => e.confirmado !== false && (e.grupos || []).length && e.hero);
  const carregar = (src) => new Promise((ok) => {
    const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src;
  });
  const imgs = await Promise.all(emps.map((e) => carregar(e.hero)));
  const blocos = emps.map((emp, i) => ({ emp, img: imgs[i] })).filter((b) => b.img);
  if (blocos.length < 2) return null;
  const SERIF = "Georgia, 'Times New Roman', serif";
  const SANS = "system-ui, -apple-system, sans-serif";
  const BRONZE = "#b08d57";
  const W = 1200, H = 630, HEAD = 100, FOOT = 72, SKEW = 80, LINHA = 5;
  const y0 = HEAD, y1 = H - FOOT;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#14181c";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4efe8";
  ctx.font = `600 40px ${SERIF}`;
  ctx.fillText("Construtora Senger", W / 2, 42);
  ctx.fillStyle = BRONZE;
  ctx.font = `500 19px ${SANS}`;
  ctx.fillText("PORTFÓLIO DE EMPREENDIMENTOS", W / 2, 80);
  // As faixas das pontas ficam iguais: a primeira perde SKEW/2 a esquerda e a
  // ultima SKEW/2 a direita (cada uma se estende para fora da imagem).
  const passo = W / blocos.length, ultima = blocos.length - 1;
  blocos.forEach(({ emp, img }, i) => {
    const xTopo = -SKEW / 2 + i * passo, xBase = xTopo + SKEW;
    const antes = i === 0 ? SKEW : 0, depois = i === ultima ? SKEW : 0;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xTopo - antes, y0);
    ctx.lineTo(xTopo + passo + depois, y0);
    ctx.lineTo(xBase + passo + depois, y1);
    ctx.lineTo(xBase - antes, y1);
    ctx.closePath();
    ctx.clip();
    // A foto cobre a faixa inteira, centrada nela.
    const caixa = passo + SKEW + 40, xCaixa = xTopo - 20;
    const s = Math.max(caixa / img.width, (y1 - y0) / img.height);
    ctx.drawImage(img, xCaixa + (caixa - img.width * s) / 2, y0 + (y1 - y0 - img.height * s) / 2, img.width * s, img.height * s);
    const grad = ctx.createLinearGradient(0, y1 - 120, 0, y1);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,.8)");
    ctx.fillStyle = grad;
    ctx.fillRect(xTopo - SKEW * 2, y1 - 120, passo + SKEW * 4, 120);
    // O nome no meio da base da faixa (a parte que aparece). Nome que nao
    // cabe numa linha quebra em duas, em vez de sair espremido.
    const ini = Math.max(xBase - antes, 0), fim = Math.min(xBase + passo + depois, W);
    const largura = fim - ini - 22, cx = (ini + fim) / 2 - 4;
    ctx.fillStyle = "#f4efe8";
    ctx.font = `600 19px ${SERIF}`;
    ctx.textBaseline = "bottom";
    const palavras = emp.nome.split(" ");
    const linhas = ctx.measureText(emp.nome).width <= largura || palavras.length < 2
      ? [emp.nome]
      : [palavras.slice(0, Math.ceil(palavras.length / 2)).join(" "), palavras.slice(Math.ceil(palavras.length / 2)).join(" ")];
    linhas.forEach((linha, n) => ctx.fillText(linha, cx, y1 - 14 - (linhas.length - 1 - n) * 22, largura));
    ctx.restore();
    if (i > 0) { // filete bronze na divisa
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xTopo - LINHA / 2, y0);
      ctx.lineTo(xTopo + LINHA / 2, y0);
      ctx.lineTo(xBase + LINHA / 2, y1);
      ctx.lineTo(xBase - LINHA / 2, y1);
      ctx.closePath();
      const lg = ctx.createLinearGradient(0, y0, 0, y1);
      lg.addColorStop(0, "#d8b87e");
      lg.addColorStop(0.5, "#b08d57");
      lg.addColorStop(1, "#d8b87e");
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.restore();
    }
  });
  ctx.fillStyle = BRONZE;
  ctx.fillRect(0, y1, W, 3);
  ctx.fillStyle = "#9aa4ab";
  ctx.font = `500 20px ${SANS}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Fotos, plantas, valores e disponibilidade, sempre atualizados", W / 2, y1 + FOOT / 2 + 2);
  return canvas.toDataURL("image/jpeg", 0.82).split(",")[1];
}

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

  // v418 — a previa do link do sistema (Compartilhar do topo).
  const PORTFOLIO = path.join(RAIZ, "assets", "preview", "portfolio.jpg");
  let portfolio = "ja existia";
  if (TUDO || !fs.existsSync(PORTFOLIO)) {
    const base64 = await pagina.evaluate(desenharPortfolio);
    if (base64) { fs.writeFileSync(PORTFOLIO, Buffer.from(base64, "base64")); portfolio = "gravada"; }
    else { falhas++; portfolio = "FALHOU"; console.error("  ! sem previa do portfolio"); }
  }

  await navegador.close();
  server.close();
  const total = fs.readdirSync(DESTINO).reduce((s, n) => s + fs.statSync(path.join(DESTINO, n)).size, 0);
  console.log(`${geradas} montagem(ns) gerada(s), ${puladas} ja existiam, ${falhas} falha(s), ${removidas} removida(s).`);
  console.log(`${todas.length} combinacoes de 2 a ${MAX} empreendimentos · ${(total / 1024 / 1024).toFixed(1)} MB em assets/preview/sel/`);
  console.log(`Previa do portfolio (assets/preview/portfolio.jpg): ${portfolio}.`);
  process.exit(falhas ? 1 : 0);
})();
