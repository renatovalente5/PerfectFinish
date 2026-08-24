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


---

## Antes e depois, refeito (24-08-2026)

O cliente pediu «mais moderno, quer na web quer para o telemóvel». O mecanismo
já era o certo — a cortina sobre um `<input type="range">` continua a ser a
convenção em 2026 — o que estava velho era o enquadramento. E havia quatro
defeitos reais:

1. **Não funcionava sem JavaScript.** O `--p` só era escrito em `site.js`;
   ficava um quadrado partido a 50/50 para sempre com uma régua invisível que
   apanhava foco e não movia nada. Agora o estado base é um **díptico** (as duas
   fotografias empilhadas, cada uma com o seu selo) e a régua nasce `disabled`.
2. **O carrossel horizontal e a cortina disputavam o mesmo gesto.** A régua
   cobre o quadrado todo; num telemóvel o arrastar horizontal ia sempre para a
   cortina e o carrossel só se movia agarrando a legenda. Os pares passam a
   empilhar. Acrescentado `touch-action: pan-y`, que é a correcção documentada
   para o conflito de scroll — nunca `none`.
3. **A desktop o carrossel nunca fechava a conta**: três cartões de 414 px mais
   duas goteiras dão 1290 px numa caixa de 1216. Ficava sempre um cortado.
4. **Servia sempre o ficheiro de 828 px**, com as variantes `-414` a existirem
   em disco sem uso. Passou a `srcset` 1x/2x: metade do peso num ecrã 1x.

O desenho novo: a partir de 62rem cada par é uma linha editorial, fotografia de
414 px de um lado e tipografia do outro, com os lados a alternar. A cortina
**abre-se sozinha ao entrar no ecrã**, ao ritmo do scroll — é o que ensina o
gesto, que é o único problema verdadeiro deste padrão.

**`@property` é o que torna isto possível.** Sem registo, uma variável
personalizada é só texto: não interpola, e portanto nem transição nem
fotograma-chave lhe tocam. `inherits: true` é obrigatório, porque quem lê o
valor são os descendentes.

**Dois pares na inicial, não três.** Empilhados, três levavam a secção de ~400
para ~1430 px no telemóvel, contra o «simples» que o cliente pediu.

Descartado: máscara com gesto (o dedo tapa o que revela, e obriga a reconstruir
teclado e nome acessível à mão), alternância temporizada (infinita cai na
armadilha do `animation-duration:.01ms`, que acelera em vez de parar; e uma
pausa a sério exige botão visível pelo SC 2.2.2), e dois cartões lado a lado
como principal (a 320 px são dois quadrados de 132 px — fica como estado sem JS
e para impressão).

## Serviços: tira de nomes + montra (24-08-2026)

O cliente pediu a secção «mais simples» e «sem textos». Tinha quatro blocos
(cabeça com parágrafo, cinco cartões, caixa «Todos os serviços», linha de
fecho). Passou a ter dois: a **tira** dos treze nomes e a **montra** de
fotografias. A tira faz o trabalho do parágrafo E da caixa; o azulejo do
Instagram faz o da linha de fecho.

**São SETE serviços com fotografia, não cinco.** Os cinco cartões eram indexados
pelas cinco *páginas* de serviço e não pelos treze *serviços*, e por isso
desperdiçavam os dois melhores planos aproximados da casa: a pinça de travão
(`tesla-pincas-1`) e a jante (`smart-fortwo-2`). São mais legíveis a 172 px do
que qualquer carro inteiro.

**A forma da grelha é derivada dos dados**, e é isso que elimina os buracos: um
serviço com fotografia é um azulejo, um sem fotografia é um nome na tira. Não há
lugares vazios porque não há lugares reservados. Carregar uma fotografia no
backoffice promove o nome a azulejo sem se tocar em CSS.

**Contraste por aritmética, não por medição.** O nome fica sobre uma placa de
`--tinta` a 90%, portanto o pior fundo concebível é uma fotografia branca: o
composto dá `#313131` e o `--osso` em cima mede 10,68:1. Isto importa porque a
fotografia é editável no backoffice — com um degradé, «Proteção e Correção de
Pintura» a 320 px caía a 2,34:1. O degradé anterior só passava porque os
azulejos usavam etiquetas curtas em vez dos nomes verdadeiros.

**Não se pode usar `repeat(auto-fit, minmax(min(100%, 18rem), 1fr))`**, que é
hoje o idioma corrente: o `auto-fit` limita o mínimo da coluna e nunca o máximo.
Com 18rem dá duas colunas de 415 px por volta dos 920 px de janela, acima do
original de 414. Baixar o mínimo a 8,5rem (o necessário para duas colunas a
320 px) dá cinco colunas de 154 px aos 900. Não existe valor que sirva os dois
extremos — têm de ser cortes explícitos.

**`role="list"` é obrigatório** nas duas listas: `list-style: none` remove a
semântica de lista no Safari com VoiceOver, e é intencional da Apple.

**O `:hover` vai fechado em `@media (hover: hover) and (pointer: fine)`.** Sem
isso, num telemóvel o estado cola depois do toque e o azulejo fica subido e com
a fotografia ampliada até se tocar noutro sítio.

## Armadilhas de verificação apanhadas neste dia

**O recuo das listas era um erro em todo o site.** A indentação de 40 px vem da
folha do NAVEGADOR; o reset do projecto é `* { margin: 0 }`, que zera margens e
não paddings, e `list-style: none` tira o marcador mas não o recuo. Medido:
`.cartoes-servico`, `.horario` e `.lista-servicos` estavam empurradas 40 px para
a direita e transbordavam 40 px. Todo o cuidado com `minmax(0, 1fr)` não servia
de nada, porque o problema está ANTES das colunas. `scripts/responsivo.mjs`
passa a exigir que o reset exista.

**Uma verificação que compara os dados com a página não vale nada.** Escrevi na
auditoria um teste que confirmava a morada da página legal contra
`data/definicoes.json` — mas a página é gerada a partir desse ficheiro, portanto
os dois lados mudam juntos e nunca falha. Sabotei o campo e passou. Passou a
procurar a FORMA (nove dígitos, um código postal), que é o que se perde quando
alguém mexe no molde.

**`git checkout <ficheiro>` para desfazer uma sabotagem apaga o trabalho não
commitado desse ficheiro.** Perdi as edições do rodapé assim. Copiar para
`/tmp` antes, e restaurar de lá.

**Chrome headless não é caminho de captura fiável neste projecto.** A janela tem
largura mínima: pedindo `--window-size=390`, o layout sai mais largo e o PNG é
cortado — parece transbordo horizontal onde não há nenhum. A medição no painel
real deu `scrollWidth - clientWidth = 0` e os azulejos a x=18 e x=200 dentro de
uma caixa de 353 px. Confirmar sempre com medição antes de acreditar numa
captura que mostra conteúdo cortado.


---

## A página /trabalhos/ saiu (24-08-2026)

O cliente quer tudo na inicial e na Loja. Verificado antes de apagar: as
galerias dos azulejos dos Serviços cobrem **os 18 trabalhos**, portanto não se
perde conteúdo nenhum — só deixa de haver uma segunda porta para o mesmo.

O que foi preciso refazer:
· os cinco comparadores passaram todos para a inicial (eram dois; os outros três
  viviam na página que saiu e ficariam inalcançáveis);
· a linha de fecho do painel do Instagram mandava para /trabalhos/ e passou a
  dizer o que há na inicial;
· o botão da página 404 aponta para /#trabalhos/ em vez da página.
O `cartaoObra` e a `.grelha` ficam a ser usados só pelo código morto das páginas
de serviço.

**Custo medido, para decidir:** o antes-e-depois no telemóvel passou de ~1430
para **3556 px** com cinco comparadores, e a página toda para 9468 px. Cortar
para três resolve numa linha (`PARES.slice(0, 3)`).

## Serviços em fundo claro (24-08-2026)

O que muda não é o fundo, é o dourado. `--ouro` #AC8A39 sobre o claro #F2EFE9 dá
**2,84:1** e reprova; `--ouro-sombra` #7A571D dá **5,70:1** e já existe na
paleta. Medido no navegador depois de aplicado: sobrescrito 5,70, título 14,18,
nomes da tira 6,38.

O azulejo do Instagram fica ESCURO de propósito: é o único sem fotografia e o
único que leva para fora, e sobre o claro lê-se como peça à parte.

**ARMADILHA em que caí:** a regra `.claro .montra__peca > a` (0,3,0) anulava o
gradiente de `.montra__ig > a` (0,2,0). O azulejo saía claro e «Mais no
Instagram» em #CBAD4F ficava a **1,90:1**. Vi na captura, confirmei por medição,
e o selector passou a repetir o `.claro` para empatar e ganhar por ordem. De
caminho apanhei um defeito que já lá estava: `@perfectfinish.pt` em
`--osso-fraco` dava 3,98:1 contra o extremo claro do gradiente — passou a
`--osso-meio`, 6,78:1.

## Título da capa: um campo, não N campos (24-08-2026)

«Studio de Customização Premium» não cabe em duas linhas. Medido a 1440 px com
fonte de 67 px numa coluna de 608: «Studio de Customização» dá 902 px e
«Customização Premium» dá 864. Em duas linhas obrigaria a descer de 4,2rem para
~2,9rem e a capa perdia força. Em três linhas a mais larga é «Customização», com
537 px, e cabe com 71 de folga.

Por isso os dois campos fixos (`heroi_linha1/2`) deram lugar a UM campo de texto
com quebras de linha, uma `<span>` por linha. O gradiente dourado é
`background-clip: text` e tem de ser aplicado linha a linha (num bloco de várias
linhas o degradé ladrilha e parte os diacríticos), mas isso agora não custa
campos novos no backoffice de cada vez que o título muda de forma.

A medição certa é um elemento SOLTO com `white-space: nowrap` e a mesma fonte.
Ler a largura do `<span>` dá a largura da CAIXA e não da linha — foi assim que
uma vez concluí que cabia uma frase que já estava quebrada.


---

## O comparador degradava PIOR do que sem JavaScript (24-08-2026)

Achado por verificação adversarial e confirmado por reprodução. O estado
interactivo estava atrás de `html[data-js]`, escrito por uma linha no `<head>`
antes da primeira pintura. Se o `site.js` não corresse, o CSS interactivo ficava
aplicado **sem régua, sem filete e sem pega**: uma caixa de 414 px com meia
fotografia «antes» e meia «depois», sem controlo nenhum. Medido com o `src`
trocado por um ficheiro inexistente: `display: block`, 414x414,
`clip-path: inset(0 0 0 96%)`. Sem JavaScript nenhum dava o díptico correcto —
ou seja, **ter o script a meio era pior do que não o ter**.

O gatilho mais provável não era o 404: o `site.js` era um IIFE único sem
`try/catch`, portanto qualquer excepção num bloco anterior impedia o
`regua.disabled = false` de correr com o ficheiro bem carregado.

Duas correcções:
1. **O portão mudou de sítio.** Passou a `.comparador[data-vivo]`, e o atributo é
   posto pelo `site.js` DEPOIS de ligar a régua daquele comparador. Assim o
   díptico é o estado por omissão e a falha degrada sozinha.
   O salto de layout que o script inline evitava **não existia**: o primeiro
   comparador está a 2653 px do topo, 2,2 ecrãs abaixo da dobra, e o CLS só mede
   o que acontece dentro da janela.
2. **Os blocos do `site.js` passaram a ser independentes**, como o cabeçalho do
   ficheiro já prometia (e não era verdade). Sete blocos, sete `try/catch`.

De caminho, e pela mesma verificação:
· **A pega era cortada nos extremos.** Tem 44 px e fica em `left: var(--p)` com
  `translate: -50%`; aos 0% e aos 100% ficavam 21 px fora da caixa, comidos pelo
  `overflow: clip` — e com eles o anel de foco, que é um `box-shadow` na pega.
  Quem carregava em Home ou End perdia a pega E o foco. Resolvido com
  `overflow-clip-margin`, que alarga a região de corte sem desligar o corte; as
  fotografias passaram a `border-radius: inherit` para os cantos não voltarem a
  ser quadrados dentro da moldura redonda. Confirmado por RENDER, não por
  medição: `getBoundingClientRect` reporta a caixa mesmo quando está recortada.
· **O anel de foco deixou de usar `:has()`.** A régua subiu no DOM para antes do
  filete e da pega, e o selector passou a irmão (`~`), que tem suporte
  universal. Sem `:has()` o anel desaparecia — e a régua tem opacidade zero,
  logo não havia foco visível a substituí-lo.
· **O bloco de impressão desapareceu.** Repetia declaração por declaração a
  reversão do estado base — duas cópias para manter em sincronia. Agora o estado
  interactivo vive dentro de `@media not print` e há uma só fonte de verdade.
· **O `site.js` passou a levar selo de conteúdo no endereço** (`?v=<hash>`). Sem
  isso o endereço nunca mudava e quem já tinha visitado o site podia ficar com a
  versão antiga depois de publicar. Apanhei-o a testar: o navegador servia-me um
  `site.js` em cache e eu procurava o erro no código.
· **A auditoria não descascava a query** ao verificar se um ficheiro existe, e
  dava «ficheiro em falta» para o próprio selo. Corrigido, e confirmado que
  continua a apanhar ficheiros que faltam a sério.

**A verificação ficou incompleta:** 48 dos 75 agentes morreram no limite de
sessão, portanto há achados que nunca foram julgados. Ficam por adjudicar, entre
outros: o botão flutuante do WhatsApp a tapar conteúdo, sair da régua com Tab, o
`onerror` das imagens, e a escolha de ficheiro em DPR 2.


---

## O til do Ã cortado no título dourado (24-08-2026)

O cliente viu-o antes de mim, e a minha medição anterior tinha dito que estava
bem — porque medi a coisa errada.

**Causa:** o `background-clip: text` pinta o gradiente SÓ dentro da caixa de
padding do elemento. A tinta que o glifo põe fora dessa caixa não recebe cor
nenhuma e simplesmente desaparece. A regra `.ouro > span` tinha
`padding-bottom: .06em` para as descidas e **nada em cima**.

**Medição certa:** uma `Range` sobre o conteúdo do `<span>` devolve o rectângulo
da TINTA; o `getBoundingClientRect` do `<span>` devolve a caixa. A 67,2 px de
corpo com Archivo, a tinta saía **6 px acima** e 1,1 px abaixo da caixa. Nas
linhas «Studio de» e «Premium» não há nada tão alto, por isso não se via; em
«Customização» o til do Ã entra nesses 6 px, e a cedilha do Ç ficava 1,1 px de
fora por baixo.

**Correcção:** `padding-block: .1em .08em` com `margin-top: -.1em` a devolver a
posição, para o layout não mexer. A regra que aperta as linhas do título passou
de -.06em para -.18em (= -.1 do padding novo, -.02 do aumento em baixo, -.06 do
aperto que já existia). Vale para TODOS os títulos dourados do site, que também
têm ã e ç.

A folga interessa porque o título é editável no backoffice: ninguém vai medir
glifo a glifo de cada vez que o cliente muda a frase.

## A régua de provas na forma pedida (24-08-2026)

Cinco estrelas, a nota, «· N avaliações Google», e a localidade num selo com
contorno e ícone — a partir de uma fotografia de outro site que o cliente mandou.

Duas coisas que precisaram de número e não de gosto:
· **O tamanho das estrelas.** A estrela desenhada ocupa cerca de dois terços da
  moldura de 24x24, portanto uma caixa igual ao corpo do número dava uma estrela
  visivelmente menor do que os dígitos. Com `.88em` do mesmo corpo fica a ~0,83
  da altura das maiúsculas, que é a proporção do exemplo.
· **A largura da régua.** Com a largura de leitura do texto (608 px a 1440) o
  selo caía para segunda linha: 342 + 221 + 56 de intervalo dão 620. A régua
  passou a `min(46rem, 64%)` — não é prosa, é uma tira compacta. Não custa
  contraste porque continua dentro da zona onde o véu é forte (até 50% da
  janela) e o selo tem painel próprio por cima disso.
  Contraste medido por composição real (fotografia + véu + painel): nota 7,69 ·
  texto 7,71 · selo 14,48 · estrelas 5,20.

O botão da capa voltou ao contorno, a pedido.
