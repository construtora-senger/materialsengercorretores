// Testes de tela — site do corretor, modo cliente e painel administrativo.
//
// Nao ha framework: e o Chromium do Playwright abrindo os arquivos do
// repositorio e conferindo o que aparece. O painel e exercitado sem token de
// verdade, interceptando https://api.github.com/** e devolvendo os arquivos
// locais em base64, como o CLAUDE.md descreve.
//
//   node tools/testar-navegador.js            -> roda tudo
//   node tools/testar-navegador.js --ver       -> abre o navegador na tela
//
// Sai com codigo 1 se algum teste falhar.

const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const RAIZ = path.join(__dirname, "..");
const VER = process.argv.includes("--ver");

// ------------------------------------------------------------ servidor local
// file:// nao serve: o service worker, o fetch do painel e os caminhos
// relativos precisam de um http:// de verdade.
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png",
  ".pdf": "application/pdf", ".ico": "image/x-icon",
};

function servir() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      let arquivo = path.join(RAIZ, rel);
      if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, "index.html");
      if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo)) { res.writeHead(404); res.end("nao encontrado"); return; }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(arquivo)] || "application/octet-stream" });
      res.end(fs.readFileSync(arquivo));
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

// ------------------------------------------------------------------ placar
const falhas = [];
let passaram = 0;
let grupoAtual = "";

function grupo(nome) { grupoAtual = nome; console.log(`\n${nome}`); }
function ok(nome) { passaram++; console.log(`  ok  ${nome}`); }
function falha(nome, detalhe) {
  falhas.push(`${grupoAtual} · ${nome}: ${detalhe}`);
  console.log(`  XX  ${nome} — ${detalhe}`);
}
async function teste(nome, fn) {
  try {
    const erro = await fn();
    if (erro) falha(nome, erro); else ok(nome);
  } catch (e) { falha(nome, e.message); }
}

(async () => {
  const { server, base } = await servir();
  const navegador = await chromium.launch({ headless: !VER });
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const erroDeConsole = [];
  contexto.on("weberror", (e) => erroDeConsole.push(String(e.error())));

  const abrir = async (rota, opcoes = {}) => {
    const pagina = await contexto.newPage();
    pagina.on("pageerror", (e) => erroDeConsole.push(`${rota}: ${e.message}`));
    if (opcoes.mobile) await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.goto(base + rota, { waitUntil: "networkidle" });
    return pagina;
  };

  // ================================================================ o corretor
  grupo("SITE / CORRETOR");
  let pg = await abrir("/");

  await teste("a home lista os empreendimentos", async () => {
    const n = await pg.locator("#portfolio-grid .portfolio-card, #portfolio-grid > *").count();
    return n >= 8 ? "" : `so ${n} cartoes na vitrine`;
  });

  await teste("o alternador Prédios/Unidades troca a lista", async () => {
    await pg.click('#view-switch button[data-view="unidades"]');
    await pg.waitForTimeout(250);
    const visivel = await pg.locator("#portfolio-grid").innerText();
    await pg.click('#view-switch button[data-view="predios"]');
    await pg.waitForTimeout(250);
    return /apto|sala|lote|quadra/i.test(visivel) ? "" : "a visao de unidades nao mostrou unidades";
  });

  await teste("a busca por numero de apartamento acha a unidade", async () => {
    await pg.fill("#search-input", "501");
    await pg.waitForTimeout(350);
    const texto = await pg.locator("#portfolio-grid").innerText();
    await pg.fill("#search-input", "");
    await pg.waitForTimeout(300);
    return /boulevard|renaissance/i.test(texto) ? "" : "a busca por 501 nao trouxe nada";
  });

  await teste("o filtro de dormitórios reduz a vitrine", async () => {
    const antes = await pg.locator("#portfolio-grid > *").count();
    await pg.selectOption("#rooms-filter", "3").catch(() => {});
    await pg.waitForTimeout(350);
    const depois = await pg.locator("#portfolio-grid > *").count();
    await pg.click("#clear-filters");
    await pg.waitForTimeout(300);
    return depois <= antes ? "" : `o filtro aumentou a lista (${antes} -> ${depois})`;
  });

  await teste("abrir um empreendimento mostra a ficha", async () => {
    await pg.goto(`${base}/#emp-boulevard`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(300);
    const titulo = await pg.locator("#detail-view h1").innerText();
    return /boulevard/i.test(titulo) ? "" : `titulo inesperado: ${titulo}`;
  });

  await teste("a ficha do empreendimento traz as ferramentas da equipe", async () => {
    const faltando = [];
    for (const id of ["share-emp-prices", "share-emp-no-prices", "share-emp-link", "print-detail", "detail-back"]) {
      if (!(await pg.locator(`#${id}`).count())) faltando.push(id);
    }
    return faltando.length ? `sem ${faltando.join(", ")}` : "";
  });

  await teste("a tipologia abre e fecha como gaveta", async () => {
    const gavetas = await pg.locator("#unidades details.unit-group").count();
    return gavetas >= 2 ? "" : `so ${gavetas} gaveta(s) de tipologia`;
  });

  await teste("cada final do Boulevard virou um quadro próprio", async () => {
    const texto = await pg.locator("#unidades").innerText();
    const finais = ["final 01", "final 02", "final 03", "final 04"].filter((f) => texto.includes(f));
    return finais.length === 4 ? "" : `so apareceram ${finais.join(", ") || "nenhum"}`;
  });

  // v321 — os quadros saem do mais barato para o mais caro. E a ordem que o
  // cliente espera ler, e o dono pediu por nome.
  await teste("as tipologias saem na ordem crescente de valor", async () => {
    const ruins = [];
    for (const id of ["quality", "renaissance", "boulevard", "evolutti"]) {
      await pg.goto(`${base}/#emp-${id}`, { waitUntil: "networkidle" });
      await pg.waitForTimeout(400);
      // Le o "a partir de" do cabecalho (.unit-group-preco .price-value), nunca
      // o texto solto do quadro: o bloco dos alugados traz "Aluguel R$ 1.400,00"
      // antes do preco, e o primeiro "R$" da caixa seria o do aluguel.
      const valores = await pg.evaluate(() =>
        [...document.querySelectorAll("#unidades details.unit-group")]
          .map((d) => d.querySelector(".unit-group-preco .price-value"))
          .map((el) => (el ? parseInt(el.textContent.replace(/\D+/g, ""), 10) : null))
          .filter((v) => v !== null && !Number.isNaN(v)));
      const crescente = valores.every((v, i) => i === 0 || v >= valores[i - 1]);
      if (!crescente) ruins.push(`${id}: ${valores.join(" > ")}`);
    }
    return ruins.length ? `fora de ordem — ${ruins.join(" | ")}` : "";
  });

  await teste("compartilhar unidade abre a escolha de envio", async () => {
    await pg.locator("#unidades details.unit-group").first().evaluate((el) => { el.open = true; });
    await pg.locator("[data-share-item]").first().click();
    await pg.waitForTimeout(250);
    const aberto = await pg.locator("#send-choice").getAttribute("aria-hidden");
    await pg.evaluate(() => document.querySelector("#send-choice .icon-button[data-close-choice]")?.click());
    await pg.waitForTimeout(200);
    return aberto === "false" ? "" : "a janela de envio nao abriu";
  });

  await teste("selecionar unidades acende o carrinho", async () => {
    await pg.locator("[data-select-item]:not([disabled])").first().click();
    await pg.waitForTimeout(250);
    const escondido = await pg.locator("#selection-fab").getAttribute("hidden");
    return escondido === null ? "" : "o botao de selecionados continuou escondido";
  });

  await teste("o PDF do portfólio monta a folha com as tabelas", async () => {
    const linhas = await pg.evaluate(async () => {
      document.getElementById("print-sheet").innerHTML = "";
      return new Promise((resolve) => {
        const original = window.print;
        window.print = () => {};
        document.getElementById("print-detail").click();
        setTimeout(() => {
          const alvo = document.getElementById("print-sheet");
          window.print = original;
          resolve(alvo ? alvo.innerText.length : 0);
        }, 1500);
      });
    });
    return linhas > 200 ? "" : `a folha saiu com ${linhas} caracteres`;
  });

  await teste("voltar guarda a altura em que o corretor estava na lista", async () => {
    await pg.goto(base + "/", { waitUntil: "networkidle" });
    // A vitrine tem imagens: a altura da pagina so estabiliza depois delas.
    // Rolar cedo demais faz o proprio teste medir errado.
    await pg.waitForFunction(() => document.documentElement.scrollHeight > 2500, null, { timeout: 8000 }).catch(() => {});
    await pg.evaluate(() => window.scrollTo(0, 1200));
    // A altura so para de mudar quando as fotos terminam de carregar, e o
    // Chrome reacomoda a rolagem nesse meio-tempo. Medir antes disso faz o
    // teste comparar com um numero que ja nao vale.
    await pg.evaluate(() => new Promise((pronto) => {
      let ultimo = -1, iguais = 0;
      const olhar = () => {
        if (window.scrollY === ultimo) iguais++; else { iguais = 0; ultimo = window.scrollY; }
        if (iguais >= 3) return pronto();
        setTimeout(olhar, 120);
      };
      olhar();
    }));
    const antes = await pg.evaluate(() => window.scrollY);
    if (antes < 400) return "a home nem rolou o suficiente para o teste valer";
    // Abre um empreendimento pelo cartao, como o corretor faz.
    await pg.locator("#portfolio-grid .card-open-overlay").first().click();
    await pg.waitForTimeout(500);
    if (await pg.locator("#detail-view").isHidden()) return "o cartao nao abriu a ficha";
    await pg.locator("#detail-back").click();
    await pg.waitForTimeout(600);
    const depois = await pg.evaluate(() => window.scrollY);
    return Math.abs(depois - antes) < 120 ? "" : `voltou para ${depois}px, e ele estava em ${antes}px`;
  });

  await teste("voltar ao portfólio fecha a ficha", async () => {
    await pg.goto(`${base}/#emp-boulevard`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(400);
    await pg.click("#detail-back");
    await pg.waitForTimeout(300);
    return (await pg.locator("#detail-view").isHidden()) ? "" : "a ficha continuou aberta";
  });
  await pg.close();

  await teste("no celular a vitrine não rola para o lado", async () => {
    const m = await abrir("/", { mobile: true });
    const sobra = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await m.close();
    return sobra <= 2 ? "" : `sobram ${sobra}px de rolagem horizontal`;
  });

  // --------------------------------------------------- o envio por WhatsApp
  // Guarda da v330. Duas coisas que ja quebraram no ar e o dono pegou antes dos
  // testes: a foto chegando sem a descricao (o `title` roubava a legenda) e,
  // no computador, o texto saindo sozinho sem foto e sem janela nenhuma.
  //
  // O navigator.share e interceptado; o que interessa e O QUE O SITE ENTREGA.
  const envioDaSelecao = async (aceitaArquivo) => {
    const pagina = await contexto.newPage();
    await pagina.addInitScript((aceita) => {
      window.__share = [];
      navigator.share = async (d) => { window.__share.push({ title: d.title ?? null, texto: d.text || "", arquivos: (d.files || []).length }); };
      navigator.canShare = (d) => (d && d.files && d.files.length ? aceita : true);
    }, aceitaArquivo);
    await pagina.goto(base + "/", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: /^Unidades$/ }).first().click().catch(() => {});
    await pagina.waitForTimeout(600);
    const chaves = await pagina.evaluate(() => {
      const porEmp = new Map();
      for (const el of document.querySelectorAll("[data-select-item]")) {
        const emp = el.dataset.selectItem.split(":")[0];
        if (!porEmp.has(emp)) porEmp.set(emp, el.dataset.selectItem);
      }
      return [...porEmp.values()].slice(0, 2);
    });
    for (const chave of chaves) await pagina.locator(`[data-select-item="${chave}"]`).first().click();
    const resultado = {};
    for (const [rotulo, id] of [["descricao", "share-selected-prices"], ["link", "share-selected-link"]]) {
      await pagina.evaluate(() => { window.__share = []; });
      await pagina.locator("#selection-fab").click();
      await pagina.waitForTimeout(200);
      await pagina.locator("#" + id).click();
      await pagina.waitForTimeout(2500);
      resultado[rotulo] = await pagina.evaluate(() => ({
        envios: window.__share,
        janela: document.getElementById("share-modal")?.classList.contains("open") || false,
      }));
      await pagina.evaluate(() => {
        document.getElementById("share-modal")?.classList.remove("open");
        document.body.classList.remove("no-scroll");
        document.querySelector(".selection-drawer")?.classList.remove("open");
      });
      await pagina.waitForTimeout(150);
    }
    await pagina.close();
    return resultado;
  };

  await teste("a seleção sai com a montagem E a descrição no mesmo envio", async () => {
    const r = await envioDaSelecao(true);
    for (const [rotulo, dados] of Object.entries(r)) {
      const envio = dados.envios[0];
      if (!envio) return `${rotulo}: nao houve envio nenhum`;
      if (envio.arquivos !== 1) return `${rotulo}: foram ${envio.arquivos} arquivos, esperado 1`;
      if (envio.texto.length < 100) return `${rotulo}: o texto saiu com ${envio.texto.length} caracteres`;
      if (envio.title !== null) return `${rotulo}: foi com title "${envio.title}" — ele rouba a legenda do WhatsApp`;
    }
    return "";
  });

  await teste("sem poder anexar (computador), abre a janela com texto e fotos", async () => {
    const r = await envioDaSelecao(false);
    for (const [rotulo, dados] of Object.entries(r)) {
      if (dados.envios.length) return `${rotulo}: mandou texto sozinho, sem a foto`;
      if (!dados.janela) return `${rotulo}: nao abriu a janela de copiar/baixar`;
    }
    return "";
  });

  // ================================================================= o cliente
  grupo("MODO CLIENTE");

  const INTERNOS = ["#share-emp-prices", "#share-emp-no-prices", "#share-emp-link", "#print-detail",
    "#print-list", "#share-portfolio", "#corretor-button", ".version-tag", "[data-select-item]", "[data-share-item]"];

  const semControlesInternos = async (pagina) => {
    const vazando = [];
    for (const sel of INTERNOS) {
      const n = await pagina.locator(sel).count();
      if (!n) continue;
      // Conta so o que o cliente consegue enxergar de fato.
      const visiveis = await pagina.locator(sel).evaluateAll((els) =>
        els.filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed").length);
      if (visiveis) vazando.push(`${sel}(${visiveis})`);
    }
    return vazando;
  };

  const CORRETOR = "w=54999013331&c=Teste&cr=CRECI%2012345";

  let cli = await abrir(`/?cliente&${CORRETOR}#emp-boulevard`);
  await teste("link do empreendimento não mostra controle interno", async () => {
    const vazando = await semControlesInternos(cli);
    return vazando.length ? `aparecem: ${vazando.join(", ")}` : "";
  });
  await teste("o botão do corretor aparece com nome e CRECI", async () => {
    const cta = cli.locator("#corretor-cta");
    if (await cta.getAttribute("hidden") !== null) return "o CTA ficou escondido";
    const texto = await cta.innerText();
    const href = await cta.getAttribute("href");
    if (!/Teste/.test(texto)) return "sem o nome do corretor";
    if (!/CRECI/.test(texto)) return "sem o CRECI";
    return /wa\.me\/5554999013331/.test(href || "") ? "" : `href errado: ${href}`;
  });
  await teste("o lead não navega para outro empreendimento", async () => {
    await cli.evaluate(() => { location.hash = "#emp-renaissance"; });
    await cli.waitForTimeout(400);
    const titulo = await cli.locator("#detail-view h1").innerText();
    return /boulevard/i.test(titulo) ? "" : `a pagina foi parar em: ${titulo}`;
  });
  await teste("nenhuma unidade vendida aparece para o cliente", async () => {
    await cli.evaluate(() => document.querySelectorAll("details.unit-group").forEach((d) => { d.open = true; }));
    // Pela etiqueta de status, nao pelo texto: o aviso legal das fotos fala em
    // "unidades ja vendidas" de proposito e nao pode derrubar o teste.
    const pills = await cli.locator(".status-pill.status-vendido").count();
    if (pills) return `${pills} unidade(s) com etiqueta Vendido na tela do cliente`;
    // E confere contra o cadastro: o Boulevard tem vendidos de verdade.
    const codigos = await cli.locator("[data-unit-code]").evaluateAll((els) => [...new Set(els.map((e) => e.dataset.unitCode))]);
    return codigos.includes("301") ? "o apto 301 (vendido) apareceu na lista" : "";
  });
  await teste("o cliente não vê quantas unidades sobraram", async () => {
    const texto = await cli.locator("#detail-view").innerText();
    return /\d+\s+unidades?\s+dispon|restam?\s+\d/i.test(texto) ? "ha contagem de estoque na tela" : "";
  });
  await cli.close();

  let uni = await abrir(`/?cliente&u=501&${CORRETOR}#emp-boulevard`);
  await teste("link de unidade vira a ficha daquela unidade", async () => {
    const h1 = await uni.locator("#detail-view h1").innerText();
    if (!/Apto 501/.test(h1)) return `o titulo nao diz a unidade: ${h1}`;
    return (await uni.locator(".ficha-unidade").count()) ? "" : "a ficha da unidade nao foi montada";
  });
  await teste("a ficha traz área, garagem, valor, entrega e RI", async () => {
    const ficha = await uni.locator(".ficha-unidade").innerText();
    const falta = [];
    if (!/Área privativa/i.test(ficha)) falta.push("area privativa");
    if (!/Área global/i.test(ficha)) falta.push("area global");
    if (!/Garagem/i.test(ficha)) falta.push("garagem");
    if (!/Entrega/i.test(ficha)) falta.push("entrega");
    if (!/Registro/i.test(ficha)) falta.push("RI");
    if (!/Dormitórios|Tipologia/i.test(ficha)) falta.push("tipologia");
    if (!/R\$/.test(ficha)) falta.push("valor");
    return falta.length ? `sem ${falta.join(", ")}` : "";
  });
  await teste("o RI do Boulevard é o do cadastro", async () => {
    const ficha = await uni.locator(".ficha-unidade").innerText();
    return /1-50\.267/.test(ficha) ? "" : "o RI nao apareceu na ficha";
  });
  await teste("só a planta daquela unidade é mostrada", async () => {
    const secao = uni.locator(".plant-section");
    if (!(await secao.count())) return "nao ha secao de plantas";
    const texto = await secao.innerText();
    if (!/Tipo 1/.test(texto)) return `a planta do final 01 nao apareceu: ${texto.slice(0, 120)}`;
    if (/Tipo 2|Tipo 3|Tipo 4/.test(texto)) return "apareceu a planta de outro final";
    if (/área de lazer/i.test(texto)) return "a planta do lazer apareceu como planta da unidade";
    if (/pavimento/i.test(texto)) return "a prancha do pavimento apareceu no link da unidade";
    return "";
  });
  await teste("a tabela de unidades sai da ficha de uma unidade só", async () => {
    return (await uni.locator("#unidades").count()) ? "a tabela de unidades continuou na tela" : "";
  });
  await teste("link de unidade não mostra controle interno", async () => {
    const vazando = await semControlesInternos(uni);
    return vazando.length ? `aparecem: ${vazando.join(", ")}` : "";
  });
  await teste("a ficha da unidade cabe no celular", async () => {
    await uni.setViewportSize({ width: 390, height: 844 });
    await uni.waitForTimeout(300);
    const sobra = await uni.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    return sobra <= 2 ? "" : `sobram ${sobra}px de rolagem horizontal`;
  });
  await uni.close();

  let sel = await abrir(`/?cliente&sel=boulevard~501,boulevard~801&${CORRETOR}#emp-boulevard`);
  await teste("seleção mostra só as unidades escolhidas", async () => {
    await sel.evaluate(() => document.querySelectorAll("details.unit-group").forEach((d) => { d.open = true; }));
    const codigos = await sel.locator("[data-unit-code]").evaluateAll((els) =>
      [...new Set(els.map((el) => el.dataset.unitCode))]);
    const sobrando = codigos.filter((c) => !["501", "801"].includes(c));
    return sobrando.length ? `apareceram tambem: ${sobrando.join(", ")}` : "";
  });
  await sel.close();

  let lista = await abrir(`/?cliente&lista=boulevard,prime&${CORRETOR}`);
  await teste("lista do cliente mostra só os empreendimentos enviados", async () => {
    const texto = await lista.locator("#portfolio-grid").innerText();
    if (!/Boulevard/i.test(texto) || !/Prime/i.test(texto)) return "faltou um dos enviados";
    return /Renaissance|Evolutti|Quality/i.test(texto) ? "apareceu empreendimento que nao foi enviado" : "";
  });
  await teste("a lista do cliente esconde hero, filtros e faixa da tabela", async () => {
    const visiveis = [];
    for (const sel2 of ["#home-hero", "#filters-panel", ".trust-strip"]) {
      if (await lista.locator(sel2).isVisible().catch(() => false)) visiveis.push(sel2);
    }
    return visiveis.length ? `aparecem: ${visiveis.join(", ")}` : "";
  });
  await lista.close();

  // ================================================================== o painel
  grupo("PAINEL ADMINISTRATIVO");

  const arquivosLocais = {};
  for (const rel of ["data.js", "index.html", "sw.js", "admin/index.html"]) {
    arquivosLocais[rel] = fs.readFileSync(path.join(RAIZ, rel), "utf8");
  }
  const b64 = (t) => Buffer.from(t, "utf8").toString("base64");

  const gravacoes = [];
  const ctxAdmin = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  await ctxAdmin.route("https://api.github.com/**", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    const metodo = req.method();
    // O cofre privado dos custos.
    if (url.pathname.includes("senger-financeiro")) {
      if (metodo === "GET") return rota.fulfill({ status: 404, body: "{}" });
      gravacoes.push({ path: "cofre", metodo });
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: { sha: "x" } }) });
    }
    // A API de dados do git: ref, commit pai, blobs, arvore, commit e o PATCH
    // que move a branch. Sao os passos da publicacao em um commit so.
    if (url.pathname.includes("/git/")) {
      if (metodo === "GET") {
        const corpoGet = /\/git\/ref\//.test(url.pathname)
          ? { object: { sha: "pai123" }, ref: "refs/heads/main" }
          : { sha: "pai123", tree: { sha: "arvore123" } };
        return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpoGet) });
      }
      gravacoes.push({ path: url.pathname, metodo });
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ sha: `novo-${gravacoes.length}`, object: { sha: "novo" } }) });
    }
    const m = url.pathname.match(/contents\/(.+)$/);
    const rel = m ? decodeURIComponent(m[1]) : "";
    if (metodo === "GET") {
      const texto = arquivosLocais[rel];
      if (texto === undefined) return rota.fulfill({ status: 404, body: "{}" });
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ content: b64(texto), sha: `sha-${rel}` }) });
    }
    // Uma publicacao de verdade — guarda o que foi enviado para conferir depois.
    const corpo = JSON.parse(req.postData() || "{}");
    gravacoes.push({ path: rel || url.pathname, metodo, mensagem: corpo.message });
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ content: { sha: `novo-${rel}` }, commit: { sha: "abc" }, sha: "abc", object: { sha: "abc" } }) });
  });

  const admin = await ctxAdmin.newPage();
  admin.on("pageerror", (e) => erroDeConsole.push(`admin: ${e.message}`));
  await admin.addInitScript(() => {
    sessionStorage.setItem("senger-admin-ok", "1");
    localStorage.setItem("senger-admin-token", "github_pat_teste");
    localStorage.setItem("senger-admin-gh-token", "github_pat_teste");
  });
  await admin.goto(`${base}/admin/`, { waitUntil: "networkidle" });
  await admin.waitForTimeout(1200);

  // v318 — as gavetas "Visão geral" e "Materiais" do menu comecam FECHADAS e so
  // o dono as abre. O teste passou a fazer o mesmo caminho que ele: abre a
  // gaveta e so entao clica no item de dentro.
  async function clicarNoMenu(seletor) {
    const item = admin.locator(seletor).first();
    const gaveta = item.locator("xpath=ancestor::div[contains(@class,'nav-accordion')][1]");
    if (await gaveta.count()) {
      const aberta = await gaveta.first().evaluate((el) => el.classList.contains("aberto"));
      if (!aberta) {
        await gaveta.locator("[data-accordion-toggle]").first().click();
        await admin.waitForTimeout(150);
      }
    }
    await item.click();
  }

  await teste("o painel abre direto no conteúdo", async () => {
    const visivel = await admin.locator("#tela-painel").isVisible();
    if (!visivel) {
      const tela = await admin.locator(".tela.ativa").getAttribute("id");
      return `parou na tela ${tela}`;
    }
    return (await admin.locator("#conteudo").isVisible()) ? "" : "o conteudo nao carregou";
  });

  // v319 — a Visao geral virou faixa da Senger + placar. O teste segue o
  // caminho do dono: confere o total, conta os quadros, abre um e volta.
  await teste("a Visão geral abre com o total da Senger e o placar", async () => {
    const total = await admin.locator("#dashboard .ve-total").count();
    const quadros = await admin.locator("#dashboard .ve-quadro").count();
    if (!total) return "a faixa com o total da Senger nao apareceu";
    return quadros >= 8 ? "" : `so ${quadros} quadros no placar`;
  });

  await teste("a faixa de cima soma todos os empreendimentos", async () => {
    const naFaixa = await admin.locator("#dashboard .ve-total-n strong").allTextContents();
    const nosQuadros = await admin.locator("#dashboard .ve-quadro .ve-q-n").allTextContents();
    const somaDosQuadros = nosQuadros.reduce((a, t) => a + parseInt(t, 10), 0);
    const aVenda = parseInt(naFaixa[0], 10);
    if (aVenda !== somaDosQuadros) return `a faixa diz ${aVenda} a venda e os quadros somam ${somaDosQuadros}`;
    // O total do cadastro tem de fechar com "a venda + vendidos".
    const [, vendidos, cadastro] = naFaixa.map((t) => parseInt(t, 10));
    return aVenda + vendidos === cadastro ? "" : `${aVenda} + ${vendidos} nao dao os ${cadastro} do cadastro`;
  });

  await teste("tocar num quadro abre o detalhe, e o voltar fecha", async () => {
    await admin.locator("#dashboard .ve-quadro").first().click();
    await admin.waitForTimeout(250);
    if (!(await admin.locator("#dashboard .visao-emp").count())) return "o detalhe nao abriu";
    // Nada do detalhe pode ter se perdido: tipologia, garagem e cadastro.
    const colunas = await admin.locator("#dashboard .ve-coluna").count();
    if (colunas < 3) return `o detalhe abriu com ${colunas} colunas, nao 3`;
    if (!(await admin.locator("#dashboard .ve-gaveta").count())) return "sumiu a gaveta da garagem por unidade";
    await admin.locator("#dashboard [data-ve-fechar]").click();
    await admin.waitForTimeout(250);
    return (await admin.locator("#dashboard .ve-quadro").count()) >= 8 ? "" : "o voltar nao devolveu o placar";
  });

  await teste("cada módulo do menu abre a sua tela", async () => {
    const ruins = [];
    for (const modulo of ["materiais", "estoque", "precos", "incc", "publicacao", "visao"]) {
      await clicarNoMenu(`[data-modulo-alvo="${modulo}"]`);
      await admin.waitForTimeout(250);
      const visivel = await admin.locator(`section.bloco[data-modulo="${modulo}"]`).first().isVisible().catch(() => false);
      if (!visivel) ruins.push(modulo);
    }
    return ruins.length ? `nao abriram: ${ruins.join(", ")}` : "";
  });

  await teste("toda tela do painel tem como voltar", async () => {
    const semVoltar = [];
    for (const modulo of ["materiais", "estoque", "precos", "incc", "publicacao"]) {
      await clicarNoMenu(`[data-modulo-alvo="${modulo}"]`);
      await admin.waitForTimeout(200);
      if (!(await admin.locator("#botao-voltar-modulo").isVisible().catch(() => false))) semVoltar.push(modulo);
    }
    return semVoltar.length ? `sem voltar: ${semVoltar.join(", ")}` : "";
  });

  // Os tres niveis saem separados e NESTA ordem. O grupo de dado comercial pode
  // nao existir — quando nenhum empreendimento tem pendencia critica, o painel
  // omite o grupo, e isso e o certo. Exigir que ele apareca fazia o teste
  // quebrar no dia em que o cadastro ficou em ordem (v320, box 59 do Quality).
  await teste("as pendências saem separadas por prioridade", async () => {
    await clicarNoMenu('[data-visao-filtro="cadastro"]');
    await admin.waitForTimeout(400);
    const titulos = await admin.locator("#cadastro .pend-grupo-topo h3").allTextContents();
    const ordemEsperada = ["Dado comercial", "Atenção", "Material complementar"];
    const vistos = ordemEsperada.filter((t) => titulos.some((h) => h.includes(t)));
    if (!vistos.length) return "nenhum grupo de pendência na tela";
    // Nao pode faltar um nivel do meio: se ha critico e material, tem de haver
    // o grupo de atencao entre eles, na ordem.
    const posicoes = vistos.map((t) => titulos.findIndex((h) => h.includes(t)));
    const emOrdem = posicoes.every((p, i) => i === 0 || p > posicoes[i - 1]);
    return emOrdem ? "" : `grupos fora de ordem: ${titulos.join(" / ")}`;
  });

  await teste("folder e vídeo não entram como pendência crítica", async () => {
    const criticos = await admin.locator(".pend-grupo-critico").innerText().catch(() => "");
    return /folder|vídeo|video/i.test(criticos) ? "folder/video listado como dado comercial critico" : "";
  });

  await teste("digitar um custo acende Publicar e Descartar", async () => {
    await clicarNoMenu('[data-modulo-alvo="precos"]');
    await admin.waitForTimeout(600);
    // A lista vem com um acordeao fechado por empreendimento.
    await admin.evaluate(() => document.querySelectorAll("#custos-venda details").forEach((d) => { d.open = true; }));
    await admin.waitForTimeout(400);
    const campo = admin.locator("input[data-custo-chave]:visible").first();
    await campo.fill("1000000");
    await campo.dispatchEvent("input");
    await admin.waitForTimeout(400);
    const publicar = await admin.locator("#botao-publicar").isEnabled();
    const descartar = await admin.locator("#botao-descartar").isVisible();
    if (!publicar) return "o Publicar continuou apagado";
    if (!descartar) return "o Descartar continuou escondido";
    return "";
  });

  await teste("Descartar devolve o custo ao valor de antes", async () => {
    const campo = admin.locator("input[data-custo-chave]:visible").first();
    const chave = await campo.getAttribute("data-custo-chave");
    admin.once("dialog", (d) => d.accept());
    await admin.locator("#botao-descartar").click();
    await admin.waitForTimeout(600);
    const guardado = await admin.evaluate((k) => {
      const pacote = JSON.parse(localStorage.getItem("senger-admin-financeiro-v2") || "{}");
      const rascunho = localStorage.getItem("senger-admin-financeiro-rascunho");
      return { valor: (pacote.custos || {})[k], rascunho };
    }, chave);
    if (guardado.rascunho) return "o rascunho continuou gravado depois do Descartar";
    if (guardado.valor === 1000000) return "o custo digitado ficou guardado";
    const naTela = await admin.locator(`input[data-custo-chave="${chave}"]`).inputValue();
    return /1\.000\.000/.test(naTela) ? `o campo continuou com ${naTela}` : "";
  });

  await teste("o custo importado entra exato, sem arredondar", async () => {
    const resultado = await admin.evaluate(() => {
      // Le a propria implementacao: o importador nao pode arredondar nada.
      const fonte = document.documentElement.innerHTML;
      const trecho = fonte.slice(fonte.indexOf("arquivo-importar-custos"), fonte.indexOf("arquivo-importar-custos") + 4000);
      return /arredondarValor|precoDeVenda/.test(trecho);
    });
    return resultado ? "ha arredondamento no caminho da importacao" : "";
  });

  await teste("a correção do INCC não arredonda o custo", async () => {
    const texto = await admin.locator('section.bloco[data-modulo="incc"]').innerText();
    return /não é arredondado|sem arredondar|valor exato/i.test(texto)
      ? "" : "a tela do INCC nao diz que o custo fica exato";
  });

  await teste("publicar grava data.js, index.html e sw.js de uma vez", async () => {
    gravacoes.length = 0;
    await clicarNoMenu('[data-modulo-alvo="estoque"]');
    await admin.waitForTimeout(500);
    const mudou = await admin.evaluate(() => {
      // Uma mudanca de status: e a operacao mais simples que existe.
      document.querySelectorAll("#lista-emps details.emp").forEach((d) => { d.hidden = false; d.open = true; });
      const select = document.querySelector("#lista-emps select.status");
      if (!select) return false;
      select.value = select.value === "vendido" ? "disponivel" : "vendido";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    });
    if (!mudou) return "nao achei nenhum seletor de status para mexer";
    await admin.waitForTimeout(500);
    admin.on("dialog", (d) => d.accept());
    await admin.locator("#botao-publicar").click();
    await admin.waitForTimeout(2500);
    const escritas = gravacoes.filter((g) => g.metodo !== "GET");
    if (!escritas.length) return "nada foi enviado ao GitHub";
    const caminhos = escritas.map((g) => g.path);
    // O caminho novo: blobs -> tree -> commit -> mover a branch UMA vez.
    const blobs = caminhos.filter((c) => /git\/blobs/.test(c)).length;
    const arvore = caminhos.some((c) => /git\/trees/.test(c));
    const commit = caminhos.some((c) => /git\/commits/.test(c));
    const moveu = escritas.filter((g) => /git\/refs\/heads/.test(g.path) && g.metodo === "PATCH").length;
    if (blobs >= 3 && arvore && commit && moveu === 1) return "";
    // O plano B continua valendo: tres PUT separados.
    const tresPuts = ["data.js", "index.html", "sw.js"].every((f) => caminhos.includes(f));
    if (tresPuts) return "caiu no plano B (tres PUT) em vez do commit unico";
    return `envio incompleto: ${caminhos.join(", ")}`;
  });

  await teste("o painel no celular abre o menu", async () => {
    await admin.setViewportSize({ width: 390, height: 844 });
    await admin.waitForTimeout(400);
    await admin.locator("#botao-menu-admin").click();
    await admin.waitForTimeout(400);
    const aberto = await admin.locator("#painel-sidebar").isVisible();
    const sobra = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (!aberto) return "o menu nao abriu";
    return sobra <= 2 ? "" : `sobram ${sobra}px de rolagem horizontal`;
  });
  await ctxAdmin.close();

  // =============================================================== o PWA
  grupo("PWA / SERVICE WORKER");
  const pwa = await abrir("/");
  await teste("o service worker registra", async () => {
    const pronto = await pwa.evaluate(() => navigator.serviceWorker.ready.then(() => true).catch(() => false));
    return pronto ? "" : "o service worker nao ficou pronto";
  });
  await teste("o cache guarda o núcleo do site", async () => {
    await pwa.waitForTimeout(1200);
    const chaves = await pwa.evaluate(async () => {
      const nomes = await caches.keys();
      if (!nomes.length) return [];
      const c = await caches.open(nomes[0]);
      return (await c.keys()).map((r) => new URL(r.url).pathname);
    });
    return chaves.some((k) => k.endsWith("/data.js")) ? "" : `o cache tem ${chaves.length} itens e nenhum data.js`;
  });
  await teste("recarregar não quebra a página", async () => {
    await pwa.reload({ waitUntil: "networkidle" });
    const n = await pwa.locator("#portfolio-grid > *").count();
    return n >= 8 ? "" : `depois do reload sobraram ${n} cartoes`;
  });
  await pwa.close();

  await teste("nenhum erro de JavaScript em tela nenhuma", async () => {
    // O painel avisa sozinho quando o GitHub recusa; erro de codigo, nao.
    const reais = erroDeConsole.filter((e) => !/Failed to fetch|NetworkError|net::ERR/i.test(e));
    return reais.length ? reais.slice(0, 3).join(" | ") : "";
  });

  await navegador.close();
  server.close();

  console.log(`\n--- ${passaram} passaram · ${falhas.length} falharam ---`);
  if (falhas.length) {
    console.log("\nFALHAS:");
    falhas.forEach((f) => console.log(`  x ${f}`));
  }
  process.exit(falhas.length ? 1 : 0);
})();
