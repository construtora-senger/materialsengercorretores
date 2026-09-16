# Portfólio Senger Corretores

## Regra que vale acima de tudo

**NUNCA FAÇA NADA QUE NÃO FOR MANDADO OU ORDENADO PELO USUÁRIO.**

Faça exatamente o que foi pedido — nada a mais. Nada de arquivo extra, opção
extra, melhoria por conta própria ou passo que ninguém pediu. Na dúvida sobre o
que ele quer, pergunte antes em vez de adivinhar e entregar as duas coisas.

Site de portfólio dos empreendimentos da Construtora Senger (Carazinho/RS), com
um painel administrativo que o dono usa pelo celular.

---

# REGRAS ATUAIS — PREVALECEM SOBRE O HISTÓRICO

**Este arquivo é longo e tem memória de mais de 290 versões. Muita coisa ali
embaixo descreve comportamento que já foi abandonado.** Quando o histórico
contradisser esta seção, **esta seção ganha** — e, mais importante: *nunca
ressuscite* um comportamento só porque um parágrafo antigo o descreve. Trechos
já substituídos estão marcados com **REGRA ANTIGA — substituída por…**; se você
encontrar um que contradiga o que está aqui e não esteja marcado, marque-o.

## O que este produto é (e o que não é)

**Não é um portal imobiliário público.** É (1) uma ferramenta de trabalho do
corretor da Senger e (2) uma apresentação privada e dirigida, enviada a um lead
que **já demonstrou interesse**. Daí decorre tudo:

- **não** criar navegação aberta para o lead, formulário de captação, chatbot,
  pop-up agressivo ou "funcionalidade porque todo site imobiliário tem";
- **não** mostrar contagem de estoque ao cliente ("restam 3", "12 unidades") —
  decisão comercial firme desde a v107;
- o corretor escolhe o que mostrar; o cliente recebe **exatamente aquilo**;
- modo corretor = eficiência. Modo cliente = clareza, confiança e informação.
  Não é a mesma interface servindo aos dois.

## Dinheiro: custo, preço e arredondamento (v301)

**O custo é sempre EXATO — nunca arredondado.** Vale para o custo digitado, o
custo importado de backup e o custo corrigido pelo INCC. Duas casas decimais,
ponto final.

**Quem é arredondado é o PREÇO DE VENDA**, e só ele: a venda desejada vira o
preço do site arredondada para os **R$ 100 mais próximos** (padrão; o seletor na
tela do INCC oferece outras opções). A função é `precoDeVenda()`, e
`vendaVaiParaOSite()` usa a mesma conta — a faixa amarela da linha e o botão
"Publicar no site" nunca podem discordar.

Trava herdada da v207: **o arredondamento jamais pode deixar o preço abaixo do
custo.** Se encostar, sobe para o degrau seguinte.

> **REGRA ANTIGA — substituída pela de cima:** a v254 arredondava *o custo e a
> margem* e deixava o preço sair redondo por consequência. Foi invertido a
> pedido do dono em 14/09/2026: *"quando importar a tabela com os custos, devem
> ser exatas, e não arredondado — arredondar somente 100,00 mais próximos no
> preço de venda, não custo."*

**Desfazer custo digitado por engano (v301).** O rascunho do financeiro é
gravado a cada tecla, então recarregar a página não desfaz nada. O **Descartar**
agora volta custo, móveis e margem ao último valor **guardado**
(`descartarFinanceiro`), e o botão aparece mesmo quando não há preço na fila —
antes, mexer só num custo deixava o dono sem nenhum botão para clicar.

## Garagem do Renaissance (v246, reafirmada na v301)

**Os boxes do Renaissance estão incluídos no valor dos apartamentos, conforme a
composição de garagem de cada unidade.** O box nunca é apresentado ao cliente
como valor adicional. Ele continua no cadastro (`emp.boxes`) apenas para
controle interno: vínculo com o apartamento, conferência de vagas e área.

`boxSeparado` **não existe mais** em empreendimento nenhum, e `tools/validar.js`
falha se alguém recriar a marca.

> **REGRA ANTIGA — substituída pela de cima:** até a v245 o Renaissance era o
> único com `boxSeparado: true`, box com preço próprio e venda à parte. Todo
> texto que ainda disser "venda separada" ou "valor próprio" para o Renaissance
> é resquício e está errado.

## O prédio inteiro está no cadastro — inclusive o vendido (v306)

**O cadastro é o prédio inteiro, não só a vitrine.** Até a v305 o Prime tinha
**1** apartamento cadastrado, o Personalité **2** e o Quality **10** — só os que
estavam à venda. As vendas não existiam em lugar nenhum, então o painel mostrava
"0 vendidos · 0% vendido" nos três, e o dono, com razão, achou que o sistema
estava errado. O sistema estava certo; o cadastro é que estava pela metade.

Na v306 entraram, pelas **tabelas de vendas do dono** (setembro/2026):

| prédio | antes | agora | vendidos que entraram |
|---|---|---|---|
| Prime | 1 | 32 | 27 apartamentos + 4 salas |
| Personalité | 2 | 50 | 39 apartamentos + 9 salas |
| Quality Residence | 10 | 60 | 50 apartamentos (blocos A e B) |

Os grupos criados para essas unidades **só têm vendidas**, e o site omite o
grupo que fica sem nenhuma disponível — **nada disso aparece para o cliente**.
Eles existem para o painel contar o prédio inteiro. Cada um traz `plantaNota`
(não há planta cadastrada para unidade vendida) e a `garagem` que a tabela do
dono informa; onde a tabela não informa, vale a composição predominante das
plantas de box que já estavam no cadastro.

**Ao acrescentar unidade, rode `node tools/gerar-pontes.js`** — foram 124 pontes
novas nesta rodada.

## O cadastro de compradores mora no cofre, nunca no site (v306)

Quem comprou cada unidade — **nome, telefone, e-mail, data e valor da venda,
corretor, contrato** — fica no **cofre privado** (`senger-financeiro`,
`financeiro.json`), na chave `compradores`, ao lado dos custos.

**O CPF não é guardado (v311)**, por decisão do dono: *"cpf do cliente não é
necessário"*. O campo **não está** na lista de `mapaDeFichas`, de propósito —
arquivo que traga `cpf` perde o campo na leitura, e a gravação seguinte limpa o
cofre sozinha. **Não recoloque**: documento de terceiro é o dado mais pesado de
se ter por perto sem necessidade.

**Tem menu próprio: "Clientes" (v310)**, a pedido do dono — *"faça um menu então
só de clientes; isso não precisa tá em margens"*. É de lá que se importa
(**Importar clientes**) e exporta, e é lá que fica a lista completa. O nome
continua aparecendo também embaixo da unidade em **Estoque / Unidades** e na
linha de **Preços e margem**, que é onde o dono está quando pensa naquela
unidade. Tudo só para quem tem a chave do GitHub.

**A tela mostra as duas metades:** quem já tem cliente e, embaixo de cada
empreendimento, **quantas vendidas ainda estão sem nome**. Sem esse segundo
número a pergunta *"cadê os compradores?"* não tem resposta na tela — as
planilhas do dono só trazem nome em parte das vendas (o Premium Office e o
Renaissance têm coluna de comprador; os outros só anotação solta). **O box fica
fora dessa conta**: ele vai junto com o apartamento, e o nome é o do
apartamento; só aparece o box alugado direto a alguém, como o 59 do Quality.

**Isto jamais pode entrar no `data.js` nem em nenhum arquivo do repositório do
site — ele é público.** Publicar o nome de um comprador não tem volta: fica no
histórico do git e nos buscadores. A regra é a mesma da v287, quando a tabela
dos lotes entrou e só o valor passou.

Cuidados que o código já tem, e que não podem se perder:

- **o `compradores` vai junto em toda gravação no cofre.** O cofre é um arquivo
  só: mandar o pacote sem eles apagaria o cadastro inteiro lá dentro;
- **`Apagar tudo` não encosta neles.** Aquele botão fala de custo e margem;
- **nem todo nome é de comprador.** Há apartamentos alugados em que o nome é do
  **inquilino** — daí o campo `papel`. Mas, **regra do dono (v312): "inquilino
  só serve quando ainda estiver à venda"**. O apartamento de investimento,
  vendido com o inquilino dentro, é **vendido**, e quem vale ali é o comprador;
  o inquilino não aparece. Por isso `papelDaFicha` só escreve o papel quando a
  unidade está como `alugado` — que é o status do que continua na oferta;
- o **Exportar backup** leva os compradores junto, então **o arquivo exportado
  tem dado pessoal**: ele é cópia de segurança, não coisa de mandar em grupo.

## Registro de incorporação

- Renaissance: **RI nº 11-47.935** (cadastrado na v301).
- Evolutti: **RI nº 11-47.935** — o **mesmo número**, confirmado pelo dono em
  14/09/2026. **Não "corrija" nenhum dos dois** por achar que é engano.
- Boulevard Residence: **RI nº 1-50.267** — já estava certo, não mexer.

## Materiais comerciais: o que existe de verdade (auditado na v301)

Varredura completa do histórico do git (`--diff-filter=A` em todos os commits de
todas as branches): **o único PDF que já existiu no repositório é
`assets/folder-evolutti.pdf`**, e **nenhum vídeo ou URL de vídeo jamais esteve
no `data.js`**. Os campos vazios não são perda — nunca foram preenchidos.

`assets/bv-folder.webp` é a **capa** do folder impresso do Boulevard (uma página
de marca, sem conteúdo), não o folder em PDF.

**Não invente folder, não invente URL de vídeo, não substitua material que falta
por conteúdo genérico.** Falta de folder/vídeo é *material complementar*, não
erro de cadastro (ver a hierarquia de pendências abaixo).

**Guarda contra regressão (v301).** Uma publicação que apague `hero`, `logo`,
`folder`, `video`, `mapa`, fotos da galeria, diferenciais, vínculos de planta ou
o RI que já estavam no ar **pede confirmação nominal** antes de gravar
(`perdasDeMaterial`, em `admin/index.html`). O `tools/validar.js` faz a mesma
conferência contra o retrato em `tools/materiais.json`.

## Plantas do Boulevard por final (v301)

A prancha `assets/bv-planta.webp` mostra os quatro tipos de uma vez. Quem recebe
o link do apartamento 501 não pode ver a planta dos outros três junto. Então:

| final | tipo da prancha | produto | arquivo |
|---|---|---|---|
| 01 | Tipo 1 | 3 suítes, 150 m² priv. | `bv-planta-tipo1.webp` |
| 02 | Tipo 2 | 3 suítes, 150 m² priv. (espelhado) | `bv-planta-tipo2.webp` |
| 03 | Tipo 3 | 2 dorm. (1 suíte), 91 m² priv. | `bv-planta-tipo3.webp` |
| 04 | Tipo 4 | 2 suítes, 93 m² priv. | `bv-planta-tipo4.webp` |

Os quatro arquivos são **recortes da própria prancha** — nada foi redesenhado.
Os originais separados **não existem em nenhuma versão do repositório**
(histórico varrido). Se o dono mandar os originais em alta, é só trocar os
arquivos: os nomes e os vínculos ficam.

Os grupos do `data.js` ganharam `sufixo: "final 01"`…`"final 04"`. **O sufixo é
obrigatório aqui**: sem ele, a junção de tipologias iguais (v213) fundiria os
finais 01 e 02 num quadro só e a planta espelhada se perderia.

A prancha completa e a planta do lazer continuam na apresentação geral, cada uma
na sua seção (`secao: "pavimento"` e `secao: "lazer"` no item da galeria). **A
planta do lazer nunca aparece como planta da unidade.**

## A ficha da unidade no link do cliente (v301)

`?cliente&u=<código>` deixou de ser "a ficha do prédio com uma linha destacada"
e passou a ser **a ficha daquela unidade**. A ordem do conteúdo muda:

1. identificação (nome do empreendimento + unidade, no hero);
2. **ficha** — tipologia, dormitórios/suítes, área privativa, área global,
   garagem, andar, entrega, pagamento, RI, características especiais e o valor
   em destaque (`fichaDaUnidade`, no `app.js`);
3. planta **daquela** unidade;
4. fotos;
5. diferenciais;
6. vídeo e folder, se existirem;
7. CTA "Falar com o corretor" (fixo).

A tabela de unidades **sai** quando é uma unidade só — com uma linha ela repetia
o que a ficha diz melhor. Link de empreendimento e link de seleção continuam
exploratórios, com a vitrine de sempre.

**Nada é inventado:** cada linha da ficha só aparece se o campo existir no
cadastro. Sem área global, não há linha de área global.

## Modo cliente: o que nunca pode vazar

Os botões da equipe **não são mais escritos no HTML** no modo cliente — antes
eram sempre escritos e escondidos pelo CSS (`.client-mode`), o que deixava a
ferramenta interna alcançável por teclado e por leitor de tela, e à vista se a
folha de estilo falhasse. O CSS continua como segunda barreira.

O lead não vê: compartilhar, selecionar, gerar PDF, enviar link, versão do site,
"Meu contato", painel, dado financeiro, nem unidade vendida.

## Hierarquia das pendências do painel (v301)

Três níveis, nesta ordem, e **folder/vídeo não são nível 1**:

1. **Dado comercial** (`NIVEL.critico`) — se estiver errado, o corretor vende
   errado: unidade à venda sem preço, vendida ainda com preço de tabela,
   tipologia sem metragem, sem garagem informada, sem RI, sem foto de capa,
   folder cadastrado que não é PDF, box vendido sem a unidade que o levou.
2. **Atenção** (`NIVEL.atencao`) — informação incompleta ou genérica: planta
   genérica no lugar da específica, tipologia sem regra de box, box sem área.
3. **Material complementar** (`NIVEL.material`) — falta material, nada do que
   existe está errado: folder, vídeo, fotos adicionais.

## Publicação em um commit só (v301)

`publicarEmUmCommit()` monta blobs → árvore → commit → move a branch uma vez.
`data.js`, `index.html`, `sw.js` e os arquivos anexados entram **juntos**: ou
tudo, ou nada. Antes eram três PUT separados e uma queda no meio deixava o site
com preço novo e versão velha. O caminho antigo continua como **plano B**, para
a conta que não alcance a API de dados do git; chave recusada (401) não tenta o
plano B, porque o problema é permissão, não método.

## Segurança: o que protege e o que não protege

- **A senha do painel não é segurança de verdade.** É uma página estática no
  GitHub Pages: a comparação de hash roda no navegador do visitante. Ela esconde
  a tela de quem abrir o endereço por acaso, e só. **Não construa autenticação
  falsa por cima disso**; resolver de verdade exigiria um backend, que este
  projeto não tem.
- **Quem protege é a chave do GitHub.** Sem ela ninguém publica nem abre o cofre
  dos custos. Ela fica no `localStorage` **daquele aparelho**, nunca no
  `data.js`, nunca numa URL, nunca em log, nunca no HTML que o cliente recebe —
  e `tools/validar.js` falha se isso mudar.
- **A chave precisa dos DOIS repositórios:** `materialsengercorretores` (o site)
  e `senger-financeiro` (o cofre privado dos custos). Chave só com o primeiro
  publica mas nunca guarda custo. Permissão necessária: **Contents: Read and
  write**, nada além disso.
- **Validade de 90 dias, não "No expiration".** Chave sem vencimento vale para
  sempre mesmo se o aparelho se perder. O painel avisa aos 75 dias e oferece
  **Apagar a chave deste aparelho**.

## Validação e testes (v301)

Dois comandos, sem dependência nenhuma de instalar:

```
node tools/validar.js          # cadastro, arquivos, pontes, segredos, versões
node tools/testar-navegador.js # site, modo cliente, painel e PWA no Chromium
node tools/gerar-pontes.js     # depois de acrescentar/remover unidade
```

`tools/validar.js --gravar-retrato` atualiza `tools/materiais.json`, que é a
referência da guarda de regressão de materiais. **Rode os dois antes de
publicar.**

## Os clientes vieram das tabelas do Word (v312)

O dono mandou **cinco `TABELA DE CLIENTES`** em `.doc` — Prime, Personalité,
Evolutti, Boulevard e Quality — e delas saíram **171 fichas**, que somadas ao
que já havia (Premium Office e Renaissance, que não têm `.doc`) fecham **203**.
De 168 vendidas sem nome sobraram **19**: 17 lotes do Nova Vila Rica e dois
apartamentos do Quality.

**Os dois do Quality eram erro de leitura, não falta de nome (16/09/2026).** O
dono mandou a foto da tabela e lá estão os dois: **104-A · LAIRTON HARNISCH** e
**202-A · DANIEL WEBER LIMA**. Com eles, ficam **205 fichas** e **17 vendidas
sem nome** — todas lotes do Nova Vila Rica. É a **quarta armadilha** do formato,
depois das três de cima: **duas linhas seguidas podem sair da leitura sem nenhum
aviso**, e a conta de "quantas ficaram sem nome" não acusa nada, porque o lugar
delas fica vazio do mesmo jeito. **Quando o dono disser que um nome existe, a
tabela dele vence a leitura** — foi ele quem achou as duas.

Os `.doc` são Word binário antigo (OLE2). O texto sai pela **piece table** do
stream `1Table`, não por `strings`. **A primeira leitura saiu errada em 13
nomes** e o dono pegou: três armadilhas, todas do formato.

1. **O nome riscado.** Ele risca o dono antigo e escreve o novo do lado. O
   riscado é o `sprmCFStrike` (**0x0837**, não o 0x0801 do Word 6) nos CHPX do
   `1Table`. Sem ler isso, o nome que saía era o antigo, ou os dois grudados.
2. **A tabela é uma grade de 4 células por linha** — unidade, box, nome e a
   célula vazia que fecha a linha. Procurar "o que parece unidade" não serve:
   *o Prime tem apto 201 e box 201*. Anda-se de 4 em 4 a partir do cabeçalho,
   e a linha de seção ("BLOCO A"), que tem 2 células, anda 2.
3. **Célula inteira riscada apagava a própria marca de fim de célula**, juntando
   duas células e desalinhando a tabela daí para baixo.

O script rodou fora do repositório — é leitura de arquivo do dono, não parte do
site; entra em `tools/` só se ele pedir.

**Nada do que está na célula se perde (v314).** A ficha guarda `riscado` (o dono
anterior) e `anotacao` (a célula inteira, como ele escreveu), e o painel mostra
os dois atrás de um **📝 obs** que abre no toque — pedido dele: *"nem que deixe
um ícone de obs pra clicar e abrir nesses casos que tem mais coisas além do
nome"*. **O CPF é retirado de todo campo**, inclusive de dentro da anotação.

**Quando a tabela de clientes discorda da planilha de vendas, vale a tabela de
clientes** — ela é a fonte direta. Foi assim que o Quality 403-A passou a ser do
**João Carlos Santos** (o Márcio Schenatto é o inquilino) e as salas do Prime
viraram **Rafael** e **Fabrício Bau Branda**.

**Nada disso apaga decisão que o dono já deu por escrito:** o Personalité 1202
segue **Cristian Kirinus** mesmo com a tabela registrando Everson Alceu Walber e
a volta para a Senger em 02/2025.

## O apartamento de investimento é vendido, não alugado (v312)

O **Quality 601-B** estava como `alugado` — portanto na vitrine. O dono
explicou: *"vendemos para a Doroti porque é apto de investimento; vendido
mantenha vendido e esquece inquilino"*. Ele passou a `vendido`, sem preço, e o
**box 32** foi junto.

`alugado` continua significando **o que ainda está à venda com o inquilino
dentro** — o produto pronto para o investidor. Assim que esse investidor compra,
vira `vendido` e sai da vitrine.

## Contar por tipo de imóvel, não pela categoria do prédio (v310)

A gaveta de vendidos dizia **"6 apartamentos vendidos"** no Renaissance com
**três salas do térreo** dentro. O nome saía de `nomes(emp)`, que olha só a
`categoria` do empreendimento — e o Renaissance é residencial. O mesmo acontecia
no Evolutti (3 lojas), no Personalité (9 salas) e no Prime (4 salas).

Agora quem manda é o **rótulo de cada item**, não o prédio (`dizerVendidos`):
"3 apartamentos e 3 salas vendidos", "16 apartamentos e 3 lojas vendidos",
"25 salas vendidas". O produto do prédio vem primeiro — a sala do térreo é o
acessório, não o assunto —, e o plural feminino ("vendidas") só aparece quando
tudo o que está ali é palavra feminina.

**Regra geral:** todo texto que conte itens de um empreendimento tem de olhar o
item, não a `categoria`. Quase todo prédio residencial da Senger tem sala ou
loja no térreo.

## O que mudou na v301 (rodada de 14/09/2026)

Uma rodada de correção, melhoria e testes pedida pelo dono. O que entrou:

**Corrigido de verdade (bugs que existiam):**
- **o custo digitado por engano não voltava atrás.** O rascunho é gravado a cada
  tecla, o "Descartar" só limpava as alterações de site, e com apenas um custo
  mexido o botão nem aparecia. Agora o Descartar devolve custo, móveis e margem
  ao último valor guardado, e aparece sempre que há algo a desfazer.
- **a publicação podia ficar pela metade** — três PUT separados. Agora é um
  commit só.
- **a planta do lazer do Boulevard** ficava junto das plantas de apartamento,
  como se fosse a planta da unidade enviada.
- **o Renaissance estava sem RI** no cadastro; a ficha e o PDF saíam com
  "Não informado".
- **`boxSeparado` continuava vivo no código** (`semValor: !emp.boxSeparado`)
  depois de a regra ter acabado na v246 — convite a ressuscitá-la.
- **o cabeçalho do `data.js` dizia "Julho / 2026"** com o META em setembro, e o
  comentário do topo do `admin/index.html` anunciava "v173" com o painel na
  v264. Os dois foram corrigidos para apontar para a fonte certa.
- **voltar da ficha jogava o corretor para o topo da lista**, mesmo tendo rolado
  até o fim da vitrine.
- **os botões da equipe iam para o HTML do cliente** e eram só escondidos pelo
  CSS.

**Mudanças de regra pedidas pelo dono nesta rodada:**
- custo sempre exato; arredondamento só no preço de venda (ver REGRAS ATUAIS);
- boxes do Renaissance inclusos no valor do apartamento — correção documental;
- RI nº 11-47.935 no Renaissance, sem tocar no Evolutti.

**UX:**
- *cliente*: a ficha da unidade (item próprio em REGRAS ATUAIS);
- *corretor*: a posição na lista volta como estava; as quatro plantas do
  Boulevard separadas por final;
- *painel*: Visão geral > Estoque geral refeita, pendências em três níveis,
  "← Voltar" em toda tela, guarda de regressão de material na publicação.

**Limitações conhecidas, que ficam:**
- as quatro plantas do Boulevard são recortes de uma prancha de 800 px — ficam
  legíveis, mas os originais em alta resolução dariam melhor. Trocar os arquivos
  pelos mesmos nomes resolve, sem mexer em código;
- folder e vídeo continuam faltando em nove de dez empreendimentos: **não
  existem no repositório e nunca existiram** (histórico varrido). Só o dono pode
  fornecê-los;
- a senha do painel não é segurança de verdade e não tem como ser, sem backend;
- divergências de cadastro deixadas **de propósito**, por falta de fonte
  conclusiva: o lote 98 da quadra 77 (348 m² no cadastro, 290 m² na tabela do
  dono), o lote 77/50 (342 m² × 340 m²) e as ruas trocadas dos lotes 145/10 e
  145/18 do Nova Vila Rica I & II. **Não resolver no chute** — são rua e área, o
  que o cliente lê.

---

# HISTÓRICO — leia com a seção acima na mão

O que vem abaixo é o registro das decisões, versão a versão. É útil para
entender *por que* as coisas são como são. **Não é a especificação do estado
atual** — quando divergir da seção "REGRAS ATUAIS", a de cima vale.

## Como o dono trabalha

- **Publique sempre ao terminar, sem perguntar.** Ao final de uma tarefa: commit
  na branch de trabalho, abre o pull request e faz o merge na `main`. Não pare
  para pedir autorização de publicação.
- **Toda alteração sobe a versão.** Antes de publicar, incremente o número em
  `index.html` (todos os `?v=`) e em `sw.js` (o `CACHE` e os `?v=` do `CORE`),
  com a data do dia no nome do cache:
  `const CACHE = "senger-portfolio-v117-20260813"`. Vale para qualquer mudança,
  inclusive as que só afetam o painel — o número é o registro do que está no ar,
  e é por ele que o dono confere se recebeu a atualização.
- Ele acompanha pelo resultado na tela, não pelo código. Explique o que mudou em
  linguagem de leigo, sem jargão de programação.

## Estrutura

- `index.html` + `app.js` + `styles.css` — o site público.
- `data.js` — a fonte de todos os dados: `META` (INCC, mês da tabela) e
  `EMPREENDIMENTOS`.
- `admin/index.html` — o painel administrativo, uma página só, sem build. Lê e
  grava o `data.js` direto pela API do GitHub, na branch `main`.
  A interface usa navegação lateral em acordeão/colapsável (v173), com módulos separados e a paleta original do painel. Preços e margem é um módulo próprio desde a v210. Configurações não é um módulo: a chave do GitHub fica recolhida em Publicação > Acesso técnico.
- `sw.js` — service worker. Navegação e arquivos do site são buscados da rede
  primeiro, então o painel nunca fica preso em cache.
- `tools/validar.js` — confere o cadastro, os arquivos, as pontes, os segredos e
  as versões. **Rode antes de publicar.**
- `tools/testar-navegador.js` — abre o Chromium e exercita o site, o modo
  cliente, o painel e o PWA. **Rode antes de publicar.**
- `tools/materiais.json` — o retrato dos materiais de cada empreendimento. É a
  referência da guarda de regressão; atualize com
  `node tools/validar.js --gravar-retrato` depois de acrescentar material.
- `l/` — as **páginas-ponte**, geradas por `tools/gerar-pontes.js`. Uma por
  empreendimento (`l/renaissance/`) e uma por unidade (`l/renaissance/u/501/`).
  Existem porque o robô do WhatsApp não roda JavaScript: sem elas a prévia de
  qualquer link seria sempre a mesma foto genérica. Cada ponte redireciona na
  hora para o portfólio, levando junto o que veio no endereço.

## data.js

Cada empreendimento usa uma destas formas de estoque, lidas pelo `app.js`:
`grupos` (unidades por tipologia), `terrenos` ou `outros`.

**Os materiais comerciais também ficam no `data.js`.** Cada empreendimento real deve ter `folder` (PDF) e `video` (YouTube, Vimeo ou arquivo MP4/WebM/Ogg). Capa (`hero`), logo (`logo`), galeria (`galeria`) e vínculos de planta (`planta`) também são administráveis pelo painel. O site lê esses campos; `boxes` continua sendo exclusivamente interno do painel.

Status válidos: `disponivel`, `vendido`, `alugado`. **Não existe "reservado"** —
a construtora não reserva unidades. `alugado` **continua na oferta**: é o
produto pronto para o investidor, que compra com o inquilino dentro. Só o
`vendido` sai da vitrine.

**Ao acrescentar ou remover unidade no `data.js`, rode
`node tools/gerar-pontes.js` e faça commit do que ele gerar.** Sem isso a
unidade nova fica sem ponte e o link enviado ao cliente cai em página
inexistente. Só mudar status não precisa: a ponte é gerada para toda unidade do
cadastro, inclusive a vendida, justamente para o painel poder desfazer uma
venda sem quebrar link.

O estoque cadastrado é o prédio inteiro, não só o que está à venda: unidade
vendida fica no `data.js` com `status: "vendido"`, **sem `preco`** (o valor de
tabela não vale mais) e **sem número de dormitórios** (o comprador costuma
modificar a planta). O site esconde as vendidas e omite o grupo que ficar sem
nenhuma disponível; se a venda for desfeita, o preço aparece como "Sob consulta"
até alguém informar o novo valor.


### A metragem pode morar na unidade, não no grupo (v315)

A pendência **"tipologia 'Lojas' sem a metragem"** do Evolutti era **falsa**. As
três lojas do térreo têm metragem no cadastro desde sempre — **cada uma a sua**
(101: 148 m² global / 108 privativo; 102: 120/88; 103: 185/135), em `areaUnit`
na própria unidade, porque um grupo com três metragens diferentes não tem uma só
para escrever. O painel olhava **apenas `g.area`** e acusava falta.

Agora a conferência é a mesma da planta: **falta metragem só quando não há nem o
texto do grupo nem `areaUnit` em todas as unidades**. Vale a regra geral —
**toda conferência de tipologia tem de olhar a unidade também**, não só o grupo.

O dono levou a sério ("as metragens das salas têm lá na tabela que já mandei
antes — e umas mil vezes já"), e estava certo: **quando ele disser que um dado
está lá, confira no cadastro antes de responder.**

### Os distratos do Nova Vila Rica III conferem (16/09/2026)

A folha de **distratos** que o dono mandou traz **11 lotes** cuja venda foi
desfeita (77/91, 77/93, 77/96, 77/98, 77/99, 77/105, 77/107, 147/27, 147/30,
157/16 e 157/29). **Todos os 11 já estão como `disponivel` no cadastro**, com
preço, e nenhum deles recebeu ficha de comprador — venda desfeita não tem dono.
Os 16 que a tabela dá como VENDIDO são exatamente os 16 `vendido` do cadastro.

A folha de distratos escreve **348 m²** no lote 98 da quadra 77, mas ali vale
**290 m²**: é a mesma folha antiga que a v302 corrigiu com o dono, e a tabela
nova também diz 290. **Não "corrija" de volta.**

### A fazer na próxima atualização

- **Nova Vila Rica I & II · lote 51 da quadra 77** — é a **única vendida do
  cadastro inteiro ainda sem nome**. A tabela que o dono mandou em 16/09/2026 é
  a do **Nova Vila Rica III**; o I & II não veio. Entra quando ele mandar.
- **Quality · box 58** *(conferir com o dono).* A **tabela de clientes** liga o
  box 58 ao apto 301-A, agora confirmado vendido; a **planta de box de
  10/08/2026**, que mandou seguir na v309, dá o 58 como **livre**, e é ela que
  está no cadastro. Como o 301-A está vendido **sem box nenhum vinculado**, uma
  das duas está velha. **Não mexido.**

- ~~**Os 17 lotes vendidos do Nova Vila Rica**~~ — **RESOLVIDO em 16/09/2026**
  para os 16 do **Nova Vila Rica III**. O dono decidiu: *"se tem o nome do
  comprador, deve constar como nos outros produtos"*, e mandou a tabela do
  loteamento (a dele, com CPF, comissão e matrícula) mais a folha de
  **distratos**. Foram para o cofre **nome, telefone, e-mail, data, valor da
  venda e corretor** — **o CPF não**, como manda a v311, nem comissão ou
  matrícula. O 157/32 é o único com dono anterior: **Silvio da Rosa Nunes cedeu
  para Luis Antonio Hermann**. Falta só o 77/51, do I & II, que é outra tabela.
- ~~**Quality · apto 301-A**~~ — **RESOLVIDO em 16/09/2026.** O dono mandou:
  *"apto 301A — bote vendido para Sergio Kirinus"*. O cadastro já estava como
  **vendido**; o que faltava era a ficha, que foi para o cofre com o
  "reservado 01/12.2025 (falta contrato de venda) — DISPONÍVEL P/ALUGUEL" da
  tabela guardado como anotação, atrás do 📝.
- ~~**Quality · apto 104-A e 202-A**~~ — **RESOLVIDO em 16/09/2026.** Eles nunca
  estiveram em branco: o dono mandou a foto da TABELA DE CLIENTES do bloco A e
  os dois têm nome — **104-A é do LAIRTON HARNISCH** (box 36) e **202-A é do
  DANIEL WEBER LIMA** (box 46), com a **Sudbrack Leonhardt Supermercados Ltda.
  riscada** antes dele. Quem errou foi a leitura da v312, que perdeu as duas
  linhas. As fichas foram entregues ao dono para importar em Clientes.
- ~~**Quality · apto 201-A**~~ — **RESOLVIDO em 16/09/2026.** Está **à venda
  mesmo**: *"cliente cancelou trato"*, e a célula dele está **em branco** na
  tabela. O "Sudbrack no 201-A" era erro de leitura — aquele nome é o riscado do
  **202-A**, a linha de baixo. O cadastro já estava certo; nada mexido.

- ~~**As 4 salas comerciais do térreo do Prime**~~ — **RESOLVIDO em 15/09/2026
  (v307).** O dono confirmou: as quatro estão **vendidas** (comprador BRANDA), e
  não à venda como a coluna DISPONÍVEIS da tabela dava a entender. Entraram no
  cadastro como vendidas, sem garagem — a tabela traz "-" para as quatro.
- ~~**Premium Office · Sala 301**~~ — **RESOLVIDO em 15/09/2026 (v307).** O dono
  confirmou: **vendida para SERGIO KIRINUS**. O cadastro já estava certo; o que
  faltava era o comprador, que foi para o cofre.
- ~~**Prime · apartamento 902**~~ — **RESOLVIDO em 16/09/2026.** O dono
  confirmou: *"foi vendido para a Consuelo e agora por último para Leodi
  Altmann"*. A ficha ficou com **LEODI ALTMANN** como comprador e **Consuelo**
  como o nome anterior (o mesmo campo `riscado` da v314, que é onde mora o dono
  antigo). Ele continua **cadastrado como VENDIDO desde a v308** e **sem
  `areaUnit`** de propósito — não tem linha na tabela de vendas (a planilha pula
  do 901 para o 903), então vale a metragem do final 02.
- ~~**Quality · box 58 e 59**~~ — **RESOLVIDO em 15/09/2026 (v309).** O dono
  mandou a **planta de box vendidos de 10/08/2026** e mandou seguir ela. A
  planta foi lida box a box, casando cada rótulo com o box mais próximo:
  **o cadastro já estava certo** nos 60 box, e quem estava fora era a
  observação da tabela de vendas. Livres: **01, 12, 58 e 60**. O **box 59 está
  alugado direto a uma pessoa, sem apartamento nenhum** — a planta escreve
  "ALUGADO FILHO LAIRTON", e esse nome foi para o cofre. Único ponto em que a
  planta e o cadastro divergem: o **box 51**, que a planta dá como vendido
  (apto 501-A) e o cadastro mantém **alugado** — de propósito, porque o dono
  decidiu na v307 que o próprio 501-A segue alugado, e o box acompanha a
  unidade.
- ~~**Quality · apto 501-A**~~ — **RESOLVIDO em 15/09/2026 (v307).** O dono
  decidiu: segue **alugado** (portanto continua na oferta), e o "vendido para
  EDSON" da tabela fica só como **observação** na ficha do cofre. Foi o que fez
  a observação da ficha ganhar linha e cor próprias na tela, em vez de ficar
  escondida no toque.
- ~~**Personalité · apto 1202**~~ — **RESOLVIDO em 15/09/2026 (v307).** Vendido
  mesmo, para **CRISTIAN KIRINUS**, que aluga para a BRAVO LOG. O "VOLTOU
  02/2025" da planilha não desfez a venda.

- ~~**Conferir a área do lote 98 da quadra 77 (Nova Vila Rica III)**~~ —
  **RESOLVIDO em 14/09/2026 (v302).** O dono confirmou: são **290 m²**, não 348.
  Corrigido no cadastro.
- ~~**Conferir a área do lote 50 da quadra 77 (Nova Vila Rica II)**~~ —
  **RESOLVIDO em 14/09/2026 (v303).** O dono confirmou: **342,50 m²** — nem os
  342 do cadastro nem os 340 da folha. É o único lote com área fracionada, e o
  site escreve "342,5 m²".
- ~~**As ruas do 145/10 e do 145/18**~~ — **RESOLVIDO em 14/09/2026 (v305).**
  O dono mandou a **planta de retificação do loteamento I e II** e ela decide:
  o **10** é o lote de esquina da quadra 145, com frente para a **Figueira**; o
  **18** está na fileira que dá para a **Acácia**. O cadastro tinha as duas
  trocadas. A planta também mostra as áreas reais (403,65 m² e 302,70 m²), mas
  o cadastro segue com 400 e 300, que vêm da folha de preços do dono e são
  menores que o real — a regra do site é nunca anunciar área maior que a
  verdadeira, então não foram mexidas sem ele pedir.

- ~~**Botão "voltar" em todas as telas do painel**~~ — **FEITO na v301.** Um
  "← Voltar para <tela anterior>" no alto de toda tela que não seja a Visão
  geral (que é o início, e não tem para onde voltar). Guarda a trilha das telas
  por onde o dono passou; nada do que ele digitou se perde, porque trocar de
  módulo só mostra e esconde seções.
- ~~**Embutir o valor do box no custo do Renaissance**~~ — **FEITO na v246.**
  Os boxes do Renaissance já estão no valor dos apartamentos. Ver
  "Garagem do Renaissance", em REGRAS ATUAIS.
- ~~**Refazer a apresentação de Visão geral > Estoque geral**~~ — **FEITO na
  v301.** Dois degraus: uma faixa de cima que responde em dois segundos
  (quantos à venda, quantos vendidos, que tipo de imóvel, barra de quanto já foi
  vendido) e, embaixo, três colunas de mesmo peso — estoque por tipologia,
  garagem e situação do cadastro. A lista "Garagem por unidade" continua
  inteira, dentro de uma gaveta fechada, e cada empreendimento tem atalhos para
  Ver unidades, Preços e margem e O que falta. **Confirmar com o dono se agora
  está claro** — ele nunca chegou a detalhar o que o confundia na v262.
### São três Casas Suspensas, não duas (v252)

O dono fala delas separadas — **2 suítes**, **3 suítes frente** e
**3 suítes superior** —, e é assim que elas estão no site desde a v252: a
Casa Suspensa de 3 suítes virou dois quadros, "frente" (401 e 402, 1 box duplo,
4º pavimento) e "pavimentos superiores" (1301 e 1302, 1 box duplo + 1 box
simples, 13º pavimento), com o `sufixo` da v213 ao lado do nome. Num quadro só,
a garagem certa aparecia apenas na linha de cada apartamento e **o cabeçalho
ficava sem nenhuma** — que é onde o cliente olha primeiro.

### A garagem quem diz é a regra do cadastro (v251)

O site não escreve mais um texto de garagem por tipologia: ele lê
`vagasPorTipologia` pelo rótulo de `estoque` da unidade — **a mesma regra que o
painel usa** em "Garagem por unidade". Foi assim que a Casa Suspensa de 3 suítes
parou de mentir: 401 e 402 levam 1 box duplo, 1301 e 1302 levam 1 box duplo + 1
box simples, e antes o grupo inteiro dizia "Box opcional (consultar)".

Quando todas as unidades do quadro levam a mesma garagem, ela continua sendo
uma etiqueta no cabeçalho. **Misturou, vira coluna**: na tabela do computador,
linha no cartão do celular, coluna no PDF e no texto que vai ao cliente. A
tabela de seis colunas tem larguras próprias (`.units-table.com-garagem`) —
sem elas o valor ficava cortado atrás dos botões.

O campo `garagem` do grupo continua valendo como último recurso, para a
tipologia sem regra cadastrada (as salas do térreo, por exemplo). No painel, a
pendência "sem a garagem informada" só acusa quem não tem **nem** o texto **nem**
a regra.

**O box já está no preço do apartamento**, então o aviso "Valor sem box de
garagem" saiu do Renaissance (ele vinha de quando o box era venda separada, o
que acabou na v246).

### Garagem: "1 box simples" ou "1 box duplo" (v245)

O campo `garagem` de cada grupo tinha **nove escritas diferentes** para a mesma
coisa — "01 vaga de garagem", "1 Box de garagem", "01 box", "Box duplo",
"01 box duplo", "01 box de garagem", "01 vaga de garagem por sala",
"03 vagas de garagem" e "Box opcional (consultar)". O dono pediu **um padrão
só**: sempre *"1 box simples"* ou *"1 box duplo"*.

O texto novo **não foi inventado**: veio de `vagasPorTipologia`, que já dizia
quantos box cada tipologia leva. Onde a tipologia leva mais de um, a escrita
segue as mesmas palavras — "1 box duplo + 1 box simples" (Renaissance, 3 suítes
superiores), "4 box simples" (18º pavimento) e "3 box simples" (a sala do térreo
do Premium Office, que tem três mesmo). As salas do térreo do Renaissance
continuam sem garagem, com o campo vazio, a pedido dele.

### Os lotes do Nova Vila Rica III têm preço de novo (v287)

O dono mandou a **tabela de valores do loteamento** (o arquivo dele, com
comprador, CPF, telefone e comissão) e pediu para "colocar os terrenos". Do
arquivo saiu **só o valor**: os **67 lotes à venda** receberam `preco` no
`data.js`, de R$ 57.000 a R$ 110.000. **Nada de nome, CPF, telefone, e-mail,
comissão ou matrícula encostou no repositório** — é dado privado dele, e o
repositório do site é público.

Os **16 vendidos continuam sem `preco`**, pela regra de sempre: o valor de
tabela não vale mais. Os **distratos** (venda desfeita) já estavam como
disponíveis e ganharam o valor junto. Os lotes de **permuta** (155/10, 155/11,
155/20, 155/21, 157/17, 157/18) e o **157/38 (pago em 2016)** não estão no
cadastro e continuam de fora — não são oferta. Conferido lote a lote: os 83
cadastrados casaram com a tabela em quadra, número e situação.

**O Nova Vila Rica I & II entrou logo depois (v288)**, pela folha de preços dele
("Preços válidos agosto/2026"): os **10 lotes à venda** receberam `preco`,
de R$ 95.000 a R$ 305.000 (o 146/22, de 1.420 m²). O vendido (77/51) continua
sem preço. Os 11 do cadastro casaram com a folha — o único que não está lá é
justamente o vendido.

**Duas diferenças ficaram anotadas, sem mexer:** o lote 77/50 tem 342 m² no
cadastro e 340 m² na folha; e as ruas do 145/10 e do 145/18 estão **trocadas**
entre o cadastro e a folha (um diz Acácia onde o outro diz Figueira). Rua e área
são o que o cliente lê, então isso se corrige com ele, não por conta própria.

### A tabela começa vazia (v225)

**Não há mais preço no `data.js`** — os 264 preços foram apagados a pedido do
dono, que está remontando a tabela pelo custo. Enquanto o preço não é publicado,
o site e o PDF mostram **"Sob consulta"**. O preço volta item a item: o dono
informa o **custo** e a **venda desejada** em Preços e margem, e o "Publicar no
site" grava. Como a linha do item pode não ter mais o campo `preco`,
`aplicarPreco` **acrescenta** o campo quando ele não existe (antes do `status:`)
em vez de falhar, e `precosDesejadosPendentes` deixou de exigir um preço atual.

**O INCC corrige custo, não preço (v225)** — continua valendo. O que mudou na
v301 é que o custo corrigido fica **exato**, sem arredondamento.
 *"Nessa tela tem que aparecer o
custo e não venda — INCC corrige custo; venda e margem é outra coisa."* A
pré-visualização lista **Custo atual → Custo novo** dos custos guardados, o
"Aplicar correção" sobe todos na hora, e o "Publicar no site" grava só o mês, a
data, o índice e o histórico no `data.js`. O seletor de arredondamento ficou
escondido: ele existia para preço.

### Custos e margem (somente painel)

**Preços e margem é uma tela própria (v210)**, no menu, ao lado da Correção pelo
INCC. Antes era um apêndice da tela de INCC, com uma tabela de nove colunas que
só cabia rolando para o lado; o dono disse, com razão, que ela estava confusa.
Agora cada item é uma linha com **quatro números — custo, preço no site, venda
desejada e margem** — e nada mais. **Nunca grave custo no `data.js` ou em outro
arquivo público do repositório.** O painel permite importar/exportar um JSON de
backup.

**Terreno não tem móveis (v264).** A v263 pôs o campo "+ móveis" em toda
linha, e ele apareceu também nos lotes dos loteamentos — lote é chão, não há o
que mobiliar. Agora o campo **não existe na linha do terreno**, e
`moveisInterno` devolve nulo para qualquer chave de terreno (`<emp>:t:...`),
então nenhuma conta do painel soma mobília em lote, venha o valor de onde vier.

**Móveis entram no custo (v263).** Alguns apartamentos foram entregues
mobiliados e o dono quer esse investimento dentro do custo. Cada linha tem o
campo **"+ móveis"** embaixo do nome, vazio na maioria; o campo Custo continua
sendo o custo da obra. **Margem %, Margem, Custo − 5%/− 10% e Venda desejada
são contados sobre o total (obra + móveis)**, e uma nota embaixo do custo diz
"= 1.313.900,00 com móveis". O valor mora no mapa `moveis`, ao lado de
`custos` e `margensDesejadas`, em todo lugar: aparelho, rascunho, cofre e
backup (backup antigo sem `moveis` continua importável). Por decisão do dono,
**o INCC corrige os móveis junto** — obra e móveis arredondados cada um por si,
e a pré-visualização mostra o total com a marca "com móveis". "Apagar tudo" e
"Apagar tudo do <nome>" limpam os móveis também. Sem custo da obra não há custo
total: móveis sozinhos não precificam nada (`comMoveis`). Quem lê custo para
conta tem de usar `custoTotalInterno`/`comMoveis`, nunca `custoInterno` —
este é só o custo da obra, que vai no campo.

**Não existe mais coluna "Preço no site" (v217).** *"Quero que 'preço no site'
não exista mais, somente venda desejada — que é o que vai pro site."* A
**Venda desejada é o preço**. O preço publicado continua guardado na linha
(`data-preco`) — é com ele que a marca "vai para o site", o "desfazer" e a fila
de publicação comparam.

**A linha fica em branco até o dono precificar (v221).** A v217 preenchia a
venda desejada com o preço que estava no ar quando não havia margem guardada; o
dono pediu o contrário — *"apague a venda desejada também, deixe tudo zerado"*.
Agora **custo, venda desejada, `Margem %` e `Margem` só aparecem quando ele
informa**: sem venda desejada, `margemDaLinha` devolve nulo e a linha inteira
fica vazia. É o que faz o "Apagar tudo" deixar a tela realmente limpa. Efeito
colateral aceito: o preço que está no ar não aparece mais nessa tela — quem
mostra preço publicado é o site e o PDF.

**Uma margem só na tela (v210).** Enquanto a venda desejada está vazia, a margem
mostrada é a do preço que está no site; assim que o dono informa a venda
desejada, ela passa a ser a margem dessa venda, e a letra miúda embaixo diz
sobre qual das duas ela é. Duas colunas de margem lado a lado era o que mais
confundia.

**Os descontos ficam na gaveta (v210), atrás de um botão que diz o nome deles
(v211).** `Custo - 5%` e `Custo - 10%` só servem na hora de uma proposta, então
saíram da linha. Na v210 a gaveta abria num `⌄` sem legenda e **o dono não achou
os descontos** — agora o botão embaixo do nome diz **"▾ margem % e descontos"**.
Dentro dela ficam a margem em %, a margem em reais, os dois descontos e o botão
**"Deixar igual ao preço do site"**, que desfaz a mudança de preço daquele item.
As contas continuam as mesmas (`custo × 0,95` e `custo × 0,90`).

**A margem também se digita em porcentagem (v211).** "Quero 5% em cima do
custo" é como o dono pensa, então a gaveta tem o campo **Margem sobre o custo**
em %: digitar 5 faz a venda desejada virar `custo × 1,05`. Os três campos —
porcentagem, margem em reais e venda desejada — conversam entre si; **o que fica
guardado continua sendo a margem em reais**, então cofre e backup não mudam de
formato.

**Aplicar a porcentagem em vários itens (v211).** Acima da lista há
`[ 5 ] % · Aplicar aos itens da lista`: ele coloca a mesma margem em tudo o que
o filtro e a busca estão mostrando naquele momento — item a item em 245 unidades
ninguém faria. Pede confirmação dizendo quantos itens vão mudar, pula o que não
tem custo lançado (e diz quantos foram), e nada vai para o site antes do
"Publicar no site".

**Um percentual para o prédio inteiro (v212).** Dentro de cada empreendimento,
logo abaixo do nome dele, há `Margem sobre o custo de todo o <nome>: [ 5 ] % ·
Aplicar a todas as unidades`. Diferente da faixa do topo da tela (que respeita o
filtro e a busca), **esta vale para todas as unidades à venda daquele
empreendimento**, filtro ligado ou não. Pula quem não tem custo lançado e diz
quantos ficaram de fora. O campo mostra a porcentagem quando o prédio inteiro
está com a mesma margem, e fica **vazio quando elas estão misturadas** — é assim
que se vê, de relance, se alguma unidade fugiu do padrão.

**As colunas ocupam a largura toda (v212).** Na v210/v211 sobrava um vão entre
o nome do apartamento e o custo: as colunas de número tinham largura fixa e
ficavam encostadas na direita. Agora elas crescem juntas (`fr` com mínimo), e a
lista mede a si mesma (`container-type: inline-size`), não a janela — o menu
lateral entra na conta.

**As oito colunas aparecem sempre — elas se apertam, não somem (v215).** As
v212/v214 escondiam `Custo − 5%` e `Custo − 10%` quando a lista era estreita
(v212 mandava para a gaveta, v214 para uma linha miúda embaixo do nome). O dono
foi claro: *"tem que ficar aparecendo todas as colunas, aperte elas pra caber"*.
Então as oito ficam na linha em qualquer largura de computador, em **três faixas
de aperto** (`@container` sobre a `.precos-lista`): confortável acima de 1060 px,
média acima de 860 e apertada abaixo disso. Só abaixo de **760 px** a linha vira
cartão — e ali cada valor aparece com o nome em cima, então nenhuma coluna some
nem no celular. (A gaveta que ainda restava foi removida na v216.)

**Não existe mais gaveta na linha (v216).** O botão "▾ mais opções" foi
removido: *"não pode aparecer 'mais opções' pra abrir"*. Tudo o que estava
dentro dele saiu para a própria linha:

- a **margem em reais** virou a coluna **Margem**, que agora é campo. Ela mostra
  a margem calculada (verde ou vermelha) e aceita digitação — digitar ali é o
  terceiro jeito de precificar, junto com a `Margem %` e a `Venda desejada`;
- o "Deixar igual ao preço do site" virou um **"desfazer"** miúdo dentro da
  célula da venda desejada, que só aparece na linha marcada "vai para o site".

**Cuidado herdado disso:** a coluna Margem é display e campo ao mesmo tempo,
então quem lê margem desejada tem de usar `margemDesejadaInterna(chave)`, nunca
o que está escrito no campo. O handler do custo lia o campo e, só de digitar o
custo, a margem que estava na tela virava margem desejada e disparava a venda.
Pelo mesmo motivo o `blur` do campo de margem chama `atualizarLinhaFinanceira`
em vez de esvaziar: sem margem desejada guardada, a coluna volta a mostrar a
margem que o preço do site dá hoje.

**O "R$" saiu das células da lista (v215).** É o que fez tudo caber: repetir
"R$" em oito colunas custava ~22 px em cada uma. A tela inteira é dinheiro e o
cabeçalho nomeia cada coluna, então a célula mostra `1.502.665,00`. Vale para os
campos digitáveis também (`dinheiroDaLinha`); `moedaFinanceira` continua com o
"R$" em todo o resto do painel — avisos, confirmações, a gaveta e a tela de INCC.

**Cuidado com a ordem das regras.** As larguras e os corpos de letra de cada
faixa usam o prefixo `.precos-lista` de propósito: sem ele, as declarações
gerais de `.preco-campo` e `.valor-suave`, que vêm depois no arquivo, ganhavam
por ordem e o texto não diminuía — as colunas então estouravam a própria
largura.

**Box vendido vai para uma gaveta recolhida (v223).** Ele não tem o que
precificar e enchia a lista — no Personalité são 60 de 65, no Prime 39 de 40.
Agora fica numa gaveta no fim do empreendimento ("N box vendidos — toque para
ver"), fechada por padrão e que lembra se o dono a deixou aberta. **Só o box
vendido** vai para lá: disponível e alugado continuam na lista, e a unidade
vendida também, em vermelho, como antes.

**A unidade vendida também vai para gaveta (v239).** No Premium Office são 25
vendidas para 9 à venda, e o dono rolava tudo para achar o que ainda vende. Agora
cada empreendimento termina com até três gavetas fechadas, nesta ordem:
**"N apartamentos vendidos"** (ou "N salas vendidas", no comercial),
**"N box à venda"** e **"N box vendidos"** — cada uma lembrando se foi deixada
aberta. A lista solta fica só com o que está à venda.

**Todo box vai para gaveta, não só o vendido (v232).** A v223 recolheu só o box
vendido; o dono pediu o resto também — no Renaissance são 65 box para 43
apartamentos, e a lista de preço é dos apartamentos. Agora cada empreendimento
termina com duas gavetas fechadas, "N box à venda" e "N box vendidos", cada uma
lembrando se foi deixada aberta. A unidade vendida continua na lista, em
vermelho.

**A faixa de "versão antiga" compara painel com painel (v232).** Ela olhava o
`?v=` do `index.html`, que **sobe sozinho a cada publicação do dono** — então
logo depois de publicar a faixa acusava desatualizado e o "Atualizar agora"
recarregava a mesma página: *"to clicando em atualizar e nada acontece"*. Agora
`conferirVersaoDoPainel` lê o `VERSAO_PAINEL` do `admin/index.html` que está no
site e compara com o desta página — a faixa só aparece quando existe mesmo uma
página de painel mais nova.

**O "Todos" conta em apartamento, não em box (v234).** A soma do chip incluía a
garagem e dava 638 — só no Renaissance são 65 box para 43 apartamentos. Agora o
`todos` pula `item.tipo === "box"` (270 no cadastro de setembro). Os outros três
chips continuam contando box de propósito. (A justificativa original era que no
Renaissance o box era venda separada e precisava de custo próprio — **isso
acabou na v246**; os chips seguem contando box para a conferência de cadastro.)

**Três filtros e uma busca (v210)**: `Falta custo`, `Vai mudar de preço` e
`Abaixo do custo`, cada um com a contagem ao lado, refeita a cada tecla
digitada. Com filtro ligado os empreendimentos abrem sozinhos. A linha que vai
mudar de preço ganha faixa amarela na lateral e a marca "vai para o site" — é a
mesma conta da fila de publicação, para a tela nunca dizer uma coisa e o botão
"Publicar no site" outra.

**No celular a linha vira cartão (v210)**, com o nome de cada valor em cima
dele. Não há mais rolagem lateral em tela nenhuma.

**Apagar tudo de um empreendimento só (v238).** Na faixa de cada empreendimento,
em Preços e margem, há **"Apagar tudo do &lt;nome&gt;"**. Ele faz **as duas coisas**,
por decisão do dono: limpa o custo e a margem daquele prédio (aparelho e cofre,
na hora) **e** coloca na fila de publicação a remoção do `preco` de cada item
dele — o preço só sai do ar no "Publicar no site", e ali o painel avisa quantos
vão sair e que as unidades passam a "Sob consulta". Nenhum outro empreendimento
é tocado.

Existe porque só limpar o custo deixava o preço velho no ar: a fila de
publicação só leva preço quando há **venda desejada diferente** do preço atual, e
sem custo não há venda desejada. A remoção é um `tipoOp: "preco-apagar"` — tipo
próprio de propósito, porque `sincronizarPrecosDesejados` refaz as ops `"preco"`
a cada render e apagaria as de remoção junto.

**A limpeza de um prédio não pode virar limpeza geral.** Por isso ela grava
`apagadoPorEmp: { renaissance: "<data>" }`, separado do `apagadoEm` — que zera
tudo em todo aparelho. Na fusão, custo do cofre cujo prédio foi apagado **aqui
depois** do pacote remoto ser salvo é ignorado, e limpeza de prédio vinda do
cofre mais nova que a deste aparelho limpa o prédio aqui, inclusive antes de
qualquer gravação no cofre (`acatarLimpezasPorEmp`).

**Apagar tudo e recomeçar (v220).** Ao lado do "Exportar backup" há
**Apagar tudo**: limpa todos os custos e margens **do aparelho, do rascunho e do
cofre**. Só limpar o aparelho não adiantaria — ao reabrir, a fusão da v190
traria os valores de volta do cofre. Pede confirmação dizendo quantos custos e
quantas margens vão embora e lembrando do Exportar backup; **não mexe em preço
nenhum do site**. Existe porque reimportar por cima só soma, e às vezes o dono
quer começar do zero.

**Onde o custo mora (v176).** Em três lugares, nesta ordem:

1. `senger-admin-financeiro-rascunho` — o que está sendo digitado e ainda não foi salvo. Existe porque fechar a aba sem salvar apagava tudo em silêncio; ao reabrir, o painel recupera o rascunho e continua marcando **Alterações não salvas**.
2. `senger-admin-financeiro-v2` — a cópia salva naquele aparelho (`senger-admin-custos-v1` continua sendo escrita, para os backups v171).
3. **Cofre privado**: o repositório **`sanchaikraemer/senger-financeiro`** (privado), arquivo `financeiro.json`, alcançado com a mesma chave do GitHub do painel. É o que faz o mesmo custo aparecer no celular e em qualquer computador. O painel lê o cofre ao abrir e grava nele ao salvar; se o repositório não existir, ele é criado sozinho como privado. Custo continua **fora** do repositório do site, que é público.

**Uma limpeza vence o cofre (v226).** A fusão da v190 soma os dois lados, então
uma limpeza **nunca ganhava**: o dono apagava tudo, o cofre devolvia na abertura
seguinte, e outra aba aberta com os valores velhos empurrava tudo de volta para
lá. Ele apagou três vezes antes de me dizer isso. Agora o pacote guarda
`apagadoEm`:

- conteúdo do cofre **mais antigo que a última limpeza deste aparelho** é
  ignorado;
- limpeza no cofre **mais nova que o pacote deste aparelho** limpa o aparelho;
- e o aparelho só devolve ao cofre quando é o mais recente (`quandoLocal >=
  quandoRemoto`) — antes uma aba velha ressuscitava tudo.

O "Apagar tudo" confere a conta depois de limpar e avisa em `alert` se ainda
sobrou algo lá, lembrando de fechar as outras abas.

**Por que a limpeza da v226 nunca funcionou (v228).** O `apagadoEm` era gravado
mas **jogado fora na leitura**: `lerPacoteFinanceiro` devolvia só `custos`,
`margensDesejadas` e `salvoEm`. Ao reabrir, o painel achava que nunca se apagara
nada, o cofre vencia e os custos voltavam — e a gravação seguinte ainda apagava a
marca do cofre. O dono apagou dezenas de vezes por causa disso. Agora o
`apagadoEm` é lido junto, e o "Apagar tudo" funciona **mesmo com o aparelho já
vazio** (o que sobrou pode estar só no cofre, que é de onde os valores voltavam).

**Quem não sabe da limpeza limpa a si mesmo antes de falar (v229).** O que
realmente devolvia os custos era **outra aba do painel**, aberta antes do
"Apagar tudo" e com os valores velhos na memória: bastava ela salvar (ou ser
recarregada) para reenviar tudo ao cofre — no dia 10/09 a limpeza foi às
13:37:28 e os 118 custos voltaram às 13:38:20. Agora `acatarLimpezaDaConta`
roda **antes de toda gravação no cofre** e também na abertura: se o cofre traz
um `apagadoEm` mais novo que o desta aba, a aba se limpa (aparelho, rascunho e
tela) e só então grava. A limpeza vence inclusive digitação em andamento — era o
`financeiroSujo` que fazia o painel nem olhar o cofre.

**Era o "Descartar" que devolvia os custos (v230).** A correcão do INCC guarda
um retrato dos custos (`financeiroAntesDaPrevia`) para o "Descartar" poder voltar
atrás. O "Apagar tudo" não apagava esse retrato: bastava clicar em **Descartar**
depois de apagar e os custos voltavam inteiros à tela, ao aparelho e ao cofre no
salvamento seguinte. Foi o que aconteceu em 10/09 — limpeza às 13:37:28, 118
custos de volta às 13:38:20. Agora o "Apagar tudo" esquece o retrato junto.
(Reproduzido no Chromium antes e depois: antes voltavam 18 de 18; depois, zero.)

**Os dois lados se juntam, nunca se apagam (v190).** Ao abrir, o painel funde o cofre com o que está no aparelho: custo lançado aqui e custo lançado lá somam, e quando o mesmo item tem valor dos dois lados vale o do pacote com `salvoEm` mais recente. Se o aparelho tinha algo que faltava no cofre, ele devolve para o cofre na hora. Isso evita o acidente clássico: abrir num computador com poucos custos e apagar os de todos os outros. Digitação em andamento nunca é atropelada pelo cofre. Se a chave não tiver permissão para o repositório privado, nada quebra: os custos ficam no aparelho e a tela explica, apontando o **Exportar/Importar backup**.

A linha de status diz a verdade — `X de Y itens com custo ✓ · salvo em dd/mm/aaaa`, ou "Nenhum custo guardado neste aparelho". O antigo "Dados salvos neste computador ✓" aparecia mesmo com a tabela vazia.

**O vendido continua na tabela (v181).** A tabela financeira mostra o prédio inteiro: os vendidos vão para o fim da lista, em vermelho e com a situação "Vendido". Eles ficam **fora** da conta `X de Y itens com custo` — não há mais o que precificar — e o cabeçalho do empreendimento diz "N itens à venda · M vendidos".

**Nenhum empreendimento tem mais box de venda separada (v246).** O Renaissance
era o único com `boxSeparado: true`; o dono embutiu o valor do box no custo de
cada apartamento (1 box simples R$ 74.000, 1 duplo R$ 121.000, e os "3 suítes
superiores" levam os dois), então o box lá deixou de ter valor próprio. A marca
foi removida do `data.js` e **o campo de custo sumiu da linha do box** — em
qualquer empreendimento, box que já está no preço do apartamento mostra só a
situação e o aviso "já incluso no preço do apartamento". Pedir custo ali era
convidar a contar a garagem duas vezes. Se algum box tiver custo guardado de
outra época, ele aparece como texto, para não ficar preso invisível.

> **REGRA ANTIGA — substituída por "Garagem do Renaissance", em REGRAS ATUAIS.**
> Desde a v246 NENHUM empreendimento vende box à parte: no Renaissance o valor
> do box foi embutido no custo do apartamento e `boxSeparado` não existe mais.
> Leia o parágrafo abaixo como história, não como instrução.

**Os box entram na tabela financeira (v180), só onde são venda separada (v185).** No **Renaissance** o box tem valor próprio e é vendido à parte — lá o `data.js` marca `boxSeparado: true` no empreendimento e guarda `preco` no box (interno; o site não lê `boxes`), e a tabela financeira lista unidades **e** box, com coluna **Situação** e a marca simples/duplo. Em **todos os outros empreendimentos o box já está dentro do preço do apartamento**: ele aparece na tabela (v187) depois das unidades, com a situação Disponível/Vendido e a frase "Já incluso no preço do apartamento" no lugar dos valores — assim o dono acompanha o que está livre sem que a garagem entre duas vezes na conta. Esses box ficam fora de `X de Y itens com custo`, e o cabeçalho do empreendimento os anuncia à parte: "14 itens à venda · 19 vendidos · 36 box no preço".

**A tipologia aparece embaixo do nome (v205).** Na tabela financeira, cada
unidade mostra em letra miúda a tipologia em que ela conta — "Apto 404 · 2
dormitórios (1 suíte)" — antes do box que foi junto. Só pelo número do
apartamento o dono não sabia se estava precificando um 2 ou um 3 dormitórios. O
texto vem de `estoque` (na unidade ou no grupo) e cai para `grupo.tipo`; o box
não recebe tipologia, continua com a marca simples/duplo.

**Quem levou qual box (v188).** Na tabela financeira, embaixo do nome, a unidade lista os box que foram com ela ("Apto 803 · Box 104") e o box mostra a unidade que o levou ("Box 104 · Apto 803"). A ligação vem do campo `apto` do box no `data.js` — vale para vendidos e disponíveis, e sai sozinha quando o campo está vazio. **O Evolutti é o único sem esses vínculos preenchidos.**

**Importar backup** entra com o **custo exato**, no centavo, sem arredondar
nada (regra do dono, 14/09/2026). Ele reconhece a linha pelo código interno e, se ele mudou, pelo nome da unidade — sempre **dentro do mesmo empreendimento e do mesmo tipo** (`u`, `b`, `t`, `o`), para o Box 101 nunca virar o Apto 101 nem o 401 de outro prédio. A importação só preenche a tela (fica "Alterações não salvas"); quem grava é o dono, no botão. Embaixo dos botões fica uma linha fixa dizendo quantos custos entraram, quantos não têm correspondência, ou o motivo da falha.

**A venda desejada vira o preço do site (v202).** Custo e margem são internos e
não vão para lugar nenhum. A **venda desejada**, porém, é preço: toda vez que ela
fica diferente do preço que está no ar, isso já entra na fila de publicação
(`tipoOp: "preco"`) e o **"Publicar no site"** acende sozinho — **não há um
segundo botão**. As v200/v201 tinham um "mandar para o site" separado, que o dono
leu, com razão, como dois botões para a mesma coisa.

**Publicar já salva o que foi digitado (v203).** Não há ordem de botão para
acertar: "Publicar no site" grava antes o custo e a margem no aparelho e no
cofre, e só então mexe no site. "Salvar custos e margens" continua existindo
para quem quer guardar só o que é interno, sem mudar preço nenhum.

Acima da tabela financeira uma faixa avisa quantos itens estão diferentes. Ao
clicar em "Publicar no site", o painel lista o que vai mudar (de → para) e só
grava depois do "ok". **Descartar** também vale para o preço, senão ele voltaria
sozinho na linha seguinte; ele reaparece assim que a venda desejada mudar de
valor. Ficam de fora o vendido, o box que já está no preço do apartamento e o
item cuja venda desejada é igual ao preço atual. A gravação é textual
(`aplicarPreco`), pela mesma chave do resto do painel, e mexe só na linha do item.

## Materiais obrigatórios por empreendimento

O padrão comercial é o mesmo para todos os empreendimentos reais (o agrupador `outros` não entra nessa regra):

- `folder` — exatamente um folder em PDF por empreendimento;
- `video` — exatamente um vídeo oficial por empreendimento.

O painel possui uma **Central de Materiais** que administra também capa, logo, fotos de galeria e plantas. Os uploads novos vão para pastas organizadas por empreendimento (`assets/<id>/...`), sem migrar ou quebrar os caminhos antigos.

Padrões informados e validados no painel:
- capa: WEBP/JPG/PNG, 1600×900 px, até 5 MB;
- galeria: WEBP/JPG/PNG, 1600×900 px, até 5 MB por foto;
- planta: WEBP/JPG/PNG, 2000×2000 px, até 6 MB;
- logo: PNG/WEBP, 1600×600 px, até 3 MB;
- folder: PDF, até 25 MB;
- vídeo: MP4/WebM/Ogg, recomendado 1920×1080, até 80 MB, ou YouTube/Vimeo.

A galeria permite adicionar várias fotos, editar legenda, reordenar e remover referências. A planta é anexada diretamente na tipologia/unidade; ao publicar, o painel atualiza a galeria e o campo `planta` correspondente no `data.js`.

O botão “Baixar folder” e a seção de vídeo só aparecem no site quando o respectivo campo está preenchido.

## O PDF do portfólio é a lista (v208)

O botão "Gerar PDF / imprimir" da home monta **uma página por empreendimento com
todas as unidades** — tipologia, área, situação e valor, mais lotes e os imóveis
de `outros`. As tabelas vêm de `tabelasDeUnidades(emp)`, a mesma função que a
folha de um empreendimento usa.

Antes da v197 saía só o "a partir de" de cada prédio; a v197 juntou os cartões
e a lista, e a v208 tirou os cartões: o corretor leva a tabela, não a vitrine.

## O "Toque para ver maior" fugia da planta no celular (v236)

O badge é `position: absolute` dentro do visor da planta. No computador o visor
é `sticky`, que serve de referência; abaixo de 720 px ele virava `static` (para
desligar o sticky) e **deixava de ser referência** — o badge subia sozinho para
o alto da página, ficava por cima do texto da apresentação e, como tem
`pointer-events: none`, não abria nada ao toque. Agora a regra do celular usa
`position: relative`: desliga o sticky do mesmo jeito e continua sendo a
referência. Vale a regra geral: **nunca troque um `sticky`/`relative` por
`static` num elemento que tem filho absoluto.**

## O celular ganhou três layouts escolhidos pelo dono (v237)

Mostrei quatro modelos de cada parte em imagem e ele escolheu; o que está no ar
é a escolha dele, não a minha.

- **Características (`info-differentials`)** — modelo "só o ícone": ícone verde
  (`--verde: #2fb39a`) à esquerda, título e frase à direita, sem quadro nenhum, e
  **duas colunas no celular** (antes virava coluna única). O ícone sai de
  `iconeDeDiferencial()`, que escolhe **por palavra do título**, nunca por lista
  fixa: são 34 títulos no `data.js` e o dono inventa outros, então título novo
  cai numa estrela e nada quebra.
- **Resumo comercial (`fact-grid`)** — modelo "preço em destaque": no celular a
  grade vira uma coluna, o quadro do preço (`.fact-card.destaque`, marcado no
  `app.js`) sobe para o topo (`order: -1`) num bloco `--brand-soft` com o valor
  grande, e Etapa e Registro viram linhas rótulo→valor.
- **Unidades e valores (`unit-group-header`)** — modelo "uma linha só": no
  celular o cabeçalho deixa de ser a faixa colorida e vira cartão branco, as
  etiquetas de metragem viram texto miúdo separado por "·", o "a partir de" fica
  à direita e o "Ver unidades" escrito dá lugar só à setinha. Cabem cinco
  tipologias numa tela, contra uma e meia.

**O `nowrap` das medidas quase estragou tudo (v249).** Para "1 box simples" não
quebrar no meio, cada medida ficou `white-space: nowrap` — mas o separador "·"
mora dentro do próprio span, então **não sobrava nenhum ponto de quebra na
linha**: ela virava uma palavra só, estourava a caixa e o texto passava por cima
do preço no celular. O conserto é deixar só o separador fora do nowrap
(`span + span::before { white-space: normal }`).

**Cuidado: há dois `@media (max-width: 720px)` no `styles.css`.** O segundo (o
que vem depois de `.unit-result-foot`) é o que manda nas regras repetidas — foi
ele que continuou empilhando o cabeçalho depois da primeira tentativa.

## Fotos

As fotos ficam em **webp** (`assets/`), que é bem mais leve no 4G do corretor na
rua. Duas exceções, de propósito:

- `assets/preview/*.jpg` continua **JPEG** — é a imagem que o robô de prévia do
  WhatsApp e do Facebook lê, e ele não trata webp de forma confiável.
- Toda foto que **sai** do site para o cliente (compartilhar, "Baixar") é
  reconvertida em JPEG na hora, pelo `comoJpeg()`. O WhatsApp trata webp como
  **figurinha**: a foto do empreendimento chegaria como sticker.

## As duas visões do portfólio

O cliente pergunta em apartamento; a vitrine responde em prédio. Por isso o
corretor tem um alternador **Prédios / Unidades** na barra de resultados:

- **Prédios** — a vitrine de sempre. Com filtro de unidade ligado, o cartão diz
  quantas unidades combinam e o "a partir de" passa a ser o menor preço
  **entre elas**, não do prédio inteiro.
- **Unidades** — os apartamentos de vários empreendimentos numa lista só.

Os filtros de dormitórios, faixa de valor e busca são conferidos **na mesma
unidade**: antes bastava existir alguma de 2 dormitórios e alguma na faixa de
preço, ainda que fossem unidades diferentes.

No link do cliente a visão é sempre a de empreendimentos, do jeito que ele
recebeu.

## Tipologias iguais viram um quadro só (v213)

Quando dois grupos do `data.js` têm **o mesmo tipo, a mesma metragem, a mesma
garagem e a mesma observação**, a vitrine mostra **um quadro só**, com o "a
partir de" sendo o menor preço entre todas as unidades dos dois. É o caso do
**Evolutti**, onde a coluna do final 3 e a do final 4 são grupos separados mas o
mesmo produto: o cliente via "2 dormitórios (1 suíte)" duas vezes seguidas, com
preços diferentes, como se fossem apartamentos distintos.

A junção é **só na hora de mostrar** (`blocosDeTipologia`, no `app.js`), e vale
para a vitrine e para o PDF. O `data.js` continua com os grupos separados de
propósito: é por eles que o painel confere a garagem de cada coluna, e cada
unidade guarda a sua própria planta e a sua própria área. No quadro que juntou,
as unidades saem em ordem de número (503, 504, 603, 604…) em vez de uma coluna
inteira depois da outra.

**Os quadros também saem em ordem, não na ordem do cadastro (v261).** Antes
eles seguiam a ordem dos grupos no `data.js` — a ordem em que o dono cadastrou,
não a que o cliente espera ler. No Renaissance isso fazia a Casa Suspensa de
3 suítes superiores (1301, 1302) aparecer logo depois da de 3 suítes frente
(401, 402), porque são os dois primeiros grupos do cadastro. Agora os quadros
saem pelo **menor número de apartamento** de cada um, crescente, e só quando
empatar decide o **menor valor**, também crescente. Vale para todos os
empreendimentos.

**O sufixo diz de qual final é a tipologia (v213).** O campo `sufixo` do grupo
aparece ao lado do nome, em letra mais leve: "Sala comercial · final 01".
No **Premium Office** havia cinco "Sala comercial" seguidas e só pela metragem
não se sabia de qual coluna do prédio cada uma era; lá o segundo pavimento
também é anunciado ("Salas comerciais · 2º pavimento"). O sufixo entra na
assinatura da junção — duas tipologias com sufixos diferentes nunca se juntam.

## O quadro de unidades é uma gaveta

Cada tipologia (e, no loteamento, cada quadra) é um `<details>` que abre ao
toque. O Renaissance tem sete tipologias e 49 apartamentos: numa lista só, achar
o que o cliente pediu era rolar sem fim. Fechadas, as tipologias cabem numa
tela — 51% menos rolagem no Renaissance, 74% no loteamento.

O cabeçalho mostra a tipologia, as áreas e **a partir de quanto** — nunca
quantas unidades há, que a v107 tirou do site de propósito.

Já abre aberta quando há **uma tipologia só** (não há o que escolher) ou no
**link do cliente** (ele recebeu unidades escolhidas, não um catálogo). Link de
unidade (`?u=`) e unidade aberta pela lista abrem a gaveta certa antes de rolar
até ela — sem isso a linha não tem posição na tela. O PDF sai sempre completo:
a folha é montada à parte, fora do quadro.

## O corretor dentro do link

Os dados de "Meu contato" ficam no aparelho do corretor; a página que o cliente
abre é a mesma, rodando no aparelho **dele**, que não sabe quem enviou. Então
nome, WhatsApp e CRECI viajam no próprio endereço (`c=`, `w=`, `cr=`) e viram o
botão verde **"Falar com…"** fixo na página do cliente. Sem `w=` no link, o
botão não aparece.

## Movimento do portfólio

O site **anota sozinho e não mostra nada**: cada empreendimento aberto, imóvel
enviado ao cliente e PDF gerado soma na chave `senger-uso` do aparelho
(`registrar()`, no `app.js`). Quem **mostra** é o painel administrativo, e só
ele — o portfólio é página aberta, e movimento de venda não se expõe. Painel e
site vivem no mesmo endereço, então o painel lê a mesma chave.

A conta é sempre **daquele aparelho**: não há servidor no meio, e o que os
corretores fazem fica no celular de cada um.

## Metragens no site

Sempre **truncadas**, nunca arredondadas para cima: 99,6188 m² vira "99 m²", e
73,665 m² vira "73 m²". O site nunca anuncia área maior que a real.

## Antes de publicar: nunca passe por cima do painel

O dono publica correções de INCC e de preço pelo próprio painel, direto na
`main`. Uma branch de trabalho aberta antes disso carrega um `data.js` velho, e
um merge desatento devolve a tabela antiga ao ar — foi o que aconteceu na v197,
que trouxe agosto de volta depois de setembro já publicado, deixando os preços
abaixo do custo.

Então, **em todo merge e em toda publicação**, antes de mandar para a `main`:

1. `git fetch origin main` e comparar o `data.js` do trabalho com o da `main`:
   `git diff origin/main -- data.js`.
2. Se aparecer diferença em `META` (mês da tabela, INCC, histórico) ou em
   `preco` sem que a tarefa fosse mexer nisso, **a versão certa é a da `main`** —
   é publicação do dono. Traga a dela (`git checkout origin/main -- data.js`) e
   refaça só o que a tarefa pedia.
3. Depois do merge, conferir de novo no que ficou na `main`: mês da tabela,
   valor do INCC, tamanho do `historicoIncc` e um preço conhecido.
4. Resolver conflito com `--ours`/`--theirs` sem olhar é proibido; sempre
   `grep -c "<<<<<<<" ` nos arquivos tocados e ler o `data.js` resultante.

Custo e preço vivem separados: o custo corrigido pelo INCC continua no cofre
mesmo quando o preço volta atrás, e é isso que faz a margem aparecer negativa.
Margem negativa depois de uma publicação é sinal de tabela errada no ar, não de
custo errado.

## O painel diz a própria versão (v227)

O número no alto do painel vinha do `index.html` lido pela API — ou seja, **do
site**, não da página aberta. Uma cópia velha guardada pelo navegador se
anunciava como nova, e o dono passou horas mexendo numa tela antiga achando que
o sistema não obedecia ("apaguei três vezes e não apaga").

Agora `admin/index.html` traz **`VERSAO_PAINEL`**, que é o que aparece no
cabeçalho e no rodapé. Quando o site está numa versão maior que a da página,
uma faixa amarela avisa e oferece **Atualizar agora** (recarrega com
`?atualizar=<hora>`, que obriga o navegador a buscar a página nova).

**O botão confere o site antes de recarregar (v235).** A faixa lê o repositório
pela API, que muda na hora; a página vem do GitHub Pages, que leva 1 a 2 minutos
para subir. Nesse intervalo o dono clicava, a mesma página voltava e a faixa
reaparecia — *"clico em atualizar e nada acontece"*. Agora o botão busca a
própria página no site (`?conferir=<hora>`, `no-store`), lê o `VERSAO_PAINEL`
dela e só recarrega quando a nova chegou; enquanto não chegou, a faixa diz que o
site ainda está publicando e para esperar.

**Ao publicar qualquer mudança no painel, suba o `VERSAO_PAINEL` junto com o
`?v=` do `index.html` e o `CACHE` do `sw.js`.** Se esquecer, a faixa passa a
acusar desatualizado sem motivo.

## Painel administrativo

- A senha é comparada por hash SHA-256; o token do GitHub fica no `localStorage`
  do aparelho.
- As alterações ficam pendentes (`estado.ops`) e só vão para o `data.js` quando
  o dono clica em "Publicar no site". Arquivos novos são enviados ao GitHub primeiro e o `data.js` só passa a apontar para eles depois do upload.
- A gravação é **edição textual** do `data.js`, não regravação do objeto, para
  preservar comentários e formatação. Ver `aplicarStatus`.
- Ao publicar pelo painel, a versão do cache (`?v=` no `index.html` e o `CACHE`
  do `sw.js`) sobe sozinha — ele lê o número atual e soma 1. Alteração feita
  direto no repositório precisa subir o número à mão, antes do merge.
- Cada empreendimento tem abas Disponíveis / Vendidos / Alugados / Todos, que
  filtram unidades e box juntos.
- **Em Estoque / Unidades, "Todos os empreendimentos" mostra todos (v247).**
  Antes ele escondia os dez e deixava na tela só a frase "toque em um
  empreendimento acima" — sem nada acima para tocar: a tela ficava vazia e sem
  serventia. Agora "Todos" lista os dez fechados e o dono abre o que quiser;
  escolher um no seletor continua mostrando só ele, já aberto.
- O cartão mostra o estoque por tipologia. O rótulo vem de `estoque` (na
  unidade ou no grupo) e cai para `grupo.tipo` quando não há — é assim que as
  Casas Suspensas do Renaissance contam junto com o andar delas.
- `vagasPorTipologia` liga cada rótulo de estoque aos box que a unidade leva, e
  o painel confere se a garagem fecha. **A conta é em box, não em vagas**: um
  box duplo tem as duas vagas uma atrás da outra e vai inteiro para um
  apartamento só — nunca se reparte entre dois. Somar vagas soltas dá um número
  que parece fechar sem fechar.
- A aba dos box mostra, quando há, o que **falta preencher no cadastro**: box
  vendido sem a unidade que o levou, unidade vendida sem box vinculado, box sem
  área. É por aí que se vê o que ainda precisa de planta ou tabela.
- A troca vale **dos dois lados**, decisão do dono: faltando box duplo, dois
  simples fazem o lugar dele; faltando box simples, um duplo faz o lugar dele
  (passa uma vaga, mas o apartamento sai com garagem). **Só falta garagem quando
  acaba o box** — box duplo sobrando nunca é falta.

## Testar o painel

> **REGRA ANTIGA — substituída por "Validação e testes", em REGRAS ATUAIS.**
> Desde a v301 há, sim, duas suítes: `node tools/validar.js` e
> `node tools/testar-navegador.js`. O parágrafo abaixo descreve o arranjo
> manual que elas automatizaram — continua útil para entender como o painel é
> exercitado sem token de verdade.

Não havia suíte de testes. Para exercitar o painel sem token de verdade, carregue
`admin/index.html` no Chromium (Playwright) interceptando `https://api.github.com/**`
e devolvendo os arquivos locais em base64, com
`sessionStorage["senger-admin-ok"]="1"` e um token qualquer no `localStorage`.

Vale sempre conferir duas coisas: que a rotina de publicação altera o item certo
sem tocar nos vizinhos, e que o site público continua sem mostrar o que é só do
painel.

### Financeiro interno (v173)
- Em Correção pelo INCC, custos e margens desejadas são dados privados do painel e não entram no `data.js`/site público.
- O usuário edita custo e margem extra desejada por item; antes de gravar, o painel mostra **Alterações não salvas** e alerta ao fechar a aba.
- **Não existe mais o botão "Salvar custos e margens" (v260).** Ele e o "Publicar
  no site" faziam quase a mesma coisa — o dono chamou isso de dobrar trabalho à
  toa. Agora só **Publicar no site**: ele grava o custo e a margem digitados e,
  se a venda desejada mudou, publica o preço novo também. Antes o botão ficava
  desabilitado quando só havia custo editado (sem preço novo na fila), o que
  obrigava usar o "Salvar" — agora ele acende também quando há alteração
  financeira sem preço pendente. Publicar sem nenhum preço na fila **não sobe
  versão no site**: só guarda o financeiro, para não gastar um número de versão
  à toa.
- `Margem extra atual = preço de venda atual - custo`; `Venda desejada = custo + margem extra desejada`.
- **Margem desejada e venda desejada são os dois editáveis (v192)** e conversam entre si: digitar a venda calcula a margem (`venda − custo`), digitar a margem calcula a venda. O que fica guardado é sempre a **margem** — backup e cofre não mudam de formato. Venda abaixo do custo grava margem negativa, de propósito; sem custo lançado, o painel avisa em vez de adivinhar.
- **A correção aparece no painel na hora (v224).** Antes, "Aplicar correção" só
  anotava: preços e custos continuavam os antigos na tela até publicar, e o dono
  reclamou com razão — *"tem que corrigir no sistema primeiro"*. Agora, ao
  aplicar, o painel já mostra tudo corrigido: os preços a partir de um retrato
  do que veio do arquivo (`precosOriginais`) e os custos e margens a partir de
  um retrato do que estava guardado (`financeiroAntesDaPrevia`). **Descartar
  desfaz os dois lados.** Publicar continua sendo o único passo que mexe no
  site — e, como a prévia já corrigiu custo e margem, o publicar não corrige de
  novo: ele só grava.
- **A correção do INCC também corrige os custos (v195).** O custo sai da tabela do mês; ao publicar a correção, o painel multiplica `custos` e `margensDesejadas` pela mesma variação, grava no aparelho e manda para o cofre. O aviso diz quantos foram corrigidos. Sem isso a margem apareceria maior sem ninguém ter ganhado nada.
- **Novo INCC e variação são os dois editáveis (v193)** e conversam: informar o novo índice calcula a variação sobre `META.incc.valor`, e informar a variação calcula o novo índice (`anterior × (1 + pct/100)`, arredondado ao centavo). Apagar a variação limpa o novo índice.
- Backups financeiros v2 levam `custos` e `margensDesejadas`; backups/custos legados v171 continuam importáveis.


### INCC e histórico (v173)

> **REGRA ANTIGA — substituída por "Dinheiro: custo, preço e arredondamento",
> em REGRAS ATUAIS.** Os dois itens abaixo descrevem o arredondamento incidindo
> sobre o CUSTO. Desde a v301 é o contrário: **custo sempre exato, e o
> arredondamento vale só para o preço de venda.** Não reviva o comportamento
> antigo.

- **O arredondamento voltou, e o padrão é o R$ 100 mais próximo (v254).** O dono
  pediu de volta ("quero de volta aquele negócio de arredondar para os 100,00
  mais próximo"): o seletor, escondido na v225, reaparece na tela do INCC com
  cinco opções — R$ 100 / R$ 1.000, mais próximo ou para cima, e o valor exato.
  Ele arredonda o **custo e a margem** corrigidos (`arredondarValor`), nunca o
  preço do site: com os dois em valor redondo, a venda desejada também sai
  redonda. **O perigo da v207 não se repete aqui**, porque ali o arredondado era
  o preço enquanto o custo seguia exato — agora a margem é calculada em cima do
  custo já arredondado. A pré-visualização mostra o custo novo já arredondado e
  o resumo diz qual arredondamento está valendo.
- **O arredondamento era sempre para cima (v207, valia para preço)**, em R$ 100 (o padrão) ou R$ 1.000.
  Arredondar para o "mais próximo" jogava o preço para baixo do valor corrigido —
  o custo sobe pelo INCC sem arredondar, então 43 unidades ficaram de R$ 5 a R$ 30
  **abaixo do custo** depois da correção de setembro, e a margem apareceu
  negativa. A correção do mês nunca pode diminuir a margem.
- O painel lembra a escolha do aparelho: antes voltava sozinho para R$ 1.000 a
  cada abertura, mesmo depois do dono ter escolhido outro (v199).
- O campo de novo INCC usa formatação monetária brasileira com duas casas decimais.
- A variação mensal é calculada automaticamente e o painel mostra também a variação anterior.
- A data da tabela usa input de data real; ao publicar, grava dd/mm/aaaa.
- META.historicoIncc guarda mês, data, valor e variação de cada correção publicada.
- A tela de Preços e margem não tem rolagem horizontal: no computador é uma grade de sete colunas em qualquer largura, e abaixo de 760 px um cartão por item.
