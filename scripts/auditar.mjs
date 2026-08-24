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

const definicoes = JSON.parse(readFileSync(join(RAIZ, "data/definicoes.json"), "utf8"));

/* Texto visível de uma página, sem marcação e com as entidades desfeitas.
   Preciso para procurar valores dos dados dentro do HTML gerado: o gerador
   escapa `&`, `<`, `>` e as aspas, e uma procura literal falharia por causa
   disso — daria um erro de auditoria onde não há erro nenhum. */
const textoDe = (html) => html
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ");

console.log(`A auditar ${paginas.length} páginas e ${ficheiros.length} ficheiros…\n`);

/* ------------------------------------------------------------ por página */
for (const caminho of paginas) {
  const nome = "/" + relative(SAIDA, caminho);
  const html = readFileSync(caminho, "utf8");

  /* --- ligações internas ------------------------------------------------ */
  /* O padrão apanha AGORA as ligações com âncora. Antes era
     `href="(\/[^"#?]*)"`, que excluía tudo o que tivesse `#` — e como a
     arquitectura passou a depender de âncoras (`/#s-ppf`), um caminho sem o
     prefixo da subpasta publicava em silêncio e ninguém dava por isso. */
  const idsDaPagina = new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
  );

  for (const [, href] of html.matchAll(/href="(\/[^"?]*)"/g)) {
    const [caminho, ancora] = href.split("#");

    if (BASE && caminho && !caminho.startsWith(BASE + "/") && caminho !== BASE) {
      falha(`${nome}: ligação sem o prefixo «${BASE}» → ${href}`);
      continue;
    }

    if (caminho) {
      const relativo = BASE ? caminho.slice(BASE.length) : caminho;
      const alvo = relativo.endsWith("/") ? relativo + "index.html" : relativo;
      if (!existe.has(alvo) && !existe.has(alvo + "/index.html")) {
        falha(`${nome}: ligação para página que não existe → ${href}`);
        continue;
      }
    }

    /* Uma âncora só se pode verificar quando aponta para ESTA página: para
       outra, o `id` está noutro ficheiro e vê-se quando esse for auditado. */
    if (ancora) {
      const paraEstaPagina = !caminho
        || caminho === BASE + nome.replace(/index\.html$/, "")
        || (nome === "/index.html" && (caminho === BASE + "/" || caminho === BASE));
      if (paraEstaPagina && !idsDaPagina.has(ancora)) {
        falha(`${nome}: âncora #${ancora} não existe nesta página → ${href}`);
      }
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
      /* Descascar a query e a âncora antes de procurar em disco: um `?v=`
         de invalidação de cache não faz parte do caminho do ficheiro, e sem
         isto a auditoria dava «ficheiro em falta» para um ficheiro que existe.
         (Foi o que aconteceu ao selar o site.js.) */
      const caminho = (BASE ? item.slice(BASE.length) : item).split(/[?#]/)[0];
      if (!existe.has(caminho)) falha(`${nome}: ficheiro em falta → ${item}`);
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
  /* A identificação do artigo 10.º do DL 7/2004 (nome, NIF, morada) deixou de
     estar no rodapé de cada página e passou a viver em /informacao-legal/.
     A lei exige que seja de acesso «fácil e direto», não que esteja repetida
     em todos os rodapés — mas exige que ESTEJA. Portanto verifica-se o par:
     esta página liga para lá, e o destino traz mesmo o NIF e a morada. */
  if (!html.includes(`${BASE}/informacao-legal/`)) {
    falha(`${nome}: sem ligação para a informação legal (artigo 10.º do DL 7/2004)`);
  }

  /* --- o destino da identificação legal ---------------------------------- */
  if (nome === "/informacao-legal/index.html") {
    const texto = textoDe(html);
    /* Procura-se a FORMA e não o valor. Comparar o texto da página com
       `definicoes.morada.rua` não vale nada: a página é gerada a partir desse
       mesmo campo, portanto os dois lados mudam juntos e o teste nunca falha.
       (Sabotei o campo para confirmar — e passou.) O que se perde de verdade é
       o bloco de identificação sair do molde numa remodelação futura, e agora
       que o rodapé já não o repete ninguém daria por isso. Isso vê-se assim. */
    const marcas = [
      ["o NIF", /\bNIF\b/, /\b\d{3}\s?\d{3}\s?\d{3}\b/],
      ["o código postal", null, /\b\d{4}-\d{3}\b/],
      ["a denominação", /Perfect Finish/, null],
    ];
    for (const [rotulo, rotuloRe, formaRe] of marcas) {
      if (rotuloRe && !rotuloRe.test(texto)) falha(`${nome}: sem ${rotulo}`);
      if (formaRe && !formaRe.test(texto)) falha(`${nome}: sem ${rotulo} (nada com essa forma na página)`);
    }
    const nifDados = String(definicoes.empresa?.nif ?? "").replace(/\D/g, "");
    if (nifDados.length !== 9) falha(`data/definicoes.json: NIF inválido («${definicoes.empresa?.nif ?? ""}»)`);
  }

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
if (!definicoes.contactos.email) {
  aviso("data/definicoes.json: sem e-mail. É obrigatório pelo artigo 10.º do DL 7/2004 — preencher assim que existir.");
}
if (!definicoes.empresa.titular) {
  aviso("data/definicoes.json: sem o nome civil do titular. Também é exigido pelo artigo 10.º do DL 7/2004.");
}

/* --------------------------------------------------------- css sem dono */
/* Uma classe usada no HTML sem regra nenhuma no CSS não dá erro — dá um
   elemento sem estilo, e isso passa numa captura de ecrã distraída. Entrou
   assim: ao apagar um bloco de CSS morto levei com ele o `.lista-servicos`,
   que continuava a ser usado, e a lista dos 13 serviços ficou sem estilo. */
const folha = readFileSync(join(RAIZ, "assets/css/site.css"), "utf8");
const declaradas = new Set(
  [...folha.matchAll(/\.([a-z][a-z0-9_-]*)(?=[\s,:{>~+.\[])/g)].map((m) => m[1])
);
const usadas = new Set();
for (const caminho of paginas) {
  const html = readFileSync(caminho, "utf8");
  for (const [, grupo] of html.matchAll(/class="([^"]+)"/g)) {
    for (const c of grupo.split(/\s+/)) if (c) usadas.add(c);
  }
}
for (const classe of usadas) {
  if (!declaradas.has(classe)) {
    falha(`a classe «${classe}» é usada no HTML e não tem nenhuma regra de CSS`);
  }
}

/* ------------------------------------------------------------- backoffice */
/* O `.pages.yml` é validado por Zod no editor do Pages CMS, mas o caminho de
   execução NÃO chama essa validação: um ficheiro com um tipo inventado ou um
   campo a menos carrega em silêncio, meio a funcionar. Como isso não dá erro
   nenhum ao cliente, verifica-se aqui.

   Não se faz o parse do YAML (não há dependências): fazem-se duas
   verificações de texto que apanham os erros que realmente acontecem. */
const backoffice = readFileSync(join(RAIZ, ".pages.yml"), "utf8");

// 1. Todos os tipos de campo têm de existir mesmo no Pages CMS 2.x.
const TIPOS = new Set(["boolean", "code", "date", "file", "image", "number",
  "reference", "rich-text", "select", "string", "text", "uuid",
  "object", "block", "collection", "group"]);
for (const [, tipo] of backoffice.matchAll(/^\s*-?\s*(?:\{\s*)?.*?\btype:\s*([a-z-]+)/gm)) {
  if (!TIPOS.has(tipo)) falha(`.pages.yml: tipo de campo inexistente → «${tipo}»`);
}

// 2. Todo o campo que existe nos dados tem de ser editável pelo cliente.
//    Se não for, ele vê o conteúdo no site e não tem como o mudar.
const nomesNoBackoffice = new Set(
  [...backoffice.matchAll(/\bname:\s*([A-Za-z0-9_-]+)/g)].map((m) => m[1])
);
const paraVerificar = [
  ["data/definicoes.json", null],
  ["data/pares.json", null],
  ["data/servicos", "*"],
  ["data/trabalhos", "*"],
  ["data/loja", "*"],
];
for (const [caminho, colecao] of paraVerificar) {
  const ficheiros = colecao
    ? readdirSync(join(RAIZ, caminho)).filter((f) => f.endsWith(".json")).map((f) => join(caminho, f))
    : [caminho];
  const chaves = new Set();
  const recolhe = (v) => {
    if (Array.isArray(v)) v.forEach(recolhe);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) { chaves.add(k); recolhe(x); }
    }
  };
  for (const f of ficheiros) recolhe(JSON.parse(readFileSync(join(RAIZ, f), "utf8")));
  for (const chave of chaves) {
    if (!nomesNoBackoffice.has(chave)) {
      falha(`.pages.yml: o campo «${chave}» existe em ${caminho} mas o cliente não o pode editar`);
    }
  }
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
