#!/usr/bin/env node
/**
 * Auditoria antes de publicar.
 *
 * Corre depois do gerador e ANTES da publicação. Se falhar, o GitHub Actions
 * pára e o site fica com a versão anterior no ar — o que é sempre melhor do
 * que publicar uma página com imagens partidas ou sem o aviso do custo das
 * chamadas, que é uma obrigação legal.
 *
 * Verifica o que já correu mal em projectos anteriores, e não uma lista
 * genérica de boas práticas:
 *
 *   · ligações internas que apontam para páginas que não existem
 *   · imagens referidas que não estão em disco (o erro mais provável quando o
 *     cliente carrega fotografias pelo backoffice)
 *   · o prefixo da subpasta em todos os caminhos absolutos — sem ele o site
 *     publicado fica sem CSS e sem imagens
 *   · «(Chamada para a rede móvel nacional)» em todas as páginas onde o
 *     número de telemóvel apareça
 *   · o Livro de Reclamações e as páginas legais no rodapé
 *   · imagens grandes de mais, que o cliente pode carregar sem saber
 *   · o sitemap coerente com as páginas que existem
 *   · sem referências à plataforma ODR (revogada a 20-07-2025)
 *
 * Correr:  node scripts/auditar.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "_site");

const erros = [];
const avisos = [];
const falha = (m) => erros.push(m);
const aviso = (m) => avisos.push(m);

if (!existsSync(SAIDA)) {
  console.error("Não existe _site/. Corra primeiro: node scripts/gerar.mjs");
  process.exit(1);
}

/* ------------------------------------------------------------ inventário */
function todos(pasta, lista = []) {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) todos(caminho, lista);
    else lista.push(caminho);
  }
  return lista;
}

const ficheiros = todos(SAIDA);
const paginas = ficheiros.filter((f) => f.endsWith(".html"));
const existe = new Set(ficheiros.map((f) => "/" + relative(SAIDA, f).split("/").join("/")));

const CNAME = existsSync(join(RAIZ, "CNAME"));
const BASE = CNAME ? "" : "/PerfectFinish";

console.log(`A auditar ${paginas.length} páginas e ${ficheiros.length} ficheiros…\n`);

/* ------------------------------------------------------------ por página */
for (const caminho of paginas) {
  const nome = "/" + relative(SAIDA, caminho);
  const html = readFileSync(caminho, "utf8");

  /* --- ligações internas ------------------------------------------------ */
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    if (BASE && !href.startsWith(BASE + "/") && href !== BASE) {
      falha(`${nome}: ligação sem o prefixo «${BASE}» → ${href}`);
      continue;
    }
    const relativo = BASE ? href.slice(BASE.length) : href;
    const alvo = relativo.endsWith("/") ? relativo + "index.html" : relativo;
    if (!existe.has(alvo) && !existe.has(alvo + "/index.html")) {
      falha(`${nome}: ligação para página que não existe → ${href}`);
    }
  }

  /* --- imagens, folhas e scripts --------------------------------------- */
  for (const [, atributo, url] of html.matchAll(/(src|srcset)="([^"]+)"/g)) {
    const partes = atributo === "srcset"
      ? url.split(",").map((p) => p.trim().split(/\s+/)[0])
      : [url];
    for (const item of partes) {
      if (!item.startsWith("/") || item.startsWith("//")) continue;
      if (BASE && !item.startsWith(BASE + "/")) {
        falha(`${nome}: caminho sem o prefixo «${BASE}» → ${item}`);
        continue;
      }
      const relativo = BASE ? item.slice(BASE.length) : item;
      if (!existe.has(relativo)) falha(`${nome}: ficheiro em falta → ${item}`);
    }
  }

  /* --- imagens sem texto alternativo ----------------------------------- */
  for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt=/.test(tag)) falha(`${nome}: <img> sem alt → ${tag.slice(0, 90)}`);
  }

  /* --- dimensões declaradas (evita saltos de layout) -------------------- */
  for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\swidth=/.test(tag) || !/\sheight=/.test(tag)) {
      aviso(`${nome}: <img> sem width/height → ${tag.slice(0, 80)}`);
    }
  }

  /* --- custo da chamada (obrigação legal) ------------------------------- */
  // Só conta o número quando aparece como texto visível, e não dentro de um
  // href="tel:" ou de um link do WhatsApp — esses não são "número exibido".
  const semLigacoes = html
    .replace(/href="tel:[^"]*"/g, "")
    .replace(/href="https:\/\/wa\.me\/[^"]*"/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "");
  const mostraNumero = /9\s?6\s?8\s?8\s?2\s?8\s?5\s?1\s?0/.test(semLigacoes);
  if (mostraNumero && !html.includes("Chamada para a rede móvel nacional")) {
    falha(`${nome}: mostra o número de telemóvel sem «(Chamada para a rede móvel nacional)»`);
  }

  /* --- rodapé legal ----------------------------------------------------- */
  if (!html.includes("livroreclamacoes.pt")) {
    falha(`${nome}: sem ligação para o Livro de Reclamações`);
  }
  for (const obrigatoria of ["/politica-de-privacidade/", "/informacao-legal/"]) {
    if (!html.includes(BASE + obrigatoria)) {
      falha(`${nome}: sem ligação para ${obrigatoria}`);
    }
  }
  if (!html.includes("NIF")) falha(`${nome}: sem NIF no rodapé`);

  /* --- plataforma ODR: revogada, não pode aparecer ---------------------- */
  if (/ec\.europa\.eu\/consumers\/odr|webgate\.ec\.europa\.eu\/odr/.test(html)) {
    falha(`${nome}: refere a plataforma ODR da UE, revogada a 20-07-2025`);
  }

  /* --- cabeça ----------------------------------------------------------- */
  const titulo = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  if (!titulo) falha(`${nome}: sem <title>`);
  else if (titulo.length > 65) aviso(`${nome}: <title> com ${titulo.length} caracteres (ideal ≤ 60)`);

  const descricao = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  if (!descricao) falha(`${nome}: sem meta description`);
  else if (descricao.length > 165) aviso(`${nome}: description com ${descricao.length} caracteres (ideal ≤ 155)`);

  if (!/<link rel="canonical"/.test(html)) falha(`${nome}: sem canonical`);
  if (!/<html lang="pt-PT">/.test(html)) falha(`${nome}: sem lang="pt-PT"`);
  if (!/<h1[\s>]/.test(html) && !nome.includes("404")) {
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 === 0) aviso(`${nome}: sem <h1>`);
  }

  /* --- JSON-LD válido --------------------------------------------------- */
  const bloco = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  if (!bloco) falha(`${nome}: sem dados estruturados`);
  else {
    try { JSON.parse(bloco); }
    catch (e) { falha(`${nome}: JSON-LD inválido — ${e.message}`); }
  }

  /* --- o `hidden` que não esconde --------------------------------------- */
  if (/\shidden\b/.test(html) && !/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(html)) {
    aviso(`${nome}: usa o atributo hidden sem a regra [hidden]{display:none!important}`);
  }
}

/* ------------------------------------------------------------- imagens */
const IMAGEM = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"]);
for (const caminho of ficheiros) {
  if (!IMAGEM.has(extname(caminho).toLowerCase())) continue;
  const kb = statSync(caminho).size / 1024;
  const nome = relative(SAIDA, caminho);
  if (kb > 1500) falha(`${nome}: ${Math.round(kb)} kB — grande de mais para a web (limite 1500 kB)`);
  else if (kb > 400) aviso(`${nome}: ${Math.round(kb)} kB — convém reduzir`);
}

/* ------------------------------------------------------------- sitemap */
const sitemap = readFileSync(join(SAIDA, "sitemap.xml"), "utf8");
const noSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const url of noSitemap) {
  const caminho = new URL(url).pathname;
  const relativo = BASE && caminho.startsWith(BASE) ? caminho.slice(BASE.length) : caminho;
  const alvo = relativo.endsWith("/") ? relativo + "index.html" : relativo;
  if (!existe.has(alvo)) falha(`sitemap.xml: aponta para página inexistente → ${url}`);
}
const publicadas = paginas
  .map((f) => "/" + relative(SAIDA, f))
  .filter((p) => !p.includes("404"))
  .map((p) => p.replace(/index\.html$/, ""));
for (const p of publicadas) {
  if (!noSitemap.some((u) => new URL(u).pathname === BASE + p)) {
    aviso(`sitemap.xml: falta a página ${p}`);
  }
}

/* ------------------------------------------------------------ obrigatórios */
for (const obrigatorio of ["/.nojekyll", "/robots.txt", "/sitemap.xml", "/site.webmanifest"]) {
  if (!existe.has(obrigatorio)) falha(`falta ${obrigatorio}`);
}

/* -------------------------------------------------------------- dados */
const definicoes = JSON.parse(readFileSync(join(RAIZ, "data/definicoes.json"), "utf8"));
if (!definicoes.contactos.email) {
  aviso("data/definicoes.json: sem e-mail. É obrigatório pelo artigo 10.º do DL 7/2004 — preencher assim que existir.");
}
if (!definicoes.empresa.titular) {
  aviso("data/definicoes.json: sem o nome civil do titular. Também é exigido pelo artigo 10.º do DL 7/2004.");
}

/* ------------------------------------------------------------- relatório */
for (const a of avisos) console.log(`  aviso   ${a}`);
if (avisos.length) console.log("");
for (const e of erros) console.log(`  ERRO    ${e}`);

console.log(
  `\n${erros.length ? "✗" : "✓"} ${erros.length} erro(s), ${avisos.length} aviso(s) ` +
  `em ${paginas.length} páginas.`
);
process.exit(erros.length ? 1 : 0);
