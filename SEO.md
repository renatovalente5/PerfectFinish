# SEO — Perfect Finish Studio

Estado a 26-08-2026. Domínio: <https://perfectfinishstudio.pt>

## O que está feito, e medido

| | |
|---|---|
| Domínio próprio a servir na raiz | apex nos 4 endereços do GitHub, `www` com 301 para o apex |
| Endereço antigo | `renatovalente5.github.io/PerfectFinish` faz **301** para o domínio novo — o histórico transfere-se |
| CNAME dentro do artefacto | sem isto a publicação por workflow apagava o domínio a cada deploy |
| Canónicos | em todas as páginas indexáveis, a apontar para o domínio novo |
| `sitemap.xml` e `robots.txt` | 5 endereços, sitemap declarado no robots |
| Página 404 | `noindex, follow` e sem canónico |
| Títulos | 31 a 59 caracteres, todos distintos |
| Descrições | 67 a 145 caracteres, todas distintas |
| `<h1>` | um por página |
| Texto alternativo | zero imagens sem `alt` |
| Dados estruturados | `AutoBodyShop`+`AutoWash`, `WebSite`, `WebPage`, `BreadcrumbList`; morada, coordenadas, horário, 10 localidades servidas, os 13 serviços, redes sociais |
| CLS | **0** |
| TTFB / domInteractive | **174 ms / 194 ms** |
| Documento | comprime para **21 kB** de 109 |
| Imagem da capa (LCP) | `fetchpriority="high"`, sem lazy; 77 kB no telemóvel, 188 kB no computador, AVIF |

**Por medir:** LCP e FCP reais. O painel de navegador desta sessão está
estrangulado e devolveu 14,5 s com FCP igual ao LCP, que é o padrão de medição
falsa — não vale como número. Fica para dados de campo do Search Console.

---

## O que falta, por ordem de impacto

### 1. Google Business Profile — o maior de todos

Para «tira mossas leiria» ou «película solar leiria», o **bloco local do Google
aparece acima dos resultados orgânicos**. Nenhum trabalho no site compete com
isso. E há aqui uma urgência: **a morada mudou 12 km** e enquanto a ficha
mostrar a antiga, cada pesquisa manda gente ao sítio errado.

- [ ] Actualizar a morada para *Estrada Nacional 242, n.º 113 — Pavilhão D, 2400-446 Leiria*
- [ ] Confirmar a nova localização (o Google costuma pedir prova)
- [ ] Pôr o site: `https://perfectfinishstudio.pt`
- [ ] Declarar os serviços (os 13 estão em `data/lista-servicos.json`)
- [ ] Carregar fotografias novas — a ficha com fotos recentes tem mais interacção
- [ ] Horário igual ao do site: seg-sex 09:00–18:30, sáb 09:00–13:00
- [ ] Responder às avaliações, mesmo às boas

As **94 avaliações a 4,9** já são um activo forte. É a ficha que o transforma em
posição.

### 2. Google Search Console

- [ ] Criar propriedade **de domínio** (`perfectfinishstudio.pt`), não de prefixo
      de URL: cobre o apex, o `www` e qualquer subdomínio de uma só vez
- [ ] Verificar por registo **TXT** no DNS (é o método que a propriedade de
      domínio exige)
- [ ] Submeter `https://perfectfinishstudio.pt/sitemap.xml`
- [ ] Pedir indexação da página inicial
- [ ] Ao fim de duas semanas, ver **Desempenho** para saber que pesquisas já
      trazem gente — é isso que diz onde vale a pena escrever

### 3. A decisão de conteúdo que falta tomar

O site tem **uma** página de conteúdo indexável. Quem procura «película solar
leiria» ou «ppf leiria» encontra uma âncora dentro da página inicial, não uma
página dedicada — e o Google classifica páginas, não secções.

As cinco páginas de serviço **existem** e estão desligadas
(`PAGINAS_DE_SERVICO = false` em `scripts/gerar.mjs`; o conteúdo está em
`_fonte/servicos-desligados/`). Ligá-las é mudar um valor.

O compromisso é real e é do cliente:

- **Uma página só** — a experiência que ele pediu, mais simples de manter, e
  concentra tudo o que o Google lê num sítio.
- **Cinco páginas** — uma por serviço, cada uma a poder responder a «serviço +
  Leiria». É a alteração com mais efeito no ranking orgânico que resta fazer.

Se ligarem, é preciso rever o conteúdo das cinco: foi escrito por nós e nunca
foi validado pelo cliente.

### 4. Barato e rápido

- [ ] Bing Webmaster Tools — importa a propriedade do Search Console, 5 minutos
- [ ] Registos **AAAA** no DNS (o GitHub Pages serve IPv6 e não há nenhum)
- [ ] Coerência de nome, morada e telefone entre site, Google, Instagram e
      Facebook. O Google cruza isto, e a morada acabou de mudar em todos

---

## O que NÃO fazer

- **Não marcar `aggregateRating` nem `review`** nos dados estruturados. As
  avaliações são recolhidas pelo próprio negócio; marcá-las num
  `LocalBusiness` arrisca acção manual. O Google já tem as suas.
- **Não copiar o texto das avaliações** para o repositório: os termos do Google
  Maps Platform proíbem-no, e num repositório público ficaria no histórico.
- **Não comprar ligações.** Num negócio local não compensa o risco.
- **Não repor a plataforma ODR** — foi revogada a 20-07-2025.

## Prazos honestos

| | |
|---|---|
| Indexação das páginas | dias a duas semanas depois do Search Console |
| Movimento no bloco local | semanas, e vem do Business Profile |
| Orgânico em termos disputados | meses, e depende de conteúdo e reputação |

Ninguém garante «primeiro lugar». O que se garante é que nada técnico está a
travar, e isso — hoje — é verdade.
