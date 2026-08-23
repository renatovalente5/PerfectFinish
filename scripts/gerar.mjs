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
/* O ficheiro vem do backoffice como objecto (`{ pares: [...] }`); aceita-se
   também o array solto, que é como estava antes de existir o backoffice. */
const _pares = ler("data/pares.json");
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
function figura(pasta, nome, alt, { classe = "", prioridade = false, medidas = "100vw" } = {}) {
  const carregamento = prioridade
    ? 'fetchpriority="high"'
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
  estrela: '<path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17l-5.25 2.75 1-5.85L3.5 9.75l5.9-.85z"/>',
};
const svg = (nome, preenchido = false) =>
  `<svg viewBox="0 0 24 24" fill="${preenchido ? "currentColor" : "none"}" stroke="${preenchido ? "none" : "currentColor"}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[nome]}</svg>`;

/* -------------------------------------------------------------- navegação */
const NAV = [
  { url: "/servicos/", nome: "Serviços" },
  { url: "/trabalhos/", nome: "Trabalhos" },
  { url: "/loja/", nome: "Loja" },
  { url: "/contactos/", nome: "Contactos" },
];

/* -------------------------------------------------------------- estrutura */
const CSS = readFileSync(join(RAIZ, "assets/css/site.css"), "utf8");

function cabecalho(atual) {
  const liga = (n) =>
    `<a href="${u(n.url)}"${atual === n.url ? ' aria-current="page"' : ""}>${n.nome}</a>`;
  return `<div class="progresso" aria-hidden="true"></div>
<header class="cabecalho" data-encolhido="nao">
 <div class="cabecalho__interior">
  <a class="marca" href="${u("/")}" aria-label="Perfect Finish Studio — página inicial">
   <img class="marca__escudo" src="${u("/assets/img/marca/simbolo.svg")}" alt="" width="288" height="299">
   <img class="marca__nome" src="${u("/assets/img/marca/assinatura.svg")}" alt="Perfect Finish Studio" width="520" height="69">
  </a>
  <nav class="navegacao" aria-label="Principal">${NAV.map(liga).join("")}</nav>
  <a class="botao botao--cheio" href="${zap("Olá! Gostava de pedir um orçamento.")}" rel="noopener" target="_blank">Pedir orçamento</a>
  <button class="menu-botao" type="button" aria-expanded="false" aria-controls="menu" aria-label="Abrir menu"><span></span></button>
 </div>
</header>
<div class="menu" id="menu" data-aberto="nao">
 <div></div>
 <nav aria-label="Menu"><ul class="menu__lista">${NAV.map(
    (n, i) =>
      `<li><a href="${u(n.url)}"${atual === n.url ? ' aria-current="page"' : ""}><span class="numero">0${i + 1}</span>${n.nome}</a></li>`
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
    <ul>${SERVICOS.map((s) => `<li><a href="${u(`/servicos/${s.slug}/`)}">${esc(s.nome)}</a></li>`).join("")}</ul>
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
  </div>

  <div class="rodape__fundo">
   <p class="rodape__legal">
    <strong>${esc(D.marca.nome_completo)}</strong><br>
    ${D.empresa.titular ? `${esc(D.empresa.titular)}, ${esc(D.empresa.forma)}<br>` : ""}
    NIF ${esc(D.empresa.nif)} · ${esc(D.morada.rua)}, ${esc(D.morada.codigo_postal)} ${esc(D.morada.localidade)}
   </p>
   <ul class="rodape__ligacoes">
    <li><a class="livro" href="https://www.livroreclamacoes.pt/inicio" target="_blank" rel="noopener noreferrer"><img src="${u("/assets/img/ui/livro-reclamacoes.svg")}" alt="Livro de Reclamações Eletrónico" width="132" height="42" loading="lazy"></a></li>
    <li><a href="${u("/politica-de-privacidade/")}">Política de Privacidade</a></li>
    <li><a href="${u("/politica-de-cookies/")}">Cookies</a></li>
    <li><a href="${u("/informacao-legal/")}">Informação legal</a></li>
    <li><a class="rodape__gestao" href="https://app.pagescms.org/renatovalente5/PerfectFinish" target="_blank" rel="noopener">Gestão</a></li>
   </ul>
   <p class="rodape__legal">© ${new Date().getFullYear()} ${esc(D.marca.nome)}. Informação prestada nos termos do artigo 10.º do Decreto-Lei n.º 7/2004.</p>
  </div>
 </div>
</footer>`;
}

const AVISO_COOKIES = `<aside class="cookies" role="dialog" aria-live="polite" aria-label="Aviso de privacidade">
 <p><strong>Este site não usa cookies.</strong> Não há publicidade, não há seguimento, não há estatísticas. Só precisamos da sua autorização para carregar o <strong>mapa do Google</strong> na página de contactos, porque isso é um pedido a um servidor da Google. <a href="${u("/politica-de-cookies/")}">Saber mais</a></p>
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
      itemElement: undefined,
      itemListElement: SERVICOS.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.nome_longo,
          url: abs(`/servicos/${s.slug}/`),
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

<link rel="preload" as="font" type="font/woff2" crossorigin href="${u("/assets/fonts/archivo-expanded-latin.woff2")}">
<style>
@font-face{font-family:"Archivo Expanded";src:url("${u("/assets/fonts/archivo-expanded-latin.woff2")}") format("woff2");font-weight:100 900;font-stretch:125%;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
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
<dialog class="lupa" id="lupa" popover>
 <button class="lupa__fecho" type="button" popovertarget="lupa" popovertargetaction="hide" aria-label="Fechar">✕</button>
 <img alt="" width="828" height="828">
 <p class="lupa__nota"></p>
</dialog>
<script src="${u("/assets/js/site.js")}" defer></script>
</body>
</html>`;
}

/* ============================================================== SECÇÕES == */

function blocoAvaliacoes({ claro = false } = {}) {
  const estrelas = "★".repeat(5);
  return `<section class="seccao${claro ? " claro" : ""}">
 <div class="caixa">
  <p class="sobrescrito">O que dizem</p>
  <div class="avaliacoes" data-avaliacoes="${esc(D.google.endpoint || "")}">
   <div class="nota">
    <span class="nota__valor">${String(D.google.nota).replace(".", ",")}</span>
    <span class="nota__estrelas" aria-hidden="true">${estrelas}</span>
    <span class="nota__conta">${D.google.total} avaliações no Google</span>
    <a class="botao botao--linha" style="margin-top:1rem" href="${esc(D.google.perfil)}" target="_blank" rel="noopener">Ler no Google <span class="seta">→</span></a>
   </div>
   <div>
    <p style="font-size:var(--t-2);line-height:1.35;font-family:var(--letra-titulo);font-stretch:125%;text-transform:uppercase;font-weight:600">
     ${D.google.total} clientes avaliaram este estúdio com ${String(D.google.nota).replace(".", ",")} em 5.
    </p>
    <p class="avaliacoes__nota-legal">
     A classificação e o número de avaliações vêm do perfil do Perfect Finish no Google.
     As avaliações são escritas por clientes, no Google, e não são filtradas nem
     ordenadas por nós — carregue em <em>Ler no Google</em> para as ver todas.
    </p>
   </div>
  </div>
 </div>
</section>`;
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
  const img = (nome, alt, classe) =>
    `<img class="${classe}" src="${foto("obras", nome)}" alt="${esc(alt)}" width="828" height="828" loading="lazy" decoding="async">`;
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
  return `<figure class="obra revelar">
 <button class="obra__foto" type="button"
   data-lupa="${foto("obras", primeira)}"
   data-lupa-alt="${esc(t.veiculo)} — ${esc(t.servico)} no Perfect Finish Studio, em Leiria"
   data-lupa-nota="${esc(t.veiculo)} · ${esc(t.servico)}"
   aria-label="Ver ${esc(t.veiculo)} em grande">
  ${figura("obras", primeira, `${t.veiculo} — ${t.servico} feito no Perfect Finish Studio, em Leiria`, {
    medidas: "(min-width: 64rem) 24rem, (min-width: 40rem) 45vw, 92vw",
  })}
 </button>
 <figcaption>
  <span class="servico">${esc(t.servico)}</span>
  <span class="veiculo">${esc(t.veiculo)}</span>
 </figcaption>
</figure>`;
}

/* ================================================================ PÁGINAS = */

function inicio() {
  const destaques = TRABALHOS.filter((t) => t.destaque).slice(0, 8);
  const corpo = `
<section class="heroi">
 <div class="caixa heroi__interior">
  <p class="sobrescrito">${esc(D.marca.reclamo)} · Leiria</p>
  <h1 class="ouro"><span>${esc(D.textos.heroi_linha1)}</span><span>${esc(D.textos.heroi_linha2)}</span></h1>
  <p class="heroi__texto">${esc(D.textos.heroi_texto)}</p>
  <div class="accoes">
   <a class="botao botao--cheio" href="${zap("Olá! Gostava de pedir um orçamento.")}" target="_blank" rel="noopener">Pedir orçamento</a>
   <a class="botao botao--linha" href="${u("/trabalhos/")}">Ver trabalhos <span class="seta">→</span></a>
  </div>
  <ul class="provas">
   <li><b>${String(D.google.nota).replace(".", ",")}</b><span>${D.google.total} avaliações no Google</span></li>
   <li><b>${SERVICOS.length}</b><span>áreas de especialidade</span></li>
   <li><b>Leiria</b><span>e toda a região Centro</span></li>
  </ul>
 </div>
</section>

<section class="seccao">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">O que fazemos</p>
   <h2>Cinco especialidades,<br>um só acabamento</h2>
  </div>
  <ul class="indice">
   ${SERVICOS.map((s) => `<li><a href="${u(`/servicos/${s.slug}/`)}">
    <span class="numero"></span>
    <div><h3>${esc(s.nome)}</h3><p>${esc(s.resumo)}</p></div>
    ${s.imagem ? `<figure>${figura("obras", s.imagem, `${s.nome} — Perfect Finish Studio`, { medidas: "8rem" })}</figure>` : "<figure></figure>"}
    <span class="seta" aria-hidden="true">→</span>
   </a></li>`).join("")}
  </ul>
 </div>
</section>

<section class="seccao">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">Antes e depois</p>
   <h2>Arraste para ver<br>a diferença</h2>
   <p>Fotografias dos nossos trabalhos. O mesmo carro, o mesmo enquadramento — só muda o que fizemos.</p>
  </div>
 </div>
 <div class="pares">${PARES.map(comparador).join("")}</div>
</section>

<section class="seccao claro">
 <div class="caixa">
  <div class="cabeca-seccao">
   <p class="sobrescrito">Como trabalhamos</p>
   <h2>Método, não pressa</h2>
  </div>
  <div class="processo">
   ${[
      ["Diagnóstico", "Vemos o carro à frente, com luz. Dizemos o que dá para fazer, o que não dá, e o que não vale a pena."],
      ["Preparação", "Lavagem, descontaminação e proteção do que não é para tratar. É a parte que ninguém fotografa e a que decide o resultado."],
      ["Execução", "Tira mossas, correção, película ou vinil — com o tempo que cada um exige, e desmontagem onde o remate a pede."],
      ["Inspeção", "Revisão sob luz rasante antes de o carro sair. Se não passa aqui, não sai."],
    ].map(([t, p], i) => `<article class="etapa" style="--i:${i}">
     <span class="etapa__numero">0${i + 1}</span>
     <h3>${t}</h3><p>${p}</p></article>`).join("")}
  </div>
 </div>
</section>

<section class="seccao">
 <div class="caixa">
  <div class="cabeca-seccao" style="display:flex;flex-wrap:wrap;gap:var(--e-5);align-items:end;justify-content:space-between">
   <div><p class="sobrescrito">Portefólio</p><h2>Alguns carros<br>que passaram por cá</h2></div>
   <a class="botao botao--linha" href="${u("/trabalhos/")}">Ver todos <span class="seta">→</span></a>
  </div>
  <div class="grelha">${destaques.map(cartaoObra).join("")}</div>
 </div>
</section>

${blocoAvaliacoes()}
${CTA("Traga-nos o carro", "Diga-nos o que precisa e recebe uma resposta com o que dá para fazer e quanto custa. Sem compromisso.")}`;

  return pagina({
    url: "/",
    titulo: "Perfect Finish Studio — Car Detail e Tira Mossas em Leiria",
    descricao: "Estúdio de customização premium em Leiria: tira mossas sem pintura, películas solares, PPF, envelopamento e car detail. 4,9 ★ no Google.",
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
   ${s.porque.map(([t, p]) => `<li><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join("")}
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
   ${s.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><div>${esc(a)}</div></details>`).join("")}
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

${blocoAvaliacoes({ claro: true })}
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

function contactos() {
  const corpo = `<section class="seccao" style="padding-top:var(--e-7)">
 <div class="caixa">
  <div class="cabeca-seccao"><p class="sobrescrito">Contactos</p><h1 class="titulo-pagina">Onde estamos</h1></div>
  <div class="contactos">
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
  </div>

  <div style="margin-top:var(--e-9)">
   <p class="sobrescrito">Zona de serviço</p>
   <p class="medida" style="color:var(--osso-meio)">Estamos em Cardosos, à saída de Leiria pela estrada de Tomar. Recebemos carros de
   Leiria, Marinha Grande, Batalha, Pombal, Porto de Mós, Ourém, Fátima, Alcobaça, Nazaré e Caldas da Rainha.</p>
  </div>
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
<p>Na página de <a href="${u("/contactos/")}">Contactos</a> existe um mapa. <strong>Esse mapa não é
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
<p>Porque há uma coisa que precisa mesmo da sua autorização: o <strong>mapa do Google</strong> na
página de contactos. Carregar esse mapa é fazer um pedido a servidores da Google, que passam a
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
      <div class="accoes" style="justify-content:center">
       <a class="botao botao--cheio" href="${u("/")}">Voltar ao início</a>
       <a class="botao botao--linha" href="${u("/servicos/")}">Ver serviços <span class="seta">→</span></a>
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
  ["servicos/index.html", indiceServicos(), "/servicos/"],
  ...SERVICOS.map((s) => [`servicos/${s.slug}/index.html`, paginaServico(s), `/servicos/${s.slug}/`]),
  ["trabalhos/index.html", trabalhos(), "/trabalhos/"],
  ["loja/index.html", loja(), "/loja/"],
  ["contactos/index.html", contactos(), "/contactos/"],
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
