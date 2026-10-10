#!/usr/bin/env node
/* A BATERIA DO GERADOR, DO site.js E DA AUDITORIA.
 *
 * Corre em local, como a .github/test-guardas.mjs, e não no CI. Cada caso
 * corre num clone do repositório (cp -c, APFS: não ocupa disco), com os dados
 * mudados de propósito; o repositório não se toca.
 *
 *     node scripts/test-site.mjs
 *
 * O que prova (as correcções de 10 out 2026, uma secção cada):
 *   · o horário do JSON-LD (openingHoursSpecification) e o texto da página de
 *     contactos saem do horário dos dados — o que o painel grava —, e nenhuma
 *     hora fica escrita à mão no gerador;
 *   · o site.js marca «hoje» a linha certa do horário em cada dia da semana, e
 *     nunca uma linha sem os dias em números (era marcada aos domingos) — o
 *     site.js verdadeiro, corrido num contexto à parte com uma página de
 *     faz-de-conta;
 *   · a auditoria trava a publicação quando o domínio próprio se perdia: um
 *     CNAME errado ou em falta no _site, e páginas geradas com o prefixo
 *     /PerfectFinish (sem o CNAME) quando o repositório o tem. */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import vm from 'node:vm';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = realpathSync(mkdtempSync(join(tmpdir(), 'pf-site-')));

let passou = 0; let falhou = 0;
const certo = (c, d, extra = '') => {
  if (c) { passou++; console.log(`  ✓ ${d}`); } else { falhou++; console.log(`  ✗ ${d}${extra !== '' ? `  — ${String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 1500)}` : ''}`); }
  return c;
};
const secao = (t) => console.log(`\n— ${t}`);

/* Um clone do que o gerador e a auditoria lêem. */
let n = 0;
function clone() {
  const w = join(TMP, `w${++n}`);
  execFileSync('mkdir', ['-p', w]);
  for (const p of ['data', 'scripts', '.github', 'assets', 'CNAME', '.pages.yml', '_fonte']) execFileSync('cp', ['-c', '-R', join(RAIZ, p), join(w, p)]);
  return w;
}
const correr = (w, script) => {
  const r = spawnSync(process.execPath, [join('scripts', script)], { cwd: w, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '' } });
  return { status: r.status, saida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};
const lerJ = (w, rel) => JSON.parse(readFileSync(join(w, rel), 'utf8'));
const escreverJ = (w, rel, o) => writeFileSync(join(w, rel), `${JSON.stringify(o, null, 2)}\n`);
const site = (w, rel) => readFileSync(join(w, '_site', rel), 'utf8');
/* O negócio do JSON-LD da página inicial (o nó com o horário). */
const negocio = (w) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(site(w, 'index.html'))[1])['@graph'].find((x) => x.openingHoursSpecification);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ================================================================== */
secao('o horário do JSON-LD e da página de contactos sai dos dados');
{
  /* Os dados de hoje dão o que estava escrito à mão, tal e qual. */
  const ESCRITO_A_MAO = [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:30' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '09:00', closes: '13:00' },
  ];
  const w = clone();
  const g = correr(w, 'gerar.mjs');
  certo(g.status === 0 && igual(negocio(w).openingHoursSpecification, ESCRITO_A_MAO), 'com o horário de hoje, o JSON-LD é o que estava escrito à mão no gerador (o domingo, encerrado, fica de fora)', negocio(w)?.openingHoursSpecification ?? g.saida);
  certo(correr(w, 'auditar.mjs').status === 0, 'e a auditoria passa');

  /* O horário mudado no painel muda o JSON-LD. */
  const w2 = clone();
  const d = lerJ(w2, 'data/definicoes.json');
  d.horario = [
    { dias: 'Segunda a sábado', horas: '08:30 – 19:00', indices: '1,2,3,4,5,6' },
    { dias: 'Domingo', horas: 'Encerrado', indices: '0' },
  ];
  escreverJ(w2, 'data/definicoes.json', d);
  correr(w2, 'gerar.mjs');
  certo(igual(negocio(w2).openingHoursSpecification, [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '08:30', closes: '19:00' }]),
    '«Segunda a sábado 08:30 – 19:00» (e o domingo encerrado): o JSON-LD diz isso', negocio(w2).openingHoursSpecification);
  certo(correr(w2, 'auditar.mjs').status === 0, 'e a auditoria passa');

  /* Duas partes no mesmo dia, outra maneira de escrever as horas, uma linha
     sem os dias em números e uma que não diz horas: só entra o que se percebe. */
  const w3 = clone();
  const d3 = lerJ(w3, 'data/definicoes.json');
  d3.horario = [
    { dias: 'Segunda a sexta', horas: '9h00 - 13h00 e 14h30 - 18h30', indices: '5,4,3,2,1' },
    { dias: 'Sábado', horas: 'Só por marcação', indices: '6' },
    { dias: 'Domingo', horas: '10:00 – 12:00' },
  ];
  escreverJ(w3, 'data/definicoes.json', d3);
  correr(w3, 'gerar.mjs');
  const semana = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  certo(igual(negocio(w3).openingHoursSpecification, [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: semana, opens: '09:00', closes: '13:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: semana, opens: '14:30', closes: '18:30' },
  ]), 'duas partes no mesmo dia («9h00 - 13h00 e 14h30 - 18h30») dão duas; «Só por marcação» e uma linha sem os dias em números ficam de fora', negocio(w3).openingHoursSpecification);

  /* A página de contactos (hoje não se gera: o gerador tem-na, para quando
     voltar) — gerada aqui, no clone, com o horário mudado. */
  const g2 = join(w2, 'scripts', 'gerar.mjs');
  const fonte = readFileSync(g2, 'utf8');
  const ancora = '["loja/index.html", loja(), "/loja/"],';
  writeFileSync(g2, fonte.replace(ancora, `${ancora}\n  ["contactos/index.html", contactos(), "/contactos/"],`));
  const r = correr(w2, 'gerar.mjs');
  const descricao = r.status === 0 ? /<meta name="description" content="([^"]*)"/.exec(site(w2, 'contactos/index.html'))?.[1] ?? '' : '';
  certo(fonte.includes(ancora) && /Segunda a sábado 08:30 – 19:00\.$/.test(descricao) && !/09:00|18:30|Domingo/.test(descricao),
    'a descrição da página de contactos diz o horário dos dados («Segunda a sábado 08:30 – 19:00»), sem as linhas encerradas', descricao || r.saida.slice(-300));

  /* Nenhuma hora escrita à mão no código do gerador (nos comentários pode). */
  const codigo = readFileSync(join(RAIZ, 'scripts', 'gerar.mjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const horas = [...codigo.matchAll(/["'`][^"'`\n]*\b\d{1,2}:\d{2}\b[^"'`\n]*["'`]/g)].map((m) => m[0]);
  certo(horas.length === 0, 'nenhuma hora escrita à mão no código do gerador', horas);
}

/* ================================================================== */
secao('o «hoje» do horário: o site.js marca a linha certa, e nunca uma sem os dias');
{
  /* O site.js VERDADEIRO, corrido num contexto à parte: uma página de
     faz-de-conta só com a lista do horário (os outros blocos não encontram o
     que procuram, e cada um falha sozinho, como o site.js promete), e o dia da
     semana escolhido. → as linhas marcadas, e as falhas do bloco do horário. */
  const FONTE = readFileSync(join(RAIZ, 'assets', 'js', 'site.js'), 'utf8');
  function marcar(dia, valores) {
    const linhas = valores.map((v) => ({ dataset: v === undefined ? {} : { dias: v } }));
    const nada = () => {};
    const classes = { add: nada, remove: nada, toggle: nada, contains: () => false };
    const horario = { querySelectorAll: (s) => (s === 'li' ? linhas : []), querySelector: () => null };
    const documento = {
      querySelector: (s) => (s === '.horario' ? horario : null), querySelectorAll: () => [],
      documentElement: { dataset: {}, classList: classes, style: { setProperty: nada } }, body: { dataset: {}, classList: classes, style: {} },
      addEventListener: nada, removeEventListener: nada, createElement: () => ({ dataset: {}, classList: classes, style: {}, setAttribute: nada, append: nada, appendChild: nada }),
    };
    class Data extends Date { getDay() { return dia; } }
    const falhas = [];
    const ctx = {
      document: documento, Date: Data, console: { error: (...a) => falhas.push(a.map(String).join(' ')), log: nada, warn: nada },
      setTimeout: () => 0, clearTimeout: nada, setInterval: () => 0, clearInterval: nada, requestAnimationFrame: () => 0, cancelAnimationFrame: nada,
      matchMedia: () => ({ matches: false, addEventListener: nada, addListener: nada }), localStorage: { getItem: () => null, setItem: nada, removeItem: nada },
      location: { hash: '', pathname: '/', search: '' }, navigator: { userAgent: 'node' }, addEventListener: nada, removeEventListener: nada,
      scrollY: 0, innerWidth: 1280, innerHeight: 800, fetch: () => Promise.reject(new Error('sem rede')),
    };
    ctx.window = ctx;
    vm.runInNewContext(FONTE, ctx);
    return { marcadas: linhas.map((l, i) => (l.dataset.hoje === 'sim' ? i : -1)).filter((i) => i >= 0), falhas: falhas.filter((f) => /horário/.test(f)) };
  }
  /* As linhas como o site as publica hoje (o data-dias de cada uma), e uma
     linha sem os dias em números (como o gerador a escreve: data-dias=""), e
     outra sem o atributo. */
  const w = clone();
  correr(w, 'gerar.mjs');
  const deHoje = [...(/<ul class="horario">([\s\S]*?)<\/ul>/.exec(site(w, 'index.html'))?.[1] ?? '').matchAll(/<li data-dias="([^"]*)">/g)].map((m) => m[1]);
  certo(igual(deHoje, ['1,2,3,4,5', '6', '0']), 'o site publica as três linhas do horário com os dias em números', deHoje);
  const valores = [...deHoje, '', undefined, ' 6 , x'];
  const esperado = (dia) => [dia >= 1 && dia <= 5 ? 0 : -1, dia === 6 ? 1 : -1, dia === 0 ? 2 : -1, dia === 6 ? 5 : -1].filter((i) => i >= 0);
  const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const mal = [];
  for (let dia = 0; dia < 7; dia++) {
    const r = marcar(dia, valores);
    if (!igual(r.marcadas, esperado(dia)) || r.falhas.length) mal.push(`${NOMES[dia]}: marcou ${JSON.stringify(r.marcadas)}, devia ${JSON.stringify(esperado(dia))}${r.falhas.length ? ` (${r.falhas[0]})` : ''}`);
  }
  certo(mal.length === 0, 'de domingo a sábado, «hoje» é a linha certa — e uma linha sem os dias em números (data-dias="" ou sem o atributo) nunca é marcada, nem ao domingo', mal.join(' | '));
}

/* ================================================================== */
secao('a auditoria do domínio próprio pode falhar');
{
  const auditar = (w) => correr(w, 'auditar.mjs');
  /* Um CNAME errado no site gerado (o GitHub Pages passava a servir outro domínio). */
  const w = clone();
  correr(w, 'gerar.mjs');
  certo(auditar(w).status === 0, 'com o CNAME certo, a auditoria passa');
  writeFileSync(join(w, '_site', 'CNAME'), 'outro-dominio.pt\n');
  const errado = auditar(w);
  certo(errado.status === 1 && /ERRO {4}o CNAME de _site\/ não coincide com o do repositório/.test(errado.saida), 'um CNAME errado no _site: a auditoria trava, e diz porquê', errado.saida.slice(-300));
  rmSync(join(w, '_site', 'CNAME'));
  const semCname = auditar(w);
  certo(semCname.status === 1 && /ERRO {4}existe CNAME no repositório mas não em _site\//.test(semCname.saida), 'sem o CNAME no _site: trava (a publicação perdia o domínio próprio)', semCname.saida.slice(-300));
  /* As páginas geradas sem o CNAME (com o prefixo /PerfectFinish da subpasta
     do github.io) com o repositório a ter o CNAME: com domínio próprio, tudo
     daria 404. */
  const w2 = clone();
  rmSync(join(w2, 'CNAME'));
  correr(w2, 'gerar.mjs');
  writeFileSync(join(w2, 'CNAME'), readFileSync(join(RAIZ, 'CNAME')));
  writeFileSync(join(w2, '_site', 'CNAME'), readFileSync(join(RAIZ, 'CNAME')));
  const prefixo = auditar(w2);
  certo(prefixo.status === 1 && /ERRO {4}\/[^:]+: ainda tem caminhos com o prefixo \/PerfectFinish, e com domínio próprio dão 404/.test(prefixo.saida),
    'páginas com o prefixo /PerfectFinish e o CNAME no repositório: trava, a dizer qual (a verificação que nunca falhava)', prefixo.saida.split('\n').filter((l) => /ERRO/.test(l)).slice(0, 3).join(' | '));
}

/* ================================================================== */
rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULTADO test-site passou=${passou} falhou=${falhou}`);
process.exit(falhou ? 1 : 0);
