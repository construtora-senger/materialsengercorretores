// Confere o cadastro e os arquivos do site antes de publicar.
//
// Por que existe: o projeto ja nao cabe em inspecao no olho. Um caminho de foto
// errado, um status invalido, uma unidade duplicada ou um folder apagado sem
// querer so aparecem quando o corretor esta com o cliente na frente. Este
// script roda em 1 segundo, sem instalar nada, e diz o que esta quebrado.
//
//   node tools/validar.js            -> confere tudo
//   node tools/validar.js --resumo   -> so a contagem final (auditoria)
//
// Sai com codigo 1 quando ha ERRO. AVISO nao derruba: e o que depende de
// material que o dono ainda nao mandou.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");
const SO_RESUMO = process.argv.includes("--resumo");

const erros = [];
const avisos = [];
const erro = (msg) => erros.push(msg);
const aviso = (msg) => avisos.push(msg);

const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const existe = (rel) => fs.existsSync(path.join(RAIZ, rel));

// ---------------------------------------------------------------- 1. sintaxe
// Todo JS do projeto tem de compilar. Um erro de virgula no data.js deixa o
// site inteiro em branco, e no navegador isso so aparece no console.
const JS = ["data.js", "app.js", "sw.js", "tools/gerar-pontes.js", "tools/gerar-montagens.js", "tools/validar.js"];
for (const arquivo of JS) {
  if (!existe(arquivo)) { erro(`arquivo ausente: ${arquivo}`); continue; }
  try { new vm.Script(ler(arquivo), { filename: arquivo }); }
  catch (e) { erro(`${arquivo} nao compila: ${e.message}`); }
}

// O painel e uma pagina so, com o JS embutido: extrai e compila o bloco.
if (existe("admin/index.html")) {
  const html = ler("admin/index.html");
  const blocos = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  blocos.forEach((codigo, i) => {
    try { new vm.Script(codigo, { filename: `admin/index.html <script ${i + 1}>` }); }
    catch (e) { erro(`admin/index.html (script ${i + 1}) nao compila: ${e.message}`); }
  });
}

// ---------------------------------------------------------------- 2. cadastro
const fonteData = ler("data.js");
const { META, EMPREENDIMENTOS } = new Function(
  fonteData.replace(/window\.SENGER[\s\S]*$/, "") + "; return { META, EMPREENDIMENTOS };"
)();

const STATUS_OK = ["disponivel", "alugado", "vendido"];
const ativos = EMPREENDIMENTOS.filter((e) => e.confirmado !== false);

// IDs unicos.
const vistos = new Set();
for (const emp of EMPREENDIMENTOS) {
  if (!emp.id) { erro("empreendimento sem id"); continue; }
  if (vistos.has(emp.id)) erro(`id de empreendimento repetido: ${emp.id}`);
  vistos.add(emp.id);
  if (!emp.nome) erro(`${emp.id}: sem nome`);
}

// Todo item do cadastro, numa lista so — e o que as contagens usam.
function itensDe(emp) {
  const itens = [];
  (emp.grupos || []).forEach((g, gi) => (g.unidades || []).forEach((u, ui) => {
    itens.push({ tipo: "unidade", codigo: String(u.apto), status: u.status || "disponivel", preco: u.preco, ref: `grupo ${gi}/unidade ${ui}`, grupo: g, unidade: u });
  }));
  (emp.terrenos || []).forEach((t, i) => {
    itens.push({ tipo: "terreno", codigo: `${t.quadra}-${t.numero}`, status: t.status || "disponivel", preco: t.preco, ref: `terreno ${i}` });
  });
  (emp.outros || []).forEach((o, i) => {
    itens.push({ tipo: "outro", codigo: String(o.nome), status: o.status || "disponivel", preco: o.preco, ref: `outro ${i}` });
  });
  return itens;
}

const contagem = { emps: ativos.length, itens: 0, disponivel: 0, alugado: 0, vendido: 0, boxes: 0 };

for (const emp of EMPREENDIMENTOS) {
  const itens = itensDe(emp);
  const codigos = new Map();
  for (const item of itens) {
    contagem.itens++;
    if (!STATUS_OK.includes(item.status)) {
      erro(`${emp.id} ${item.ref}: status invalido "${item.status}" (validos: ${STATUS_OK.join(", ")})`);
    } else {
      contagem[item.status]++;
    }
    // Unidade repetida dentro do mesmo empreendimento: o link do cliente
    // (?u=codigo) passa a apontar para duas linhas diferentes.
    const chave = `${item.tipo}:${item.codigo}`;
    if (codigos.has(chave)) erro(`${emp.id}: ${item.tipo} "${item.codigo}" aparece duas vezes (${codigos.get(chave)} e ${item.ref})`);
    codigos.set(chave, item.ref);
    // Preco coerente com o status. O que esta a venda sem preco sai como
    // "Sob consulta" (aviso); o vendido com preco de tabela e erro de cadastro.
    const aVenda = item.status === "disponivel" || item.status === "alugado";
    if (aVenda && !(Number(item.preco) > 0)) {
      aviso(`${emp.id} ${item.ref} (${item.codigo}): a venda sem preco — sai como "Sob consulta"`);
    }
    if (item.status === "vendido" && item.tipo === "unidade" && Number(item.preco) > 0) {
      erro(`${emp.id} ${item.ref} (${item.codigo}): vendido e ainda com preco de tabela`);
    }
  }
  (emp.boxes || []).forEach((b) => {
    contagem.boxes++;
    if (!STATUS_OK.includes(b.status || "disponivel")) erro(`${emp.id}: box ${b.box} com status invalido "${b.status}"`);
  });
  // A regra abandonada: nenhum empreendimento vende box a parte desde a v246.
  if (emp.boxSeparado) erro(`${emp.id}: boxSeparado nao existe mais — o box ja esta no preco do apartamento`);
}

// ------------------------------------------------- 3. arquivos referenciados
// Caminho de arquivo que nao existe = imagem quebrada na cara do cliente.
const ARQUIVO = /^assets\//;
function conferirArquivo(rotulo, valor) {
  if (!valor) return;
  if (/^https?:\/\//i.test(valor)) return; // link externo: fora do nosso alcance
  if (!ARQUIVO.test(valor)) { erro(`${rotulo}: caminho fora de assets/ ("${valor}")`); return; }
  if (!existe(valor)) erro(`${rotulo}: arquivo nao existe ("${valor}")`);
}

// As plantas sao ligadas por APELIDO (nome do arquivo sem pasta nem extensao) e
// resolvidas contra a galeria. Apelido sem foto na galeria = link da unidade sem
// planta nenhuma.
const nomeDaMidia = (src) => String(src || "").split("/").pop().replace(/\.[a-z0-9]+$/i, "");

for (const emp of EMPREENDIMENTOS) {
  conferirArquivo(`${emp.id}.hero`, emp.hero);
  conferirArquivo(`${emp.id}.logo`, emp.logo);
  conferirArquivo(`${emp.id}.folder`, emp.folder);
  if (emp.folder && !/^https?:\/\//i.test(emp.folder) && !/\.pdf(\?|$)/i.test(emp.folder)) {
    erro(`${emp.id}.folder: o padrao comercial pede PDF ("${emp.folder}")`);
  }
  if (emp.video && !/^https?:\/\//i.test(emp.video)) conferirArquivo(`${emp.id}.video`, emp.video);
  (emp.galeria || []).forEach((g, i) => conferirArquivo(`${emp.id}.galeria[${i}]`, g && g.src));

  const apelidos = new Set((emp.galeria || []).map((g) => nomeDaMidia(g && g.src)));
  (emp.grupos || []).forEach((g, gi) => {
    if (g.planta && !apelidos.has(g.planta)) erro(`${emp.id} grupo ${gi} ("${g.tipo}"): planta "${g.planta}" nao esta na galeria`);
    (g.unidades || []).forEach((u, ui) => {
      if (u.planta && !apelidos.has(u.planta)) erro(`${emp.id} grupo ${gi}/unidade ${ui} (${u.apto}): planta "${u.planta}" nao esta na galeria`);
    });
  });

  // Foto de previa: sem ela o gerador de pontes nao gera nada para o
  // empreendimento, e o link enviado cai em pagina inexistente.
  if (emp.confirmado !== false && !existe(`assets/preview/${emp.id}.jpg`)) {
    erro(`${emp.id}: falta assets/preview/${emp.id}.jpg — as pontes nao sao geradas`);
  }
}

// ------------------------------------------- 4. material comercial obrigatorio
// Capa, galeria, folder e video sao o padrao comercial de todo empreendimento
// real. Faltar e AVISO: depende de material que so o dono tem.
for (const emp of ativos) {
  if (emp.id === "outros") continue;
  if (!emp.hero) erro(`${emp.id}: sem foto de capa`);
  if (!(emp.galeria || []).length) aviso(`${emp.id}: sem galeria`);
  if (!emp.folder) aviso(`${emp.id}: sem folder em PDF`);
  if (!emp.video) aviso(`${emp.id}: sem video oficial`);
  // Predio tem registro de incorporacao; loteamento nao.
  if ((emp.grupos || []).length && !(emp.ri || []).length) erro(`${emp.id}: sem registro de incorporacao (RI)`);
}

// --------------------------------------------------- 5. regressao de material
// Compara com o retrato anterior (tools/materiais.json). Uma atualizacao de
// estoque nunca pode zerar folder, video, logo, hero, galeria, mapa ou planta
// que ja estavam cadastrados — foi assim que materiais sumiram no passado.
const RETRATO = path.join(__dirname, "materiais.json");

function retratoAtual() {
  const foto = {};
  for (const emp of EMPREENDIMENTOS) {
    foto[emp.id] = {
      hero: emp.hero || "",
      logo: emp.logo || "",
      folder: emp.folder || "",
      video: emp.video || "",
      mapa: emp.mapa || "",
      galeria: (emp.galeria || []).length,
      diferenciais: (emp.diferenciais || []).length,
      plantas: (emp.grupos || []).reduce((soma, g) =>
        soma + (g.planta ? 1 : 0) + (g.unidades || []).filter((u) => u.planta).length, 0),
    };
  }
  return foto;
}

const agora = retratoAtual();
if (process.argv.includes("--gravar-retrato")) {
  fs.writeFileSync(RETRATO, JSON.stringify(agora, null, 2) + "\n");
  console.log(`Retrato de materiais gravado em tools/materiais.json (${Object.keys(agora).length} empreendimentos).`);
} else if (fs.existsSync(RETRATO)) {
  const antes = JSON.parse(fs.readFileSync(RETRATO, "utf8"));
  const CAMPOS = ["hero", "logo", "folder", "video", "mapa"];
  for (const [id, velho] of Object.entries(antes)) {
    const novo = agora[id];
    if (!novo) { erro(`REGRESSAO: o empreendimento "${id}" sumiu do cadastro`); continue; }
    for (const campo of CAMPOS) {
      if (velho[campo] && !novo[campo]) erro(`REGRESSAO: ${id}.${campo} tinha "${velho[campo]}" e agora esta vazio`);
    }
    for (const campo of ["galeria", "diferenciais", "plantas"]) {
      if (novo[campo] < velho[campo]) erro(`REGRESSAO: ${id}.${campo} caiu de ${velho[campo]} para ${novo[campo]}`);
    }
  }
} else {
  aviso("tools/materiais.json nao existe — rode `node tools/validar.js --gravar-retrato` para ligar a guarda de regressao.");
}

// --------------------------------------------------------- 6. paginas-ponte
// Uma ponte por empreendimento e uma por unidade do cadastro (inclusive a
// vendida, para desfazer venda nao quebrar link).
const slug = (texto) => String(texto || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

let pontesEsperadas = 0;
let pontesAchadas = 0;
for (const emp of ativos) {
  if (!existe(`assets/preview/${emp.id}.jpg`)) continue;
  pontesEsperadas++;
  if (existe(`l/${emp.id}/index.html`)) pontesAchadas++;
  else erro(`ponte ausente: l/${emp.id}/index.html — rode node tools/gerar-pontes.js`);
  for (const item of itensDe(emp)) {
    const nome = slug(item.codigo);
    if (!nome) continue;
    pontesEsperadas++;
    if (existe(`l/${emp.id}/u/${nome}/index.html`)) pontesAchadas++;
    else erro(`ponte ausente: l/${emp.id}/u/${nome}/ (${item.codigo}) — rode node tools/gerar-pontes.js`);
  }
}
// v333/v334 — a ponte da montagem: uma para cada combinacao de 2 ou mais empreendimentos
// (assets/preview/sel/<ids>.jpg + l/sel/<ids>/). Sem a imagem, a previa do
// WhatsApp cai na marca; sem a ponte, o link enviado cai em pagina inexistente.
{
  const ids = ativos.map((e) => e.id);
  const combos = [];
  const anda = (inicio, atual) => {
    if (atual.length >= 2) combos.push([...atual].sort().join("_"));
    if (atual.length === 10) return;
    for (let i = inicio; i < ids.length; i++) anda(i + 1, [...atual, ids[i]]);
  };
  anda(0, []);
  let semMontagem = 0, semPonte = 0;
  for (const chave of combos) {
    pontesEsperadas++;
    if (!existe(`assets/preview/sel/${chave}.jpg`)) semMontagem++;
    if (existe(`l/sel/${chave}/index.html`)) pontesAchadas++; else semPonte++;
  }
  if (semMontagem) erro(`${semMontagem} montagem(ns) de previa faltando em assets/preview/sel/ — rode node tools/gerar-montagens.js`);
  if (semPonte) erro(`${semPonte} ponte(s) de selecao faltando em l/sel/ — rode node tools/gerar-pontes.js`);
  const dirSel = path.join(RAIZ, "l", "sel");
  if (fs.existsSync(dirSel)) {
    const validas = new Set(combos);
    for (const nome of fs.readdirSync(dirSel)) if (!validas.has(nome)) erro(`ponte orfa: l/sel/${nome}/ — combinacao fora do cadastro`);
  }
}

// Ponte sobrando aponta para unidade que saiu do cadastro.
for (const emp of ativos) {
  const dir = path.join(RAIZ, "l", emp.id, "u");
  if (!fs.existsSync(dir)) continue;
  const noCadastro = new Set(itensDe(emp).map((i) => slug(i.codigo)).filter(Boolean));
  for (const nome of fs.readdirSync(dir)) {
    if (!noCadastro.has(nome)) erro(`ponte orfa: l/${emp.id}/u/${nome}/ nao corresponde a nenhuma unidade do cadastro`);
  }
}

const index = ler("index.html");

// ----------------------------------------------------------- 7. modo cliente
// O que o cliente NAO pode ver. Sao conferencias de codigo, nao de tela: o
// teste de navegador cobre o resto.
const app = ler("app.js");
// Vendida fora do itemMap: e o que tira a unidade vendida da vitrine, do PDF e
// da mensagem.
if (!/if \(vendida\(unit\.status\)\) return;/.test(app)) {
  erro("app.js: a unidade vendida nao esta mais sendo filtrada em buildInventory");
}
// A trava do hash no modo cliente: sem ela o lead navega o portfolio inteiro.
if (!/CLIENT_MODE && location\.hash !== clientLockHash/.test(app)) {
  erro("app.js: sumiu a trava de navegacao do modo cliente (clientLockHash)");
}
// Contagem de estoque nunca vai para o cliente (v107).
if (/unidades? dispon[ií]ve|restam? \d|unidades? restantes/i.test(app)) {
  erro("app.js: parece haver contagem de estoque visivel ao cliente");
}

// ------------------------------------------------------------- 8. segredos
// Nada de token, senha ou chave dentro de arquivo publico. O painel guarda a
// chave no localStorage do aparelho; ela nunca pode ser commitada.
const PUBLICOS = ["data.js", "app.js", "index.html", "sw.js", "manifest.json", "admin/index.html", "tools/gerar-pontes.js", "tools/gerar-montagens.js", "tools/validar.js"];
const SEGREDOS = [
  [/gh[pousr]_[A-Za-z0-9]{16,}/, "token classico do GitHub"],
  [/github_pat_[A-Za-z0-9_]{20,}/, "token fine-grained do GitHub"],
  [/AKIA[0-9A-Z]{16}/, "chave da AWS"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada"],
];
for (const arquivo of PUBLICOS) {
  if (!existe(arquivo)) continue;
  const texto = ler(arquivo);
  for (const [regra, nome] of SEGREDOS) {
    if (regra.test(texto)) erro(`SEGREDO em ${arquivo}: ${nome}`);
  }
}
// O site publico nao pode encostar na chave do painel. Sao paginas separadas,
// mas basta alguem copiar um trecho de codigo de um lado para o outro.
if (/senger-admin-token|senger-admin-ok|senger-admin-financeiro|api\.github\.com/.test(app)) {
  erro("app.js: o site publico referencia a chave ou a API do painel — token nunca pode chegar ao modo cliente");
}
if (/senger-admin|github_pat|api\.github\.com/.test(index)) {
  erro("index.html: o site publico referencia coisa do painel");
}
// Nem o painel pode mandar a chave por endereco: token em URL fica no
// historico do navegador, no referer e em qualquer log pelo caminho.
if (existe("admin/index.html")) {
  const painel = ler("admin/index.html");
  if (/[?&](token|chave|pat)=/.test(painel)) erro("admin/index.html: parece haver token viajando em URL");
  if (/console\.log\([^)]*token/i.test(painel)) erro("admin/index.html: token indo para o console");
}

// Custo e margem sao internos: nunca podem aparecer no repositorio publico.
if (/\bcustos?\s*:\s*\{/.test(fonteData) || /margensDesejadas/.test(fonteData)) {
  erro("data.js: custo/margem no repositorio publico — eles moram so no painel e no cofre privado");
}

// -------------------------------------------------------------- 9. versoes
// O aparelho do corretor so recebe a atualizacao quando a versao sobe nos tres
// lugares ao mesmo tempo.
const sw = ler("sw.js");
const vIndex = [...new Set([...index.matchAll(/[?&]v=(\d+)/g)].map((m) => m[1]))];
const vSw = [...new Set([...sw.matchAll(/[?&]v=(\d+)/g)].map((m) => m[1]))];
const cache = (sw.match(/const CACHE = "senger-portfolio-v(\d+)/) || [])[1];
if (vIndex.length !== 1) erro(`index.html tem versoes diferentes no ?v=: ${vIndex.join(", ")}`);
if (vSw.length !== 1) erro(`sw.js tem versoes diferentes no ?v=: ${vSw.join(", ")}`);
if (vIndex[0] && vSw[0] && vIndex[0] !== vSw[0]) erro(`index.html esta na v${vIndex[0]} e o sw.js na v${vSw[0]}`);
if (cache && vIndex[0] && cache !== vIndex[0]) erro(`o CACHE do sw.js esta na v${cache} e o site na v${vIndex[0]}`);

// Todo arquivo do CORE do service worker tem de existir.
const core = (sw.match(/const CORE = \[([^\]]*)\]/) || [])[1] || "";
[...core.matchAll(/"\.\/([^"?]*)/g)].map((m) => m[1]).filter(Boolean).forEach((rel) => {
  if (!existe(rel)) erro(`sw.js: o CORE aponta para "${rel}", que nao existe`);
});

// -------------------------------------------------------------- 10. resumo
const linhasResumo = [
  `Empreendimentos ativos ......... ${contagem.emps}`,
  `Itens no cadastro .............. ${contagem.itens}`,
  `  disponiveis .................. ${contagem.disponivel}`,
  `  alugados ..................... ${contagem.alugado}`,
  `  vendidos ..................... ${contagem.vendido}`,
  `Box de garagem ................. ${contagem.boxes}`,
  `Paginas-ponte esperadas ........ ${pontesEsperadas}`,
  `Paginas-ponte no repositorio ... ${pontesAchadas}`,
  `Folders cadastrados ............ ${ativos.filter((e) => e.folder).length}`,
  `Videos cadastrados ............. ${ativos.filter((e) => e.video).length}`,
  `Tabela ......................... ${META.mesTabela} (INCC ${META.incc.valor})`,
];

if (!SO_RESUMO) {
  if (erros.length) {
    console.log(`\nERROS (${erros.length}):`);
    erros.forEach((m) => console.log(`  x ${m}`));
  }
  if (avisos.length) {
    console.log(`\nAVISOS (${avisos.length}):`);
    avisos.forEach((m) => console.log(`  ! ${m}`));
  }
}
console.log(`\n--- AUDITORIA ---\n${linhasResumo.join("\n")}`);
console.log(`\n${erros.length ? `${erros.length} erro(s)` : "Nenhum erro"} · ${avisos.length} aviso(s).`);

process.exit(erros.length ? 1 : 0);
