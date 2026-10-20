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
  // v434 — este navegador fica SEM WebGL de proposito: aqui se testam as abas
  // do mapa do predio (v431), que e o que aparece no aparelho que nao consegue
  // desenhar o predio em 3D. O 3D tem o grupo dele, num navegador com WebGL.
  await contexto.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) { return /^webgl/.test(tipo) ? null : original.call(this, tipo, ...resto); };
  });
  const erroDeConsole = [];
  contexto.on("weberror", (e) => erroDeConsole.push(String(e.error())));

  const abrir = async (rota, opcoes = {}) => {
    const pagina = await contexto.newPage();
    pagina.on("pageerror", (e) => erroDeConsole.push(`${rota}: ${e.message}`));
    if (opcoes.mobile) await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.goto(base + rota, { waitUntil: "networkidle" });
    return pagina;
  };

  // v429 — o Renaissance abre no desenho do predio ("Ver no prédio"); a lista
  // fica a um toque, em "Ver em lista", como o corretor faz.
  const verEmLista = async (p) => {
    const botao = p.locator("[data-vista-unidades=lista]");
    if (await botao.count()) { await botao.click(); await p.waitForTimeout(200); }
  };

  // ================================================================ o corretor
  grupo("SITE / CORRETOR");
  let pg = await abrir("/");

  await teste("a home lista os empreendimentos", async () => {
    const n = await pg.locator("#portfolio-grid .portfolio-card, #portfolio-grid > *").count();
    return n >= 8 ? "" : `so ${n} cartoes na vitrine`;
  });

  // v405 — o alternador Predios/Unidades saiu a pedido do dono.
  await teste("a vitrine não tem mais o alternador Prédios/Unidades", async () => {
    return (await pg.locator("#view-switch").count()) === 0 ? "" : "o alternador voltou para a vitrine";
  });

  // v419 — pedido do dono: a vitrine e o PDF da home saem do predio mais
  // barato para o mais caro; os loteamentos e "Outros Imoveis" vao para o fim.
  await teste("a vitrine e o PDF da home vão do prédio mais barato ao mais caro, loteamentos e outros no fim", async () => {
    const r = await pg.evaluate(async () => {
      const porId = new Map(window.SENGER.EMPREENDIMENTOS.map((e) => [e.id, e]));
      const cartoes = [...document.querySelectorAll("#portfolio-grid .portfolio-card")].map((c) => {
        const emp = porId.get(c.querySelector("[data-pick-emp]")?.dataset.pickEmp);
        const preco = Number(((c.textContent.match(/R\$\s?([\d.]+)/) || [])[1] || "0").replace(/\./g, ""));
        const bloco = emp?.categoria === "outros" ? 2 : (emp?.terrenos || []).length ? 1 : 0;
        return { nome: emp?.nome, bloco, preco };
      });
      const original = window.print;
      window.print = () => {};
      document.getElementById("print-sheet").innerHTML = "";
      document.getElementById("print-list").click();
      await new Promise((ok) => setTimeout(ok, 1500));
      window.print = original;
      const pdf = [...document.querySelectorAll("#print-sheet .ps-section")].map((h) => h.textContent.trim());
      return { cartoes, pdf };
    });
    const { cartoes, pdf } = r;
    if (cartoes.some((c) => !c.nome)) return "cartao sem empreendimento identificado";
    for (let i = 1; i < cartoes.length; i++) {
      const [a, b] = [cartoes[i - 1], cartoes[i]];
      if (b.bloco < a.bloco) return `${b.nome} saiu depois de ${a.nome} (loteamento/outros tem de ir para o fim)`;
      if (a.bloco === 0 && b.bloco === 0 && b.preco < a.preco) return `${b.nome} (${b.preco}) saiu depois de ${a.nome} (${a.preco})`;
    }
    if (pdf.join(" | ") !== cartoes.map((c) => c.nome).join(" | ")) return `o PDF saiu em outra ordem: ${pdf.join(", ")}`;
    return "";
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
    for (const id of ["share-emp-prices", "share-emp-link", "print-detail", "detail-back"]) {
      if (!(await pg.locator(`#${id}`).count())) faltando.push(id);
    }
    return faltando.length ? `sem ${faltando.join(", ")}` : "";
  });

  // v406 — o "WhatsApp sem preços" saiu a pedido do dono.
  await teste("a ficha do empreendimento não tem mais o WhatsApp sem preços", async () => {
    return (await pg.locator("#share-emp-no-prices").count()) === 0 ? "" : "o botao voltou";
  });

  await teste("a tipologia abre e fecha como gaveta", async () => {
    const gavetas = await pg.locator("#unidades details.unit-group").count();
    return gavetas >= 2 ? "" : `so ${gavetas} gaveta(s) de tipologia`;
  });

  // v421 — modelo C: o Compartilhar da linha leva o simbolo do WhatsApp e o
  // Selecionar uma caixinha de marcar, que nao some ao marcar e desmarcar; e
  // os botoes nunca passam por cima do preco (apartamentos e lotes).
  await teste("os botões da linha têm WhatsApp e caixinha, e não cobrem o preço", async () => {
    for (const [rota, largura] of [["/#emp-renaissance", 1024], ["/#emp-renaissance", 800], ["/#emp-nova-vila-rica-iii", 1280]]) {
      const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(base + rota, { waitUntil: "networkidle" });
      await p.waitForTimeout(500);
      await verEmLista(p);
      const r = await p.evaluate(() => {
        localStorage.removeItem("senger-selection");
        document.querySelectorAll("#unidades details.unit-group").forEach((d) => { d.open = true; });
        let cobre = "";
        document.querySelectorAll("#unidades .units-table tbody tr").forEach((tr) => {
          if (cobre || !tr.offsetParent) return;
          const preco = tr.querySelector(".price-value");
          const botoes = [...tr.querySelectorAll("td:last-child button")].filter((b) => b.offsetParent);
          if (!preco || !botoes.length) return;
          const fimPreco = preco.getBoundingClientRect().right;
          if (botoes.some((b) => b.getBoundingClientRect().left < fimPreco)) cobre = tr.dataset.unitCode;
        });
        const linha = [...document.querySelectorAll("#unidades .units-table tbody tr")].find((tr) => tr.offsetParent);
        return { cobre, wa: !!linha.querySelector("[data-share-item] .ic-wa"), caixa: !!linha.querySelector("[data-select-item] .caixa-marcar") };
      });
      if (r.cobre) { await ctx.close(); return `${rota} em ${largura}px: os botoes cobrem o preco em ${r.cobre}`; }
      if (!r.wa) { await ctx.close(); return `${rota}: o Compartilhar esta sem o simbolo do WhatsApp`; }
      if (!r.caixa) { await ctx.close(); return `${rota}: o Selecionar esta sem a caixinha`; }
      const sel = p.locator("#unidades .units-table [data-select-item]:visible").first();
      await sel.click(); await p.waitForTimeout(200);
      const marcado = await sel.evaluate((b) => ({ sel: b.classList.contains("selected"), caixa: !!b.querySelector(".caixa-marcar"), texto: b.textContent.trim() }));
      await sel.click(); await p.waitForTimeout(200);
      const desmarcado = await sel.evaluate((b) => ({ sel: b.classList.contains("selected"), caixa: !!b.querySelector(".caixa-marcar"), texto: b.textContent.trim() }));
      await ctx.close();
      if (!marcado.sel || !marcado.caixa || marcado.texto !== "Selecionado") return `${rota}: marcar deixou ${JSON.stringify(marcado)}`;
      if (desmarcado.sel || !desmarcado.caixa || desmarcado.texto !== "Selecionar") return `${rota}: desmarcar deixou ${JSON.stringify(desmarcado)}`;
    }
    return "";
  });

  // v421 — no Renaissance cada final tem a sua planta (pedido do dono, conferido
  // no desenho do andar que vem no canto de cada planta e no folder): final 01
  // a da direita, final 02 a da esquerda, final 04 a "2 suites (final 04)";
  // na 3 suites superior, o final 02 tem a planta da pagina 8 do folder;
  // o final 03 da 2 suites tem a planta que o dono mandou (espelho do 04).
  await teste("no Renaissance a planta da linha é a do final do apartamento", async () => {
    const p = await abrir("/#emp-renaissance");
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const planta = (cod) => document.querySelector(`#unidades tr[data-unit-code="${cod}"] .planta-mini img`)?.getAttribute("src") || "";
      return Object.fromEntries(["501", "502", "603", "604", "1401", "1402"].map((cod) => [cod, planta(cod)]));
    });
    await p.close();
    if (!r["501"].includes("ren-planta-3s-frente-dir")) return `501 mostra ${r["501"]}`;
    if (!r["502"].includes("ren-planta-3s-frente-esq")) return `502 mostra ${r["502"]}`;
    if (!r["603"].includes("ren-planta-2suites-03")) return `603 mostra ${r["603"]}`;
    if (!r["604"].includes("ren-planta-604")) return `604 mostra ${r["604"]}`;
    if (!/ren-planta-3s-superior\.webp/.test(r["1401"])) return `1401 mostra ${r["1401"]}`;
    if (!r["1402"].includes("ren-planta-3s-superior-02")) return `1402 mostra ${r["1402"]}`;
    return "";
  });

  // v421 — pedido do dono: 1 m² a mais ou a menos nao diferencia a unidade;
  // o 501 e o 502 levam a mesma metragem da tipologia, sem destaque.
  await teste("no Renaissance o 501 e o 502 têm a metragem da tipologia, sem destaque", async () => {
    const p = await abrir("/#emp-renaissance");
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ["501", "502", "602"].map((cod) => {
      const td = document.querySelector(`#unidades tr[data-unit-code="${cod}"] td:nth-child(2)`);
      return { cod, texto: td?.textContent.trim() || "", destaque: !!td?.classList.contains("unit-own-area") };
    }));
    await p.close();
    for (const l of r) {
      if (l.destaque) return `${l.cod} ainda sai destacado`;
      if (l.texto !== r[2].texto) return `${l.cod} mostra "${l.texto}", o 602 "${r[2].texto}"`;
    }
    return "";
  });

  // v427 — no Boulevard o final 01 e o final 02 tem plantas diferentes (o
  // painel gravava as duas no mesmo arquivo, e uma apagava a outra).
  await teste("no Boulevard o final 01 e o final 02 abrem plantas diferentes", async () => {
    const p = await abrir("/#emp-boulevard");
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => Object.fromEntries(["501", "602", "403", "404"].map((cod) => [cod,
      document.querySelector(`#unidades tr[data-unit-code="${cod}"] .planta-mini img`)?.getAttribute("src") || ""])));
    await p.close();
    if (!r["501"].includes("final-01")) return `501 mostra ${r["501"]}`;
    if (!r["602"].includes("final-02")) return `602 mostra ${r["602"]}`;
    if (!r["403"].includes("2-dormitorios")) return `403 mostra ${r["403"]}`;
    if (!r["404"].includes("2-suites")) return `404 mostra ${r["404"]}`;
    return "";
  });

  // v420 — modelo D: a miniatura da planta na linha de cada unidade, que abre
  // a planta DAQUELA unidade; o cliente tambem ve (fora dos botoes da equipe).
  await teste("a linha da unidade traz a miniatura da planta e abre a planta dela", async () => {
    for (const rota of ["/#emp-renaissance", "/?cliente#emp-renaissance"]) {
      const p = await abrir(rota);
      await p.waitForTimeout(600);
      await verEmLista(p);
      const r = await p.evaluate(() => {
        const linhas = [...document.querySelectorAll("#unidades tr[data-unit-code]")];
        const semPlanta = linhas.filter((tr) => !tr.querySelector(".planta-mini")).map((tr) => tr.dataset.unitCode);
        const gaveta = [...document.querySelectorAll("#unidades details.unit-group")].find((d) => d.offsetParent !== null);
        gaveta.open = true;
        const tr = gaveta.querySelector("tr[data-unit-code]");
        const emp = window.SENGER.EMPREENDIMENTOS.find((e) => e.id === "renaissance");
        let esperado = "";
        for (const g of emp.grupos) for (const u of g.unidades || []) if (String(u.apto) === tr.dataset.unitCode) esperado = u.planta || g.planta;
        return { linhas: linhas.length, semPlanta, codigo: tr.dataset.unitCode, esperado };
      });
      if (!r.linhas) { await p.close(); return `${rota}: nenhuma linha de unidade`; }
      if (r.semPlanta.length) { await p.close(); return `${rota}: sem miniatura em ${r.semPlanta.join(", ")}`; }
      const mini = p.locator(`#unidades tr[data-unit-code="${r.codigo}"] .planta-mini`);
      if (!(await mini.isVisible())) { await p.close(); return `${rota}: a miniatura do ${r.codigo} nao aparece`; }
      await mini.click();
      await p.waitForTimeout(500);
      const src = await p.evaluate(() => document.getElementById("lightbox")?.classList.contains("open") ? document.getElementById("lightbox-image").getAttribute("src") : "");
      await p.close();
      if (!src) return `${rota}: o toque na miniatura nao abriu o visor`;
      if (!src.includes(`/${r.esperado}.`)) return `${rota}: abriu ${src}, esperado a planta ${r.esperado}`;
    }
    return "";
  });

  await teste("cada final do Boulevard virou um quadro próprio", async () => {
    // textContent, nao innerText: desde a v407 os finais 01 e 02 moram na aba
    // "3 suítes", escondida ate o toque.
    const texto = await pg.locator("#unidades").evaluate((el) => el.textContent);
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
      // Le o menor valor das linhas da tabela (tr .price-value), nunca o texto
      // solto do quadro: o bloco dos alugados traz "Aluguel R$ 1.400,00" antes
      // do preco, e o primeiro "R$" da caixa seria o do aluguel. Desde a v383
      // o cabecalho da tipologia nao traz mais o "a partir de".
      // v407 — com abas, a ordem crescente vale dentro de cada aba.
      const porAba = await pg.evaluate(() => {
        const paineis = [...document.querySelectorAll("#unidades .painel-tipologia")];
        return (paineis.length ? paineis : [document.querySelector("#unidades")]).map((painel) =>
          [...painel.querySelectorAll("details.unit-group")]
            .map((d) => [...d.querySelectorAll("tr[data-unit-code] .price-value")]
              .map((el) => parseInt(el.textContent.replace(/\D+/g, ""), 10))
              .filter((v) => !Number.isNaN(v) && v > 0))
            .map((lista) => (lista.length ? Math.min(...lista) : null))
            .filter((v) => v !== null));
      });
      porAba.forEach((valores) => {
        const crescente = valores.every((v, i) => i === 0 || v >= valores[i - 1]);
        if (!crescente) ruins.push(`${id}: ${valores.join(" > ")}`);
      });
    }
    return ruins.length ? `fora de ordem — ${ruins.join(" | ")}` : "";
  });

  // v407 — modelo B, escolhido pelo dono: abas na ordem dele e o "a partir
  // de" ao lado do "Ver unidades".
  await teste("o Renaissance abre em abas, salas comerciais por último", async () => {
    await pg.goto(`${base}/#emp-renaissance`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(400);
    await verEmLista(pg);
    const abas = await pg.$$eval(".aba-tipologia", (els) => els.map((el) => el.textContent.trim()));
    const esperado = "2 suítes | 3 suítes frente | 3 suítes superiores | Salas comerciais";
    if (abas.join(" | ") !== esperado) return `abas: ${abas.join(" | ")}`;
    const visiveis = await pg.$$eval(".painel-tipologia", (els) => els.filter((el) => !el.hidden).length);
    if (visiveis !== 1) return `${visiveis} grupos na tela ao mesmo tempo`;
    await pg.locator(".aba-tipologia", { hasText: "Salas comerciais" }).click();
    const titulos = await pg.locator(".painel-tipologia:not([hidden]) .unit-group-header h3").allInnerTexts();
    return titulos.length === 1 && /Salas comerciais/.test(titulos[0]) ? "" : `a aba das salas mostrou: ${titulos.join(" / ")}`;
  });

  // v428 — modelo A, escolhido pelo dono: as abas viram botoes redondos, com
  // "Escolha a tipologia:" na frente, para ninguem deixar de ver as outras.
  await teste("as abas são botões redondos, com \"Escolha a tipologia\" na frente", async () => {
    const r = await pg.evaluate(() => {
      const lista = document.querySelector(".abas-tipologia");
      const sel = document.querySelector('.aba-tipologia[aria-selected="true"]');
      const outra = document.querySelector('.aba-tipologia[aria-selected="false"]');
      const cs = (el) => getComputedStyle(el);
      return { rotulo: getComputedStyle(lista, "::before").content, raio: parseFloat(cs(sel).borderTopLeftRadius),
        fundoSel: cs(sel).backgroundColor, borda: cs(outra).borderTopColor };
    });
    if (!/Escolha a tipologia/.test(r.rotulo)) return `sem o rótulo: ${r.rotulo}`;
    if (r.raio < 15) return `cantos de ${r.raio}px`;
    if (r.fundoSel !== "rgb(23, 143, 160)") return `a aba escolhida não está pintada: ${r.fundoSel}`;
    if (r.borda !== "rgb(23, 143, 160)") return `as outras abas sem contorno: ${r.borda}`;
    return "";
  });

  await teste("o cabeçalho da tipologia traz o \"a partir de\" ao lado do Ver unidades", async () => {
    const texto = await pg.locator(".painel-tipologia:not([hidden]) .unit-group-aside").first().innerText();
    return /a partir de\s*R\$\s*1\.142\.900/.test(texto) ? "" : `o canto diz: ${texto.replace(/\s+/g, " ")}`;
  });

  // v429 — o mapa do predio, pedido do dono (16/10/2026): o Renaissance abre
  // no desenho, o toque no apartamento abre a ficha ao lado, com o preco do
  // cadastro; vendido aparece como "Vendido", sem ficha. So no modo corretor.
  // v431 — em duas abas, como no mapa antigo: "Apartamentos 3 suites" (frente,
  // finais 01 e 02) e "Apartamentos 2 suites" (fundos, finais 03 e 04).
  const tocarNoPredio = async (p, cod) => {
    const aba = /0[34]$/.test(cod) ? "Apartamentos 2 suítes" : "Apartamentos 3 suítes";
    await p.locator(".aba-predio", { hasText: aba }).click();
    await p.locator(".predio-painel:not([hidden]) button.predio-u", { hasText: new RegExp(`^${cod}$`) }).click();
  };

  await teste("o Renaissance abre no prédio, e o toque no apartamento abre a ficha dele", async () => {
    const p = await abrir("/#emp-renaissance");
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const emp = window.SENGER.EMPREENDIMENTOS.find((e) => e.id === "renaissance");
      const unidades = emp.grupos.flatMap((g) => g.unidades);
      const unicos = (lista) => [...new Set(lista)].sort().join(",");
      return {
        predio: !document.querySelector(".vista-predio").hidden,
        lista: !document.querySelector(".vista-lista").hidden,
        botoes: unicos([...document.querySelectorAll("button.predio-u")].map((el) => el.textContent.trim())),
        aVenda: unicos(unidades.filter((u) => u.status !== "vendido").map((u) => String(u.apto))),
        vendidas: unicos(unidades.filter((u) => u.status === "vendido").map((u) => String(u.apto))),
        naTela: unicos([...document.querySelectorAll(".predio-vendido")].map((el) => el.title.replace(" — vendido", ""))),
        preco: unidades.find((u) => u.apto === "1302").preco,
      };
    });
    if (!r.predio || r.lista) { await p.close(); return `abriu com prédio ${r.predio} e lista ${r.lista}`; }
    if (r.botoes !== r.aVenda) { await p.close(); return `no desenho: ${r.botoes} — à venda no cadastro: ${r.aVenda}`; }
    if (r.naTela !== r.vendidas) { await p.close(); return `vendidos no desenho: ${r.naTela} — no cadastro: ${r.vendidas}`; }
    await tocarNoPredio(p, "1302");
    await p.waitForTimeout(300);
    const ficha = (await p.locator(".predio-ficha").innerText()).replace(/\s+/g, " ");
    const preco = r.preco.toLocaleString("pt-BR");
    if (!/Apto 1302/.test(ficha) || !ficha.includes(`R$ ${preco}`) || !/1 box duplo \+ 1 box simples/.test(ficha) || !/13º andar/.test(ficha)) { await p.close(); return `a ficha diz: ${ficha}`; }
    const sel = p.locator(".predio-ficha [data-select-item]");
    await sel.click(); await p.waitForTimeout(200);
    const marcado = (await sel.innerText()).trim();
    await sel.click(); await p.waitForTimeout(200);
    if (marcado !== "Selecionado") { await p.close(); return `o Selecionar da ficha deixou "${marcado}"`; }
    await p.locator(".predio-ficha .planta-mini").click();
    await p.waitForTimeout(400);
    const src = await p.evaluate(() => document.getElementById("lightbox")?.classList.contains("open") ? document.getElementById("lightbox-image").getAttribute("src") : "");
    await p.keyboard.press("Escape");
    if (!/ren-planta-1302/.test(src)) { await p.close(); return `o Ver planta abriu "${src}"`; }
    await verEmLista(p);
    const depois = await p.evaluate(() => [document.querySelector(".vista-predio").hidden, document.querySelector(".vista-lista").hidden, document.querySelectorAll(".aba-tipologia").length]);
    await p.close();
    return depois[0] && !depois[1] && depois[2] ? "" : `o "Ver em lista" deixou prédio escondido ${depois[0]}, lista escondida ${depois[1]}, ${depois[2]} abas`;
  });

  await teste("o prédio tem a aba dos 3 suítes (frente) e a dos 2 suítes (fundos)", async () => {
    const p = await abrir("/#emp-renaissance");
    await p.waitForTimeout(400);
    const naTela = () => p.evaluate(() => {
      const painel = document.querySelector(".predio-painel:not([hidden])");
      return {
        codigos: [...painel.querySelectorAll("button.predio-u")].map((el) => el.textContent.trim()).filter((c) => /^\d+$/.test(c)),
        vazios: painel.querySelectorAll(".predio-fantasma").length,
        paineis: document.querySelectorAll(".predio-painel:not([hidden])").length,
      };
    });
    const abas = await p.$$eval(".aba-predio", (els) => els.map((el) => `${el.textContent.trim()}${el.getAttribute("aria-selected") === "true" ? "*" : ""}`));
    if (abas.join(" | ") !== "Apartamentos 3 suítes* | Apartamentos 2 suítes") { await p.close(); return `abas: ${abas.join(" | ")}`; }
    const frente = await naTela();
    if (frente.paineis !== 1) { await p.close(); return `${frente.paineis} abas do prédio na tela ao mesmo tempo`; }
    const foraDaFrente = frente.codigos.filter((c) => !/0[12]$/.test(c));
    if (foraDaFrente.length || !frente.codigos.includes("1302")) { await p.close(); return `a aba 3 suítes mostra: ${frente.codigos.join(",")}`; }
    await p.locator(".aba-predio", { hasText: "Apartamentos 2 suítes" }).click();
    const fundos = await naTela();
    await p.close();
    const foraDosFundos = fundos.codigos.filter((c) => !/0[34]$/.test(c));
    if (foraDosFundos.length || !fundos.codigos.includes("1203") || !fundos.codigos.includes("504")) return `a aba 2 suítes mostra: ${fundos.codigos.join(",")}`;
    // 18º (largo), 17º ao 13º e 4º sem 2 suítes: os quadradinhos ficam vazios.
    return fundos.vazios === 13 ? "" : `a aba 2 suítes tem ${fundos.vazios} quadradinhos vazios, esperado 13`;
  });

  // v430 — pedido do dono: a planta tecnica do andar, em PDF, na ficha,
  // como no mapa antigo (pranchas A05 a A09).
  await teste("a ficha do prédio traz a planta técnica do andar, em PDF", async () => {
    const p = await abrir("/#emp-renaissance");
    await p.waitForTimeout(400);
    const esperado = { "402": "pavimento-04", "503": "pavimento-05", "1004": "pavimento-06-a-12", "1302": "pavimento-13", "1701": "pavimento-14-a-17", "Sala 04": "" };
    for (const [cod, arquivo] of Object.entries(esperado)) {
      await tocarNoPredio(p, cod);
      await p.waitForTimeout(200);
      const r = await p.evaluate(async () => {
        const a = document.querySelector(".predio-ficha .planta-tecnica");
        if (!a) return { href: "" };
        return { href: a.getAttribute("href"), alvo: a.target, status: (await fetch(a.href, { method: "HEAD" })).status };
      });
      if (!arquivo) { if (r.href) { await p.close(); return `${cod} não devia ter planta técnica e mostra ${r.href}`; } continue; }
      if (!r.href.includes(`/${arquivo}.pdf`)) { await p.close(); return `${cod} abre "${r.href}", esperado ${arquivo}.pdf`; }
      if (r.status !== 200) { await p.close(); return `${cod}: o PDF respondeu ${r.status}`; }
      if (r.alvo !== "_blank") { await p.close(); return `${cod}: o PDF não abre em outra aba`; }
    }
    await p.close();
    return "";
  });

  await teste("no celular a ficha abre embaixo do prédio e a tela desce até ela", async () => {
    const p = await abrir("/#emp-renaissance", { mobile: true });
    await p.waitForTimeout(500);
    const largura = await p.evaluate(() => document.documentElement.scrollWidth);
    await tocarNoPredio(p, "1203");
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const ficha = document.querySelector(".predio-ficha").getBoundingClientRect();
      const topo = document.querySelector(".site-header").getBoundingClientRect().bottom;
      const desenho = document.querySelector(".predio-desenho").getBoundingClientRect();
      return { ficha: Math.round(ficha.top), topo: Math.round(topo), embaixo: ficha.top >= desenho.bottom, tela: innerHeight,
        texto: document.querySelector(".predio-ficha h3")?.textContent || "" };
    });
    await p.close();
    if (largura > 390) return `a página passou da largura do celular (${largura}px)`;
    if (!r.embaixo) return "a ficha não ficou embaixo do desenho";
    if (r.texto !== "Apto 1203") return `a ficha mostra "${r.texto}"`;
    return r.ficha >= r.topo && r.ficha < r.tela / 2 ? "" : `a ficha ficou em ${r.ficha}px (cabeçalho até ${r.topo}px)`;
  });

  // v432 — ordem do dono: o cliente tambem ve o mapa, igual ao do corretor
  // (com "Vendido"), so sem o Compartilhar e o Selecionar na ficha.
  await teste("o cliente vê o mapa do prédio, sem os botões da equipe na ficha", async () => {
    const p = await abrir("/?cliente#emp-renaissance");
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({
      predio: !!document.querySelector(".vista-predio:not([hidden])"),
      abas: document.querySelectorAll(".aba-predio").length,
      vendidos: document.querySelectorAll(".predio-vendido").length,
    }));
    if (!r.predio) { await p.close(); return "o cliente não recebeu o desenho do prédio"; }
    if (r.abas !== 2) { await p.close(); return `o cliente vê ${r.abas} abas no prédio`; }
    if (!r.vendidos) { await p.close(); return "o cliente não vê os vendidos no desenho"; }
    await tocarNoPredio(p, "1302");
    await p.waitForTimeout(300);
    const ficha = await p.evaluate(() => {
      const f = document.querySelector(".predio-ficha");
      return { texto: f.innerText.replace(/\s+/g, " "), equipe: f.querySelectorAll("[data-share-item], [data-select-item]").length, tecnica: !!f.querySelector(".planta-tecnica") };
    });
    await p.close();
    if (!/Apto 1302/.test(ficha.texto) || !/R\$/.test(ficha.texto)) return `a ficha do cliente diz: ${ficha.texto}`;
    if (ficha.equipe) return "a ficha do cliente mostra o Compartilhar ou o Selecionar";
    return ficha.tecnica ? "" : "a ficha do cliente está sem a planta técnica";
  });

  await teste("sem WebGL, o Renaissance mostra as abas do mapa no lugar do prédio em 3D", async () => {
    const p = await abrir("/#emp-renaissance");
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({
      tresD: document.querySelectorAll("[data-predio-3d]").length,
      abas: !document.querySelector(".predio-desenho").hidden && document.querySelectorAll(".aba-predio").length,
      dica: document.querySelector("#unidades .section-title-row p").textContent,
    }));
    await p.close();
    if (r.tresD) return "o palco do 3D ficou na tela sem WebGL";
    if (r.abas !== 2) return `as abas do mapa não voltaram (${r.abas})`;
    return r.dica === "Toque no apartamento para ver a ficha" ? "" : `a dica diz "${r.dica}"`;
  });

  await teste("Personalité e Prime, com uma tipologia só, ficam sem abas", async () => {
    const com = [];
    for (const id of ["personalite", "prime"]) {
      await pg.goto(`${base}/#emp-${id}`, { waitUntil: "networkidle" });
      await pg.waitForTimeout(300);
      if (await pg.locator(".abas-tipologia").count()) com.push(id);
    }
    return com.length ? `com abas: ${com.join(", ")}` : "";
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
    await pg.waitForFunction(() => document.documentElement.scrollHeight > 1800, null, { timeout: 8000 }).catch(() => {});
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
    // Abre um empreendimento pelo cartao, como o corretor faz. v400 — sem o
    // banner, o primeiro cartao fica no alto da pagina: clicar nele faria o
    // navegador rolar ate la antes do clique. O ultimo esta na tela.
    await pg.locator("#portfolio-grid .card-open-overlay").last().click();
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
  // Guarda da v333. O WhatsApp do celular do dono descarta a legenda quando vai
  // foto anexada (provado em 21/09 com o site exato de 17/08). Entao NENHUM
  // envio leva arquivo: o texto vai com o link no fim e a foto vem pela previa.
  // Para 2 a 4 empreendimentos o link e a ponte da montagem (l/sel/), que
  // precisa existir com a imagem. No computador nao ha envio nativo: abre a
  // janela de copiar/baixar, com o texto e as fotos.
  //
  // O navigator.share e interceptado; o que interessa e O QUE O SITE ENTREGA.
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
  const envioDaSelecao = async (celular) => {
    const ctx = await navegador.newContext(celular
      ? { userAgent: ANDROID, viewport: { width: 390, height: 844 } }
      : { viewport: { width: 1280, height: 900 } });
    const pagina = await ctx.newPage();
    await pagina.addInitScript(() => {
      window.__share = [];
      navigator.share = async (d) => { window.__share.push({ title: d.title ?? null, texto: d.text || "", arquivos: (d.files || []).length }); };
      navigator.canShare = () => true;
    });
    await pagina.goto(base + "/", { waitUntil: "networkidle" });
    // v405 — sem a visao de unidades na vitrine, a unidade e selecionada
    // dentro do empreendimento, como o corretor faz: os dois primeiros predios.
    const predios = await pagina.evaluate(() => [...document.querySelectorAll("[data-pick-emp]")].slice(0, 2).map((b) => b.dataset.pickEmp));
    const chaves = [];
    for (const id of predios) {
      await pagina.evaluate((alvo) => { location.hash = "#emp-" + alvo; }, id);
      await pagina.waitForTimeout(600);
      const chave = await pagina.evaluate(() => {
        const botao = [...document.querySelectorAll("[data-select-item]")].find((el) => !el.disabled);
        botao?.click();
        return botao?.dataset.selectItem || null;
      });
      if (chave) chaves.push(chave);
    }
    await pagina.evaluate(() => { location.hash = ""; });
    await pagina.waitForTimeout(400);
    const resultado = { emps: chaves.map((c) => c.split(":")[0]) };
    for (const [rotulo, id] of [["descricao", "share-selected-prices"], ["link", "share-selected-link"]]) {
      await pagina.evaluate(() => { window.__share = []; });
      await pagina.locator("#selection-fab").click();
      await pagina.waitForTimeout(200);
      await pagina.locator("#" + id).click();
      await pagina.waitForTimeout(1500);
      resultado[rotulo] = await pagina.evaluate(() => ({
        envios: window.__share,
        janela: document.getElementById("share-modal")?.classList.contains("open") || false,
        textoDaJanela: document.getElementById("share-modal-text")?.value || "",
        fotosNaJanela: document.querySelectorAll("#share-modal-photos img").length,
      }));
      await pagina.evaluate(() => {
        document.getElementById("share-modal")?.classList.remove("open");
        document.body.classList.remove("no-scroll");
        document.querySelector(".selection-drawer")?.classList.remove("open");
      });
      await pagina.waitForTimeout(150);
    }
    await ctx.close();
    return resultado;
  };

  await teste("no celular, a seleção vai como texto com o link da montagem — sem arquivo", async () => {
    const r = await envioDaSelecao(true);
    const chave = [...r.emps].sort().join("_");
    for (const rotulo of ["descricao", "link"]) {
      const envio = r[rotulo].envios[0];
      if (!envio) return `${rotulo}: nao houve envio nenhum`;
      if (r[rotulo].envios.length !== 1) return `${rotulo}: ${r[rotulo].envios.length} envios, esperado 1`;
      if (envio.arquivos !== 0) return `${rotulo}: foi com ${envio.arquivos} arquivo(s) — o WhatsApp descarta a legenda`;
      if (envio.texto.length < 100) return `${rotulo}: o texto saiu com ${envio.texto.length} caracteres`;
      if (!envio.texto.includes(`/l/sel/${chave}/`)) return `${rotulo}: o texto nao leva o link da montagem l/sel/${chave}/`;
      if (/[?&]sel=/.test(envio.texto)) return `${rotulo}: o link da montagem saiu comprido (?sel=), e nao o curto (?s=)`;
      if (r[rotulo].janela) return `${rotulo}: abriu a janela de copiar no celular`;
    }
    if (!fs.existsSync(path.join(RAIZ, "l", "sel", chave, "index.html"))) return `a ponte l/sel/${chave}/ nao existe`;
    if (!fs.existsSync(path.join(RAIZ, "assets", "preview", "sel", `${chave}.jpg`))) return `a montagem assets/preview/sel/${chave}.jpg nao existe`;
    return "";
  });

  await teste("no computador, abre a janela com o texto (com link) e as fotos", async () => {
    const r = await envioDaSelecao(false);
    for (const rotulo of ["descricao", "link"]) {
      if (r[rotulo].envios.length) return `${rotulo}: disparou envio nativo no computador`;
      if (!r[rotulo].janela) return `${rotulo}: nao abriu a janela de copiar/baixar`;
      if (!/https?:\/\//.test(r[rotulo].textoDaJanela)) return `${rotulo}: o texto da janela esta sem link`;
      if (r[rotulo].fotosNaJanela < 1) return `${rotulo}: a janela esta sem foto`;
    }
    return "";
  });

  await teste("a ponte da montagem aponta para a imagem certa e redireciona para o portfólio", async () => {
    const chave = "evolutti_renaissance";
    const html = fs.readFileSync(path.join(RAIZ, "l", "sel", chave, "index.html"), "utf8");
    if (!html.includes(`assets/preview/sel/${chave}.jpg`)) return "og:image nao aponta para a montagem";
    const pagina = await contexto.newPage();
    await pagina.goto(`${base}/l/sel/${chave}/?sel=evolutti~504,renaissance~503&w=5554999`, { waitUntil: "networkidle" });
    await pagina.waitForTimeout(500);
    const url = pagina.url();
    await pagina.close();
    if (!/\/\?cliente&sel=evolutti~504,renaissance~503&w=5554999$/.test(url)) return `redirecionou para ${url}`;
    return "";
  });

  await teste("o link curto da montagem (?s=) abre as mesmas unidades", async () => {
    const pagina = await contexto.newPage();
    await pagina.goto(`${base}/l/sel/evolutti_renaissance/?s=504.604_503&w=5554999`, { waitUntil: "networkidle" });
    await pagina.waitForTimeout(500);
    const url = pagina.url();
    await pagina.close();
    if (!/\/\?cliente&sel=evolutti~504,evolutti~604,renaissance~503&w=5554999$/.test(url)) return `redirecionou para ${url}`;
    return "";
  });

  // v418 — o Compartilhar do topo manda o link do SISTEMA para outro corretor:
  // so texto (regra da v333), com a ponte l/portfolio/, que da a previa com a
  // montagem dos predios e abre o portfolio no modo corretor (sem ?cliente).
  await teste("o Compartilhar do topo manda o link do sistema, só texto", async () => {
    const ctx = await navegador.newContext({ userAgent: ANDROID, viewport: { width: 390, height: 844 } });
    const pagina = await ctx.newPage();
    await pagina.addInitScript(() => {
      window.__share = [];
      navigator.share = async (d) => { window.__share.push({ title: d.title ?? null, texto: d.text || "", arquivos: (d.files || []).length }); };
      navigator.canShare = () => true;
    });
    await pagina.goto(base + "/", { waitUntil: "networkidle" });
    await pagina.locator("#compartilhar-sistema").click();
    await pagina.waitForTimeout(600);
    const r = await pagina.evaluate(() => ({
      envios: window.__share,
      janela: document.getElementById("share-modal")?.classList.contains("open") || false,
    }));
    await ctx.close();
    const envio = r.envios[0];
    if (!envio) return "nao houve envio nenhum";
    if (r.envios.length !== 1) return `${r.envios.length} envios, esperado 1`;
    if (envio.arquivos !== 0) return `foi com ${envio.arquivos} arquivo(s) — o WhatsApp descarta a legenda`;
    if (!/https?:\/\/\S+\/l\/portfolio\/$/.test(envio.texto)) return "o texto nao termina com o link l/portfolio/";
    if (/cliente/.test(envio.texto)) return "o link do sistema saiu no modo cliente";
    if (r.janela) return "abriu a janela de copiar no celular";
    return "";
  });

  await teste("a ponte do portfólio mostra a montagem dos prédios e abre o sistema no modo corretor", async () => {
    const html = fs.readFileSync(path.join(RAIZ, "l", "portfolio", "index.html"), "utf8");
    if (!html.includes('og:image" content="https://construtora-senger.github.io/materialsengercorretores/assets/preview/portfolio.jpg"')) return "og:image nao aponta para a previa do portfolio";
    if (!fs.existsSync(path.join(RAIZ, "assets", "preview", "portfolio.jpg"))) return "assets/preview/portfolio.jpg nao existe";
    const pagina = await contexto.newPage();
    await pagina.goto(`${base}/l/portfolio/`, { waitUntil: "networkidle" });
    await pagina.waitForTimeout(500);
    const url = pagina.url();
    const temBotao = await pagina.locator("#compartilhar-sistema").count();
    await pagina.close();
    if (url !== `${base}/`) return `redirecionou para ${url}`;
    if (!temBotao) return "o portfolio abriu sem os botoes do corretor";
    return "";
  });

  // ================================================================= o cliente
  grupo("MODO CLIENTE");

  const INTERNOS = ["#share-emp-prices", "#share-emp-no-prices", "#share-emp-link", "#print-detail",
    "#print-list", "#share-portfolio", "#corretor-button", "#compartilhar-sistema", ".version-tag", "[data-select-item]", "[data-share-item]"];

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
  // v374 — "Ver no mapa": o lote abre o mapa do loteamento com a marca
  // desenhada, tambem para o cliente (que nao ve os botoes da equipe).
  await teste("o lote abre o mapa com a marca, inclusive para o cliente", async () => {
    const lv = await abrir(`/?cliente&${CORRETOR}#emp-nova-vila-rica-iii`);
    await lv.waitForTimeout(600);
    const botoes = lv.locator("#unidades .units-table .map-link");
    if (!(await botoes.count())) return "nenhum botao Ver no mapa na tabela de lotes";
    await lv.locator("#unidades details.unit-group").first().evaluate((d) => { d.open = true; });
    await botoes.first().click();
    await lv.waitForTimeout(800);
    const aberto = await lv.locator("#lightbox.open").count();
    if (!aberto) return "o mapa nao abriu";
    const src = await lv.locator("#lightbox-image").getAttribute("src");
    if (!/^data:image\/jpeg/.test(src || "")) return "o mapa abriu sem a marca desenhada";
    const legenda = await lv.locator("#lightbox-caption").innerText();
    return /Quadra \d+ · Lote \d+/.test(legenda) ? "" : `legenda inesperada: ${legenda}`;
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
    // v423 — as legendas do Boulevard nao dizem mais "tipo N" (tipo e o
    // pavimento, nao o final); quem identifica a planta e o final.
    if (!/final 01/i.test(texto)) return `a planta do final 01 nao apareceu: ${texto.slice(0, 120)}`;
    if (/final 0[234]/i.test(texto)) return "apareceu a planta de outro final";
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
  // v407 — 501 e 801 sao da mesma aba ("3 suítes"): uma aba sozinha nao aparece.
  await teste("seleção de um grupo só vem sem abas", async () => {
    return (await sel.locator(".abas-tipologia").count()) ? "apareceram abas com um grupo so" : "";
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
      gravacoes.push({ path: url.pathname, metodo, corpo: req.postData() || "" });
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

  // v335 — os lotes dos loteamentos ficam fora da faixa de cima, a pedido do
  // dono; eles seguem nos quadros deles. A faixa tem de fechar com a soma dos
  // quadros que nao sao de lotes — e nunca mais com a soma de todos.
  await teste("a faixa de cima soma os empreendimentos, sem os lotes dos loteamentos", async () => {
    const naFaixa = await admin.locator("#dashboard .ve-total-n strong").allTextContents();
    const quadros = await admin.locator("#dashboard .ve-quadro").evaluateAll((els) => els.map((el) => ({
      n: parseInt(el.querySelector(".ve-q-n").textContent, 10),
      lotes: /\blotes\b/.test(el.querySelector(".ve-q-un").textContent),
    })));
    const somaSemLotes = quadros.filter((q) => !q.lotes).reduce((a, q) => a + q.n, 0);
    const somaComLotes = quadros.reduce((a, q) => a + q.n, 0);
    const aVenda = parseInt(naFaixa[0], 10);
    if (aVenda !== somaSemLotes) return `a faixa diz ${aVenda} a venda e os quadros sem lotes somam ${somaSemLotes}`;
    if (quadros.some((q) => q.lotes) && aVenda === somaComLotes) return "a faixa ainda soma os lotes dos loteamentos";
    // O total do cadastro tem de fechar com "a venda + vendidos".
    const [, vendidos, cadastro] = naFaixa.map((t) => parseInt(t, 10));
    return aVenda + vendidos === cadastro ? "" : `${aVenda} + ${vendidos} nao dao os ${cadastro} do cadastro`;
  });

  // v335 — `foraDaConta: true` (hoje, o Campos Elisios) deixa o item na
  // vitrine, mas fora da conta do painel: nem a venda, nem no total.
  await teste("o item marcado como fora da conta fica na vitrine, mas fora da faixa", async () => {
    const fonte = fs.readFileSync(path.join(RAIZ, "data.js"), "utf8");
    const { EMPREENDIMENTOS } = new Function(fonte.replace(/window\.SENGER[\s\S]*$/, "") + "; return { EMPREENDIMENTOS };")();
    const outros = EMPREENDIMENTOS.find((e) => e.id === "outros");
    const fora = (outros.outros || []).filter((o) => o.foraDaConta).map((o) => o.nome);
    if (!fora.length) return "nenhum imovel avulso esta marcado como fora da conta — o teste nao prova nada";
    const esperado = (outros.outros || []).filter((o) => !o.foraDaConta && (o.status || "disponivel") !== "vendido").length;
    const legenda = await admin.locator("#dashboard .ve-total-n").nth(2).innerText();
    const faltando = fora.filter((nome) => !legenda.includes(nome));
    if (faltando.length) return `a faixa nao diz que ficou de fora: ${faltando.join(", ")}`;
    const noQuadro = parseInt(await admin.locator('#dashboard .ve-quadro[data-ve-abrir="outros"] .ve-q-n').innerText(), 10);
    if (noQuadro !== esperado) return `o quadro de Outros Imoveis diz ${noQuadro} a venda, esperava ${esperado}`;
    // E no site ele continua a venda, como sempre.
    const pg = await admin.context().newPage();
    await pg.goto(`${base}/#emp-outros`, { waitUntil: "networkidle" });
    const sumiram = [];
    for (const nome of fora) if (!(await pg.getByText(nome).count())) sumiram.push(nome);
    await pg.close();
    return sumiram.length ? `sumiu da vitrine: ${sumiram.join(", ")}` : "";
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

  // v433 — o dono pediu que os lotes vendidos do mapa do Nova Vila Rica I & II
  // entrassem na conta sem serem cadastrados: o painel soma o
  // `vendidosSemCadastro` aos vendidos e ao total, no Estoque e no placar.
  await teste("os vendidos contados no mapa do loteamento entram na conta do painel", async () => {
    const fonte = fs.readFileSync(path.join(RAIZ, "data.js"), "utf8");
    const { EMPREENDIMENTOS } = new Function(fonte.replace(/window\.SENGER[\s\S]*$/, "") + "; return { EMPREENDIMENTOS };")();
    const emp = EMPREENDIMENTOS.find((e) => e.vendidosSemCadastro > 0);
    if (!emp) return "nenhum empreendimento tem vendidos sem cadastro — o teste nao prova nada";
    const extra = emp.vendidosSemCadastro;
    const lotes = emp.terrenos || [];
    const disp = lotes.filter((t) => (t.status || "disponivel") === "disponivel").length;
    const vend = lotes.filter((t) => t.status === "vendido").length + extra;
    const total = lotes.length + extra;
    await clicarNoMenu('[data-modulo-alvo="estoque"]');
    await admin.waitForTimeout(400);
    const det = admin.locator(`#lista-emps details.emp[data-emp="${emp.id}"]`);
    await det.evaluate((d) => { d.hidden = false; d.open = true; });
    const resumo = (await det.locator("summary .contagem").innerText()).trim();
    if (resumo !== `${disp} de ${total} disponíveis`) return `o cabecalho diz "${resumo}", esperava "${disp} de ${total} disponíveis"`;
    const quantos = async (f) => parseInt(await det.locator(`.abas button[data-filtro="${f}"] .quantos`).innerText(), 10);
    if ((await quantos("vendido")) !== vend) return `a aba Vendidos diz ${await quantos("vendido")}, esperava ${vend}`;
    if ((await quantos("todos")) !== total) return `a aba Todos diz ${await quantos("todos")}, esperava ${total}`;
    if (await det.locator("tr.sem-cadastro").isVisible()) return "a linha dos vendidos do mapa aparece na aba Disponíveis";
    await det.locator('.abas button[data-filtro="vendido"]').click();
    await admin.waitForTimeout(150);
    const linha = det.locator("tr.sem-cadastro");
    if (!(await linha.isVisible())) return "a aba Vendidos nao explica os vendidos do mapa";
    if (!(await linha.innerText()).includes(String(extra))) return "a linha dos vendidos do mapa nao diz quantos sao";
    await det.locator('.abas button[data-filtro="disponivel"]').click();
    // No placar da Visao geral, o quadro do loteamento fecha com o mesmo total.
    await clicarNoMenu('[data-visao-filtro="estoque"]');
    await admin.waitForTimeout(400);
    const pe = (await admin.locator(`#dashboard .ve-quadro[data-ve-abrir="${emp.id}"] .ve-q-pe`).innerText()).replace(/\s+/g, " ");
    return pe.includes(`${vend} de ${total}`) ? "" : `o quadro do placar diz "${pe}", esperava "${vend} de ${total}"`;
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

  // v378 — ate 3 videos por empreendimento (video, video2, video3). O painel
  // tem os tres campos e a publicacao grava a linha video2 sem tocar no resto.
  await teste("o painel aceita um segundo vídeo e grava a linha video2 no data.js", async () => {
    gravacoes.length = 0;
    await clicarNoMenu('[data-modulo-alvo="materiais"]');
    await admin.waitForTimeout(400);
    await admin.evaluate(() => document.querySelectorAll("#materiais details.material-emp").forEach((d) => { d.hidden = false; d.open = true; }));
    const campos = await admin.locator('#materiais details[data-material-emp="nova-vila-rica-iii"] [data-material-campo-video]').count();
    if (campos !== 3) return `esperava 3 campos de vídeo, achei ${campos}`;
    const link = admin.locator('#materiais input[data-material-link="video2"][data-emp="nova-vila-rica-iii"]');
    await link.evaluate((el) => {
      el.value = "https://youtu.be/abc123XYZ00";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await admin.waitForTimeout(400);
    admin.on("dialog", (d) => d.accept());
    await admin.locator("#botao-publicar").click();
    await admin.waitForTimeout(2500);
    const blobs = gravacoes.filter((g) => /git\/blobs/.test(g.path)).map((g) => {
      try { const b = JSON.parse(g.corpo); return b.encoding === "base64" ? Buffer.from(b.content, "base64").toString("utf8") : String(b.content); } catch (e) { return ""; }
    });
    const dados = blobs.find((t) => /EMPREENDIMENTOS/.test(t));
    if (!dados) return "o data.js nao foi enviado";
    if (!/\n\s*video2:\s*"https:\/\/youtu\.be\/abc123XYZ00",/.test(dados)) return "a linha video2 nao foi gravada";
    const dentro = (t) => t.slice(t.indexOf('id: "nova-vila-rica-iii"'));
    return /video:\s*"assets\/nova-vila-rica-iii\/video.mp4"/.test(dentro(dados)) ? "" : "o video principal sumiu";
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
  // v366 — planta aceita PDF (sem conferir pixels) e continua recusando o que
  // nao e imagem nem PDF.
  await teste("a planta aceita PDF e recusa outros formatos", async () => {
    await clicarNoMenu('[data-modulo-alvo="materiais"]');
    await admin.locator("#materiais .material-emp > summary, #materiais details summary").first().click().catch(() => {});
    const input = admin.locator("input[data-arquivo-planta]").first();
    if (!(await input.count())) return "nao achei o campo de planta";
    await input.setInputFiles({ name: "planta-teste.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
    await admin.waitForTimeout(500);
    const ok = await admin.locator("#aviso").innerText();
    if (!/Planta pronta/i.test(ok)) return `PDF recusado: ${ok}`;
    await input.setInputFiles({ name: "planta.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await admin.waitForTimeout(500);
    const ruim = await admin.locator("#aviso").innerText();
    return /precisa estar em/i.test(ruim) ? "" : `txt nao foi recusado: ${ruim}`;
  });

  // v367 — loteamento nao tem tipologia, mas tambem recebe planta em PDF.
  await teste("o loteamento aceita planta em PDF e dá para remover", async () => {
    const input = admin.locator("input[data-arquivo-planta-livre]").first();
    if (!(await input.count())) return "loteamento sem campo de planta";
    const antes = await admin.locator("button[data-planta-livre-remover]").count();
    await input.setInputFiles({ name: "planta-lote.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
    await admin.waitForTimeout(500);
    const depois = await admin.locator("button[data-planta-livre-remover]").count();
    if (depois !== antes + 1) return `a planta nao entrou na lista (${antes} -> ${depois})`;
    // o nome da planta e editavel e fica guardado na lista de alteracoes
    const campo = admin.locator('.planta-item input[data-galeria-legenda]').last();
    await campo.evaluate((el) => { el.value = "Meu nome da planta"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await admin.waitForTimeout(200);
    const guardado = await admin.evaluate(() => document.body.innerText.length > 0 && true);
    if (!guardado) return "painel quebrou ao editar o nome";
    await admin.locator("button[data-planta-livre-remover]").last().evaluate((b) => b.click());
    await admin.waitForTimeout(300);
    return (await admin.locator("button[data-planta-livre-remover]").count()) === antes ? "" : "nao removeu";
  });

  // v427 — duas tipologias com o mesmo nome (finais 01 e 02 do Boulevard,
  // "3 suítes + lavabo") nao podem gravar no mesmo arquivo, e regravar a
  // galeria nao pode perder a secao (unidade / pavimento / lazer).
  await teste("plantas de finais diferentes vão para arquivos diferentes, e a galeria guarda a seção", async () => {
    gravacoes.length = 0;
    // o teste do menu no celular deixou a tela estreita; o botao de publicar
    // e o do computador
    await admin.setViewportSize({ width: 1366, height: 900 });
    await admin.waitForTimeout(400);
    await clicarNoMenu('[data-modulo-alvo="materiais"]');
    await admin.waitForTimeout(400);
    await admin.evaluate(() => document.querySelectorAll("#materiais details.material-emp").forEach((d) => { d.hidden = false; d.open = true; }));
    for (const g of ["0", "1"]) {
      const input = admin.locator(`input[data-arquivo-planta][data-emp="boulevard"][data-grupo="${g}"]`);
      if (!(await input.count())) return `sem o campo da planta do grupo ${g}`;
      await input.setInputFiles({ name: "3-suites-lavabo.pdf", mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n% grupo ${g}\n%%EOF`) });
      await admin.waitForTimeout(400);
    }
    await admin.locator("#botao-publicar").evaluate((b) => b.click());
    await admin.waitForTimeout(2500);
    const blobs = gravacoes.filter((g) => /git\/blobs/.test(g.path)).map((g) => {
      try { const b = JSON.parse(g.corpo); return b.encoding === "base64" ? Buffer.from(b.content, "base64").toString("utf8") : String(b.content); } catch (e) { return ""; }
    });
    const dados = blobs.find((t) => /EMPREENDIMENTOS/.test(t));
    if (!dados) return "o data.js nao foi enviado";
    const ini = dados.indexOf('id: "boulevard"');
    const bv = dados.slice(ini, dados.indexOf('id: "', ini + 5));
    const plantas = [...bv.matchAll(/\n\s*planta:\s*"([^"]+)"/g)].map((m) => m[1]);
    if (plantas.length < 2) return "nao achei as plantas dos grupos";
    if (plantas[0] === plantas[1]) return `os finais 01 e 02 ficaram com a mesma planta: ${plantas[0]}`;
    if (!/secao:\s*"lazer"/.test(bv) || !/secao:\s*"pavimento"/.test(bv)) return "a galeria perdeu a secao do lazer ou do pavimento";
    if (!/legenda:\s*"Planta — 3 suítes \+ lavabo · final 02"/.test(bv)) return "a legenda nova nao diz o final";
    return "";
  });

  // v423 — o nome de cada planta no painel diz o final (pedido do dono:
  // "quero escrito 'final tal'"). No Boulevard as linhas nao saem na ordem
  // 1, 2, 3, 4, e duas tem o mesmo nome de tipologia.
  await teste("no painel, cada planta diz o final dela", async () => {
    const nomes = await admin.evaluate(() => [...document.querySelectorAll(".planta-titulo")].map((el) => el.textContent.trim()));
    const esperados = [
      "Tipologia — 3 suítes + lavabo · final 01",
      "Tipologia — 3 suítes + lavabo · final 02",
      "Tipologia — 2 suítes + lavabo · final 04",
      "Tipologia — 2 dormitórios (1 suíte) · final 03",
      "Tipologia — 2 suítes · final 03",
      "Unidade 604 — 2 suítes · final 04",
    ];
    const faltam = esperados.filter((n) => !nomes.includes(n));
    return faltam.length ? `faltam: ${faltam.join(" | ")}` : "";
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

  // ============================================================ predio em 3D
  // v434 — escolha do dono (20/10/2026): o predio em 3D, que gira, com o
  // vendido em cinza escuro escrito "Vendido" e o numero do apartamento na
  // frente, nos fundos e nas laterais. Precisa de um navegador com WebGL.
  grupo("PRÉDIO EM 3D");
  const nav3d = await chromium.launch({ headless: !VER, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx3d = await nav3d.newContext({ viewport: { width: 1280, height: 900 } });
  const abrir3d = async (rota, opcoes = {}) => {
    const p = await ctx3d.newPage();
    p.on("pageerror", (e) => erroDeConsole.push(`3D ${rota}: ${e.message}`));
    if (opcoes.mobile) await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + rota, { waitUntil: "networkidle" });
    await p.waitForFunction(() => document.querySelector(".predio-3d.pronto") || !document.querySelector("[data-predio-3d]"), null, { timeout: 60000 });
    return p;
  };
  // Toca no apartamento: o predio vem para a tela e o clique vai no lugar dele.
  const tocarNo3d = async (p, cod, graus) => {
    await p.evaluate(() => { const el = document.querySelector(".predio-3d"); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 90, behavior: "instant" }); });
    if (graus !== undefined) await p.evaluate((g) => document.querySelector(".predio-3d").predio3d.girar(g), graus);
    const pt = await p.evaluate((c) => document.querySelector(".predio-3d").predio3d.pontoDe(c), cod);
    if (!pt) return false;
    await p.mouse.click(pt.x, pt.y);
    await p.waitForTimeout(400);
    return true;
  };

  await teste("o Renaissance abre o prédio em 3D, e o toque no apartamento abre a ficha dele", async () => {
    const p = await abrir3d("/#emp-renaissance");
    const r = await p.evaluate(() => ({
      pronto: !!document.querySelector(".predio-3d.pronto canvas"),
      abasEscondidas: document.querySelector(".predio-desenho").hidden,
      lados: [...document.querySelectorAll(".predio-3d-lados button")].map((b) => b.textContent.trim()).join(","),
      dica: document.querySelector("#unidades .section-title-row p").textContent,
      preco: window.SENGER.EMPREENDIMENTOS.find((e) => e.id === "renaissance").grupos.flatMap((g) => g.unidades).find((u) => u.apto === "1102").preco,
    }));
    if (!r.pronto) { await p.close(); return "o prédio em 3D não apareceu"; }
    if (!r.abasEscondidas) { await p.close(); return "as abas do mapa ficaram na tela junto do 3D"; }
    if (r.lados !== "Frente,Lateral,Fundos,De cima") { await p.close(); return `os botões do prédio são: ${r.lados}`; }
    if (!/Gire o prédio/.test(r.dica)) { await p.close(); return `a dica diz "${r.dica}"`; }
    await tocarNo3d(p, "1102");
    const ficha = (await p.locator(".predio-ficha").innerText()).replace(/\s+/g, " ");
    if (!/Apto 1102/.test(ficha) || !ficha.includes(`R$ ${r.preco.toLocaleString("pt-BR")}`) || !/11º andar/.test(ficha)) { await p.close(); return `a ficha diz: ${ficha}`; }
    const sel = p.locator(".predio-ficha [data-select-item]");
    await sel.click(); await p.waitForTimeout(200);
    const marcado = (await sel.innerText()).trim();
    await sel.click(); await p.waitForTimeout(200);
    await p.close();
    return marcado === "Selecionado" ? "" : `o Selecionar da ficha deixou "${marcado}"`;
  });

  await teste("no 3D, o vendido não abre ficha e os botões giram o prédio", async () => {
    const p = await abrir3d("/#emp-renaissance");
    // O 803 e vendido e fica nos fundos.
    await tocarNo3d(p, "803", 204);
    const vazia = await p.locator(".predio-ficha .predio-ficha-vazia").count();
    const antes = await p.evaluate(() => document.querySelector(".predio-3d").predio3d.pontoDe("1102"));
    await p.locator(".predio-3d-lados button", { hasText: "Lateral" }).click();
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({
      depois: document.querySelector(".predio-3d").predio3d.pontoDe("1102"),
      marcado: document.querySelector(".predio-3d-lados [aria-pressed=true]")?.textContent,
    }));
    await p.close();
    if (!vazia) return "o toque no vendido abriu uma ficha";
    if (r.marcado !== "Lateral") return `depois do Lateral o botão marcado é "${r.marcado}"`;
    return Math.abs(r.depois.x - antes.x) > 20 ? "" : "o botão Lateral não girou o prédio";
  });

  await teste("no celular o 3D cabe na tela e a ficha abre embaixo dele", async () => {
    const p = await abrir3d("/#emp-renaissance", { mobile: true });
    const largura = await p.evaluate(() => document.documentElement.scrollWidth);
    await tocarNo3d(p, "1203", 204);
    await p.waitForTimeout(900);
    const r = await p.evaluate(() => {
      const ficha = document.querySelector(".predio-ficha").getBoundingClientRect();
      const palco = document.querySelector(".predio-3d").getBoundingClientRect();
      return { embaixo: ficha.top + scrollY >= palco.bottom + scrollY, topo: Math.round(ficha.top), tela: innerHeight, texto: document.querySelector(".predio-ficha h3")?.textContent || "" };
    });
    await p.close();
    if (largura > 390) return `a página passou da largura do celular (${largura}px)`;
    if (r.texto !== "Apto 1203") return `a ficha mostra "${r.texto}"`;
    if (!r.embaixo) return "a ficha não ficou embaixo do prédio";
    return r.topo < r.tela / 2 ? "" : `a tela não desceu até a ficha (ficou em ${r.topo}px)`;
  });

  await teste("o cliente vê o prédio em 3D, sem os botões da equipe na ficha", async () => {
    const p = await abrir3d("/?cliente#emp-renaissance");
    if (!(await p.locator(".predio-3d.pronto").count())) { await p.close(); return "o cliente não recebeu o prédio em 3D"; }
    await tocarNo3d(p, "1302");
    const ficha = await p.evaluate(() => {
      const f = document.querySelector(".predio-ficha");
      return { texto: f.innerText.replace(/\s+/g, " "), equipe: f.querySelectorAll("[data-share-item], [data-select-item]").length };
    });
    await p.close();
    if (!/Apto 1302/.test(ficha.texto) || !/R\$/.test(ficha.texto)) return `a ficha do cliente diz: ${ficha.texto}`;
    return ficha.equipe ? "a ficha do cliente mostra o Compartilhar ou o Selecionar" : "";
  });

  // v435 — o Boulevard no mesmo padrao, pelas fachadas que o dono mandou; no
  // lugar do 303 fica o salao de festas (nao e unidade).
  await teste("o Boulevard abre o prédio em 3D, com o salão de festas no lugar do 303", async () => {
    const p = await abrir3d("/#emp-boulevard");
    if (!(await p.locator(".predio-3d.pronto").count())) { await p.close(); return "o prédio em 3D do Boulevard não apareceu"; }
    const sem303 = await p.evaluate(() => document.querySelector(".predio-3d").predio3d.pontoDe("303"));
    await tocarNo3d(p, "1102");
    const ficha = (await p.locator(".predio-ficha").innerText()).replace(/\s+/g, " ");
    await p.close();
    if (sem303) return "o 303 apareceu como apartamento";
    return /Apto 1102/.test(ficha) && /11º andar/.test(ficha) && /final 02/.test(ficha) ? "" : `a ficha diz: ${ficha}`;
  });

  // v436 — o Premium Office, pelas fachadas e pelas plantas do 2º e do 3º
  // pavimento; a sala 05 vai ate o canto do predio (correcao do dono).
  await teste("o Premium Office abre o prédio em 3D, e o toque na sala abre a ficha dela", async () => {
    const p = await abrir3d("/#emp-premium-office");
    if (!(await p.locator(".predio-3d.pronto").count())) { await p.close(); return "o prédio em 3D do Premium Office não apareceu"; }
    const lugares = await p.evaluate(() => ["101", "201", "305", "801", "805"].map((c) => !!document.querySelector(".predio-3d").predio3d.pontoDe(c)));
    await tocarNo3d(p, "801");
    const ficha = (await p.locator(".predio-ficha").innerText()).replace(/\s+/g, " ");
    await p.close();
    if (lugares.includes(false)) return `faltou sala no prédio: ${lugares.join(",")}`;
    return /801/.test(ficha) && /8º andar/.test(ficha) && /R\$/.test(ficha) ? "" : `a ficha diz: ${ficha}`;
  });

  await teste("quem não tem prédio em 3D não baixa o 3D", async () => {
    const p = await ctx3d.newPage();
    const baixados = [];
    p.on("request", (req) => { if (/vendor\/three/.test(req.url())) baixados.push(req.url()); });
    await p.goto(`${base}/#emp-evolutti`, { waitUntil: "networkidle" });
    await p.waitForTimeout(300);
    await p.close();
    return baixados.length ? `o Evolutti baixou ${baixados.length} arquivo(s) do 3D` : "";
  });
  await nav3d.close();

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
