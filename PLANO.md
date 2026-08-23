# Perfect Finish Studio — plano de construção

Estúdio de customização premium em Leiria. Site estático no GitHub Pages, backoffice
no Pages CMS, orçamento zero.

Este ficheiro é o plano e o registo das decisões. O que está feito fica marcado; o que
depende do cliente fica em **PENDENTE** com a razão.

---

## O que este site tem de resolver

O cliente pediu: navegação simples, pouca informação, informação directa, visual
premium. E disse que os sites anteriores eram básicos demais.

Isso não é contraditório — é a definição de design de luxo: tirar tudo o que não é
preciso e tratar muito bem o que fica. O que separa este site de um modelo genérico não
são mais secções, são **quatro decisões**:

1. **O herói não tem fotografia.** Tipografia dourada sobre escuro. É o LCP mais rápido
   possível, contorna o problema das fotografias pequenas (ver abaixo) e recusar mostrar
   um carro é o sinal de confiança mais forte que há.
2. **Comparador antes/depois** como interacção central — é o que o negócio faz.
3. **Índice de serviços numerado**, não uma grelha de cartões.
4. **Uma única faixa clara** no site inteiro, para o escuro ter contra-campo.

---

## Restrição descoberta na análise (importante)

As **288 fotografias estão todas a 414×414 px**. São as miniaturas que o Instagram e o
Facebook servem, não os originais do telemóvel. Consequências:

- Não há herói de largura total com fotografia — a 1920 px seria uma ampliação de 4,6×.
- A grelha é toda quadrada, servida no máximo a 828 px (2×414, com Lanczos + máscara de
  nitidez, que se lê melhor do que deixar o browser ampliar).
- **PENDENTE:** pedir ao cliente os originais. Com eles, muda-se a pasta de origem,
  corre-se `scripts/imagens.py` outra vez e o herói pode passar a ter fotografia.

O acervo em si é excelente: Ferrari Roma, Rolls-Royce Wraith, Porsche 911 (992 e
Targa 4 GTS), Maserati Ghibli, Lotus Emeya, Audi e-tron GT, Mercedes-AMG CLA 45 S,
Ford Mustang Dark Horse. Isso posiciona o site.

---

## Passos

### 1. Marca e matéria-prima — FEITO
- [x] Logótipo extraído em **vector** do PDF do cliente (`scripts/logotipo.py`).
      Conjunto completo, símbolo e assinatura, com os gradientes originais.
      Nada foi redesenhado.
- [x] Favicon e imagens sociais a partir do vector (`scripts/favicons.py`).
- [x] **Dourado medido no próprio logótipo**, nos píxeis interiores (as bordas
      suavizadas enganam a leitura e puxam a cor para cima):
      `#7A571D` → `#8B6926` → **`#AC8A39` (corpo)** → `#CBAD4F` → `#D4B756` (reflexo).
      O `#D4B756` é só o brilho máximo — ocupa 6,6% da área. Usá-lo como cor principal
      deixava o site amarelo. O preto é `#231F20`, o preto quente do logótipo.
- [x] 288 fotografias → 257 únicas → agrupadas em **31 trabalhos** por proximidade dos
      identificadores das publicações (um álbum = um carro).
- [x] Selecção curada: 18 trabalhos, 5 pares antes/depois honestos, 63 imagens.
- [x] **RGPD:** matrículas e rostos localizados imagem a imagem e tapados no ficheiro,
      não por CSS (`scripts/imagens.py`). Verificado por leitura adversária.
- [x] Tipos de letra alojados no próprio site (Archivo Expanded + Inter Tight,
      subconjunto latino, 79 652 B no total). Sem pedidos ao Google.

### 2. Sistema de desenho — FEITO
- [x] `assets/css/` — fichas de cor, escala tipográfica, espaçamento, componentes.
- [x] Ouro como tinta só sobre escuro. Na faixa clara o texto é escuro; ouro só em
      filetes e números decorativos (`#D4AF37` sobre claro dá 1,86:1 — ilegível).
- [x] Movimento todo dentro de `@media (prefers-reduced-motion: no-preference)`.

### 3. Gerador e páginas — FEITO
- [x] `scripts/gerar.mjs`, Node sem dependências. Sem `npm ci` no GitHub Actions:
      nada para instalar, nada para partir daqui a seis meses.
- [x] 13 páginas: início, índice de serviços, 4 páginas de serviço, trabalhos, loja,
      contactos, 3 páginas legais, 404.
- [x] `scripts/auditar.mjs` — trava a publicação se houver ligações partidas, imagens
      em falta, contraste mau, aviso de custo de chamada em falta ou sitemap incoerente.

### 4. Backoffice — FEITO
- [x] `.pages.yml` para o Pages CMS 2.1.8, com `settings.content.merge: true`
      (o valor por omissão apaga campos não mapeados).
- [x] Ligação **«Gestão»** no rodapé, a seguir ao Livro de Reclamações.

### 5. Avaliações do Google — PARCIAL
- [x] Nota real (4,9 ★ · 94 avaliações) e ligação directa ao perfil.
- [x] `worker/` — o Cloudflare Worker pronto a publicar, que traz as avaliações em
      directo sem as guardar em lado nenhum.
- **PENDENTE (cliente):** conta Cloudflare + chave da Places API. Sem isso o bloco
      mostra a nota e a ligação; com isso passa a mostrar as avaliações.
- **Não** se copiam os textos das avaliações para o repositório: os termos da Google
      proíbem-no expressamente («copy and save … user reviews»), e num repositório
      público ficaria para sempre no histórico.

### 6. Lei — FEITO, com dependências
- [x] DL 7/2004 art. 10.º, Livro de Reclamações, RAL (CNIACC), aviso de custo de
      chamada em todos os números, política de privacidade, aviso das películas,
      garantias, loja como montra (cenário B, sem venda à distância).
- [x] **Sem plataforma ODR** — o Regulamento (UE) 524/2013 foi revogado a 20-07-2025.
- [x] **Sem capital social**: o NIF 316614610 começa por 3, é pessoa singular, logo
      empresário em nome individual e o art. 171.º do CSC não se aplica.
- **PENDENTE (cliente):** e-mail (obrigatório por lei, o WhatsApp não cumpre), nome
      civil completo do titular, e confirmação do código postal.

### 7. SEO — FEITO
- [x] 4 páginas de serviço para as 4 intenções comerciais distintas, sem páginas por
      localidade (seriam páginas-porta).
- [x] JSON-LD: `LocalBusiness` (`AutoBodyShop` + `AutoWash`), `WebSite`, `WebPage`,
      `BreadcrumbList`, `Service`. **Sem** `AggregateRating`, `Review`, `FAQPage`
      nem `Product` — ou violam a política, ou já não dão resultado nenhum.

### 8. Publicação — FEITO
- [x] GitHub Actions → GitHub Pages, com a auditoria a travar antes de publicar.
- [x] Verificado a 390 px e a 1440 px por captura de ecrã, não por medição.

---

## Decisões que vale a pena não esquecer

**Gerador sem dependências, e não Eleventy.** A pesquisa recomendava Eleventy pelo
tratamento de imagens no build. Mas as fotografias já estão tratadas, e um `npm ci` no
Actions é uma coisa que parte sozinha com o tempo. O travão fica na auditoria: avisa
alto se alguém carregar uma fotografia grande pelo backoffice.

**Sem biblioteca de scroll suave.** Parte o `position: sticky`, o botão de voltar, o
Cmd+F e a navegação por teclado. `scroll-behavior: smooth` nas âncoras chega.

**Sem vermelho.** É a cor por omissão do sector (Topaz, WrapStyle, Novitec, Brabus).
Ouro e preto quente, e mais nada.

**Aviso de cookies.** O site não põe cookies nenhuns. O aviso existe porque o cliente o
pediu e porque **serve mesmo para alguma coisa**: é o que autoriza carregar o mapa do
Google. Sem autorização o mapa fica um cartão estático com ligação.


---

## Segunda volta — o que o cliente apontou (23-08-2026)

**O defeito grave: nada era clicável.** O `<dialog>` da lupa tinha `display:
grid` no elemento. O navegador esconde um `popover` fechado com `display:
none`, e uma regra do autor ganha a essa — ficava um painel de ecrã inteiro,
invisível, a comer todos os cliques. Explicava por si só os botões e as
fotografias «que não funcionam». O `display` passa a existir só no estado
aberto.

**Landing page.** Serviços, Trabalhos e Contactos passam a ser secções da
página inicial (`#servicos`, `#trabalhos`, `#contactos`). A Loja é a única que
muda de página. As páginas `/servicos/<slug>/` continuam a existir e no
sitemap — é por elas que entra quem pesquisa o serviço no Google — só saíram
do menu.

**Tipo de letra.** O Archivo estava em largura expandida (`font-stretch: 125%`)
e com tracking até `.4em`. Passou a largura normal e o tracking caiu para
`.14em` nos sobrescritos, `.04em` nos botões e negativo nos títulos. Era isso
que fazia as palavras parecerem esticadas.

**Imagem de fundo na capa.** Não podia ser uma fotografia esticada: com
originais de 414 px, chegar a 2560 px é ampliar seis vezes. `scripts/capa.py`
compõe um mosaico onde cada peça fica ao tamanho quase nativo, com
escurecimento inclinado gravado na imagem, foco dourado e vinheta. 22 kB em
AVIF.

**«Como trabalhamos» removida.** O texto do «sobre» que vivia no cabeçalho
dessa secção passou para a abertura de «O que fazemos», para não ficar órfão.

**«O que fazemos» refeita.** Era um índice numerado com miniatura ao passar o
rato — elegante, mas obrigava a ler linha a linha e a miniatura só existia no
computador e só com o rato em cima. Passou a cinco cartões com fotografia,
sempre visíveis, duas colunas no telemóvel.

**Avaliações do Google.** As críticas reais do perfil estão no site
(`data/avaliacoes.json`), com nome próprio e inicial do apelido e sem
fotografias de perfil — o mínimo de dados pessoais para continuar credível. O
Worker continua a ser o caminho preferido e, quando ligado, passa a mandar nos
números.

**Botão de WhatsApp** fixo no canto inferior direito, em todas as páginas.
Sobe quando o aviso de cookies está no ecrã e desaparece com o menu aberto.

### Responsividade: dois transbordos reais, encontrados a medir

Testado em `iframe` a 320, 360, 390, 430, 600, 768, 834, 1024, 1280, 1440 e
1920 px, em seis páginas.

1. **`dl.dados` com 427 px num ecrã de 305.** `grid-template-columns: auto 1fr`
   — e um `1fr` é `minmax(auto, 1fr)`, cujo `auto` não deixa a coluna encolher
   abaixo do conteúdo. Passou a `minmax(0, 1fr)`, com `min-inline-size: 0` nos
   descendentes.
2. **`.mapa` preso a 445 px.** `min-block-size: 20rem` mais
   `aspect-ratio: 4/3` obrigavam a uma largura mínima de 427 px. A largura
   passa a mandar e o mínimo de altura leva um `min(20rem, 75vw)`.

Nenhuma das duas era visível numa captura de ecrã do telemóvel — a página
parecia bem e arrastava para o lado. `scripts/responsivo.mjs` passa a travar a
publicação nas causas que são aritmética de CSS.


---

## Terceira volta — o Instagram passa a ser o portefólio (23-08-2026)

O cliente redefiniu a ideia do site: **mostrar algumas coisas e mandar para o
Instagram**, onde está o portefólio todo. Decidido com três propostas
independentes, cada uma julgada por três lentes (dono do estúdio, visitante no
telemóvel, engenheiro/SEO), e sintetizado numa especificação.

### Páginas: 14 → 7

Ficam `/`, `/trabalhos/`, `/loja/` e as três legais, mais o 404.
Apagam-se `/servicos/`, as cinco `/servicos/<slug>/` e `/contactos/` — esta
última era **órfã**: o menu já apontava para `/#contactos` e nada no site lhe
ligava, e duplicava o mesmo bloco.

**Sem páginas de substituição.** Cada uma teria de levar canonical, title,
description, JSON-LD, o rodapé legal completo e os ~55 kB de CSS embutido para
passar a auditoria: **~75 kB cada, 450 kB no total**, e seis páginas legais a
manter. Contra: o repositório tem um dia, zero indexação e zero backlinks. O
404 do GitHub Pages faz o resgate de graça e passou a listar os cinco serviços
com âncora.

**`PAGINAS_DE_SERVICO = false`** no topo do gerador. O código e os cinco JSON
ficam intactos. Se o Search Console mostrar impressões sem cliques para «ppf
leiria» ou «tira mossas leiria», põe-se a `true` e as páginas voltam — com o
sitemap e as migalhas atrás, sem escrever uma palavra nova.

### Os 13 serviços sem páginas: cinco blocos SEMPRE ABERTOS

Foi tentado com `<details>` e **não pode ser**: uma âncora não abre um
`<details>`. O algoritmo de revelação do HTML percorre os *ascendentes* do
alvo, e um `<details>` não é ascendente de si mesmo — `/#s-ppf` faria scroll e
deixaria a gaveta fechada, e toda a ideia de substituir páginas por âncoras
caía. Além disso o Safari e o Firefox não expandem `<details>` no Cmd+F, o que
tornaria o texto dos serviços inencontrável na própria página.

`<article>` com o `id` no artigo (não no `<h3>`, senão o salto começa a meio do
bloco). Lista dos 13 nomes por cima, a saltar para as âncoras. **986 palavras
já escritas** foram reaproveitadas; zero palavras novas.

### A capa: separar em vez de sobrepor

O mosaico de fundo foi tentado duas vezes e falhou as duas. Com originais de
414 px, cobrir 2560 px obriga a ampliar seis vezes; para o texto continuar
legível é preciso um véu a 97%, e então as fotografias somem — que era
exactamente a queixa do cliente.

Agora: **texto à esquerda sobre preto chapado, três fotografias à direita,
inteiras, sem véu e sem desfoque.** O contraste é o do tema (14,6:1) e não
depende de máscara nenhuma. `scripts/capa.py` e os 509 kB de
`assets/img/capa/` foram apagados; a capa nova pesa menos e mostra três carros
a sério.

**REGRA DURA, a partir de agora: nenhuma caixa de fotografia passa de 414 px
CSS em todo o site.** É o tamanho do original. O comparador antes/depois era o
único ponto a violá-la (27rem = 432 px) e passou a 25,875rem.

**A escolha das três fotografias foi medida, não palpitada.** O Audi Q7
camaleão foi a primeira escolha e a 114 px lê-se como um quadrado negro — o
carro dissolve-se no fundo escuro. Renderizei nove candidatos ao tamanho real
e ficou o Rolls-Royce, cuja grelha cromada se lê a qualquer tamanho.

### Navbar

Ordem: **Serviços · Trabalhos · Contactos │ [Loja] · [Pedir orçamento]**.

Dois destaques lado a lado resolvem-se por **matéria**, não por cor:
preenchido (WhatsApp) > contornado (Loja) > texto simples. O filete é um
elemento a sério e não um `::before` com deslocamentos adivinhados — o
intervalo visual é o `gap` da navegação **mais** o do cabeçalho, e nenhum
`calc` acerta nisso.

No telemóvel a Loja tem alvo próprio na barra (2,75rem, ao lado da
hamburguer). Não leva a classe `.botao`, senão desaparecia com a regra dos
60rem que esconde `.cabecalho__interior > .botao`.

### Um bug real na auditoria, encontrado a especificar isto

O padrão das ligações era `href="(\/[^"#?]*)"` — **excluía tudo o que tivesse
`#`**. Como a arquitectura nova depende de âncoras, um `/#s-ppf` sem o prefixo
`/PerfectFinish` publicava em silêncio. Corrigido, e acrescentada a
verificação de que **todo o `#id` referido numa página existe nessa página**.
Ambos testados a provocar o erro de propósito.

### Instagram: quatro saídas, e nenhuma acima da dobra

Fim de `#trabalhos` (a principal, painel próprio), dentro do bloco do tira
mossas (no lugar da fotografia que não existe), nos contactos e no rodapé.

**Nada na capa e nada no menu — e isto contraria o cliente à letra.** Um link
para fora acima da dobra gasta a visita antes de a prova ser vista. O
objectivo é que saiam para o Instagram *depois* de acreditarem.
E `/trabalhos/` **não** se apagou: é a apólice. O Instagram mostra um muro de
login a quem não tem conta, e se a conta cair a montra cai com ela.

### O que se perde, dito sem maquilhagem

Quatro intenções comerciais distintas — «tira mossas leiria», «películas
solares leiria», «ppf leiria», «car wrapping leiria» — passam de quatro `<h1>`
em quatro URL para quatro `<h3>` numa página. Uma página posiciona-se bem para
um tema, não para quatro. A mitigação (âncoras, 986 palavras, `hasOfferCatalog`
nas âncoras, `alt` com o nome do serviço, `/trabalhos/` com 52 fotografias
legendadas) segura cauda longa e «marca + serviço»; **não** segura os termos de
cabeça contra quem tenha página dedicada. O `<title>` de `/` passou a
«Tira Mossas, Películas e PPF em Leiria» e o de `/trabalhos/` cobre
«Envelopamento» — é uma divisão deliberada entre as duas únicas páginas
indexáveis que restam.


---

## Quarta volta — serviços só com imagens, e a capa em mosaico (23-08-2026)

**Os serviços deixaram de ter texto.** O cliente foi claro: «não quero que me
detalhes os serviços, quero só imagens, nada de especificações». Saíram as
introduções, os três argumentos, os avisos e as 15 perguntas frequentes.
Ficaram cinco cartões com fotografia e o nome, mais a lista dos 13 nomes.

O texto **não foi apagado dos dados**: continua em `data/servicos/*.json` e
continua editável no backoffice. O aviso legal das películas (limites de
transmissão luminosa) não se perde por isto — vive em `/informacao-legal/`,
que é onde a lei o quer.

Carregar num cartão abre a galeria daquele serviço, com as fotografias dos
trabalhos correspondentes. Fica-se na mesma página e vêem-se mais imagens.

**O tira mossas não tem fotografia utilizável em todo o acervo** — e é o
serviço que dá nome à casa. As três que existem estão contra a luz e a mossa
não se lê a 414 px. Não se põe ali a fotografia de outro serviço: o cartão
leva o escudo em marca de água e manda para o Instagram. Quando houver
fotografia, basta preencher o campo no backoffice.

**A capa voltou ao mosaico**, a pedido. Mas com duas correcções que só
aparecem a medir:

1. **O texto caía sobre as fotografias.** O painel escuro gravado acabava aos
   46% da largura, e o `object-fit: cover` com `object-position` ao centro
   recortava parte dele. Painel alargado para 58% e imagem encostada à
   esquerda. Confirmado a **desenhar a imagem num canvas com a mesma
   geometria do `cover` e a ler a luminância por baixo de cada bloco de
   texto**: o `<h1>` dá 6,67:1 no pior ponto e o corpo 7,06:1. A régua de
   provas dava 4,04:1 — abaixo do mínimo — e passou de `--osso-fraco` para
   `--osso-meio`.
2. **No telemóvel a imagem é uma FAIXA por baixo do texto, não um fundo.** Num
   ecrã estreito o texto ocupa a largura toda e não há lado nenhum onde as
   fotografias possam ficar à vista: ou se tapa a imagem com um véu (e volta a
   queixa de que não se vê nada), ou se separa. Separou-se.
   A versão de telemóvel passou a ser gerada **sem painel** — o esbatimento é
   feito por CSS, e o painel gravado só escurecia a faixa, que é a parte que se
   quer ver.

**Armadilha do CSS que só a medição apanhou:** o espaço reservado para a faixa
estava em `padding-block-end: 49%`, e **um `padding` em percentagem resolve
contra a LARGURA, não a altura**. Reservava 191 px onde a faixa media 404, e a
régua de provas acabava por cima da fotografia. Agora a altura da faixa e o
espaço reservado usam a mesma variável, `--faixa: min(44svh, 24rem)`.

**Navbar:** a Loja passou para depois dos Contactos, em pastilha de contorno
dourado, com um filete a separá-la dos três links. Na página da Loja a
pastilha fica dourada cheia.


---

## A capa é fundo a sério, também no telemóvel (23-08-2026)

A faixa de fotografias por baixo do texto foi um erro. Num telemóvel alto caía
toda abaixo da dobra e ficava um sliver de fotografia — o cliente mandou uma
captura do iPhone a mostrá-lo e disse «quero a foto como background e não só
ao lado». Tem razão.

A fotografia cobre agora o herói todo, nas duas medidas. O contraste vem de um
véu **em degradé**, e não de um véu uniforme: forte em cima onde está o texto,
leve em baixo onde se veem os carros. Um véu uniforme forte o suficiente para o
texto apaga as fotografias — foi a primeira queixa, e a aritmética explica-a:
para o dourado `#CBAD4F` chegar a 4,5:1, o fundo por baixo dele tem de descer
a uma luminância relativa de 0,054, o que sobre uma fotografia de luminância
média 120/255 obriga a escurecer ~72%.

**Medido, não estimado.** Compõe-se num canvas exactamente o que o ecrã mostra
— a imagem com a geometria do `object-fit: cover` mais o mesmo degradé que o
CSS aplica — e lê-se o pixel MAIS CLARO debaixo de cada bloco de texto:

| | pior caso |
|---|---|
| `<h1>` dourado | 7,94:1 |
| subtítulo | 7,82:1 |
| corpo | 7,85:1 |
| régua de provas | 7,53:1 |

A régua de provas dava **3,66:1** na primeira medição, porque cai na zona clara
do véu — que é justamente onde se querem ver os carros. Em vez de escurecer o
véu todo, a régua passou a ter um painel próprio. Lê-se como uma barra de
números, que é o que é.

### Uma lição de processo

O texto da capa desapareceu por completo numa das iterações: `.heroi__interior`
perdeu as suas regras (incluindo o `z-index: 2`) quando apaguei o CSS da pilha
de fotografias, e o véu passou a ficar por cima do texto.

**A geometria dizia que estava tudo bem** — posição certa, opacidade 1, cor
certa. Só não era pintado. E a auditoria tem exactamente o travão que apanha
isto (toda a classe usada no HTML tem de ter regras de CSS) — mas eu corri o
gerador e o `responsivo.mjs` e **saltei o `auditar.mjs`**. O travão existia e
não foi accionado.

Correr sempre os três: `gerar` → `responsivo` → `auditar`. É o que o workflow
de publicação faz, e é o que se deve fazer em local antes de olhar para o ecrã.


---

## Título novo e sem descrição (23-08-2026)

O parágrafo de descrição saiu da capa. Ficou o título, uma linha de apoio, os
dois botões e a régua de provas.

**O título é a frase do próprio cliente.** «Proteção absoluta» era um slogan
que não dizia o que a casa faz; o Facebook deles diz «PERFECT FINISH SUA
VIATURA NOVA DE NOVO», que diz o benefício. Ficou **«A sua viatura / nova de
novo»**, e a linha de apoio — «Tira mossas, películas, PPF e car detail em
Leiria» — passou a ser editável no backoffice, porque agora que não há
parágrafo nem páginas por serviço é o único sítio do `<h1>` onde os termos de
pesquisa cabem.

### O título mais longo obrigou a três correcções, todas encontradas a medir

1. **Quebrava em quatro linhas.** A frase tem 13 caracteres na linha mais longa
   contra os 8 de «Proteção absoluta», e a `--t-5` geral (máximo 6,2rem) pedia
   361 px numa caixa de 353. O título passou a ter escala própria,
   `clamp(1.85rem, .2rem + 8.4vw, 4.2rem)`.

   Nota de método: à primeira medi a largura do `<span>` e deu 353 — igual à
   caixa — e concluí que cabia. Não cabia: estava **já quebrado**, e 353 era a
   largura do bloco, não da linha. A medição certa é criar um elemento com
   `white-space: nowrap` e a mesma fonte, e ler a largura natural.

2. **Os pontos de corte estavam desalinhados.** O `<picture>` trocava para a
   imagem larga aos 48rem, mas o CSS só mudava de véu aos 64rem. Entre 768 e
   1023 px juntava-se a imagem larga, o véu de telemóvel e uma coluna de texto
   de 42% — e o título voltava às quatro linhas. Tudo alinhado aos 64rem.

3. **O painel gravado na imagem estava ancorado à coisa errada.** O `object-fit:
   cover` corta de forma diferente a cada largura, mas o texto está num
   contentor centrado: a 1920 px o contentor começa aos 352 px e o texto saía
   do escuro — **1,75:1 no sobrescrito**, medido.
   O véu passou a ser feito **em CSS nas duas medidas** (horizontal no
   computador, vertical no telemóvel). Acompanha o layout em vez do recorte, e
   afina-se sem gerar imagem nenhuma. As duas imagens passaram a ser geradas
   sem painel.

Contraste no pior pixel debaixo de cada bloco, a 1425 px: sobrescrito 5,20:1 ·
título 7,63:1 · subtítulo 7,63:1 · régua 7,65:1. No telemóvel, ≥7,5:1 em tudo.
