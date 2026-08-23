#!/usr/bin/env node
/**
 * Gerador do site do Perfect Finish Studio.
 *
 * Node puro, sem dependências. Não há `package.json` e não há `npm ci` no
 * GitHub Actions — não é falta de vontade, é o que faz este site continuar a
 * publicar daqui a dois anos sem ninguém lhe tocar.
 *
 * Entra:  data/*.json  +  assets/
 * Sai:    _site/
 *
 * Correr:  node scripts/gerar.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "_site");

/* ------------------------------------------------------------------ dados */
const ler = (p) => JSON.parse(readFileSync(join(RAIZ, p), "utf8"));
const lerPasta = (p) =>
  readdirSync(join(RAIZ, p))
    .filter((f) => f.endsWith(".json"))
    .map((f) => ler(join(p, f)))
    .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));

const D = ler("data/definicoes.json");
const SERVICOS = lerPasta("data/servicos");
const TRABALHOS = lerPasta("data/trabalhos").filter((t) => t.publicado !== false);
const PRODUTOS = lerPasta("data/loja").filter((p) => p.publicado !== false);
const AVALIACOES = ler("data/avaliacoes.json");
const LISTA_SERVICOS = ler("data/lista-servicos.json").servicos;
/* O ficheiro vem do backoffice como objecto (`{ pares: [...] }`); aceita-se
   também o array solto, que é como estava antes de existir o backoffice. */
const _pares = ler("data/pares.json");
/* Páginas próprias por serviço (/servicos/ e as cinco filhas). DESLIGADAS a
   pedido do cliente, que quer tudo numa página e o portefólio no Instagram.
   O código e os cinco JSON ficam: se o Search Console mostrar impressões sem
   cliques para «ppf leiria» ou «tira mossas leiria», põe-se isto a `true` e as
   páginas voltam — com o sitemap e as migalhas atrás, sem escrever uma
   palavra nova. */
const PAGINAS_DE_SERVICO = false;

const PARES = (Array.isArray(_pares) ? _pares : _pares.pares || [])
  .slice().sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));

/* O endereço base. Com CNAME o site vive na raiz de um domínio; sem CNAME
   vive numa subpasta do github.io e TODOS os caminhos têm de a incluir —
   esquecer isto é a forma mais rápida de publicar um site sem CSS. */
const CNAME = existsSync(join(RAIZ, "CNAME"))
  ? readFileSync(join(RAIZ, "CNAME"), "utf8").trim()
  : "";
const BASE = CNAME ? "" : "/PerfectFinish";
const SITE = CNAME ? `https://${CNAME}` : "https://renatovalente5.github.io/PerfectFinish";

const u = (caminho) => `${BASE}${caminho}`;          // endereço interno
const abs = (caminho) => `${SITE}${caminho}`;        // endereço absoluto

/* --------------------------------------------------------------- auxiliares */
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Negrito com **asteriscos**, para o cliente poder destacar no backoffice. */
const forte = (s = "") => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const TEL = D.contactos.telefone;
const TEL_TXT = D.contactos.telefone_texto;
/* Por lei, junto de cada número de telemóvel visível. Está numa constante para
   não haver hipótese de ficar um bloco sem ele. */
const CUSTO = "(Chamada para a rede móvel nacional)";

const zap = (texto) =>
  `https://wa.me/${D.contactos.whatsapp}?text=${encodeURIComponent(texto)}`;

/**
 * <picture> para uma fotografia.
 *
 * Há duas origens possíveis e é preciso aceitar as duas:
 *
 *  a) as fotografias tratadas por `scripts/imagens.py`, guardadas como
 *     `<nome>-414.webp`, `-828.webp` e os AVIF correspondentes. Aqui o valor
 *     guardado nos dados é só o nome, sem medida nem extensão.
 *  b) uma fotografia carregada pelo cliente no backoffice, que fica no
 *     repositório tal e qual, com extensão e sem variantes. O Pages CMS grava
 *     o caminho completo, tipo `assets/img/obras/foto.jpg`.
 *
 * Distinguem-se pela extensão. Sem isto, a primeira fotografia que o cliente
 * carregasse aparecia partida — e ele não teria como perceber porquê.
 */
function figura(pasta, nome, alt, { classe = "", prioridade = false, carga = "tarde", medidas = "100vw" } = {}) {
  /* Três modos, e não dois:
       "alta"  → fetchpriority="high". Só UMA por página; três anulam-se.
       "cedo"  → acima da dobra mas não é o LCP. `lazy` aqui era uma
                 regressão, e `fetchpriority` roubava prioridade ao LCP.
       "tarde" → o resto. (por omissão) */
  const modo = prioridade ? "alta" : carga;
  const carregamento = modo === "alta" ? 'fetchpriority="high"'
    : modo === "cedo" ? 'loading="eager" decoding="async"'
    : 'loading="lazy" decoding="async"';
  const atributos = `alt="${esc(alt)}" width="828" height="828"${classe ? ` class="${classe}"` : ""} ${carregamento}`;

  if (/\.(jpe?g|png|webp|avif|gif)$/i.test(nome)) {
    const caminho = nome.startsWith("assets/") || nome.startsWith("/")
      ? u("/" + nome.replace(/^\/+/, ""))
      : `${u("/assets/img")}/${pasta}/${nome}`;
    return `<img src="${caminho}" ${atributos}>`;
  }

  const c = `${u("/assets/img")}/${pasta}/${nome}`;
  return `<picture>
<source type="image/avif" srcset="${c}-414.avif 414w, ${c}-828.avif 828w" sizes="${medidas}">
<source type="image/webp" srcset="${c}-414.webp 414w, ${c}-828.webp 828w" sizes="${medidas}">
<img src="${c}-828.webp" ${atributos}></picture>`;
}

/** Endereço da versão grande de uma fotografia (para a lupa). */
function foto(pasta, nome) {
  if (/\.(jpe?g|png|webp|avif|gif)$/i.test(nome)) {
    return nome.startsWith("assets/") || nome.startsWith("/")
      ? u("/" + nome.replace(/^\/+/, ""))
      : `${u("/assets/img")}/${pasta}/${nome}`;
  }
  return `${u("/assets/img")}/${pasta}/${nome}-828.webp`;
}

/* ------------------------------------------------------------------ ícones */
const ICONE = {
  telefone: '<path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 3 5a1 1 0 0 1 1-1z"/>',
  local: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  zap: '<path d="M20.5 11.6A8.4 8.4 0 0 1 7.8 19l-4.3 1.2 1.2-4.2A8.4 8.4 0 1 1 20.5 11.6z"/><path d="M9 9.3c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.7 1.6c.1.3 0 .5-.1.7l-.4.4c-.1.2-.2.3 0 .6a6 6 0 0 0 2.4 2c.3.1.4 0 .6-.1l.5-.5c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.5 0 .8-.6 1.5-1.4 1.6-.4 0-.8 0-3.2-1.2a8.2 8.2 0 0 1-3.4-3.5c-1-2-.8-2.5-.7-2.8z"/>',
  instagram: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.1" cy="6.9" r="1.1" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M13.6 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H17V3.6A22 22 0 0 0 14.6 3.5c-2.4 0-4 1.45-4 4.1v2.3H8v3.1h2.6v8z"/>',
  saco: '<path d="M6 8h12l1 11.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z"/><path d="M9.2 8V6.4a2.8 2.8 0 0 1 5.6 0V8"/>',
  estrela: '<path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17l-5.25 2.75 1-5.85L3.5 9.75l5.9-.85z"/>',
};
const svg = (nome, preenchido = false) =>
  `<svg viewBox="0 0 24 24" fill="${preenchido ? "currentColor" : "none"}" stroke="${preenchido ? "none" : "currentColor"}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[nome]}</svg>`;

/* -------------------------------------------------------------- navegação */
/* Serviços, Trabalhos e Contactos são SECÇÕES da página inicial — clicar não
   sai da página. A Loja é a única que muda de página, por ser outra coisa:
   produtos, não serviços.
   As páginas /servicos/<slug>/ continuam a existir e continuam a estar no
   sitemap: são elas que apanham as pesquisas por serviço no Google. Só não
   estão no menu. */
const NAV = [
  { url: "/#servicos", nome: "Serviços" },
  { url: "/#trabalhos", nome: "Trabalhos" },
  { url: "/#contactos", nome: "Contactos" },
  { url: "/loja/", nome: "Loja", pagina: true, destaque: true },
];

/* -------------------------------------------------------------- estrutura */
/* A folha vai embutida em cada página, portanto os comentários iam com ela —
   e esta folha é muito comentada de propósito. Os comentários servem quem lê o
   ficheiro; não servem ninguém no HTML. Ficam na fonte e saem no embutido.
   (O grão é um data URI e não contém `/*`, portanto isto não lhe toca.) */
const CSS = readFileSync(join(RAIZ, "assets/css/site.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

function cabecalho(atual) {
  // Só a Loja recebe a marca de «página actual». As âncoras não: estando
  // todas na mesma página, marcar as três ao mesmo tempo não diz nada a
  // ninguém — e para um leitor de ecrã é ruído, porque `aria-current="page"`
  // afirma que aquele é o destino em que estamos.
  const eAtual = (n) => Boolean(n.pagina) && atual === n.url;
  const liga = (n) => n.destaque
    ? `<span class="navegacao__risco" aria-hidden="true"></span>` +
      `<a class="nav-loja" href="${u(n.url)}"${eAtual(n) ? ' aria-current="page"' : ""}>${svg("saco")}${n.nome}</a>`
    : `<a href="${u(n.url)}"${eAtual(n) ? ' aria-current="page"' : ""}>${n.nome}</a>`;
  return `<div class="progresso" aria-hidden="true"></div>
<header class="cabecalho" data-encolhido="nao">
 <div class="cabecalho__interior">
  <a class="marca" href="${u("/")}" aria-label="Perfect Finish Studio — página inicial">
   <img class="marca__escudo" src="${u("/assets/img/marca/simbolo.svg")}" alt="" width="288" height="299">
   <img class="marca__nome" src="${u("/assets/img/marca/assinatura.svg")}" alt="Perfect Finish Studio" width="520" height="69">
  </a>
  <nav class="navegacao" aria-label="Principal">${NAV.map(liga).join("")}</nav>
  <a class="botao botao--cheio" href="${zap("Olá! Gostava de pedir um orçamento.")}" rel="noopener" target="_blank">Pedir orçamento</a>
  <a class="loja-movel" href="${u("/loja/")}" aria-label="Loja">${svg("saco")}</a>
  <button class="menu-botao" type="button" aria-expanded="false" aria-controls="menu" aria-label="Abrir menu"><span></span></button>
 </div>
</header>
<div class="menu" id="menu" data-aberto="nao">
 <div></div>
 <nav aria-label="Menu"><ul class="menu__lista">${NAV.map(
    (n, i) =>
      `<li><a href="${u(n.url)}"${eAtual(n) ? ' aria-current="page"' : ""}><span class="numero">0${i + 1}</span>${n.nome}</a></li>`
  ).join("")}</ul></nav>
 <div class="menu__pe">
  <a class="botao botao--cheio" href="${zap("Olá! Gostava de pedir um orçamento.")}" rel="noopener" target="_blank">Pedir orçamento por WhatsApp</a>
  <p class="menu__contacto"><strong>${TEL_TXT}</strong><br>${CUSTO}</p>
 </div>
</div>`;
}

function rodape() {
  const contacto = (icone, conteudo) =>
    `<li>${svg(icone)}<div>${conteudo}</div></li>`;
  return `<footer class="rodape">
 <div class="caixa">
  <div class="rodape__topo">
   <div class="rodape__marca">
    <img src="${u("/assets/img/marca/logotipo.svg")}" alt="Perfect Finish Studio" width="520" height="382" loading="lazy">
    <p>${esc(D.marca.descricao)}</p>
    <div class="redes">
     <a href="${esc(D.contactos.instagram)}" target="_blank" rel="noopener" aria-label="Instagram do Perfect Finish Studio">${svg("instagram")}</a>
     <a href="${esc(D.contactos.facebook)}" target="_blank" rel="noopener" aria-label="Facebook do Perfect Finish Studio">${svg("facebook")}</a>
     <a href="${zap("Olá!")}" target="_blank" rel="noopener" aria-label="WhatsApp do Perfect Finish Studio">${svg("zap")}</a>
    </div>
   </div>

   <div>
    <h4>Serviços</h4>
    <ul>${SERVICOS.map((s) => `<li><a href="${u(`/#s-${s.slug}`)}">${esc(s.nome)}</a></li>`).join("")}</ul>
   </div>

   <div>
    <h4>Contactos</h4>
    <ul class="rodape__contactos">
     ${contacto("telefone", `<a href="tel:+351${TEL}">${TEL_TXT}</a><br><span class="custo-chamada">${CUSTO}</span>`)}
     ${D.contactos.email ? contacto("email", `<a href="mailto:${esc(D.contactos.email)}">${esc(D.contactos.email)}</a>`) : ""}
     ${contacto("local", `${esc(D.morada.rua)}<br>${esc(D.morada.codigo_postal)} ${esc(D.morada.localidade)}`)}
     ${contacto("relogio", D.horario.map((h) => `${esc(h.dias)}: ${esc(h.horas)}`).join("<br>"))}
    </ul>
   </div>

   <div>
    <h4>Legal</h4>
    <ul class="rodape__legais">
     <li><a href="${u("/politica-de-privacidade/")}">Política de Privacidade</a></li>
     <li><a href="${u("/politica-de-cookies/")}">Cookies</a></li>
     <li><a href="${u("/informacao-legal/")}">Informação legal</a></li>
     <li><a class="rodape__gestao" href="https://app.pagescms.org/renatovalente5/PerfectFinish" target="_blank" rel="noopener">Gestão</a></li>
    </ul>
   </div>
  </div>

  <div class="rodape__fundo">
   <a class="livro" href="https://www.livroreclamacoes.pt/inicio" target="_blank" rel="noopener noreferrer"><img src="${u("/assets/img/ui/livro-reclamacoes.svg")}" alt="Livro de Reclamações Eletrónico" width="132" height="42" loading="lazy"></a>
   <p class="rodape__copyright">© ${new Date().getFullYear()} ${esc(D.marca.nome)}</p>
  </div>
 </div>
</footer>`;
}

const AVISO_COOKIES = `<aside class="cookies" role="dialog" aria-live="polite" aria-label="Aviso de privacidade">
 <p><strong>Este site não usa cookies.</strong> Não há publicidade, não há seguimento, não há estatísticas. Só precisamos da sua autorização para carregar o <strong>mapa do Google</strong> no fim desta página, porque isso é um pedido a um servidor da Google. <a href="${u("/politica-de-cookies/")}">Saber mais</a></p>
 <div class="cookies__accoes">
  <button class="botao botao--cheio" type="button" data-aceitar>Aceitar</button>
  <button class="botao botao--linha" type="button" data-recusar>Só o essencial</button>
 </div>
</aside>`;

/* --------------------------------------------------------------- JSON-LD */
function dadosEstruturados(pagina) {
  const negocio = {
    "@type": ["AutoBodyShop", "AutoWash"],
    "@id": `${SITE}/#estudio`,
    name: D.marca.nome,
    alternateName: D.marca.nome_completo,
    description: D.marca.descricao,
    url: `${SITE}/`,
    logo: {
      "@type": "ImageObject",
      "@id": `${SITE}/#logotipo`,
      url: abs("/assets/img/marca/favicon-512.png"),
      width: 512, height: 512,
    },
    image: abs("/assets/img/obras/audi-q4-etron-1-828.webp"),
    telephone: `+351${TEL}`,
    ...(D.contactos.email ? { email: D.contactos.email } : {}),
    priceRange: "€€",
    currenciesAccepted: "EUR",
    address: {
      "@type": "PostalAddress",
      streetAddress: D.morada.rua,
      postalCode: D.morada.codigo_postal,
      addressLocality: D.morada.localidade,
      addressRegion: D.morada.distrito,
      addressCountry: "PT",
    },
    geo: { "@type": "GeoCoordinates", latitude: D.morada.latitude, longitude: D.morada.longitude },
    hasMap: D.morada.mapa,
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "18:30" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "13:00" },
    ],
    areaServed: ["Leiria", "Marinha Grande", "Batalha", "Pombal", "Porto de Mós", "Ourém", "Fátima", "Alcobaça", "Nazaré", "Caldas da Rainha"]
      .map((n) => ({ "@type": "City", name: n })),
    knowsLanguage: ["pt-PT"],
    sameAs: [D.contactos.instagram, D.contactos.facebook, D.google.perfil].filter(Boolean),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `Serviços ${D.marca.nome}`,
      itemListElement: SERVICOS.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.nome_longo,
          url: abs(`/#s-${s.slug}`),
          provider: { "@id": `${SITE}/#estudio` },
        },
      })),
    },
  };

  const grafo = [
    negocio,
    { "@type": "WebSite", "@id": `${SITE}/#site`, url: `${SITE}/`, name: D.marca.nome,
      inLanguage: "pt-PT", publisher: { "@id": `${SITE}/#estudio` } },
    { "@type": "WebPage", "@id": `${abs(pagina.url)}#pagina`, url: abs(pagina.url),
      name: pagina.titulo, description: pagina.descricao, inLanguage: "pt-PT",
      isPartOf: { "@id": `${SITE}/#site` }, about: { "@id": `${SITE}/#estudio` } },
  ];

  if (pagina.migalhas?.length) {
    grafo.push({
      "@type": "BreadcrumbList",
      itemListElement: [{ nome: "Início", url: "/" }, ...pagina.migalhas].map((m, i) => ({
        "@type": "ListItem", position: i + 1, name: m.nome, item: abs(m.url),
      })),
    });
  }
  if (pagina.servico) {
    grafo.push({
      "@type": "Service", name: pagina.servico.nome_longo, serviceType: pagina.servico.nome,
      url: abs(pagina.url), provider: { "@id": `${SITE}/#estudio` },
      areaServed: { "@type": "City", name: "Leiria" },
      description: pagina.servico.resumo,
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": grafo });
}

/* ------------------------------------------------------------- estrutura */
function pagina({ url, titulo, descricao, corpo, migalhas = [], servico = null, classe = "" }) {
  const canonico = abs(url);
  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${canonico}">
<meta name="theme-color" content="#1A1717">
<meta name="robots" content="index, follow, max-image-preview:large">

<meta property="og:type" content="website">
<meta property="og:locale" content="pt_PT">
<meta property="og:site_name" content="${esc(D.marca.nome)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${canonico}">
<meta property="og:image" content="${abs("/assets/img/marca/og.png")}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="${u("/assets/img/marca/favicon.ico")}" sizes="any">
<link rel="icon" type="image/png" href="${u("/assets/img/marca/favicon-192.png")}" sizes="192x192">
<link rel="apple-touch-icon" href="${u("/assets/img/marca/favicon-180.png")}">
<link rel="manifest" href="${u("/site.webmanifest")}">

<link rel="preload" as="font" type="font/woff2" crossorigin href="${u("/assets/fonts/archivo-latin.woff2")}">
<style>
@font-face{font-family:"Archivo";src:url("${u("/assets/fonts/archivo-latin.woff2")}") format("woff2");font-weight:100 900;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"Inter Tight";src:url("${u("/assets/fonts/inter-tight-latin.woff2")}") format("woff2");font-weight:100 900;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
${CSS}
</style>
<script type="application/ld+json">${dadosEstruturados({ url, titulo, descricao, migalhas, servico })}</script>
</head>
<body${classe ? ` class="${classe}"` : ""}>
<a class="saltar" href="#conteudo">Saltar para o conteúdo</a>
<div class="grao" aria-hidden="true"></div>
${cabecalho(url)}
<main id="conteudo">
${migalhas.length ? `<nav class="migalhas caixa" aria-label="Migalhas" style="padding-top:calc(var(--cabecalho-alto) + 1.5rem)"><ol><li><a href="${u("/")}">Início</a></li>${migalhas
      .map((m, i) =>
        i === migalhas.length - 1
          ? `<li aria-current="page">${esc(m.nome)}</li>`
          : `<li><a href="${u(m.url)}">${esc(m.nome)}</a></li>`
      ).join("")}</ol></nav>` : ""}
${corpo}
</main>
${rodape()}
${AVISO_COOKIES}
<a class="zap-flutuante" href="${zap("Olá! Gostava de pedir um orçamento.")}"
   target="_blank" rel="noopener" aria-label="Falar por WhatsApp">${svg("zap", true)}</a>
<dialog class="lupa" id="lupa" popover aria-label="Fotografias do trabalho">
 <button class="lupa__fecho" type="button" popovertarget="lupa" popovertargetaction="hide" aria-label="Fechar">✕</button>
 <div class="lupa__palco">
  <button class="lupa__seta lupa__seta--tras" type="button" data-passo="-1" aria-label="Fotografia anterior">‹</button>
  <img alt="" width="828" height="828">
  <button class="lupa__seta lupa__seta--frente" type="button" data-passo="1" aria-label="Fotografia seguinte">›</button>
 </div>
 <p class="lupa__nota"></p>
</dialog>
<script src="${u("/assets/js/site.js")}" defer></script>
</body>
</html>`;
}

/* ============================================================== SECÇÕES == */

function blocoAvaliacoes({ claro = false } = {}) {
  const estrela = (cheia) =>
    `<svg viewBox="0 0 24 24" fill="${cheia ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${ICONE.estrela}</svg>`;
  const estrelas = (n) => `<span class="estrelas" role="img" aria-label="${n} de 5 estrelas">${
    Array.from({ length: 5 }, (_, i) => estrela(i < n)).join("")}</span>`;

  const critica = (c) => `<figure class="critica">
   ${estrelas(c.estrelas)}
   <blockquote>${esc(c.texto)}</blockquote>
   <figcaption>
    <span class="critica__autor">${esc(c.autor)}</span>
    <span class="critica__quando">${esc(c.quando)}</span>
    ${c.nota_traducao ? `<span class="critica__nota">${esc(c.nota_traducao)}</span>` : ""}
   </figcaption>
  </figure>`;

  return `<section class="seccao${claro ? " claro" : ""}" id="avaliacoes">
 <div class="caixa">
  <div class="avaliacoes" data-avaliacoes="${esc(D.google.endpoint || "")}">
   <div class="nota">
    <p class="sobrescrito">Avaliações no Google</p>
    <div class="nota__linha">
     <span class="nota__valor">${String(D.google.nota).replace(".", ",")}</span>
     <div>
      ${estrelas(5)}
      <span class="nota__conta">${D.google.total} avaliações</span>
     </div>
    </div>
    <a class="botao ${claro ? "botao--claro" : "botao--linha"}" href="${esc(D.google.perfil)}" target="_blank" rel="noopener">Ver todas no Google <span class="seta">→</span></a>
   </div>
   <div class="criticas">${AVALIACOES.criticas.map(critica).join("")}</div>
  </div>
  <p class="avaliacoes__nota-legal">
   Avaliações escritas por clientes no perfil do Perfect Finish no Google, onde
   podem ser lidas na íntegra. Reproduzimos aqui algumas das mais recentes, com
   o nome próprio e a inicial do apelido; a ordem é nossa. Não filtramos nem
   respondemos por elas — a classificação de ${String(D.google.nota).replace(".", ",")} é a média de todas as ${D.google.total}.
  </p>
 </div>
</section>`;
}

/** Os 13 serviços que o estúdio faz, cada um a ligar para a página que o
 *  cobre. Os cinco cartões acima são as áreas; esta é a lista completa, para
 *  quem procura um serviço concreto o encontrar pelo nome exacto. */
function listaCompleta() {
  return `<ul class="lista-servicos">${LISTA_SERVICOS.map((sv) =>
    `<li><a href="${u(`/#s-${sv.pagina}`)}"><span class="risco" aria-hidden="true"></span>${esc(sv.nome)}</a></li>`
  ).join("")}</ul>`;
}

const CTA = (titulo, texto) => `<section class="seccao">
 <div class="caixa" style="text-align:center;display:grid;justify-items:center;gap:var(--e-5)">
  <h2 class="ouro"><span>${esc(titulo)}</span></h2>
  <p class="medida" style="color:var(--osso-meio)">${esc(texto)}</p>
  <div class="accoes" style="justify-content:center;margin-top:var(--e-3)">
   <a class="botao botao--cheio" href="${zap("Olá! Gostava de pedir um orçamento.")}" target="_blank" rel="noopener">Falar por WhatsApp</a>
   <a class="botao botao--linha" href="tel:+351${TEL}">Ligar ${TEL_TXT}</a>
  </div>
  <p style="font-size:var(--t--2);color:var(--osso-fraco)">${CUSTO}</p>
 </div>
</section>`;

function comparador(par) {
  /* Aqui não se usa <picture>: as duas imagens têm de ficar sobrepostas em
     posição absoluta e o <picture> mete um elemento pelo meio. Usa-se o
     AVIF directamente, com o WebP como alternativa no `onerror` — o AVIF é
     Baseline há muito e o par de ficheiros existe sempre. */
  const img = (nome, alt, classe) => {
    const base = foto("obras", nome).replace(/\.webp$/, "");
    return `<img class="${classe}" src="${base}.avif" alt="${esc(alt)}" width="828" height="828"
 loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${base}.webp'">`;
  };
  return `<figure class="par">
 <div class="comparador">
  <span class="comparador__etiqueta antes">Antes</span>
  <span class="comparador__etiqueta depois">Depois</span>
  ${img(par.antes, par.alt_antes, "antes")}
  ${img(par.depois, par.alt_depois, "depois")}
  <span class="comparador__linha" aria-hidden="true"></span>
  <span class="comparador__pega" aria-hidden="true">◀▶</span>
  <input type="range" min="0" max="100" value="50" step="1"
   aria-label="Comparar antes e depois — ${esc(par.veiculo)}, ${esc(par.servico)}">
 </div>
 <figcaption>
  <span class="servico">${esc(par.servico)}</span>
  <span class="veiculo">${esc(par.veiculo)}</span>
  <p class="legenda">${esc(par.legenda)}</p>
 </figcaption>
</figure>`;
}

function cartaoObra(t) {
  const primeira = t.fotos[0];
  /* Todas as fotografias do trabalho vão no botão, e não só a primeira: a
     lupa passa a ser uma galeria por onde se anda. Antes ficavam 34 das 52
     fotografias curadas sem aparecer em sítio nenhum do site. */
  const galeria = JSON.stringify(t.fotos.map((f, i) => ({
    src: foto("obras", f),
    alt: `${t.veiculo} — ${t.servico}, fotografia ${i + 1} de ${t.fotos.length}`,
  })));
  return `<figure class="obra revelar">
 <button class="obra__foto" type="button"
   data-galeria="${esc(galeria)}"
   data-titulo="${esc(t.veiculo)} · ${esc(t.servico)}"
   aria-label="Ver ${esc(t.veiculo)}${t.fotos.length > 1 ? ` — ${t.fotos.length} fotografias` : ""}">
  ${figura("obras", primeira, `${t.veiculo} — ${t.servico} feito no Perfect Finish Studio, em Leiria`, {
    medidas: "(min-width: 64rem) 21rem, (min-width: 40rem) 32vw, 46vw",
  })}
  ${t.fotos.length > 1 ? `<span class="obra__conta" aria-hidden="true">${t.fotos.length}</span>` : ""}
 </button>
 <figcaption>
  <span class="servico">${esc(t.servico)}</span>
  <span class="veiculo">${esc(t.veiculo)}</span>
 </figcaption>
</figure>`;
}

/* ================================================================ PÁGINAS = */

/* As três fotografias da capa vêm dos dados (editáveis no backoffice). Se
   faltarem, cai nos destaques — o site nunca fica sem capa por causa de um
   campo vazio. */
const CAPA = (D.capa?.fotos || []).filter(Boolean);
const FOTOS_CAPA = CAPA.length === 3
  ? CAPA
  : TRABALHOS.filter((t) => t.destaque).slice(0, 3).map((t) => t.fotos[0]);

/** Texto alternativo de uma fotografia, tirado do trabalho a que ela pertence.
 *  Derivado e não escrito à mão: assim não fica a mentir quando o cliente
 *  trocar uma fotografia no backoffice. */
function alturaFoto(nome) {
  const dono = TRABALHOS.find((t) => t.fotos?.includes(nome));
  return dono
    ? `${dono.veiculo} — ${dono.servico} no Perfect Finish Studio, em Leiria`
    : "Trabalho do Perfect Finish Studio, em Leiria";
}

const IG = D.contactos.instagram;
const ig = (texto, classe = "botao botao--linha") =>
  `<a class="${classe}" href="${esc(IG)}" target="_blank" rel="noopener">${svg("instagram")}${texto}</a>`;

/**
 * Um serviço: uma imagem e o nome. Mais nada.
 *
 * Houve aqui blocos com introdução, três argumentos, avisos e perguntas
 * frequentes. O cliente foi claro — «não quero que me detalhes os serviços,
 * quero só imagens, nada de especificações» — e é a decisão dele.
 *
 * O texto não foi apagado dos dados: continua em `data/servicos/*.json` e
 * continua editável no backoffice. Se um dia voltar a ser preciso, está lá.
 * O aviso legal das películas (limites de transmissão luminosa) NÃO se perde
 * por isto — vive em /informacao-legal/, que é onde a lei o quer.
 *
 * Carregar na imagem abre a galeria daquele serviço, com as fotografias dos
 * trabalhos correspondentes: fica-se na mesma página e vêem-se mais imagens,
 * que é exactamente o que foi pedido.
 */
function cartaoServico(sv) {
  const fotos = TRABALHOS.filter((t) => t.pagina === sv.slug)
    .flatMap((t) => t.fotos).slice(0, 12);
  const capa = sv.imagem || fotos[0];

  /* O TIRA MOSSAS NÃO TEM FOTOGRAFIA UTILIZÁVEL em todo o acervo — e é o
     serviço que dá nome à casa. As três que existem estão contra a luz e a
     mossa não se lê a 414 px.
     Não se põe ali a fotografia de outro serviço: seria dizer que aquilo é
     tira mossas quando não é. Fica um cartão com o nome e o escudo, que
     manda para o Instagram. Assim a âncora continua a existir, a grelha não
     fica com um buraco, e ninguém é enganado.
     Quando houver fotografia — um plano aproximado com a tábua de leitura,
     antes e depois, no mesmo enquadramento — basta preencher o campo
     «Fotografia do serviço» no backoffice e este cartão passa a ser igual
     aos outros. */
  if (!capa) {
    return `<li class="cartao-servico cartao-servico--sem-foto">
  <a id="s-${esc(sv.slug)}" href="${esc(IG)}" target="_blank" rel="noopener"
     aria-label="${esc(sv.nome)} — ver exemplos no Instagram">
   <img src="${u("/assets/img/marca/simbolo.svg")}" alt="" width="288" height="299">
   <span class="cartao-servico__nome">${esc(sv.nome)}</span>
   <span class="cartao-servico__ig">Exemplos no Instagram →</span>
  </a>
 </li>`;
  }

  const galeria = JSON.stringify(fotos.map((f) => ({
    src: foto("obras", f), alt: alturaFoto(f),
  })));

  return `<li class="cartao-servico">
  <button type="button" id="s-${esc(sv.slug)}"
    data-galeria="${esc(galeria)}" data-titulo="${esc(sv.nome)}"
    aria-label="Ver ${esc(sv.nome)}${fotos.length ? ` — ${fotos.length} fotografias` : ""}">
   ${figura("obras", capa, `${sv.nome} — Perfect Finish Studio, em Leiria`, {
     medidas: "(min-width: 68rem) 22rem, (min-width: 44rem) 45vw, 92vw" })}
   <span class="cartao-servico__nome">${esc(sv.nome)}</span>
   ${fotos.length > 1 ? `<span class="cartao-servico__conta" aria-hidden="true">${fotos.length}</span>` : ""}
  </button>
 </li>`;
}

function inicio() {
  const destaques = TRABALHOS.filter((t) => t.destaque).slice(0, 8);

  const corpo = `
<section class="heroi">
 <div class="heroi__fundo" aria-hidden="true">
  <picture>
   <source media="(min-width: 64rem)" type="image/avif" srcset="${u("/assets/img/capa/capa-larga.avif")}">
   <source media="(min-width: 64rem)" type="image/webp" srcset="${u("/assets/img/capa/capa-larga.webp")}">
   <source type="image/avif" srcset="${u("/assets/img/capa/capa-alta.avif")}">
   <img src="${u("/assets/img/capa/capa-alta.webp")}" alt="" width="900" height="900" fetchpriority="high">
  </picture>
 </div>
 <div class="caixa heroi__interior">
  <div class="heroi__texto">
   <p class="sobrescrito">${esc(D.marca.reclamo)}</p>
   <h1 class="ouro"><span>${esc(D.textos.heroi_linha1)}</span><span>${esc(D.textos.heroi_linha2)}</span></h1>
   <p class="heroi__sub">${esc(D.textos.heroi_sub)}</p>
   <div class="accoes">
    <a class="botao botao--cheio" href="${zap("Olá! Gostava de pedir um orçamento.")}" target="_blank" rel="noopener">Pedir orçamento</a>
    <a class="botao botao--linha" href="${u("/#trabalhos")}">Ver trabalhos <span class="seta">→</span></a>
   </div>
  </div>

  <ul class="provas">
   <li><b>${String(D.google.nota).replace(".", ",")} ★</b><span>${D.google.total} avaliações no Google</span></li>
   <li><b>Leiria</b><span>e toda a região Centro</span></li>
  </ul>
 </div>
</section>

<section class="seccao" id="servicos">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">Serviços</p>
   <h2>O que fazemos</h2>
   <p>${esc(D.textos.sobre)}</p>
  </div>

  <ul class="cartoes-servico">${SERVICOS.map(cartaoServico).join("")}</ul>

  <div class="lista-servicos__caixa">
   <h3>Todos os serviços</h3>
   ${listaCompleta()}
  </div>

  <p class="fecho-seccao">Mais exemplos de cada serviço no Instagram → <a href="${esc(IG)}" target="_blank" rel="noopener">@perfectfinish.pt</a></p>
 </div>
</section>

<section class="seccao" id="antes-depois">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">Antes e depois</p>
   <h2>Arraste para ver a diferença</h2>
   <p>O mesmo carro, o mesmo enquadramento. Só muda o que fizemos.</p>
  </div>
 </div>
 <div class="pares">${PARES.slice(0, 3).map(comparador).join("")}</div>
 <div class="caixa"><p class="fecho-seccao">Os cinco comparadores completos estão em <a href="${u("/trabalhos/")}">Trabalhos</a>.</p></div>
</section>

<section class="seccao" id="trabalhos">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">Portefólio</p>
   <h2>Carros que passaram por cá</h2>
  </div>
  <div class="grelha">${destaques.map(cartaoObra).join("")}</div>

  <div class="painel-ig">
   <p>Isto são ${destaques.length}. O portefólio completo vive no Instagram, com
   trabalho novo quase todos os dias.</p>
   ${ig("Ver tudo no Instagram <span class=\"seta\">→</span>")}
   <p class="painel-ig__conta">@perfectfinish.pt</p>
   <p class="fecho-seccao">…ou ver os ${TRABALHOS.length} trabalhos aqui no site → <a href="${u("/trabalhos/")}">Trabalhos</a></p>
  </div>
 </div>
</section>

${blocoAvaliacoes({ claro: true })}

<section class="seccao" id="contactos">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">Contactos</p>
   <h2>Onde estamos</h2>
  </div>
  ${blocoContactos()}
 </div>
</section>`;

  return pagina({
    url: "/",
    titulo: "Studio de Customização Premium em Leiria | Perfect Finish",
    descricao: "Estúdio de customização em Leiria: tira mossas sem pintura, películas solares, PPF, envelopamento e car detail. 4,9 ★ em 94 avaliações no Google.",
    corpo,
  });
}

function indiceServicos() {
  const corpo = `<section class="seccao" style="padding-top:var(--e-7)">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">Serviços</p>
   <h1 class="titulo-pagina">O que fazemos,<br>e como</h1>
   <p>Cinco áreas. Em todas, o princípio é o mesmo: mexer o menos possível na pintura de origem.</p>
  </div>
  <ul class="indice">
   ${SERVICOS.map((s) => `<li><a href="${u(`/servicos/${s.slug}/`)}">
    <span class="numero"></span>
    <div><h3>${esc(s.nome_longo)}</h3><p>${esc(s.resumo)}</p></div>
    ${s.imagem ? `<figure>${figura("obras", s.imagem, `${s.nome} — Perfect Finish Studio`, { medidas: "8rem" })}</figure>` : "<figure></figure>"}
    <span class="seta" aria-hidden="true">→</span>
   </a></li>`).join("")}
  </ul>

  <div class="lista-servicos__caixa">
   <h3>Tudo o que fazemos</h3>
   ${listaCompleta()}
  </div>
 </div>
</section>
${CTA("Não sabe qual precisa?", "Descreva o problema e nós dizemos o que se aplica ao seu caso — mesmo que a resposta seja que não vale a pena.")}`;

  return pagina({
    url: "/servicos/",
    titulo: "Serviços — Tira Mossas, Películas e PPF | Perfect Finish",
    descricao: "Tira mossas sem pintura, películas solares, PPF, envelopamento e car detail em Leiria. Veja o que envolve cada serviço.",
    corpo,
    migalhas: [{ nome: "Serviços", url: "/servicos/" }],
  });
}

function paginaServico(s) {
  const obras = TRABALHOS.filter((t) => s.obras?.includes(t.slug));
  const paresDoServico = PARES.filter((p) =>
    obras.some((o) => o.slug === p.slug) || p.slug === s.slug);

  const corpo = `<section class="seccao" style="padding-top:var(--e-7)">
 <div class="caixa">
  <div style="display:grid;gap:var(--e-7);align-items:start"${s.imagem ? ' class="com-foto"' : ""}>
   <div>
    <p class="sobrescrito">${esc(s.alt)}</p>
    <h1 class="ouro" style="font-size:var(--t-4)"><span>${esc(s.nome_longo)}</span></h1>
    <p class="medida" style="font-size:var(--t-1);color:var(--osso-meio);margin-top:var(--e-5)">${esc(s.intro)}</p>
    <div class="accoes" style="margin-top:var(--e-6)">
     <a class="botao botao--cheio" href="${zap(`Olá! Queria saber mais sobre ${s.nome}.`)}" target="_blank" rel="noopener">Pedir orçamento</a>
    </div>
   </div>
  </div>
 </div>
</section>

<section class="seccao claro">
 <div class="caixa">
  <p class="sobrescrito">Porquê</p>
  <ul class="garantias" style="margin-top:var(--e-6)">
   ${s.porque.map((x) => `<li><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></li>`).join("")}
  </ul>
  ${s.lista ? `<div style="margin-top:var(--e-8)"><p class="sobrescrito">Inclui</p><ul style="columns:2;column-gap:var(--e-7);list-style:none;font-size:var(--t--1);line-height:2">${s.lista.map((x) => `<li>— ${esc(x)}</li>`).join("")}</ul></div>` : ""}
  ${s.quando_nao ? `<div class="aviso" style="margin-top:var(--e-7);max-width:60ch">${esc(s.quando_nao)}</div>` : ""}
  ${s.legal ? `<div class="aviso" style="margin-top:var(--e-7);max-width:60ch">${forte(s.legal)}</div>` : ""}
 </div>
</section>

${paresDoServico.length ? `<section class="seccao">
 <div class="caixa"><div class="cabeca-seccao"><p class="sobrescrito">Antes e depois</p><h2>Feito por nós</h2></div></div>
 <div class="pares">${paresDoServico.map(comparador).join("")}</div>
</section>` : ""}

${obras.length ? `<section class="seccao">
 <div class="caixa">
  <div class="cabeca-seccao"><p class="sobrescrito">Trabalhos</p><h2>${esc(s.nome)} no estúdio</h2></div>
  <div class="grelha">${obras.map(cartaoObra).join("")}</div>
 </div>
</section>` : ""}

<section class="seccao">
 <div class="caixa">
  <div class="cabeca-seccao"><p class="sobrescrito">Perguntas</p><h2>O que nos perguntam</h2></div>
  <div class="faq">
   ${s.faq.map((x) => `<details><summary>${esc(x.pergunta)}</summary><div>${esc(x.resposta)}</div></details>`).join("")}
  </div>
 </div>
</section>

<section class="seccao claro">
 <div class="caixa">
  <p class="sobrescrito">Outros serviços</p>
  <ul class="indice" style="margin-top:var(--e-5)">
   ${SERVICOS.filter((o) => o.slug !== s.slug).slice(0, 3).map((o) => `<li><a href="${u(`/servicos/${o.slug}/`)}">
     <span class="numero"></span><div><h3>${esc(o.nome)}</h3><p>${esc(o.resumo)}</p></div>
     <figure></figure><span class="seta" aria-hidden="true">→</span></a></li>`).join("")}
  </ul>
 </div>
</section>

${CTA(`Precisa de ${s.nome.toLowerCase()}?`, "Mande-nos uma mensagem com uma fotografia e dizemos-lhe já o que dá para fazer.")}`;

  return pagina({
    url: `/servicos/${s.slug}/`,
    titulo: s.titulo_seo,
    descricao: s.descricao_seo,
    corpo,
    migalhas: [{ nome: "Serviços", url: "/servicos/" }, { nome: s.nome, url: `/servicos/${s.slug}/` }],
    servico: s,
  });
}

function trabalhos() {
  const corpo = `<section class="seccao" style="padding-top:var(--e-7)">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">Portefólio</p>
   <h1 class="titulo-pagina">Trabalhos</h1>
   <p>Carros que passaram pelo estúdio. As matrículas foram desfocadas por respeito pela privacidade dos clientes.</p>
  </div>
 </div>
 <div class="caixa"><div class="grelha">${TRABALHOS.map(cartaoObra).join("")}</div></div>
</section>

<section class="seccao">
 <div class="caixa"><div class="cabeca-seccao"><p class="sobrescrito">Antes e depois</p><h2>Arraste para comparar</h2></div></div>
 <div class="pares">${PARES.map(comparador).join("")}</div>
</section>

<section class="seccao claro">
 <div class="caixa" style="text-align:center;display:grid;justify-items:center;gap:var(--e-5)">
  <p class="sobrescrito">Instagram</p>
  <h2>Há mais, e é actualizado quase todos os dias</h2>
  <p class="medida">Estes são os trabalhos que escolhemos para aqui. O portefólio completo está no Instagram.</p>
  ${ig("Ver tudo no Instagram <span class=\"seta\">→</span>", "botao botao--claro")}
 </div>
</section>
${CTA("O próximo pode ser o seu", "Traga o carro ou mande-nos uma fotografia. Respondemos com o que dá para fazer e quanto custa.")}`;

  return pagina({
    url: "/trabalhos/",
    titulo: "Trabalhos — Envelopamento e Detail | Perfect Finish Leiria",
    descricao: "Portefólio do Perfect Finish Studio em Leiria: Ferrari, Porsche, Rolls-Royce, Audi e Mercedes. Envelopamento, correção de pintura, PPF e películas.",
    corpo,
    migalhas: [{ nome: "Trabalhos", url: "/trabalhos/" }],
  });
}

function loja() {
  const cartao = (p) => `<article class="produto revelar">
 <div class="produto__imagem">${figura("loja", p.foto || p.slug, `${p.nome} — ${p.familia}`, {
    medidas: "(min-width: 64rem) 16rem, (min-width: 40rem) 45vw, 92vw",
  })}</div>
 <div class="produto__corpo">
  <span class="produto__familia">${esc(p.familia)}</span>
  <h3>${esc(p.nome)}</h3>
  <p>${esc(p.descricao)}</p>
  <span class="produto__preco">${p.preco ? `${String(p.preco).replace(".", ",")} €<small>IVA incluído · ${esc(p.formato)}</small>` : `Sob consulta<small>${esc(p.formato)}</small>`}</span>
 </div>
 <a class="botao botao--linha" href="${zap(`Olá! Tenho interesse no produto: ${p.nome} (${p.formato}). Pode dizer-me o preço e a disponibilidade?`)}" target="_blank" rel="noopener">Pedir por WhatsApp <span class="seta">→</span></a>
</article>`;

  const corpo = `<section class="seccao" style="padding-top:var(--e-7)">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">Loja</p>
   <h1 class="titulo-pagina">Produtos que<br>usamos no estúdio</h1>
   <p>O que temos à venda ao balcão. Escolha o produto e fale connosco — dizemos-lhe o preço, a disponibilidade e como se usa.</p>
  </div>
  <div class="aviso" style="margin-bottom:var(--e-7)">
   <strong>Como funciona:</strong> esta página é uma montra. Não há compra nem pagamento no site.
   Ao carregar em «Pedir por WhatsApp» abre uma conversa connosco com o produto já indicado;
   combinamos aí o preço, a disponibilidade e a entrega, e a venda é fechada presencialmente no estúdio.
  </div>
  <div class="produtos">${PRODUTOS.map(cartao).join("")}</div>
 </div>
</section>
${CTA("Não encontra o que procura?", "Trabalhamos com mais marcas e formatos do que os que estão aqui. Pergunte-nos.")}`;

  return pagina({
    url: "/loja/",
    titulo: "Loja — Produtos de Detailing | Perfect Finish Studio Leiria",
    descricao: "Shampoo, selantes, descontaminantes e acessórios de detailing no Perfect Finish Studio, em Leiria. Peça por WhatsApp.",
    corpo,
    migalhas: [{ nome: "Loja", url: "/loja/" }],
  });
}

/** Os contactos, o mapa e a zona de serviço. Usado na página inicial (como
 *  secção) e na página /contactos/ (que continua a existir para quem chega
 *  do Google a pesquisar «perfect finish contactos»). */
function blocoContactos() {
  return `<div class="contactos">
   <dl class="dados">
    <div class="dado">${svg("telefone")}<div>
     <dt>Telefone</dt>
     <dd><a href="tel:+351${TEL}">${TEL_TXT}</a><span class="custo-chamada">${CUSTO}</span></dd>
    </div></div>
    <div class="dado">${svg("zap")}<div>
     <dt>WhatsApp</dt>
     <dd><a href="${zap("Olá! Gostava de pedir um orçamento.")}" target="_blank" rel="noopener">Abrir conversa</a></dd>
    </div></div>
    ${D.contactos.email ? `<div class="dado">${svg("email")}<div><dt>E-mail</dt><dd><a href="mailto:${esc(D.contactos.email)}">${esc(D.contactos.email)}</a></dd></div></div>` : ""}
    <div class="dado">${svg("local")}<div>
     <dt>Morada</dt>
     <dd>${esc(D.morada.rua)}<br>${esc(D.morada.codigo_postal)} ${esc(D.morada.localidade)}<br>
     <a href="${esc(D.morada.mapa)}" target="_blank" rel="noopener">Abrir no Google Maps →</a></dd>
    </div></div>
    <div class="dado">${svg("relogio")}<div>
     <dt>Horário</dt>
     <dd><ul class="horario">${D.horario.map((h) => `<li data-dias="${esc(h.indices)}"><span class="dia">${esc(h.dias)}</span><span>${esc(h.horas)}</span></li>`).join("")}</ul></dd>
    </div></div>
    <div class="dado">${svg("instagram")}<div>
     <dt>Instagram</dt>
     <dd><a href="${esc(IG)}" target="_blank" rel="noopener">@perfectfinish.pt</a></dd>
    </div></div>
    <div class="dado">${svg("local")}<div>
     <dt>Zona de serviço</dt>
     <dd>Leiria, Marinha Grande, Batalha, Pombal, Porto de Mós, Ourém, Fátima,
     Alcobaça, Nazaré e Caldas da Rainha.</dd>
    </div></div>
   </dl>

   <div>
    <div class="mapa" data-incorporar="${esc(D.google.incorporar)}">
     <div class="mapa__fundo" aria-hidden="true"></div>
     <div class="mapa__convite">
      <p><strong>Mapa do Google</strong><br>Carregar o mapa envia o seu endereço IP para a Google. Só o fazemos com a sua autorização.</p>
      <button class="botao botao--linha" type="button" data-carregar-mapa>Carregar o mapa</button>
      <p style="font-size:var(--t--2)"><a href="${esc(D.morada.mapa)}" target="_blank" rel="noopener">…ou abrir directamente no Google Maps →</a></p>
     </div>
    </div>
   </div>
  </div>`;
}

function contactos() {
  const corpo = `<section class="seccao" style="padding-top:var(--e-7)">
 <div class="caixa">
  <div class="cabeca-seccao"><p class="sobrescrito">Contactos</p><h1 class="titulo-pagina">Onde estamos</h1></div>
  ${blocoContactos()}
 </div>
</section>
${CTA("Marque connosco", "Diga-nos o que precisa e combinamos o dia. A maioria dos trabalhos fica pronta no próprio dia.")}`;

  return pagina({
    url: "/contactos/",
    titulo: "Contactos — Perfect Finish Studio, Leiria",
    descricao: `Perfect Finish Studio: ${D.morada.rua}, ${D.morada.codigo_postal} ${D.morada.localidade}. Telefone ${TEL_TXT}. Segunda a sexta 09:00–18:30, sábado 09:00–13:00.`,
    corpo,
    migalhas: [{ nome: "Contactos", url: "/contactos/" }],
  });
}

/* ------------------------------------------------------------- páginas legais */
function paginaTexto(url, titulo, descricao, nome, html) {
  return pagina({
    url, titulo, descricao,
    corpo: `<section class="seccao" style="padding-top:var(--e-7)"><div class="caixa">
     <div class="cabeca-seccao"><p class="sobrescrito">Informação</p><h1 class="titulo-pagina">${esc(nome)}</h1></div>
     <div class="texto">${html}</div></div></section>`,
    migalhas: [{ nome, url }],
  });
}

const IDENT = `<p><strong>${esc(D.marca.nome_completo)}</strong><br>
${D.empresa.titular ? `${esc(D.empresa.titular)} — ${esc(D.empresa.forma)}<br>` : `<em>[Nome civil do titular — a preencher]</em><br>`}
NIF: ${esc(D.empresa.nif)}<br>
${esc(D.morada.rua)}, ${esc(D.morada.codigo_postal)} ${esc(D.morada.localidade)}, ${esc(D.morada.pais)}<br>
Telefone: <a href="tel:+351${TEL}">${TEL_TXT}</a> ${CUSTO}<br>
${D.contactos.email ? `E-mail: <a href="mailto:${esc(D.contactos.email)}">${esc(D.contactos.email)}</a>` : "<em>E-mail: a preencher</em>"}</p>`;

const informacaoLegal = () => paginaTexto(
  "/informacao-legal/",
  "Informação Legal | Perfect Finish Studio Leiria",
  "Identificação do prestador, resolução alternativa de litígios, garantias e livro de reclamações do Perfect Finish Studio, em Leiria.",
  "Informação legal",
  `<h2>Identificação do prestador</h2>
${IDENT}
<p>Informação prestada nos termos do artigo 10.º do Decreto-Lei n.º 7/2004, de 7 de janeiro.</p>

<h2>Livro de Reclamações</h2>
<p>Está à sua disposição o Livro de Reclamações Eletrónico, nos termos do Decreto-Lei n.º 156/2005,
de 15 de setembro, na sua redação atual.</p>
<p><a href="https://www.livroreclamacoes.pt/inicio" target="_blank" rel="noopener noreferrer">www.livroreclamacoes.pt</a></p>

<h2>Resolução alternativa de litígios</h2>
<p>Em caso de litígio de consumo, o consumidor pode recorrer a uma entidade de resolução
alternativa de litígios, nos termos da Lei n.º 144/2015, de 8 de setembro.</p>
<p>A entidade competente é o <strong>CNIACC — Centro Nacional de Informação e Arbitragem de
Conflitos de Consumo</strong>:</p>
<p>Rua D. Afonso Henriques, n.º 1, 4700-030 Braga<br>
Telefone: 253 619 607<br>
<a href="https://www.cniacc.pt/" target="_blank" rel="noopener noreferrer">www.cniacc.pt</a></p>
<p>Mais informação em <a href="https://www.consumidor.gov.pt/" target="_blank" rel="noopener noreferrer">Portal do Consumidor</a>.</p>

<h2>Garantias</h2>
<p>Aos bens vendidos a consumidores aplica-se a garantia legal de conformidade prevista no
Decreto-Lei n.º 84/2021, de 18 de outubro: <strong>três anos</strong> para bens móveis, contados da
entrega.</p>
<p>Aos serviços prestados aplica-se o regime da empreitada previsto no Código Civil. A duração e
o âmbito de qualquer garantia comercial adicional são indicados por escrito no orçamento ou na
fatura do trabalho em causa.</p>

<h2>A nossa loja</h2>
<p>A página <a href="${u("/loja/")}">Loja</a> é uma <strong>montra</strong>. Não é possível comprar nem pagar
através deste site. Ao carregar em «Pedir por WhatsApp» inicia uma conversa connosco; o preço, a
disponibilidade e a entrega são combinados nessa conversa e a venda é concluída presencialmente
no estúdio. Não se trata, por isso, de um contrato celebrado à distância.</p>

<h2>Preços</h2>
<p>Os preços que venham a ser indicados neste site são preços finais, com IVA incluído à taxa
legal em vigor, nos termos do Decreto-Lei n.º 138/90, de 26 de abril.</p>

<h2>Películas solares</h2>
<p>A aplicação de películas em vidros de veículos está sujeita aos limites de transmissão
luminosa fixados no Decreto-Lei n.º 40/2003, de 11 de março, e regulamentação conexa:
<strong>mínimo de 75% no para-brisas</strong> e <strong>70% nos vidros laterais à frente do
condutor</strong>. Não aplicamos películas que façam o veículo descer abaixo destes valores nesses
vidros.</p>

<h2>Propriedade intelectual</h2>
<p>As fotografias de trabalhos publicadas neste site são da autoria do Perfect Finish Studio. As
marcas e os modelos de veículos referidos pertencem aos respetivos titulares e são mencionados
apenas para identificar o trabalho realizado.</p>`
);

const politicaPrivacidade = () => paginaTexto(
  "/politica-de-privacidade/",
  "Política de Privacidade | Perfect Finish Studio",
  "Como o Perfect Finish Studio trata os seus dados pessoais. Este site não recolhe dados nem usa cookies.",
  "Política de Privacidade",
  `<p>Última atualização: ${new Date().toLocaleDateString("pt-PT", { year: "numeric", month: "long" })}.</p>

<h2>Quem é o responsável</h2>
${IDENT}

<h2>O que este site recolhe</h2>
<p><strong>Nada.</strong> Este site não tem formulários, não tem conta de utilizador, não tem
newsletter, não usa cookies e não tem ferramentas de estatísticas ou de publicidade. Ao navegar
aqui não nos deixa dados pessoais nenhuns.</p>

<h2>Registos do servidor</h2>
<p>O site é alojado no GitHub Pages (GitHub, Inc.). Como qualquer servidor web, o alojamento
regista tecnicamente os pedidos que recebe, incluindo o endereço IP, por motivos de segurança e
de funcionamento. Não temos acesso a esses registos nem os usamos.</p>

<h2>Mapa do Google</h2>
<p>No fim da página inicial, em <a href="${u("/#contactos")}">Contactos</a>, existe um mapa. <strong>Esse mapa não é
carregado automaticamente.</strong> Só é carregado se o autorizar expressamente, porque carregá-lo
implica um pedido a servidores da Google, que passa a conhecer o seu endereço IP e a receber
informação sobre o seu navegador. Enquanto não autorizar, vê apenas um cartão estático e uma
ligação para abrir o Google Maps por sua iniciativa.</p>
<p>Fundamento: o seu consentimento (artigo 6.º, n.º 1, alínea a) do RGPD, e artigo 5.º da Lei
n.º 41/2004). Pode retirá-lo a qualquer momento limpando os dados deste site no seu navegador.</p>

<h2>Avaliações do Google</h2>
<p>Mostramos a classificação média e o número de avaliações do nosso perfil do Google. Não
guardamos no site o texto das avaliações nem os nomes ou fotografias de quem as escreveu. Ao
carregar em «Ler no Google» é encaminhado para o Google, onde se aplicam os termos e a política
de privacidade da Google.</p>

<h2>WhatsApp e telefone</h2>
<p>Se nos contactar por WhatsApp ou por telefone, tratamos os dados que nos der (nome, contacto,
o que descrever sobre o carro) para lhe responder e para prestar o serviço. Fundamento: diligências
pré-contratuais e execução do contrato (artigo 6.º, n.º 1, alíneas b) do RGPD). O WhatsApp é um
serviço da Meta Platforms Ireland Ltd. e o seu uso rege-se pelos termos da Meta.</p>

<h2>Durante quanto tempo</h2>
<p>Os dados de contacto e do serviço são conservados enquanto durar a relação e, depois, pelos
prazos legais aplicáveis — em especial os prazos fiscais e os de garantia.</p>

<h2>Os seus direitos</h2>
<p>Pode pedir-nos o acesso, a retificação, o apagamento, a limitação ou a portabilidade dos seus
dados, e opor-se ao tratamento. Basta contactar-nos pelos meios indicados acima. Se entender que
não respeitámos os seus direitos, pode apresentar reclamação à
<a href="https://www.cnpd.pt/" target="_blank" rel="noopener noreferrer">CNPD — Comissão Nacional
de Proteção de Dados</a>.</p>`
);

const politicaCookies = () => paginaTexto(
  "/politica-de-cookies/",
  "Cookies | Perfect Finish Studio",
  "Este site não utiliza cookies. Explicamos o que guardamos e porquê.",
  "Cookies",
  `<h2>Este site não usa cookies</h2>
<p>Não há cookies de publicidade, não há cookies de estatísticas e não há cookies de redes
sociais. Não usamos Google Analytics nem nenhuma ferramenta equivalente.</p>

<h2>Então porque aparece um aviso?</h2>
<p>Porque há uma coisa que precisa mesmo da sua autorização: o <strong>mapa do Google</strong> no
fim da página inicial. Carregar esse mapa é fazer um pedido a servidores da Google, que passam a
conhecer o seu endereço IP. Não fazemos isso sem que nos diga que sim.</p>
<p>Se carregar em «Só o essencial», o mapa não é carregado e fica apenas uma ligação que abre o
Google Maps quando <em>você</em> quiser.</p>

<h2>O que fica guardado no seu equipamento</h2>
<dl>
 <dt>pf-mapa</dt>
 <dd>Guarda apenas «sim» ou «não» — a sua resposta ao aviso — para não lhe voltarmos a perguntar.
 É guardado no <em>armazenamento local</em> do navegador, não é um cookie e nunca é enviado para
 nenhum servidor. Fica no seu equipamento até limpar os dados do site.</dd>
</dl>

<h2>Como apagar</h2>
<p>Nas definições do navegador, em «Dados dos sites» ou «Privacidade», apague os dados deste
site. O aviso voltará a aparecer na visita seguinte.</p>`
);

function naoEncontrada() {
  return pagina({
    url: "/404.html",
    titulo: "Página não encontrada | Perfect Finish Studio",
    descricao: "A página que procura não existe.",
    corpo: `<section class="seccao" style="padding-top:calc(var(--cabecalho-alto) + 4rem);min-height:60svh;display:grid;place-items:center;text-align:center">
     <div class="caixa" style="display:grid;justify-items:center;gap:var(--e-5)">
      <p class="sobrescrito">Erro 404</p>
      <h1 class="ouro" style="font-size:var(--t-4)"><span>Página não</span><span>encontrada</span></h1>
      <p class="medida" style="color:var(--osso-meio)">A página que procura mudou de sítio ou nunca existiu.</p>
      <p class="medida" style="color:var(--osso-fraco);font-size:var(--t--1)">
       As páginas de cada serviço passaram a ser secções da página inicial.
       Talvez seja isto que procura:</p>
      <ul class="lista-servicos" style="text-align:left;max-width:34rem">
       ${SERVICOS.map((sv) => `<li><a href="${u(`/#s-${sv.slug}`)}"><span class="risco" aria-hidden="true"></span>${esc(sv.nome_longo)}</a></li>`).join("")}
      </ul>
      <div class="accoes" style="justify-content:center">
       <a class="botao botao--cheio" href="${zap("Olá! Gostava de pedir um orçamento.")}" target="_blank" rel="noopener">Falar por WhatsApp</a>
       <a class="botao botao--linha" href="${u("/trabalhos/")}">Ver trabalhos <span class="seta">→</span></a>
       <a class="botao botao--linha" href="${u("/loja/")}">Loja <span class="seta">→</span></a>
      </div>
     </div></section>`,
  });
}

/* ================================================================ escrever = */
function escrever(caminho, conteudo) {
  const destino = join(SAIDA, caminho);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, conteudo);
  return conteudo.length;
}

rmSync(SAIDA, { recursive: true, force: true });
mkdirSync(SAIDA, { recursive: true });

const PAGINAS = [
  ["index.html", inicio(), "/"],

  /* As páginas próprias por serviço só entram com a bandeira ligada. O
     sitemap é derivado desta lista, portanto acompanha sozinho. */
  ...(PAGINAS_DE_SERVICO ? [
    ["servicos/index.html", indiceServicos(), "/servicos/"],
    ...SERVICOS.map((s) => [`servicos/${s.slug}/index.html`, paginaServico(s), `/servicos/${s.slug}/`]),
  ] : []),

  ["trabalhos/index.html", trabalhos(), "/trabalhos/"],
  ["loja/index.html", loja(), "/loja/"],
  ["informacao-legal/index.html", informacaoLegal(), "/informacao-legal/"],
  ["politica-de-privacidade/index.html", politicaPrivacidade(), "/politica-de-privacidade/"],
  ["politica-de-cookies/index.html", politicaCookies(), "/politica-de-cookies/"],
  ["404.html", naoEncontrada(), null],
];

let total = 0;
for (const [caminho, html] of PAGINAS) total += escrever(caminho, html);

/* Assets. O `.nojekyll` é obrigatório: sem ele o GitHub Pages passa tudo pelo
   Jekyll e ignora silenciosamente qualquer pasta começada por underscore. */
for (const pasta of ["assets"]) cpSync(join(RAIZ, pasta), join(SAIDA, pasta), { recursive: true });
escrever(".nojekyll", "");
if (CNAME) escrever("CNAME", CNAME + "\n");

escrever("robots.txt", `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

const hoje = new Date().toISOString().slice(0, 10);
escrever("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGINAS.filter(([, , url]) => url).map(([, , url]) =>
  `<url><loc>${abs(url)}</loc><lastmod>${hoje}</lastmod><changefreq>monthly</changefreq><priority>${url === "/" ? "1.0" : url.startsWith("/servicos/") ? "0.9" : "0.7"}</priority></url>`
).join("\n")}
</urlset>
`);

escrever("site.webmanifest", JSON.stringify({
  name: D.marca.nome, short_name: "Perfect Finish", lang: "pt-PT",
  start_url: u("/"), display: "standalone",
  background_color: "#1A1717", theme_color: "#1A1717",
  icons: [192, 512].map((n) => ({
    src: u(`/assets/img/marca/favicon-${n}.png`), sizes: `${n}x${n}`, type: "image/png", purpose: "any",
  })),
}, null, 1));

console.log(`${PAGINAS.length} páginas · ${(total / 1024).toFixed(0)} kB de HTML`);
console.log(`base: ${SITE}${BASE ? `  (subpasta ${BASE})` : "  (raiz do domínio)"}`);
