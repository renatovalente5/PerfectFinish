#!/usr/bin/env node
/* A BATERIA DA GUARDA DO CONTEÚDO E DO CI DO SITE.
 *
 * Corre em local, NÃO no CI: afirma coisas sobre os dados de HOJE, e um item
 * mal preenchido pelo dono não pode parar a publicação por causa de um teste
 * (como a da AMMA Creative e a da LR Motors, de onde vem o molde).
 *
 *     node .github/test-guardas.mjs             tudo (um minuto)
 *     node .github/test-guardas.mjs --rapido    sem a publicação de ponta a ponta
 *
 * A publicação de ponta a ponta precisa de APFS: cada caso corre num clone do
 * repositório (cp -c), que não ocupa disco. O repositório não se toca.
 *
 * O que prova:
 *   · regras.mjs é ES module puro (corre no browser e no Worker do painel);
 *   · os dados de hoje passam sem nada que pare, sem nada neutralizado e sem
 *     avisos, e os lembretes são exactamente os que os dados pedem; os
 *     ficheiros saem do serializar() byte a byte, cada um com a sua terminação;
 *   · re-jogar TODOS os commits que mexeram em data/: os que teriam parado a
 *     publicação listam-se, com a razão, e são os esperados;
 *   · cada regra com um caso e a classe certa — e os casos em que a regra diz
 *     «sim»; uma chave, uma classe (o Worker do painel compara só as chaves);
 *   · o varrimento (memória testar-o-caminho-do-cliente): apagar cada chave de
 *     cada trabalho, de cada produto, de cada item das listas e dos dados do
 *     estúdio dá o problema certo, com o ecrã nomeado, ou nada se o campo é
 *     opcional;
 *   · na consola, nenhum dado abre um comando do runner; no resumo da corrida
 *     (público, em Markdown), nenhum dado fica fora do código;
 *   · a cópia que o gerador lê muda só o que tem de mudar, e nada sem nada;
 *   · A PUBLICAÇÃO DE PONTA A PONTA: dados estragados de propósito, e os passos
 *     do publicar.yml corridos TAL COMO ESTÃO ESCRITOS (o run: extraído, nunca
 *     reescrito — memória correr-a-guarda-verdadeira), pela ordem do ficheiro.
 *     Ou a guarda pára e diz porquê, ou a publicação vai até ao fim — o
 *     gerador, a verificação do CSS e a AUDITORIA: nunca pára mais à frente
 *     sem explicação; e também sem o .pages.yml (o dia da troca);
 *   · o publicar.yml: a guarda antes de tudo o que lê os dados, e nenhum passo
 *     grava no repositório (a cópia neutralizada nunca lá chega);
 *   · --neutralizar recusa-se a escrever no próprio repositório fora do CI;
 *   · as regras do site e a cópia do painel são o mesmo ficheiro. */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync, existsSync, statSync, realpathSync, symlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir, availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as R from './regras.mjs';
import * as G from './guardas.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARDA = join(RAIZ, '.github', 'guardas.mjs');
const YAML = readFileSync(join(RAIZ, '.github', 'workflows', 'publicar.yml'), 'utf8');
const TMP = realpathSync(mkdtempSync(join(tmpdir(), 'pf-guardas-')));
const RAPIDO = process.argv.includes('--rapido');

let passou = 0; let falhou = 0;
const certo = (c, d, extra = '') => {
  if (c) { passou++; console.log(`  ✓ ${d}`); } else { falhou++; console.log(`  ✗ ${d}${extra ? `  — ${String(extra).slice(0, 1500)}` : ''}`); }
  return c;
};
const secao = (t) => console.log(`\n— ${t}`);
const clonar = (x) => JSON.parse(JSON.stringify(x));
const correr = (cmd, args, opcoes = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opcoes, env: { ...process.env, GITHUB_STEP_SUMMARY: '', GITHUB_ACTIONS: '', ...(opcoes.env || {}) } });
  return { status: r.status, out: r.stdout || '', err: r.stderr || '' };
};
const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/* Os dados de hoje, como a guarda os lê (texto), e lidos (objectos). */
const { dados: TEXTO } = G.lerDados(RAIZ);
const lerObj = (t) => JSON.parse(t);
const HOJE = {
  definicoes: lerObj(TEXTO.definicoes), servicos: lerObj(TEXTO.servicos), pares: lerObj(TEXTO.pares), avaliacoes: lerObj(TEXTO.avaliacoes),
  trabalhos: Object.fromEntries(Object.entries(TEXTO.trabalhos).map(([k, v]) => [k, lerObj(v)])),
  loja: Object.fromEntries(Object.entries(TEXTO.loja).map(([k, v]) => [k, lerObj(v)])),
};
const LISTAR = G.listarPastaEm(RAIZ);
const OP = { listarPasta: LISTAR };
const deClasse = (lista, classe) => lista.filter((p) => p.classe === classe);
const avisos = (lista) => lista.filter((p) => p.classe === 'avisa' && !p.lembrete);
const lembretes = (lista) => lista.filter((p) => p.lembrete);
/* Os dados de hoje, mudados: mudar(d) mexe em d.trabalhos[<nome>], d.loja[<nome>]
   (objecto, ou texto para um ficheiro que não se lê), d.definicoes, d.servicos… */
const com = (mudar) => { const d = clonar(HOJE); mudar(d); return d; };
const problemasCom = (mudar, op = OP) => R.problemas(com(mudar), op);
const novos = (lista) => { const hoje = new Set(R.problemas(TEXTO, OP).map((p) => p.chave)); return lista.filter((p) => !hoje.has(p.chave)); };

const T = 'ferrari-roma';           // um trabalho: na galeria da «Correção de Pintura»
const T2 = 'audi-q4-etron';         // só na galeria do «Polimento»
const P = 'shampoo-ph-neutro';      // um produto: a fotografia é a do nome (sem `foto`)
const SV = HOJE.servicos.servicos.findIndex((s) => s.slug === 'polimento');
const PA = 0;                       // o 1.º comparador (tesla-pincas)
const trab = (nome, mudar) => (d) => mudar(d.trabalhos[nome], d);
const prod = (nome, mudar) => (d) => mudar(d.loja[nome], d);
const serv = (mudar) => (d) => mudar(d.servicos.servicos[SV], d);
const par = (mudar) => (d) => mudar(d.pares.pares[PA], d);
const crit = (i, mudar) => (d) => mudar(d.avaliacoes.criticas[i], d);
const def = (mudar) => (d) => mudar(d.definicoes, d);
const FOTO_T = HOJE.trabalhos[T].fotos[0];
const FOTO_LOJA = 'assets/img/loja/cera-de-carnauba-828.webp';
const SLUG_PA = HOJE.pares.pares[PA].slug;
/* A chave de uma fotografia nas chaves das regras. */
const chaveFoto = (c) => R.chaveDaFoto(c, 'obras');

/* OS COMMITS QUE TERIAM PARADO A PUBLICAÇÃO, revistos um a um (10 out 2026):
   · os doze do primeiro dia do site (23 e 24 ago 2026, até acfa299): ainda sem
     o e-mail (até ccd3c82) e sem o nome civil do titular (até 99ec208) — os
     dois que o artigo 10.º do DL 7/2004 obriga (memória
     perfectfinish-compliance: «Faltavam os dois neste projecto»);
   · nos três primeiros, ainda não havia os ficheiros dos serviços e das
     avaliações (o gerador de então não os lia; hoje rebentava sem eles). */
const PARAVA_SEM_EMAIL = ['194039a', 'a9c846f', 'd9c70a2', 'a810b3d', 'e847a85', '128015d'];
const PARAVA_SEM_TITULAR = ['194039a', 'a9c846f', 'd9c70a2', 'a810b3d', 'e847a85', '128015d', 'ccd3c82', 'e0abfc3', 'a18e3d4', '686fd31', 'f29abc8', 'acfa299'];
const ESPERADOS_NO_HISTORICO = Object.fromEntries(PARAVA_SEM_TITULAR.map((h) => [h, [
  ...(PARAVA_SEM_EMAIL.includes(h) ? ['definicoes:contactos.email'] : []),
  'definicoes:empresa.titular',
  ...(['194039a', 'a9c846f', 'd9c70a2'].includes(h) ? ['servicos:ausente'] : []),
  ...(['194039a', 'a9c846f'].includes(h) ? ['avaliacoes:ausente'] : []),
]]));

/* ================================================================== */
secao('as regras são um ES module puro');
{
  const fonte = readFileSync(join(RAIZ, '.github', 'regras.mjs'), 'utf8');
  certo(!/^\s*import[\s{*]/m.test(fonte) && !/\bimport\s*\(/.test(fonte), 'regras.mjs não importa nada');
  certo(!/\brequire\s*\(|\bprocess\.|['"]node:|\bBuffer\b|__dirname|import\.meta/.test(fonte), 'nem require, process, node:*, Buffer, __dirname ou import.meta (corre tal e qual no browser e num Worker)');
  certo(![...fonte].some((ch) => { const c = ch.codePointAt(0); return (c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 0x7f || c === 0x2028 || c === 0x2029 || c === 0xfeff; }), 'nenhum carácter de controlo literal no código (memória bytes-de-controlo-no-codigo)');
}

/* ================================================================== */
secao('os dados de hoje');
{
  const lista = R.problemas(TEXTO, OP);
  certo(deClasse(lista, 'bloqueia').length === 0, 'nada pára a publicação', deClasse(lista, 'bloqueia').map((p) => p.chave).join(', '));
  certo(deClasse(lista, 'neutraliza').length === 0, 'nada muda no site', deClasse(lista, 'neutraliza').map((p) => p.chave).join(', '));
  certo(avisos(lista).length === 0, 'nenhum aviso', avisos(lista).map((p) => `${p.chave}: ${p.mensagem}`).join(' | '));
  const esperados = ['produto:descontaminante-ferrico:familia-fora', 'produto:quick-detailer:familia-fora'];
  const vistos = lembretes(lista).map((p) => p.chave).sort();
  certo(JSON.stringify(vistos) === JSON.stringify(esperados), 'os lembretes são os 2 que os dados pedem (as categorias «Preparação» e «Manutenção», fora da lista do .pages.yml)', vistos.join(', '));
  let iguais = 0; const diferentes = [];
  const todos = [...Object.entries(R.FICHEIROS).map(([k, rel]) => [rel, TEXTO[k]]),
    ...Object.entries(TEXTO.trabalhos).map(([n, t]) => [R.ficheiroDoTrabalho(n), t]), ...Object.entries(TEXTO.loja).map(([n, t]) => [R.ficheiroDoProduto(n), t])];
  for (const [rel, t] of todos) { if (R.serializar(JSON.parse(t), R.terminacaoDe(t)) === t) iguais++; else diferentes.push(rel); }
  certo(diferentes.length === 0, `os ${iguais} ficheiros de data/ saem do serializar() byte a byte, cada um com a sua terminação`, diferentes.join(', '));
  certo(todos.every(([, t]) => t.endsWith('\n')), 'hoje todos acabam em \\n (o Pages CMS gravava sem: o painel guarda a de cada um)');
  const naoBate = Object.entries(HOJE.trabalhos).filter(([n, t]) => t.slug !== n).concat(Object.entries(HOJE.loja).filter(([n, p]) => p.slug !== n));
  certo(naoBate.length === 0, 'em cada trabalho e produto, o campo `slug` é o nome do ficheiro (o gerador usa o campo)', naoBate.map(([n]) => n).join(', '));
  const g = correr('node', [GUARDA]);
  certo(g.status === 0 && /0 que param, 0 que mudam o site \(0 item\(ns\)\), 0 avisos, 2 lembretes/.test(g.out), 'a guarda, como programa, no repositório: sai com 0, e diz o mesmo', g.out.slice(-300) + g.err);
}

/* ================================================================== */
secao('as fotografias, com a conta do gerador');
{
  const L = (p) => LISTAR(p);
  certo(R.fotografiaExiste(FOTO_T, L, 'obras'), `a de 828 em WebP de uma tratada existe (${FOTO_T})`);
  certo(R.fotografiaExiste(FOTO_T.replace('-828.webp', '-414.avif'), L, 'obras'), 'uma cópia escolhida (a de 414 em AVIF) vale pela fotografia');
  certo(R.fotografiaExiste(FOTO_T.replace(/^assets\/img\/obras\//, '').replace('-828.webp', ''), L, 'obras'), 'o radical sozinho (a forma antiga) também');
  certo(R.fotografiaExiste(`/${FOTO_T}`, L, 'obras'), 'e com a barra à frente');
  certo(!R.fotografiaExiste(FOTO_T, L, 'loja'), 'mas não noutra biblioteca (o gerador junta-lhe a pasta do campo)');
  certo(R.fotografiaExiste('cera-de-carnauba', L, 'loja'), 'a fotografia de um produto pelo nome dele (a dos dez de hoje)');
  const sem414 = (p) => (p === R.BIBLIOTECAS.obras ? L(p).filter((n) => n !== FOTO_T.split('/').pop().replace('-828.webp', '-414.avif')) : L(p));
  certo(!R.fotografiaExiste(FOTO_T, sem414, 'obras'), 'uma tratada a que falta uma das quatro cópias não existe (o site pedia-a no srcset, e a auditoria travava a publicação)');
  const comSolta = (p) => (p === R.BIBLIOTECAS.obras ? [...L(p), 'Foto nova 1.jpg'] : L(p));
  certo(R.fotografiaExiste('assets/img/obras/Foto nova 1.jpg', comSolta, 'obras'), 'um ficheiro solto (do Pages CMS, com espaços) existe se estiver lá');
  certo(!R.fotografiaExiste('assets/img/obras/sub/x.jpg', () => ['sub'], 'obras'), 'uma subpasta não é da biblioteca');
  certo(R.chaveDaFoto(FOTO_T) === R.chaveDaFoto(FOTO_T.replace('-828.webp', '-414.webp')), 'as quatro cópias são a mesma fotografia (chaveDaFoto)');
  const copias = L(R.BIBLIOTECAS.obras).filter((n) => R.eCopia(n)).length;
  const fotos = L(R.BIBLIOTECAS.obras).filter((n) => !R.eCopia(n)).length;
  certo(copias === 3 * fotos && fotos === 63, `a biblioteca das obras: ${fotos} fotografias e ${copias} cópias (três por fotografia)`);
}

/* ================================================================== */
secao('re-jogar os commits de data/');
{
  certo(git('rev-parse', '--is-shallow-repository').trim() === 'false', 'o histórico está inteiro (um clone raso não prova nada)');
  const noCommit = (c) => {
    const entradas = git('ls-tree', '-r', '-z', c, '--', 'data/').split('\0').filter(Boolean).map((l) => { const [cab, caminho] = l.split('\t'); return { id: cab.split(' ')[2], caminho }; });
    const ler = (id) => git('cat-file', 'blob', id);
    const dados = { trabalhos: Object.create(null), loja: Object.create(null) };
    for (const k of Object.keys(R.FICHEIROS)) dados[k] = null;
    for (const { id, caminho } of entradas) {
      for (const [k, f] of Object.entries(R.FICHEIROS)) if (caminho === f) dados[k] = ler(id);
      let m = /^data\/trabalhos\/([^/]+)\.json$/.exec(caminho); if (m) dados.trabalhos[m[1]] = ler(id);
      m = /^data\/loja\/([^/]+)\.json$/.exec(caminho); if (m) dados.loja[m[1]] = ler(id);
    }
    const pastas = new Map();
    for (const caminho of git('ls-tree', '-r', '-t', '-z', '--name-only', c, '--', 'assets/img').split('\0').filter(Boolean)) {
      const pai = caminho.slice(0, caminho.lastIndexOf('/'));
      if (!pastas.has(pai)) pastas.set(pai, []);
      pastas.get(pai).push(caminho.slice(caminho.lastIndexOf('/') + 1));
    }
    return { dados, listarPasta: (p) => pastas.get(p) || [] };
  };
  const commits = git('log', '--format=%H %h', '--reverse', '--', 'data/').trim().split('\n').map((l) => l.split(' '));
  const pararam = new Map(); let comNeutralizados = 0;
  for (const [c, h] of commits) {
    const { dados, listarPasta } = noCommit(c);
    const lista = R.problemas(dados, { listarPasta });
    const b = deClasse(lista, 'bloqueia');
    const efeitos = R.neutralizar(dados, lista).efeitos;
    const msg = git('log', '-1', '--format=%ad: %s', '--date=short', c).trim();
    if (b.length) pararam.set(h, b.map((p) => p.chave));
    if (efeitos.length) comNeutralizados++;
    console.log(`    · ${h} ${msg.slice(0, 70)} — ${b.length ? `PARAVA: ${b.map((p) => p.chave).join(', ')}` : 'publicava'} (${Object.keys(dados.trabalhos).length} trabalhos, ${Object.keys(dados.loja).length} produtos; ${efeitos.length ? `mudavam no site: ${efeitos.map((e) => `${e.nome} — ${R.descreverEfeitos(e)}`).join('; ').slice(0, 200)}` : 'nada neutralizado'})`);
  }
  certo(commits.length >= 20, `${commits.length} commits re-jogados (todos os que mexeram em data/, desde o primeiro)`);
  const a = [...pararam.entries()].map(([h, k]) => `${h}: ${k.join(', ')}`).sort();
  const e = Object.entries(ESPERADOS_NO_HISTORICO).map(([h, k]) => `${h}: ${k.join(', ')}`).sort();
  certo(JSON.stringify(a) === JSON.stringify(e), `os commits que teriam parado a publicação são os ${e.length} esperados (o primeiro dia, sem o e-mail e o nome civil do titular)${comNeutralizados ? ` — em ${comNeutralizados} algum item mudava no site` : ''}`, `vistos: ${a.join(' · ') || 'nenhum'} — esperados: ${e.join(' · ') || 'nenhum'}`);
  {
    /* A mesma máquina tem de saber dizer «pára». */
    const [c] = commits.at(-1);
    const { dados, listarPasta } = noCommit(c);
    const d = JSON.parse(dados.definicoes); delete d.contactos.whatsapp;
    certo(R.problemas({ ...dados, definicoes: R.serializar(d, '\n') }, { listarPasta }).some((p) => p.classe === 'bloqueia' && p.chave === 'definicoes:contactos.whatsapp'), '   e a mesma máquina diz «pára» quando é caso disso (o último commit, sem o WhatsApp)');
  }
}

/* ================================================================== */
secao('cada regra, com a classe certa');
{
  const fotosObras = LISTAR(R.BIBLIOTECAS.obras).filter((n) => n.endsWith('-828.webp')).map((n) => `${R.BIBLIOTECAS.obras}/${n}`);
  const semGalerias = (d) => { for (const s of d.servicos.servicos) if (Array.isArray(s.obras)) s.obras = s.obras.filter((x) => x !== T2); };
  const CASOS = [
    // [descrição, mudar(dados), classe, chave (texto ou RegExp), efeito?, lembrete?]
    ['trabalho sem carro', trab(T, (t) => { delete t.veiculo; }), 'neutraliza', `trabalho:${T}:veiculo`, 'esconder'],
    ['carro que é um número', trab(T, (t) => { t.veiculo = 7; }), 'neutraliza', `trabalho:${T}:veiculo`, 'esconder'],
    ['carro só com espaços', trab(T, (t) => { t.veiculo = '   '; }), 'neutraliza', `trabalho:${T}:veiculo`, 'esconder'],
    ['trabalho sem «o que se fez»', trab(T, (t) => { t.servico = ''; }), 'neutraliza', `trabalho:${T}:servico`, 'esconder'],
    ['trabalho sem a lista das fotografias', trab(T, (t) => { delete t.fotos; }), 'neutraliza', `trabalho:${T}:fotos-lista`, 'sem_fotografia'],
    ['fotografias num texto', trab(T, (t) => { t.fotos = t.fotos[0]; }), 'neutraliza', `trabalho:${T}:fotos-lista`, 'sem_fotografia'],
    ['fotografia que já não existe', trab(T, (t) => { t.fotos.push('assets/img/obras/APAGADA.jpg'); }), 'neutraliza', `trabalho:${T}:foto-em-falta:assets/img/obras/APAGADA.jpg`, 'sem_fotografia'],
    ['uma tratada que já não existe', trab(T, (t) => { t.fotos.push('assets/img/obras/apagada-1-828.webp'); }), 'neutraliza', `trabalho:${T}:foto-em-falta:assets/img/obras/apagada-1`, 'sem_fotografia'],
    ['fotografia da biblioteca da loja', trab(T, (t) => { t.fotos.push(FOTO_LOJA); }), 'neutraliza', `trabalho:${T}:foto-invalida:${FOTO_LOJA}`, 'sem_fotografia'],
    ['fotografia numa subpasta', trab(T, (t) => { t.fotos.push('assets/img/obras/sub/x.jpg'); }), 'neutraliza', `trabalho:${T}:foto-invalida:assets/img/obras/sub/x.jpg`, 'sem_fotografia'],
    ['fotografia com «..»', trab(T, (t) => { t.fotos.push('assets/img/obras/../marca/og.png'); }), 'neutraliza', `trabalho:${T}:foto-invalida:assets/img/obras/../marca/og.png`, 'sem_fotografia'],
    ['fotografia de outro site', trab(T, (t) => { t.fotos.push('https://exemplo.pt/a.jpg'); }), 'neutraliza', `trabalho:${T}:foto-invalida:https://exemplo.pt/a.jpg`, 'sem_fotografia'],
    ['fotografia com «"» no nome (partia o src)', trab(T, (t) => { t.fotos.push('assets/img/obras/a"b.jpg'); }), 'neutraliza', `trabalho:${T}:foto-invalida:assets/img/obras/a"b.jpg`, 'sem_fotografia'],
    ['fotografia com um espaço à frente (o gerador não a acha)', trab(T, (t) => { t.fotos[0] = ` ${t.fotos[0]}`; }), 'neutraliza', `trabalho:${T}:foto-invalida: ${FOTO_T}`, 'sem_fotografia'],
    ['fotografia .gif', trab(T, (t) => { t.fotos.push('assets/img/obras/a.gif'); }), 'neutraliza', `trabalho:${T}:foto-invalida:assets/img/obras/a.gif`, 'sem_fotografia'],
    ['fotografia que não é texto', trab(T, (t) => { t.fotos.push(null); }), 'neutraliza', `trabalho:${T}:foto-invalida:null`, 'sem_fotografia'],
    ['a mesma fotografia duas vezes', trab(T, (t) => { t.fotos.push(t.fotos[0]); }), 'avisa', `trabalho:${T}:foto-repetida:${chaveFoto(FOTO_T)}`],
    ['a de 828 e a de 414 da mesma', trab(T, (t) => { t.fotos.push(t.fotos[0].replace('-828.webp', '-414.webp')); }), 'avisa', `trabalho:${T}:foto-repetida:${chaveFoto(FOTO_T)}`],
    ['21 fotografias', trab(T, (t) => { t.fotos = fotosObras.slice(0, 21); }), 'avisa', `trabalho:${T}:fotos-a-mais`],
    ['«Mostrar no site» escrito como texto', trab(T, (t) => { t.publicado = 'false'; }), 'avisa', `trabalho:${T}:publicado`],
    ['«Destacar» como número', trab(T, (t) => { t.destaque = 1; }), 'avisa', `trabalho:${T}:destaque`],
    ['ordem 0 (o .pages.yml começa em 1)', trab(T, (t) => { t.ordem = 0; }), 'avisa', `trabalho:${T}:ordem`],
    ['ordem com casas decimais', trab(T, (t) => { t.ordem = 1.5; }), 'avisa', `trabalho:${T}:ordem`],
    ['carro com 200 caracteres', trab(T, (t) => { t.veiculo = 'x'.repeat(200); }), 'avisa', `trabalho:${T}:veiculo:tamanho`],
    ['carro com uma mudança de linha', trab(T, (t) => { t.veiculo = 'Ferrari\nRoma'; }), 'avisa', `trabalho:${T}:veiculo:controlo`],
    ['o identificador não é o nome do ficheiro', trab(T, (t) => { t.slug = 'outro'; }), 'avisa', `trabalho:${T}:slug`],
    ['publicado sem fotografias', trab(T, (t) => { t.fotos = []; }), 'avisa', `trabalho:${T}:sem-fotos`, undefined, true],
    ['um trabalho em galeria nenhuma', semGalerias, 'avisa', `trabalho:${T2}:fora-das-galerias`, undefined, true],
    ['um trabalho que não se lê', (d) => { d.trabalhos[T] = '{ "veiculo": '; }, 'bloqueia', `trabalho:${T}:ilegivel`],
    ['um trabalho que é uma lista', (d) => { d.trabalhos[T] = '[]'; }, 'bloqueia', `trabalho:${T}:forma`],
    ['um ficheiro chamado «.json»', (d) => { d.trabalhos[''] = TEXTO.trabalhos[T]; }, 'bloqueia', 'trabalho::sem-nome'],
    ['um nome de ficheiro com maiúsculas e espaços', (d) => { d.trabalhos['Teste Ç'] = { ...HOJE.trabalhos[T], slug: 'Teste Ç' }; }, 'avisa', 'trabalho:Teste Ç:nome-do-ficheiro'],
    ['um trabalho de 60 KB', trab(T, (t) => { t.veiculo = 'x'.repeat(56 * 1024); }), 'avisa', `trabalho:${T}:tecto`, undefined, true],

    ['produto sem nome', prod(P, (p) => { delete p.nome; }), 'neutraliza', `produto:${P}:nome`, 'esconder'],
    ['produto sem categoria', prod(P, (p) => { p.familia = ''; }), 'avisa', `produto:${P}:familia`],
    ['categoria fora da lista', prod(P, (p) => { p.familia = 'Outra'; }), 'avisa', `produto:${P}:familia-fora`, undefined, true],
    ['preço com vírgula, num texto', prod(P, (p) => { p.preco = '18,50'; }), 'avisa', `produto:${P}:preco`],
    ['preço com três casas', prod(P, (p) => { p.preco = 18.555; }), 'avisa', `produto:${P}:preco`],
    ['preço negativo', prod(P, (p) => { p.preco = -1; }), 'avisa', `produto:${P}:preco`],
    ['fotografia escolhida que já não existe', prod(P, (p) => { p.foto = 'assets/img/loja/APAGADA.jpg'; }), 'neutraliza', `produto:${P}:sem-foto`, 'esconder'],
    ['fotografia da biblioteca das obras', prod(P, (p) => { p.foto = FOTO_T; }), 'neutraliza', `produto:${P}:foto-invalida`, 'esconder'],
    ['sem fotografia nem a do nome', (d) => { d.loja['produto-novo'] = { ...HOJE.loja[P], slug: 'produto-novo', nome: 'Produto novo' }; }, 'neutraliza', 'produto:produto-novo:sem-foto', 'esconder'],
    ['descrição com 401 caracteres', prod(P, (p) => { p.descricao = 'x'.repeat(401); }), 'avisa', `produto:${P}:descricao:tamanho`],
    ['«</script» na descrição', prod(P, (p) => { p.descricao = 'a </script> b'; }), 'avisa', `produto:${P}:partia-a-pagina`],

    ['os serviços que não são uma lista', (d) => { d.servicos = { servicos: 'x' }; }, 'bloqueia', 'servicos:forma'],
    ['sem o ficheiro dos serviços', (d) => { d.servicos = null; }, 'bloqueia', 'servicos:ausente'],
    ['um serviço que não é um serviço', (d) => { d.servicos.servicos.push(null); }, 'bloqueia', `servicos:#${HOJE.servicos.servicos.length + 1}:forma`],
    ['nenhum serviço', (d) => { d.servicos.servicos = []; }, 'avisa', 'servicos:vazia'],
    ['serviço sem nome', serv((s) => { s.nome = ''; }), 'avisa', 'servicos:polimento:nome'],
    ['serviço com «</script» no nome (vai para o JSON-LD de todas as páginas)', serv((s) => { s.nome = 'Polimento </script>'; }), 'bloqueia', 'servicos:polimento:partia-a-pagina'],
    ['fotografia do serviço que já não existe', serv((s) => { s.imagem = 'assets/img/obras/apagada-828.webp'; }), 'neutraliza', 'servicos:polimento:foto-em-falta', 'sem_fotografia'],
    ['fotografia do serviço da biblioteca da loja', serv((s) => { s.imagem = FOTO_LOJA; }), 'neutraliza', 'servicos:polimento:foto-invalida', 'sem_fotografia'],
    ['galeria com um trabalho que não existe', serv((s) => { s.obras.push('nao-existe'); }), 'avisa', 'servicos:polimento:obra-desconhecida:nao-existe'],
    ['galeria num texto', serv((s) => { s.obras = 'ferrari-roma'; }), 'avisa', 'servicos:polimento:obras'],
    ['dois serviços com o mesmo identificador', (d) => { d.servicos.servicos.push({ ...HOJE.servicos.servicos[SV] }); }, 'avisa', 'servicos:polimento:slug-repetido'],
    ['um identificador com maiúsculas', serv((s) => { s.slug = 'Polimento'; }), 'avisa', `servicos:#${SV + 1}:slug`],
    ['uma galeria que não abre nada', serv((s) => { s.obras = []; s.imagem = 'assets/img/obras/par-brembo-antes-828.webp'; }), 'avisa', 'servicos:polimento:galeria-vazia', undefined, true],

    ['os comparadores num texto', (d) => { d.pares = { pares: 'x' }; }, 'bloqueia', 'pares:forma'],
    ['um comparador que não é um comparador', (d) => { d.pares.pares.push(7); }, 'bloqueia', `pares:#${HOJE.pares.pares.length + 1}:forma`],
    ['comparador sem a fotografia ANTES', par((p) => { delete p.antes; }), 'neutraliza', `pares:${SLUG_PA}:antes`, 'esconder'],
    ['ANTES que já não existe', par((p) => { p.antes = 'assets/img/obras/apagada-828.webp'; }), 'neutraliza', `pares:${SLUG_PA}:antes-em-falta`, 'esconder'],
    ['DEPOIS da biblioteca da loja', par((p) => { p.depois = FOTO_LOJA; }), 'neutraliza', `pares:${SLUG_PA}:depois-invalida`, 'esconder'],
    ['as duas fotografias iguais', par((p) => { p.depois = p.antes; }), 'avisa', `pares:${SLUG_PA}:mesma-foto`],
    ['comparador sem carro', par((p) => { p.veiculo = ''; }), 'avisa', `pares:${SLUG_PA}:veiculo`],
    ['sem a descrição da fotografia ANTES', par((p) => { delete p.alt_antes; }), 'avisa', `pares:${SLUG_PA}:alt_antes`, undefined, true],
    ['ordem do comparador 0', par((p) => { p.ordem = 0; }), 'avisa', `pares:${SLUG_PA}:ordem`],
    ['nenhum comparador', (d) => { d.pares.pares = []; }, 'avisa', 'pares:vazia'],

    ['as avaliações num texto', (d) => { d.avaliacoes = { criticas: 'x' }; }, 'bloqueia', 'avaliacoes:forma'],
    ['uma avaliação que não é uma avaliação', (d) => { d.avaliacoes.criticas.push(null); }, 'bloqueia', `avaliacoes:#${HOJE.avaliacoes.criticas.length + 1}:forma`],
    ['avaliação sem autor', crit(0, (c) => { c.autor = ''; }), 'avisa', `avaliacoes:#1:autor`],
    ['o nome completo de quem escreveu', crit(0, (c) => { c.autor = 'Nelson Pereira'; }), 'avisa', 'avaliacoes:nelson-pereira:autor-completo', undefined, true],
    ['seis estrelas', crit(0, (c) => { c.estrelas = 6; }), 'avisa', 'avaliacoes:nelson-p:estrelas'],
    ['sem estrelas', crit(0, (c) => { delete c.estrelas; }), 'avisa', 'avaliacoes:nelson-p:estrelas'],
    ['avaliação sem texto', crit(0, (c) => { delete c.texto; }), 'avisa', 'avaliacoes:nelson-p:texto'],

    ['sem telefone', def((x) => { delete x.contactos.telefone; }), 'bloqueia', 'definicoes:contactos.telefone'],
    ['telefone com espaços', def((x) => { x.contactos.telefone = '968 828 510'; }), 'bloqueia', 'definicoes:contactos.telefone'],
    ['telefone fixo (o site diz «rede móvel»)', def((x) => { x.contactos.telefone = '244000000'; x.contactos.telefone_texto = '244 000 000'; }), 'avisa', 'definicoes:contactos.telefone:rede'],
    ['sem o telefone «como aparece»', def((x) => { delete x.contactos.telefone_texto; }), 'bloqueia', 'definicoes:contactos.telefone_texto'],
    ['os dois telefones diferentes', def((x) => { x.contactos.telefone_texto = '968 828 910'; }), 'avisa', 'definicoes:contactos.telefone_texto:outro'],
    ['sem e-mail (a lei obriga)', def((x) => { x.contactos.email = ''; }), 'bloqueia', 'definicoes:contactos.email'],
    ['e-mail que não é e-mail', def((x) => { x.contactos.email = 'isto não é email'; }), 'avisa', 'definicoes:contactos.email:formato'],
    ['sem Instagram', def((x) => { delete x.contactos.instagram; }), 'avisa', 'definicoes:contactos.instagram'],
    ['Instagram sem https', def((x) => { x.contactos.instagram = 'http://instagram.com/x'; }), 'avisa', 'definicoes:contactos.instagram:formato'],
    ['sem Facebook', def((x) => { delete x.contactos.facebook; }), 'avisa', 'definicoes:contactos.facebook', undefined, true],
    ['WhatsApp sem o 351', def((x) => { x.contactos.whatsapp = x.contactos.whatsapp.slice(3); }), 'bloqueia', 'definicoes:contactos.whatsapp'],
    ['WhatsApp com espaços', def((x) => { x.contactos.whatsapp = '351 968 828 510'; }), 'bloqueia', 'definicoes:contactos.whatsapp'],
    ['sem a rua', def((x) => { delete x.morada.rua; }), 'bloqueia', 'definicoes:morada.rua'],
    ['código postal vazio', def((x) => { x.morada.codigo_postal = ''; }), 'bloqueia', 'definicoes:morada.codigo_postal'],
    ['código postal sem o hífen', def((x) => { x.morada.codigo_postal = '2400446'; }), 'avisa', 'definicoes:morada.codigo_postal:formato'],
    ['sem a localidade', def((x) => { x.morada.localidade = ' '; }), 'bloqueia', 'definicoes:morada.localidade'],
    ['sem o país (escondido)', def((x) => { delete x.morada.pais; }), 'avisa', 'definicoes:morada.pais'],
    ['latitude num texto', def((x) => { x.morada.latitude = '39,7'; }), 'avisa', 'definicoes:morada.latitude'],
    ['sem a secção da morada', def((x) => { delete x.morada; }), 'bloqueia', 'definicoes:morada:forma'],
    ['o horário num texto', def((x) => { x.horario = 'todos os dias'; }), 'bloqueia', 'definicoes:horario:forma'],
    ['uma linha do horário que não é uma linha', def((x) => { x.horario.push(null); }), 'bloqueia', `definicoes:horario.${HOJE.definicoes.horario.length}:forma`],
    ['uma linha do horário sem dias', def((x) => { x.horario[0].dias = ''; }), 'avisa', 'definicoes:horario.0.dias'],
    ['os dias da semana em números estragados', def((x) => { x.horario[0].indices = 'seg'; }), 'avisa', 'definicoes:horario.0.indices'],
    ['o horário vazio', def((x) => { x.horario = []; }), 'avisa', 'definicoes:horario:vazio'],
    ['sem o título da capa', def((x) => { delete x.textos.heroi_titulo; }), 'avisa', 'definicoes:textos.heroi_titulo'],
    ['o título da capa em 5 linhas', def((x) => { x.textos.heroi_titulo = 'a\nb\nc\nd\ne'; }), 'avisa', 'definicoes:textos.heroi_titulo:linhas', undefined, true],
    ['uma linha do título com 30 letras', def((x) => { x.textos.heroi_titulo = 'Estúdio de Customização Premium\nX'; }), 'avisa', 'definicoes:textos.heroi_titulo:linha-longa', undefined, true],
    ['sem a linha por baixo do título', def((x) => { x.textos.heroi_sub = ''; }), 'avisa', 'definicoes:textos.heroi_sub'],
    ['sem o nome completo (legal)', def((x) => { delete x.marca.nome_completo; }), 'bloqueia', 'definicoes:marca.nome_completo'],
    ['sem o nome', def((x) => { x.marca.nome = ''; }), 'avisa', 'definicoes:marca.nome'],
    ['sem a nota do Google', def((x) => { delete x.google.nota; }), 'avisa', 'definicoes:google.nota'],
    ['nota 5,5', def((x) => { x.google.nota = 5.5; }), 'avisa', 'definicoes:google.nota'],
    ['nota com duas casas', def((x) => { x.google.nota = 4.95; }), 'avisa', 'definicoes:google.nota'],
    ['número de avaliações num texto', def((x) => { x.google.total = '94'; }), 'avisa', 'definicoes:google.total'],
    ['sem o perfil do Google', def((x) => { x.google.perfil = ''; }), 'avisa', 'definicoes:google.perfil'],
    ['sem o nome civil do titular', def((x) => { x.empresa.titular = ''; }), 'bloqueia', 'definicoes:empresa.titular'],
    ['sem a forma jurídica', def((x) => { delete x.empresa.forma; }), 'avisa', 'definicoes:empresa.forma'],
    ['sem NIF', def((x) => { x.empresa.nif = ''; }), 'bloqueia', 'definicoes:empresa.nif'],
    ['NIF com 8 algarismos (a auditoria trava)', def((x) => { x.empresa.nif = '31661461'; }), 'bloqueia', 'definicoes:empresa.nif'],
    ['NIF que não confere', def((x) => { x.empresa.nif = '316 614 611'; }), 'avisa', 'definicoes:empresa.nif:controlo'],
    ['dados legais que são uma lista', def((x) => { x.empresa = []; }), 'bloqueia', 'definicoes:empresa:forma'],
    ['«</script>» num texto do estúdio', def((x) => { x.marca.reclamo = 'a </script> b'; }), 'bloqueia', 'definicoes:partia-a-pagina'],
    ['a capa num texto (escondida)', def((x) => { x.capa = { fotos: 'x' }; }), 'bloqueia', 'definicoes:capa:forma'],
    ['uma fotografia da capa que já não existe', def((x) => { x.capa = { fotos: ['assets/img/obras/apagada-828.webp'] }; }), 'bloqueia', 'definicoes:capa:fotos'],
    ['os dados do estúdio não se lêem', (d) => { d.definicoes = '{'; }, 'bloqueia', 'definicoes:ilegivel'],
    ['sem os dados do estúdio', (d) => { d.definicoes = null; }, 'bloqueia', 'definicoes:ausente'],
    ['os dados do estúdio numa lista', (d) => { d.definicoes = []; }, 'bloqueia', 'definicoes:forma'],
  ];
  for (const [descr, mudar, classe, chave, efeito, lembrete] of CASOS) {
    const lista = problemasCom(mudar);
    const p = lista.find((x) => x.classe === classe && (chave instanceof RegExp ? chave.test(x.chave) : x.chave === chave));
    const outrosQueParam = deClasse(novos(lista), 'bloqueia').filter((x) => x !== p);
    certo(p && (!efeito || p.efeito === efeito) && (!lembrete || p.lembrete === true) && !outrosQueParam.length && p.ecra && p.mensagem,
      `${descr} → ${classe}${efeito ? ` (${efeito})` : ''}${lembrete ? ' (lembrete)' : ''}`,
      p ? `efeito ${p.efeito}, lembrete ${p.lembrete}, também param: ${outrosQueParam.map((x) => x.chave).join(', ')}` : `veio: ${novos(lista).map((x) => `${x.chave}=${x.classe}`).join(', ') || 'nada'}`);
  }

  /* E os casos em que a regra diz «sim». */
  const comSolta = (p) => (p === R.BIBLIOTECAS.obras ? [...LISTAR(p), 'ferrari-roma-1a2b3c4d.jpg'] : p === R.BIBLIOTECAS.loja ? [...LISTAR(p), 'shampoo-ph-neutro-1a2b3c4d.jpg'] : LISTAR(p));
  const SIM = [
    ['uma cópia escolhida (a de 414) vale pela fotografia', trab(T, (t) => { t.fotos[0] = t.fotos[0].replace('-828.webp', '-414.webp'); })],
    ['a mesma fotografia com a barra à frente', trab(T, (t) => { t.fotos[0] = `/${t.fotos[0]}`; })],
    ['o radical sozinho (a forma antiga)', trab(T, (t) => { t.fotos[0] = 'ferrari-roma-1'; })],
    ['uma fotografia nova do painel no trabalho', trab(T, (t) => { t.fotos.push('assets/img/obras/ferrari-roma-1a2b3c4d.jpg'); }), comSolta],
    ['despublicado sem fotografias', trab(T, (t) => { t.fotos = []; t.publicado = false; })],
    ['sem ordem', trab(T, (t) => { delete t.ordem; })],
    ['preço vazio (null) fica «Sob consulta»', prod(P, (p) => { p.preco = null; })],
    ['preço com duas casas', prod(P, (p) => { p.preco = 24.5; })],
    ['produto com uma fotografia nova do painel', prod(P, (p) => { p.foto = 'assets/img/loja/shampoo-ph-neutro-1a2b3c4d.jpg'; }), comSolta],
    ['produto com a fotografia de outro produto', prod(P, (p) => { p.foto = FOTO_LOJA; })],
    ['serviço sem fotografia (fica só o nome)', serv((s) => { s.imagem = ''; delete s.obras; })],
    ['serviço com a galeria pela fotografia (sem trabalhos escolhidos)', serv((s) => { delete s.obras; })],
    ['comparador sem explicação', par((p) => { delete p.legenda; })],
    ['NIF sem espaços', def((x) => { x.empresa.nif = '316614610'; })],
    ['NIF como número', def((x) => { x.empresa.nif = 316614610; })],
    ['uma linha nova no horário, sem os dias em números', def((x) => { x.horario.push({ dias: 'Feriados', horas: 'Encerrado' }); })],
    ['um trabalho novo, do painel, na galeria de um serviço', (d) => {
      d.trabalhos['porsche-taycan'] = { slug: 'porsche-taycan', veiculo: 'Porsche Taycan', servico: 'PPF', ordem: 19, fotos: [FOTO_T], destaque: false, publicado: true };
      d.servicos.servicos[SV].obras.push('porsche-taycan');
    }],
    ['um produto novo, do painel', (d) => { d.loja['luva-nova'] = { slug: 'luva-nova', nome: 'Luva nova', familia: 'Acessórios', ordem: 11, descricao: 'Uma luva.', formato: '1 un.', preco: null, foto: FOTO_LOJA, publicado: true }; }],
    ['um comparador novo, do painel', (d) => { d.pares.pares.push({ slug: 'porsche-taycan', veiculo: 'Porsche Taycan', servico: 'PPF', antes: FOTO_T, depois: HOJE.trabalhos[T].fotos[1], ordem: 6, legenda: 'x', alt_antes: 'a', alt_depois: 'b' }); }],
    ['uma avaliação nova', (d) => { d.avaliacoes.criticas.push({ autor: 'Ana R.', quando: 'há uma semana', estrelas: 5, texto: 'Impecável.' }); }],
  ];
  for (const [descr, mudar, listar] of SIM) {
    const n = novos(problemasCom(mudar, listar ? { listarPasta: listar } : OP)).filter((p) => !p.lembrete);
    certo(n.length === 0, `sim: ${descr}`, n.map((p) => `${p.chave}=${p.classe}`).join(', '));
  }

  /* Uma chave, uma classe: o Worker do painel compara as chaves do HEAD com as
     da gravação, e uma chave que mudasse de classe com o valor enganava-o. */
  const classes = new Map(); const duplas = [];
  for (const [, mudar] of [...CASOS, ...SIM]) {
    for (const p of problemasCom(mudar)) {
      const k = p.chave.replace(/^(trabalho|produto):[^:]*:/, '$1:*:').replace(/^(servicos|pares|avaliacoes):[^:]+:/, '$1:*:')
        .replace(/:(foto-[a-z-]+|obra-desconhecida):.*$/, ':$1:*').replace(/^definicoes:horario\.\d+/, 'definicoes:horario.N');
      const c = `${p.classe}${p.lembrete ? '+lembrete' : ''}`;
      if (classes.has(k) && classes.get(k) !== c) duplas.push(`${k}: ${classes.get(k)} e ${c}`);
      classes.set(k, c);
    }
  }
  certo(duplas.length === 0, `uma chave, uma classe (${classes.size} chaves vistas)`, duplas.join(' | '));
}

/* ================================================================== */
secao('o varrimento: cada chave apagada');
{
  const semCaminhos = (m) => /data\/|\.json|\b[a-z_]+\.[a-z_]+\b/.test(m);
  /* A classe mais grave do que veio; só lembretes → «lembrete». Um lembrete
     pode ser de OUTRO ecrã (tirar a fotografia de um serviço deixa um
     trabalho fora das galerias, e o trabalho lembra-o): é a ligação entre os
     ficheiros a funcionar. O ecrã confere-se nos que não são lembretes. */
  const GRAVIDADE = ['bloqueia', 'neutraliza', 'avisa'];
  const classeDe = (lista) => {
    const serios = lista.filter((p) => !p.lembrete);
    if (!serios.length) return lista.length ? 'lembrete' : null;
    return GRAVIDADE.find((c) => serios.some((p) => p.classe === c));
  };
  const varrer = (titulo, itens, quer, ecraComeca) => {
    const maus = []; let n = 0;
    for (const [nome, chaves, mudar] of itens) {
      for (const k of chaves) {
        n++;
        const lista = novos(problemasCom(mudar(k)));
        const viu = classeDe(lista);
        const q = quer[k];
        const aceita = Array.isArray(q) ? q : [q ?? null];
        if (!aceita.includes(viu)) maus.push(`${nome}.${k}: queria ${aceita.join(' ou ') || 'nada'}, veio ${viu || 'nada'}`);
        for (const p of lista) if ((!p.lembrete && !String(p.ecra).startsWith(ecraComeca)) || semCaminhos(p.mensagem)) maus.push(`${nome}.${k}: ecrã «${p.ecra}», mensagem «${p.mensagem}»`);
      }
    }
    certo(maus.length === 0, `${titulo} (${n} chaves): o problema certo, no ecrã certo, sem caminhos de JSON`, maus.slice(0, 8).join(' | '));
  };
  varrer('apagar cada chave de cada trabalho', Object.keys(HOJE.trabalhos).map((nome) => [nome, Object.keys(HOJE.trabalhos[nome]), (k) => trab(nome, (t) => { delete t[k]; })]),
    { veiculo: 'neutraliza', servico: 'neutraliza', fotos: 'neutraliza', slug: 'avisa' }, 'Trabalhos › ');
  varrer('apagar cada chave de cada produto', Object.keys(HOJE.loja).map((nome) => [nome, Object.keys(HOJE.loja[nome]), (k) => prod(nome, (p) => { delete p[k]; })]),
    { nome: 'neutraliza', familia: 'avisa', slug: 'neutraliza' }, 'Loja › ');
  varrer('apagar cada chave de cada serviço', HOJE.servicos.servicos.map((s, i) => [s.slug, Object.keys(s), (k) => (d) => { delete d.servicos.servicos[i][k]; }]),
    { nome: 'avisa', slug: 'avisa', imagem: [null, 'lembrete'], obras: [null, 'lembrete'], curto: null }, 'Serviços');
  varrer('apagar cada chave de cada comparador', HOJE.pares.pares.map((p, i) => [p.slug, Object.keys(p), (k) => (d) => { delete d.pares.pares[i][k]; }]),
    { veiculo: 'avisa', servico: 'avisa', antes: 'neutraliza', depois: 'neutraliza', alt_antes: 'lembrete', alt_depois: 'lembrete' }, 'Antes e depois');
  varrer('apagar cada chave de cada avaliação', HOJE.avaliacoes.criticas.map((c, i) => [c.autor, Object.keys(c), (k) => crit(i, (x) => { delete x[k]; })]),
    { autor: 'avisa', estrelas: 'avisa', texto: 'avisa' }, 'Avaliações');

  /* Os dados do estúdio, em profundidade. O que pára é o que a lei pede ou o
     que o gerador lê sem perguntar; o resto avisa ou cala-se. */
  const PARAM = new Set(['marca', 'marca.nome_completo', 'contactos', 'contactos.telefone', 'contactos.telefone_texto', 'contactos.whatsapp', 'contactos.email',
    'morada', 'morada.rua', 'morada.codigo_postal', 'morada.localidade', 'horario', 'google', 'empresa', 'empresa.titular', 'empresa.nif', 'textos']);
  const caminhos = [];
  (function andar(o, pre) {
    for (const [k, v] of Object.entries(o)) {
      const c = [...pre, k]; caminhos.push(c);
      if (v && typeof v === 'object') andar(v, c);
    }
  })(HOJE.definicoes, []);
  const maus2 = []; let param = 0;
  for (const c of caminhos) {
    const lista = novos(problemasCom(def((d) => { const pai = c.slice(0, -1).reduce((o, k) => o[k], d); if (Array.isArray(pai)) pai.splice(Number(c.at(-1)), 1); else delete pai[c.at(-1)]; })));
    const k = c.join('.');
    const para = lista.some((p) => p.classe === 'bloqueia');
    if (para) param++;
    if (para !== PARAM.has(k)) maus2.push(`${k}: ${para ? 'pára' : 'não pára'}`);
    if (lista.some((p) => p.classe === 'neutraliza')) maus2.push(`${k}: neutraliza nos dados do estúdio`);
    for (const p of lista) if (!String(p.ecra).startsWith('Dados do estúdio') || /data\/|\.json/.test(p.mensagem)) maus2.push(`${k}: ecrã «${p.ecra}», mensagem «${p.mensagem}»`);
  }
  certo(maus2.length === 0, `apagar cada um dos ${caminhos.length} caminhos dos dados do estúdio: param os ${param} que a lei ou o gerador pedem, e cada problema diz o ecrã`, maus2.slice(0, 8).join(' | '));
}

/* ================================================================== */
secao('a consola e o resumo da corrida');
{
  /* Um repositório de ensaio com dados que tentam abrir comandos do runner e
     escapar do código no resumo (público, em Markdown). */
  const dir = mkdtempSync(join(TMP, 'repo-'));
  mkdirSync(join(dir, 'data', 'trabalhos'), { recursive: true });
  mkdirSync(join(dir, 'data', 'loja'), { recursive: true });
  symlinkSync(join(RAIZ, 'assets'), join(dir, 'assets'));
  for (const [k, rel] of Object.entries(R.FICHEIROS)) writeFileSync(join(dir, rel), TEXTO[k]);
  for (const [n, t] of Object.entries(TEXTO.loja)) writeFileSync(join(dir, R.ficheiroDoProduto(n)), t);
  const mau = (nome, mudar) => { const t = { ...clonar(HOJE.trabalhos[T]), slug: nome }; mudar(t); writeFileSync(join(dir, R.ficheiroDoTrabalho(nome)), JSON.stringify(t, null, 2)); };
  mau('a', (t) => { t.veiculo = 'Ferrari\n::error::falso'; delete t.servico; });
  mau('b', (t) => { t.veiculo = 'Ferrari ##[error]falso'; t.fotos.push('assets/img/obras/x\n::warning::y.jpg'); });
  mau('c', (t) => { t.veiculo = 'Ferrari ``` | <img src=x onerror=alert(1)> [ligação](https://exemplo.pt) ![i](https://exemplo.pt/i.png)'; delete t.servico; });
  mau('d', (t) => { t.veiculo = `Ferrari ${String.fromCharCode(0x2028)}::error::separador`; t.fotos = 'x|y'; });
  const resumo = join(dir, 'resumo.md');
  writeFileSync(resumo, '');
  const r = correr('node', [GUARDA, '--raiz', dir], { env: { GITHUB_STEP_SUMMARY: resumo } });
  certo(r.status === 0, 'trabalhos com dados hostis não param a publicação', r.out.slice(-400) + r.err);
  const linhas = r.out.split('\n');
  const comandos = linhas.filter((l) => /^\s*::/.test(l));
  const legitimos = comandos.filter((l) => /^::(error|warning|notice) (file=[^,\n]*,)?title=[^:\n]*::/.test(l));
  certo(comandos.length > 0 && comandos.length === legitimos.length, `na consola, as ${comandos.length} linhas «::» são as anotações da guarda, e nenhuma vem dos dados`, comandos.filter((l) => !legitimos.includes(l)).join(' ⏎ '));
  certo(!r.out.includes('##['), 'nenhum «##[» em sítio nenhum da consola', linhas.filter((l) => l.includes('##[')).join(' ⏎ '));
  const md = readFileSync(resumo, 'utf8');
  const semCodigo = md.split('\n').map((l) => {
    let out = ''; let i = 0;
    while (i < l.length) {
      if (l[i] === '`') {
        let n = 0; while (l[i + n] === '`') n++;
        const cerca = '`'.repeat(n);
        const fim = l.indexOf(cerca, i + n);
        if (fim < 0) { out += l.slice(i); break; }
        out += '⟦código⟧'; i = fim + n; while (l[i] === '`') i++;
      } else { out += l[i]; i++; }
    }
    return out;
  }).join('\n');
  const fora = ['<img', '](', '::error', '##[', 'onerror', 'falso', 'separador'].filter((s) => semCodigo.includes(s));
  certo(md.length > 0 && fora.length === 0, 'no resumo, nenhum dado fica fora do código (nem ligações, nem imagens, nem HTML)', `fora: ${fora.join(', ')}`);
  const tabela = md.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('|---'));
  const colunas = tabela.map((l) => l.replace(/\\\|/g, '').split('|').length);
  certo(tabela.length > 1 && colunas.every((x) => x === 5), `a tabela do resumo tem as ${tabela.length} linhas com 3 colunas (uma «|» nos dados não abre outra)`, colunas.join(','));
  certo(!/[\p{Zl}\p{Zp}]/u.test(md) && !/[\u0000-\u0009\u000B-\u001F]/.test(md), 'no resumo, nenhum carácter de controlo nem separador de linha do Unicode');
}

/* ================================================================== */
secao('a cópia que o gerador lê');
{
  const d = com((x) => {
    delete x.trabalhos[T].veiculo;                                                    // esconder
    x.trabalhos[T2].fotos.push('assets/img/obras/NAO-EXISTE.jpg', FOTO_LOJA);          // sem_fotografia
    x.trabalhos['smart-fortwo'].fotos = 'x';                                           // a lista passa a vazia
    x.loja[P].foto = 'assets/img/loja/NAO-EXISTE.jpg';                                 // esconder, sem o caminho
    x.servicos.servicos[SV].imagem = 'assets/img/obras/NAO-EXISTE-828.webp';           // só o nome
    x.pares.pares[PA].antes = '';                                                      // sai da lista
    x.trabalhos['tesla-pincas'].veiculo = ''; x.trabalhos['tesla-pincas'].publicado = false;  // escondido já estava
  });
  const texto = (k, v, orig) => R.serializar(v, R.terminacaoDe(orig));
  const textos = {
    ...Object.fromEntries(Object.keys(R.FICHEIROS).map((k) => [k, texto(k, d[k], TEXTO[k])])),
    trabalhos: Object.fromEntries(Object.entries(d.trabalhos).map(([k, v]) => [k, texto(k, v, TEXTO.trabalhos[k])])),
    loja: Object.fromEntries(Object.entries(d.loja).map(([k, v]) => [k, texto(k, v, TEXTO.loja[k])])),
  };
  const lista = R.problemas(textos, OP);
  const n = R.neutralizar(textos, lista);
  const quer = [R.ficheiroDoTrabalho(T), R.ficheiroDoTrabalho(T2), R.ficheiroDoTrabalho('smart-fortwo'), R.ficheiroDoProduto(P), R.FICHEIROS.servicos, R.FICHEIROS.pares].sort();
  certo(JSON.stringify(Object.keys(n.ficheiros).sort()) === JSON.stringify(quer), 'mudam só os ficheiros com alguma coisa a mudar (o trabalho que já estava escondido não muda)', Object.keys(n.ficheiros).join(', '));
  const t = JSON.parse(n.ficheiros[R.ficheiroDoTrabalho(T)]);
  certo(t.publicado === false && JSON.stringify({ ...t, publicado: d.trabalhos[T].publicado }) === JSON.stringify(d.trabalhos[T]), 'o trabalho sem carro: só o «publicado» muda (fica escondido)');
  const t2 = JSON.parse(n.ficheiros[R.ficheiroDoTrabalho(T2)]);
  certo(JSON.stringify(t2.fotos) === JSON.stringify(HOJE.trabalhos[T2].fotos) && t2.publicado !== false, 'o trabalho com a fotografia em falta e a da loja: as duas saem da lista, as outras ficam pela ordem, e continua no site');
  certo(JSON.stringify(JSON.parse(n.ficheiros[R.ficheiroDoTrabalho('smart-fortwo')]).fotos) === '[]', 'as fotografias que não eram uma lista passam a uma lista vazia (o gerador fazia t.fotos.includes)');
  const p = JSON.parse(n.ficheiros[R.ficheiroDoProduto(P)]);
  certo(p.publicado === false && !Object.hasOwn(p, 'foto'), 'o produto com a fotografia em falta: escondido, e sem o caminho (a auditoria confere todos os caminhos de data/)');
  const s = JSON.parse(n.ficheiros[R.FICHEIROS.servicos]);
  certo(s.servicos[SV].imagem === '' && JSON.stringify(s.servicos.filter((_, i) => i !== SV)) === JSON.stringify(HOJE.servicos.servicos.filter((_, i) => i !== SV)), 'o serviço com a fotografia em falta fica só com o nome; os outros não mudam');
  const pp = JSON.parse(n.ficheiros[R.FICHEIROS.pares]);
  certo(pp.pares.length === HOJE.pares.pares.length - 1 && !pp.pares.some((x) => x.slug === SLUG_PA), 'o comparador sem a fotografia ANTES sai da lista');
  certo(Object.entries(n.ficheiros).every(([rel, txt]) => txt.endsWith('\n')), 'cada um com a terminação que tinha');
  certo(n.efeitos.length === 6 && !n.efeitos.some((e) => e.ficheiro === R.ficheiroDoTrabalho('tesla-pincas')), 'o resumo diz o que muda no site, em seis itens (o trabalho que já estava escondido não muda nada; o comparador com o mesmo identificador sai)', JSON.stringify(n.efeitos.map((e) => [e.ficheiro, e.slug, e.efeitos])));
  const depois = clonar(textos);
  for (const [rel, txt] of Object.entries(n.ficheiros)) {
    const m = /^data\/(trabalhos|loja)\/(.+)\.json$/.exec(rel);
    if (m) depois[m[1]][m[2]] = txt; else depois[Object.keys(R.FICHEIROS).find((k) => R.FICHEIROS[k] === rel)] = txt;
  }
  certo(!R.neutralizar(depois, R.problemas(depois, OP)).mudou, 'a cópia neutralizada já não tem nada a neutralizar (a segunda passagem não muda nada)');
  certo(!R.neutralizar(TEXTO, R.problemas(TEXTO, OP)).mudou, 'com os dados de hoje, nada sem nada: a cópia é o repositório');
}

/* ================================================================== */
secao('--neutralizar e o repositório');
{
  const ficheiros = readdirSync(join(RAIZ, 'data', 'trabalhos')).map((f) => join(RAIZ, 'data', 'trabalhos', f));
  const antes = ficheiros.map((f) => statSync(f).mtimeMs).join();
  const r = correr('node', [GUARDA, '--neutralizar', RAIZ]);
  certo(r.status === 2 && /só numa cópia/.test(r.err) && ficheiros.map((f) => statSync(f).mtimeMs).join() === antes, '--neutralizar recusa-se a escrever no próprio repositório fora do CI (sai com 2, sem tocar em nada)', `${r.status} ${r.err}`);
  const r2 = correr('node', [GUARDA, '--neutralizar']);
  certo(r2.status === 2, '--neutralizar sem pasta sai com 2');
}

/* ================================================================== */
secao('o publicar.yml');
{
  const nomes = YAML.split('\n').map((l) => l.match(/^ {6}- (?:name: (.+)|uses: ([^@\s]+)@\S+)$/)).filter(Boolean).map((m) => m[1] || m[2]);
  const i = (n) => nomes.indexOf(n);
  certo(i('Conferir o conteúdo') > 0 && i('Conferir o conteúdo') < i('Gerar o site') && i('Gerar o site') < i('Auditar antes de publicar'), 'a guarda corre antes de tudo o que lê os dados (o gerador e a auditoria lêem a cópia neutralizada)', nomes.join(' → '));
  certo(/node \.github\/guardas\.mjs --neutralizar \. /.test(passoDoYaml('Conferir o conteúdo')), 'e é a guarda a preparar a cópia (--neutralizar .)');
  certo(!/\bgit\s+(commit|push|add)\b/.test(YAML), 'nenhum passo grava no repositório: a cópia neutralizada nunca lá chega');
  certo(/^permissions:\n {2}contents: read$/m.test(YAML), 'o job só lê o repositório (contents: read)');
  certo(/^on:\n(?:\s*#.*\n)*\s+push:\n\s+branches: \[main\]\n\s+workflow_dispatch:/m.test(YAML) && !/^\s+(?:paths-ignore|paths):/m.test(YAML), 'corre em todos os pushes para o main, sem paths-ignore, e à mão (workflow_dispatch: o «Publicar outra vez» do painel)');
  certo(/^\s+publicar:\n\s+needs: construir/m.test(YAML), 'o job que publica chama-se «publicar» (o painel lê-o para saber se a corrida publicou)');
  certo(!/node\s+\.github\/test-guardas/.test(YAML), 'esta bateria não corre no CI (afirma coisas sobre os dados de hoje)');
}

/* ================================================================== */
secao('a mesma regra no site e no painel');
{
  const painel = resolve(RAIZ, '..', 'perfectfinish-painel', 'estatico', 'js', 'regras.js');
  if (existsSync(painel)) {
    const h = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
    certo(h(painel) === h(join(RAIZ, '.github', 'regras.mjs')), 'as regras do painel são uma cópia byte a byte das do site (cp .github/regras.mjs ../perfectfinish-painel/estatico/js/regras.js)');
  } else console.log('  · o painel não está ao lado (~/Websites/perfectfinish-painel): não se compara');
}

/* ================================================================== */
if (!RAPIDO) await pontaAPonta();
rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULTADO test-guardas passou=${passou} falhou=${falhou}`);
process.exit(falhou ? 1 : 0);

/* ------------------------------------------------------------------ */
/* O publicar.yml, passo a passo                                       */
/* ------------------------------------------------------------------ */
function passoDoYaml(nome) {
  const linhas = YAML.split('\n');
  const ind = (l) => l.match(/^ */)[0].length;
  const i0 = linhas.findIndex((l) => l.trim() === `- name: ${nome}`);
  if (i0 < 0) throw new Error(`o publicar.yml não tem o passo «${nome}»`);
  let fim = linhas.length;
  for (let i = i0 + 1; i < linhas.length; i++) if (linhas[i].trim() && ind(linhas[i]) <= ind(linhas[i0])) { fim = i; break; }
  const r = linhas.slice(i0, fim).findIndex((l) => /^\s*run:/.test(l));
  if (r < 0) return null;
  const m = linhas[i0 + r].match(/^\s*run:\s*(.*)$/);
  if (m[1] && m[1] !== '|') return m[1] + '\n';
  const corpo = linhas.slice(i0 + r + 1, fim);
  while (corpo.length && !corpo[corpo.length - 1].trim()) corpo.pop();
  const base = Math.min(...corpo.filter((l) => l.trim()).map(ind));
  return corpo.map((l) => l.slice(base)).join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* A publicação de ponta a ponta                                       */
/* ------------------------------------------------------------------ */
async function pontaAPonta() {
  secao('a publicação de ponta a ponta (os passos do publicar.yml, tal como estão escritos)');
  const base = join(TMP, 'base'); mkdirSync(base);
  try {
    for (const p of ['data', 'scripts', '.github', 'assets', 'CNAME', '.pages.yml']) execFileSync('cp', ['-c', '-R', join(RAIZ, p), join(base, p)]);
  } catch (e) { certo(false, 'o clone do repositório (cp -c, APFS)', String(e.message)); return; }
  const nomes = YAML.split('\n').map((l) => l.match(/^ {6}- name: (.+)$/)).filter(Boolean).map((m) => m[1]);
  const PASSOS = nomes.filter((n) => passoDoYaml(n)).map((n) => ({ nome: n, run: passoDoYaml(n) }));
  certo(PASSOS.length === 4 && PASSOS[0].nome === 'Conferir o conteúdo' && PASSOS.at(-1).nome === 'Auditar antes de publicar', `${PASSOS.length} passos: ${PASSOS.map((p) => p.nome).join(' → ')}`);

  const correrAsync = (cmd, args, { cwd, env }) => new Promise((res) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, GITHUB_STEP_SUMMARY: '', GITHUB_ACTIONS: '', ...env } });
    let out = ''; let err = '';
    p.stdout.on('data', (x) => { out += x; }); p.stderr.on('data', (x) => { err += x; });
    p.on('close', (status) => res({ status, out, err }));
  });
  async function publicar(w) {
    const rt = join(w, '.rt'); mkdirSync(rt, { recursive: true });
    const env = { GITHUB_ACTIONS: 'true', RUNNER_TEMP: rt, GITHUB_STEP_SUMMARY: join(rt, 'resumo.md') };
    const feitos = [];
    for (const p of PASSOS) {
      const f = join(rt, `passo-${feitos.length}.sh`);
      writeFileSync(f, p.run);
      const r = await correrAsync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', f], { cwd: w, env });
      feitos.push({ nome: p.nome, ...r });
      if (r.status !== 0) break;
    }
    const rel = join(rt, 'relatorio.json');
    return { feitos, relatorio: existsSync(rel) ? JSON.parse(readFileSync(rel, 'utf8')) : null };
  }

  const ler = (w, rel) => readFileSync(join(w, rel), 'utf8');
  const escrever = (w, rel, obj, t) => writeFileSync(join(w, rel), JSON.stringify(obj, null, 2) + t);
  const mexer = (rel) => (mudar) => (w) => { const t = ler(w, rel); const o = JSON.parse(t); mudar(o); escrever(w, rel, o, R.terminacaoDe(t)); };
  const trabW = (nome, mudar) => mexer(R.ficheiroDoTrabalho(nome))(mudar);
  const prodW = (nome, mudar) => mexer(R.ficheiroDoProduto(nome))(mudar);
  const defW = mexer(R.FICHEIROS.definicoes);
  const servW = mexer(R.FICHEIROS.servicos);
  const parW = mexer(R.FICHEIROS.pares);
  const critW = mexer(R.FICHEIROS.avaliacoes);
  const fotoNova = (rel, conteudo) => (w) => writeFileSync(join(w, rel), conteudo ?? readFileSync(join(RAIZ, 'assets', 'img', 'marca', 'favicon-512.png')));
  const e = (...fs) => (w) => fs.forEach((f) => f(w));
  const site = (w, rel) => readFileSync(join(w, '_site', rel), 'utf8');
  const lojaSem = (nome) => (w) => !site(w, 'loja/index.html').includes(`<h3>${nome}</h3>`);
  /* [descrição, mudar(pasta), o que se espera: 'publica' | chave que pára,
      e, se publica, uma verificação do _site (opcional)] */
  const CASOS = [
    ['os dados de hoje', () => {}, 'publica', (w) => site(w, 'index.html').includes('Ferrari Roma') && site(w, 'loja/index.html').includes('Shampoo pH Neutro')],
    ['os dados de hoje, sem o .pages.yml (o dia da troca)', (w) => rmSync(join(w, '.pages.yml')), 'publica'],
    ...['veiculo', 'servico', 'fotos', 'publicado', 'destaque', 'ordem', 'slug'].map((k) => [`sem «${k}» num trabalho`, trabW(T, (t) => { delete t[k]; }), 'publica']),
    ...['veiculo', 'fotos'].map((k) => [`sem «${k}» num trabalho destacado (o gerador lia t.fotos[0] dos destacados)`, trabW('amg-cla-45s', (t) => { delete t[k]; t.destaque = true; }), 'publica']),
    ...[['fotos', 'x'], ['fotos', {}], ['fotos', [5, null, {}]], ['veiculo', 7], ['servico', ['x']], ['ordem', '5'], ['ordem', 'x'], ['publicado', 'false'], ['destaque', 'sim'], ['slug', 7]]
      .map(([k, v]) => [`trabalho com «${k}» = ${JSON.stringify(v)}`, trabW(T, (t) => { t[k] = v; }), 'publica']),
    ['um trabalho com uma fotografia que não existe', trabW(T, (t) => { t.fotos.push('assets/img/obras/nao-existe.jpg'); }), 'publica'],
    ['um trabalho com fotografias da loja e de outro site', trabW(T, (t) => { t.fotos.unshift(FOTO_LOJA, 'https://exemplo.pt/a.jpg'); }), 'publica'],
    ['um trabalho despublicado com uma fotografia que não existe (a auditoria confere todos os caminhos)', trabW(T, (t) => { t.fotos.push('assets/img/obras/nao-existe.jpg'); t.publicado = false; }), 'publica'],
    ['uma fotografia nova (solta) num trabalho', e(fotoNova('assets/img/obras/ferrari-roma-1a2b3c4d.png'), trabW(T, (t) => { t.fotos.push('assets/img/obras/ferrari-roma-1a2b3c4d.png'); })), 'publica'],
    ['uma fotografia nova com espaços e acentos', e(fotoNova('assets/img/obras/Ação Nova 1.png'), trabW(T, (t) => { t.fotos = ['assets/img/obras/Ação Nova 1.png']; })), 'publica'],
    ['um trabalho novo vazio ({})', (w) => writeFileSync(join(w, 'data', 'trabalhos', 'teste-novo.json'), '{}'), 'publica'],
    ['um trabalho novo que não se lê', (w) => writeFileSync(join(w, 'data', 'trabalhos', 'teste-novo.json'), '{ "veiculo": '), 'trabalho:teste-novo:ilegivel'],
    ['um ficheiro com BOM', (w) => writeFileSync(join(w, R.ficheiroDoTrabalho(T)), `${String.fromCharCode(0xfeff)}${ler(w, R.ficheiroDoTrabalho(T))}`), `trabalho:${T}:ilegivel`],
    ['todos os trabalhos despublicados', (w) => { for (const f of readdirSync(join(w, 'data', 'trabalhos'))) trabW(f.slice(0, -5), (t) => { t.publicado = false; })(w); }, 'publica'],
    ...['nome', 'familia', 'descricao', 'formato', 'preco', 'publicado', 'ordem', 'slug'].map((k) => [`sem «${k}» num produto`, prodW(P, (p) => { delete p[k]; }), 'publica']),
    ...[['preco', '18 €'], ['preco', true], ['preco', 24.5], ['nome', 7], ['familia', {}], ['foto', 'assets/img/loja/nao-existe.jpg'], ['foto', FOTO_T], ['foto', 7], ['foto', '']]
      .map(([k, v]) => [`produto com «${k}» = ${JSON.stringify(v)}`, prodW(P, (p) => { p[k] = v; }), 'publica']),
    ['um produto com a fotografia em falta sai da loja', prodW(P, (p) => { p.foto = 'assets/img/loja/nao-existe.jpg'; }), 'publica', lojaSem('Shampoo pH Neutro')],
    ['um produto novo sem fotografia nenhuma', (w) => writeFileSync(join(w, 'data', 'loja', 'produto-novo.json'), JSON.stringify({ slug: 'produto-novo', nome: 'Produto novo', familia: 'Lavagem', ordem: 11, publicado: true }, null, 2)), 'publica', lojaSem('Produto novo')],
    ['um produto com uma fotografia nova', e(fotoNova('assets/img/loja/shampoo-ph-neutro-1a2b3c4d.png'), prodW(P, (p) => { p.foto = 'assets/img/loja/shampoo-ph-neutro-1a2b3c4d.png'; })), 'publica', (w) => site(w, 'loja/index.html').includes('shampoo-ph-neutro-1a2b3c4d.png')],
    ...['nome', 'slug', 'imagem', 'obras', 'curto'].map((k) => [`sem «${k}» num serviço`, servW((d) => { delete d.servicos[SV][k]; }), 'publica']),
    ['um serviço com a fotografia em falta fica só com o nome', servW((d) => { d.servicos[SV].imagem = 'assets/img/obras/nao-existe-828.webp'; }), 'publica', (w) => site(w, 'index.html').includes('id="s-polimento"')],
    ['um serviço com a galeria num texto', servW((d) => { d.servicos[SV].obras = 'ferrari-roma'; }), 'publica'],
    ['um serviço sem galeria e com uma fotografia que não é de trabalho nenhum', servW((d) => { delete d.servicos[SV].obras; d.servicos[SV].imagem = 'assets/img/obras/par-brembo-antes-828.webp'; }), 'publica'],
    ['um serviço novo, com fotografia e galeria, num trabalho sem fotografias', e(trabW(T, (t) => { t.fotos = 7; }), servW((d) => { d.servicos.push({ nome: 'Novo', slug: 'novo', imagem: FOTO_T }); })), 'publica'],
    ['dois serviços com o mesmo identificador', servW((d) => { d.servicos.push({ ...d.servicos[SV] }); }), 'publica'],
    ['nenhum serviço', servW((d) => { d.servicos = []; }), 'publica'],
    ['os serviços num texto', servW((d) => { d.servicos = 'x'; }), 'servicos:forma'],
    ['um serviço que não é um serviço', servW((d) => { d.servicos.push(null); }), `servicos:#${HOJE.servicos.servicos.length + 1}:forma`],
    ['«</script>» no nome de um serviço', servW((d) => { d.servicos[SV].nome = 'Polimento </script><script>alert(1)</script>'; }), 'servicos:polimento:partia-a-pagina'],
    ...['antes', 'depois', 'veiculo', 'servico', 'legenda', 'ordem', 'alt_antes', 'alt_depois', 'slug'].map((k) => [`sem «${k}» num comparador`, parW((d) => { delete d.pares[PA][k]; }), 'publica']),
    ['um comparador com a fotografia em falta sai da lista', parW((d) => { d.pares[PA].depois = 'assets/img/obras/nao-existe.jpg'; }), 'publica', (w) => !site(w, 'index.html').includes('nao-existe')],
    ['todos os comparadores sem fotografias', parW((d) => { for (const p of d.pares) p.antes = ''; }), 'publica'],
    ['os comparadores como a lista solta (a forma antiga)', (w) => writeFileSync(join(w, R.FICHEIROS.pares), JSON.stringify(JSON.parse(ler(w, R.FICHEIROS.pares)).pares, null, 2)), 'publica'],
    ['os comparadores num texto', parW((d) => { d.pares = 'x'; }), 'pares:forma'],
    ...['autor', 'quando', 'estrelas', 'texto'].map((k) => [`sem «${k}» numa avaliação`, critW((d) => { delete d.criticas[0][k]; }), 'publica']),
    ['as avaliações num texto', critW((d) => { d.criticas = 'x'; }), 'avaliacoes:forma'],
    ...['marca', 'contactos', 'morada', 'horario', 'google', 'empresa', 'textos', 'marca.nome_completo', 'contactos.telefone', 'contactos.telefone_texto', 'contactos.whatsapp', 'contactos.email', 'morada.rua', 'morada.codigo_postal', 'morada.localidade', 'empresa.titular', 'empresa.nif']
      .map((c) => [`sem «${c}» nos dados do estúdio`, defW((d) => { const [a, b] = c.split('.'); if (b) delete d[a][b]; else delete d[a]; }), c.includes('.') ? `definicoes:${c}` : `definicoes:${c}:forma`]),
    ...['marca.nome', 'marca.reclamo', 'marca.descricao', 'contactos.instagram', 'contactos.facebook', 'morada.distrito', 'morada.pais', 'morada.mapa', 'morada.latitude', 'morada.longitude', 'google.nota', 'google.total', 'google.perfil', 'google.endpoint', 'google.incorporar', 'empresa.forma', 'textos.heroi_titulo', 'textos.heroi_sub', 'textos.sobre']
      .map((c) => [`sem «${c}» nos dados do estúdio`, defW((d) => { const [a, b] = c.split('.'); delete d[a][b]; }), 'publica']),
    ...[['google.nota', '4,9'], ['google.total', null], ['textos.heroi_titulo', 7], ['marca.reclamo', {}], ['contactos.email', 7], ['empresa.nif', 316614610], ['empresa.nif', '316614611'], ['morada.latitude', 'x'], ['horario', []], ['horario', [{ dias: 'Todos', horas: 'Sempre' }]]]
      .map(([c, v]) => [`«${c}» = ${JSON.stringify(v)} nos dados do estúdio`, defW((d) => { const [a, b] = c.split('.'); if (b) d[a][b] = v; else d[a] = v; }), 'publica']),
    ['o NIF com 8 algarismos (a auditoria travava)', defW((d) => { d.empresa.nif = '31661461'; }), 'definicoes:empresa.nif'],
    ['«</script>» num texto do estúdio', defW((d) => { d.marca.descricao = 'a </script><script>alert(1)</script>'; }), 'definicoes:partia-a-pagina'],
    ['os dados do estúdio que não se lêem', (w) => writeFileSync(join(w, R.FICHEIROS.definicoes), '{'), 'definicoes:ilegivel'],
    ['uma imagem de 1,6 MB na biblioteca', fotoNova('assets/img/obras/enorme.jpg', Buffer.alloc(1600 * 1024, 1)), 'imagem:assets/img/obras/enorme.jpg:grande'],
  ];

  const maus = []; let i = 0; let ok = 0;
  const OPERARIOS = Math.max(2, Math.min(6, availableParallelism() - 2));
  const operario = async (n) => {
    while (i < CASOS.length) {
      const [descr, mudar, quer, conferir] = CASOS[i++];
      const w = join(TMP, `w${n}`);
      rmSync(w, { recursive: true, force: true });
      execFileSync('cp', ['-c', '-R', base, w]);
      let r;
      try { mudar(w); r = await publicar(w); } catch (err) { maus.push(`${descr}: o ensaio rebentou (${err.message})`); continue; }
      const falhou = r.feitos.find((p) => p.status !== 0);
      const pararam = (r.relatorio?.problemas || []).filter((p) => p.classe === 'bloqueia').map((p) => p.chave);
      if (quer === 'publica') {
        if (falhou) maus.push(`${descr}: parou em «${falhou.nome}»${falhou.nome === 'Conferir o conteúdo' ? ` (${pararam.join(', ')})` : ' SEM A GUARDA DIZER PORQUÊ'}: ${(falhou.out + falhou.err).trim().split('\n').filter((l) => /ERRO|Error|rro/.test(l)).slice(-3).join(' ⏎ ').slice(0, 400)}`);
        else if (conferir && !conferir(w)) maus.push(`${descr}: publicou, mas o site não ficou como devia`);
        else ok++;
      } else if (!falhou || falhou.nome !== 'Conferir o conteúdo' || !pararam.includes(quer)) {
        maus.push(`${descr}: devia parar na guarda com ${quer}; ${falhou ? `parou em «${falhou.nome}» (${pararam.join(', ') || 'sem bloqueios'})` : 'publicou'}`);
      } else {
        /* E diz porquê em anotações (é por elas que o painel o diz ao dono). */
        if (!/^::error /m.test(falhou.out)) maus.push(`${descr}: parou na guarda sem anotações ::error`); else ok++;
      }
      rmSync(w, { recursive: true, force: true });
    }
  };
  const t0 = Date.now();
  await Promise.all(Array.from({ length: OPERARIOS }, (_, n) => operario(n)));
  certo(maus.length === 0, `${CASOS.length} casos de ponta a ponta (${Math.round((Date.now() - t0) / 1000)} s): ou a guarda pára e diz porquê, ou o site publica-se até ao fim — o gerador, o CSS e a auditoria (${ok} certos)`, maus.join('\n      '));
  /* A auditoria, quando pára, também o diz em anotações (o painel lê-as). */
  {
    const w = join(TMP, 'w-auditoria');
    execFileSync('cp', ['-c', '-R', base, w]);
    /* Uma página sem o Livro de Reclamações não é coisa da guarda: só a
       auditoria a vê. */
    const g = join(w, 'scripts', 'gerar.mjs');
    writeFileSync(g, readFileSync(g, 'utf8').replaceAll('livroreclamacoes.pt', 'exemplo.pt'));
    const r = await publicar(w);
    const f = r.feitos.find((p) => p.status !== 0);
    certo(f?.nome === 'Auditar antes de publicar' && /^::error title=Auditoria antes de publicar::.*Livro de Reclamações/m.test(f.out), 'quando a auditoria trava a publicação, diz porquê em anotações ::error (o painel mostra-as)', f ? `${f.nome}: ${f.out.slice(-300)}` : 'não parou');
    rmSync(w, { recursive: true, force: true });
  }
}
