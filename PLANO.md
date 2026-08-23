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
