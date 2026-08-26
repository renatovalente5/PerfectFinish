#!/usr/bin/env node
/**
 * Verificação de responsividade por aritmética de CSS.
 *
 * Não substitui olhar para uma captura de ecrã — substitui é a parte que é
 * contas e que se esquece sempre. Apanha as causas de transbordo horizontal
 * que já aconteceram neste projecto:
 *
 *   · larguras fixas em px grandes
 *   · font-size em px, que ignora a preferência do utilizador
 *   · `repeat(N, 1fr)` sem `minmax(0, …)` — um `1fr` é `minmax(auto, 1fr)` e o
 *     `auto` não deixa a coluna encolher abaixo do conteúdo. Foi assim que o
 *     bloco de contactos ficou com 427 px num ecrã de 305.
 *   · `clamp()` com o mínimo maior que o máximo, que se inverte em silêncio
 *   · larguras a `100vw`, que incluem a barra de scroll
 *
 * O caso do mapa (`min-block-size` + `aspect-ratio` a forçar uma largura
 * mínima) não é apanhável por texto — esse encontrou-se a medir no browser.
 *
 * Correr:  node scripts/responsivo.mjs
 */
// Verificação de responsividade sem browser: mede o CSS em vez de o renderizar.
// Não substitui a captura de ecrã, mas apanha o que é aritmética — larguras
// fixas, valores que não escalam, e grelhas que pedem mais do que há.
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../assets/css/site.css", import.meta.url), "utf8");

const problemas = [];

// 1. Larguras fixas em px que não sejam pequenas (ícones, bordas, raios).
for (const m of css.matchAll(/(?:^|\n)\s*(?:inline-size|width|min-inline-size|min-width)\s*:\s*(\d+)px/g)) {
  const px = Number(m[1]);
  if (px > 60) problemas.push(`largura fixa de ${px}px`);
}
// 2. font-size em px (não escala com a preferência do utilizador).
for (const m of css.matchAll(/font-size\s*:\s*(\d+)px/g)) problemas.push(`font-size em px: ${m[1]}px`);
// 3. Qualquer `1fr` numa grelha sem `minmax(0, …)`. Um `1fr` é
//    `minmax(auto, 1fr)` e o `auto` não deixa a coluna encolher abaixo do
//    conteúdo — é a causa nº 1 de transbordo horizontal neste projecto, e
//    apareceu três vezes: nos contactos, nas garantias e no índice.
for (const m of css.matchAll(/grid-template-columns:\s*([^;}]+)/g)) {
  const valor = m[1].trim();
  const sem = valor.replace(/minmax\(\s*0[^)]*\)/g, "");
  if (/\b[\d.]*fr\b/.test(sem)) problemas.push(`grid-template-columns: ${valor} — «fr» sem minmax(0,…)`);
}
// 4. clamp() com o mínimo maior que o máximo (inverte-se em silêncio).
for (const m of css.matchAll(/clamp\(\s*([\d.]+)rem\s*,[^,]*,\s*([\d.]+)rem\s*\)/g)) {
  if (Number(m[1]) > Number(m[2])) problemas.push(`clamp invertido: ${m[0]}`);
}
// 5. O reset do recuo das listas tem de existir. A indentação de 40px vem da
//    folha do NAVEGADOR: `* { margin: 0 }` não a tira e `list-style: none`
//    também não. Sem este reset, TODA a lista estilizada fica 40px à direita e
//    a grelha transborda 40px — foi medido em .cartoes-servico, .horario e
//    .lista-servicos, e nem o cuidado com minmax(0,1fr) o evitava, porque o
//    problema está antes das colunas. Verifica-se a existência do reset, não
//    cada regra: é o reset que resolve todas de uma vez.
if (!/:where\(ul,\s*ol\)\[class\]\s*\{[^}]*padding-inline-start:\s*0/.test(css)) {
  problemas.push("falta o reset `:where(ul, ol)[class] { padding-inline-start: 0 }` — as listas voltam a ter 40px de recuo do navegador");
}
// 6. 100vw em propriedades de largura: inclui a barra de scroll e transborda.
for (const m of css.matchAll(/(?<!max-)(?:inline-size|width)\s*:\s*100vw/g)) problemas.push("largura 100vw (inclui a barra de scroll)");

// 7. Acentos graves dentro de comentários HTML do gerador. Um comentário
//    escrito num template literal fecha a string no primeiro acento grave e o
//    ficheiro deixa de compilar. Quebrei esta regra QUATRO vezes num dia, e
//    escrevê-la no PLANO não bastou — por isso passa a ser verificada.
{
  const ger = readFileSync(new URL("../scripts/gerar.mjs", import.meta.url), "utf8");
  for (const m of ger.matchAll(/<!--[\s\S]*?-->/g)) {
    if (m[0].includes("`")) {
      const primeira = m[0].split("\n")[0].trim().slice(0, 56);
      problemas.push(`comentário HTML com acento grave em gerar.mjs — fecha o template literal: «${primeira}…»`);
    }
  }
}

console.log(problemas.length ? problemas.map(p => "  " + p).join("\n") : "  nada a apontar");
console.log(`\n${problemas.length} apontamento(s)`);
process.exit(problemas.length ? 1 : 0);
