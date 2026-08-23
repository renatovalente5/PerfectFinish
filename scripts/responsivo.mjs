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
// 3. grid-template-columns com repeat(N, ...) sem minmax(0, — a causa clássica
//    de uma coluna que não encolhe e faz a página transbordar.
for (const m of css.matchAll(/grid-template-columns:\s*repeat\((\d+),\s*([^)]*)\)/g)) {
  if (!/minmax\(\s*0/.test(m[2])) problemas.push(`repeat(${m[1]}, ${m[2].trim()}) sem minmax(0,…)`);
}
// 4. clamp() com o mínimo maior que o máximo (inverte-se em silêncio).
for (const m of css.matchAll(/clamp\(\s*([\d.]+)rem\s*,[^,]*,\s*([\d.]+)rem\s*\)/g)) {
  if (Number(m[1]) > Number(m[2])) problemas.push(`clamp invertido: ${m[0]}`);
}
// 5. 100vw em propriedades de largura: inclui a barra de scroll e transborda.
for (const m of css.matchAll(/(?<!max-)(?:inline-size|width)\s*:\s*100vw/g)) problemas.push("largura 100vw (inclui a barra de scroll)");

console.log(problemas.length ? problemas.map(p => "  " + p).join("\n") : "  nada a apontar");
console.log(`\n${problemas.length} apontamento(s)`);
process.exit(problemas.length ? 1 : 0);
