/* AS REGRAS DOS DADOS DO PERFECT FINISH STUDIO, NUM SÓ SÍTIO.
 *
 * Três leitores, e os três têm de ouvir o mesmo:
 *   · o CI do site (.github/guardas.mjs), antes de gerar o site;
 *   · o painel, no browser (o erro aparece por baixo do campo, antes de gravar);
 *   · o Worker do painel, ao gravar (recusa os problemas NOVOS que não sejam
 *     lembretes).
 * O painel usa uma CÓPIA BYTE A BYTE deste ficheiro (estatico/js/regras.js no
 * repositório perfectfinish-painel), com um teste de SHA-256 que falha se
 * divergirem. Por isso é um ES module puro: nenhum import, nada de node:*, fs,
 * process ou require. Corre tal e qual no browser, num Worker e no Node.
 * (Molde: as regras da AMMA Creative e da LR Motors.)
 *
 * O que cada campo FAZ no site é o scripts/gerar.mjs: as regras olham para o que
 * o gerador faz com o valor, e não para o que o valor parece. Os rótulos e as
 * ajudas que o dono lê são os do .pages.yml do Pages CMS, que o painel
 * substitui (a especificação dos formulários).
 *
 * OS DADOS (dados = { … }):
 *   definicoes: texto | objecto | null     data/definicoes.json (os dados do estúdio)
 *   servicos:   texto | objecto | null     data/lista-servicos.json ({ servicos: [...] })
 *   pares:      texto | objecto | null     data/pares.json ({ pares: [...] }: antes e depois)
 *   avaliacoes: texto | objecto | null     data/avaliacoes.json ({ criticas: [...] }: os
 *                                          testemunhos de clientes, com a autorização de cada um)
 *   trabalhos:  { <nome>: texto | objecto | null }   data/trabalhos/<nome>.json
 *   loja:       { <nome>: texto | objecto | null }   data/loja/<nome>.json
 *   <nome> é o nome do ficheiro sem «.json»; o painel escreve-o igual ao campo
 *   `slug` de dentro (o gerador usa o campo: liga um trabalho às galerias dos
 *   serviços, e um produto à fotografia com o nome dele).
 *   texto = o conteúdo do ficheiro; null = o ficheiro não existe.
 *   Uma chave de topo AUSENTE não se confere (o painel pode conferir só um
 *   ficheiro); `definicoes: null` (presente, mas null) é «falta o ficheiro».
 *
 * CADA PROBLEMA TEM UMA CLASSE:
 *   · bloqueia   — a publicação pára e o site fica como estava. Só a estrutura
 *                  (um JSON que não se lê, um ficheiro sem a forma de que o
 *                  gerador precisa: rebentava a meio) e o que a lei obriga em
 *                  todas as páginas (DL 7/2004, art. 10.º: o nome civil do
 *                  titular, a denominação, o NIF, a morada, o email) ou o que
 *                  está em todas as páginas e o dono não consegue mudar (o
 *                  WhatsApp dos botões).
 *   · neutraliza — UM item, só na cópia que o gerador lê (o ficheiro do
 *                  repositório não muda — ver neutralizar()): um trabalho ou
 *                  um produto sem o essencial fica escondido; uma fotografia
 *                  que já não está na biblioteca não aparece (e um comparador
 *                  sem as duas sai). Um problema de UM item nunca pára a
 *                  publicação dos outros.
 *   · avisa      — só aviso. No painel, os que não são lembrete são erro de
 *                  campo (valor fora da lista, número fora dos limites, um
 *                  obrigatório vazio): o painel não os deixa gravar, mas um
 *                  valor estranho num commit à mão não é razão para parar o
 *                  site. Os LEMBRETES (lembrete: true) não são erro de
 *                  ninguém: o painel grava na mesma e mostra-os no Início.
 *
 * problema = {
 *   classe:   'bloqueia' | 'neutraliza' | 'avisa',
 *   chave:    estável: 'definicoes:<campo>[:<regra>]', 'servicos:<slug>:<regra>',
 *             'pares:<slug>:<regra>', 'avaliacoes:<autor>:<regra>',
 *             'trabalho:<slug>:<regra>', 'produto:<slug>:<regra>'.
 *             O Worker compara as chaves do HEAD com as da gravação e recusa só
 *             as novas; por isso UMA CHAVE TEM SEMPRE A MESMA CLASSE.
 *   ficheiro: o caminho do ficheiro no repositório;
 *   ecra:     o ecrã do painel onde se corrige («Trabalhos › Ferrari Roma»,
 *             «Dados do estúdio › Contactos»);
 *   mensagem: para o dono, em português simples, sem caminhos de JSON;
 *   campo?:   o campo onde o painel mostra o erro ('preco', 'contactos.email',
 *             'servicos.2.imagem');
 *   efeito?:  só nos «neutraliza»: 'esconder' | 'sem_fotografia';
 *   slug?:    nos trabalhos e produtos (o nome do ficheiro), e nos itens das listas;
 *   indice?:  nos itens das listas, e nas fotografias de um trabalho;
 *   foto?:    nos problemas de uma fotografia (o caminho como está nos dados);
 *   lembrete?: true nos avisos que não são erro de ninguém.
 * }
 *
 * «NÃO FOI DITO» E NULL SÃO O MESMO (o Pages CMS omitia os campos vazios ao
 * gravar). E o vazio testa-se ANTES de converter: Number(null) é 0, e 0 é uma
 * escolha (memória numero-zero-nao-e-nao-foi-dito).
 */

/* ------------------------------------------------------------------ */
/* Onde estão as coisas                                                */
/* ------------------------------------------------------------------ */

export const FICHEIROS = Object.freeze({
  definicoes: 'data/definicoes.json',
  servicos: 'data/lista-servicos.json',
  pares: 'data/pares.json',
  avaliacoes: 'data/avaliacoes.json',
});
export const PASTAS = Object.freeze({ trabalhos: 'data/trabalhos', loja: 'data/loja' });
export const ficheiroDoTrabalho = (nome) => `${PASTAS.trabalhos}/${nome}.json`;
export const ficheiroDoProduto = (nome) => `${PASTAS.loja}/${nome}.json`;

/* AS BIBLIOTECAS DAS FOTOGRAFIAS, uma por tipo de campo (é a pasta que o
   gerador junta ao nome: figura("obras", …), figura("loja", …)):
     obras — os trabalhos, os azulejos dos serviços e os comparadores;
     loja  — os produtos.
   Cada fotografia TRATADA pelo scripts/imagens.py (as 63 de hoje, com as
   matrículas e os rostos tapados no ficheiro) existe em QUATRO cópias —
   <radical>-414.avif, -414.webp, -828.avif e -828.webp — e os dados guardam a
   de 828 em WebP (o .pages.yml diz porquê: um caminho que existe mostra-se no
   formulário). As outras três são cópias: nunca se mostram nem se escolhem.
   Uma fotografia carregada pelo painel (ou pelo Pages CMS) é um ficheiro só,
   que o site serve tal e qual. As bibliotecas não têm subpastas: o painel lê
   um nível só, e uma fotografia numa subpasta não é da biblioteca. */
export const BIBLIOTECAS = Object.freeze({ obras: 'assets/img/obras', loja: 'assets/img/loja' });
export const SUFIXOS_COPIAS = Object.freeze(['-414.avif', '-414.webp', '-828.avif', '-828.webp']);
const RE_VARIANTE = /-(?:414|828)\.(?:avif|webp)$/i;
/* As extensões que um campo de fotografia aceita (as do .pages.yml). */
export const EXTENSOES_FOTO = Object.freeze(['jpg', 'jpeg', 'png', 'webp', 'avif']);

/** Um nome de ficheiro que é uma CÓPIA de uma fotografia tratada (as de 414 e
 *  o AVIF de 828): nunca se mostra nem se escolhe. A de 828 em WebP é a que
 *  representa a fotografia. */
export const eCopia = (nomeFicheiro) => {
  const n = String(nomeFicheiro ?? '').split('/').pop();
  return /-414\.(?:avif|webp)$/i.test(n) || /-828\.avif$/i.test(n);
};

/* ------------------------------------------------------------------ */
/* As listas                                                           */
/* ------------------------------------------------------------------ */

/* As categorias da loja, as do .pages.yml (a chave `name` de cada opção; o
   site escreve-a tal e qual no cartão do produto). */
export const FAMILIAS = Object.freeze(['Lavagem', 'Preparação', 'Proteção', 'Manutenção', 'Rodas', 'Interior', 'Acessórios']);

/* AS CHAVES DE CADA FICHEIRO, PELA ORDEM EM QUE O FICHEIRO AS TEM (a dos 18
   trabalhos e dos 10 produtos de hoje). Uma chave nova entra por esta ordem
   (ordenarComo()); as que já estão no ficheiro ficam onde estão. A ordem do
   FORMULÁRIO é outra (a do .pages.yml), e vive no painel. */
export const CAMPOS_TRABALHO = Object.freeze(['slug', 'veiculo', 'servico', 'ordem', 'fotos', 'destaque', 'publicado']);
export const CAMPOS_PRODUTO = Object.freeze(['slug', 'nome', 'familia', 'ordem', 'descricao', 'formato', 'preco', 'foto', 'publicado']);
export const CAMPOS_SERVICO = Object.freeze(['nome', 'slug', 'curto', 'imagem', 'obras']);
export const CAMPOS_PAR = Object.freeze(['slug', 'veiculo', 'servico', 'antes', 'depois', 'ordem', 'legenda', 'alt_antes', 'alt_depois']);
/* Os testemunhos (data/avaliacoes.json). O «quando» saiu a 11 out 2026: envelhecia
   sozinho («há um mês» ficava escrito para sempre), e não se põe data nenhuma. */
export const CAMPOS_CRITICA = Object.freeze(['autor', 'estrelas', 'texto', 'nota_traducao', 'autorizado']);
export const CAMPOS_HORARIO = Object.freeze(['dias', 'horas', 'indices']);
/* Sempre escritos pelo painel, com o valor explícito. Ausentes valem o de
   sempre: o gerador mostra tudo menos `publicado: false`. */
export const BOOLEANOS_TRABALHO = Object.freeze(['publicado', 'destaque']);
export const BOOLEANOS_PRODUTO = Object.freeze(['publicado']);
export const POR_OMISSAO = Object.freeze({ publicado: true, destaque: false });

export const NOMES_CAMPOS = Object.freeze({
  trabalho: { veiculo: 'Carro', servico: 'O que se fez', fotos: 'Fotografias', publicado: 'Mostrar no site', destaque: 'Destacar', ordem: 'Ordem', slug: 'Nome do ficheiro' },
  produto: { nome: 'Produto', familia: 'Categoria', descricao: 'Descrição', formato: 'Formato', preco: 'Preço com IVA', foto: 'Fotografia', publicado: 'Mostrar na loja', ordem: 'Ordem', slug: 'Nome do ficheiro' },
  servico: { nome: 'Nome do serviço', imagem: 'Fotografia', obras: 'Trabalhos que a galeria mostra', curto: 'Nome curto', slug: 'Identificador' },
  par: { veiculo: 'Carro', servico: 'O que se fez', antes: 'Fotografia ANTES', depois: 'Fotografia DEPOIS', legenda: 'Explicação', ordem: 'Ordem', alt_antes: 'Descrição da fotografia ANTES', alt_depois: 'Descrição da fotografia DEPOIS', slug: 'Identificador' },
  critica: { autor: 'Nome do cliente', texto: 'Testemunho', estrelas: 'Estrelas', nota_traducao: 'Nota de tradução', autorizado: 'O cliente autorizou mostrar no site' },
});

/* As secções do data/definicoes.json, com o nome do ecrã («Dados do estúdio ›
   Contactos»). O gerador lê-as todas sem perguntar: sem uma delas rebenta a
   meio. A `capa` (as peças do mosaico) está escondida no .pages.yml. A secção
   `google` (a nota, o número de avaliações e o perfil) muda-se noutro ecrã do
   painel, o «Avaliações», junto dos testemunhos (ECRAS_DAS_SECCOES). */
export const SECCOES_DEFINICOES = Object.freeze({
  contactos: 'Contactos', morada: 'Morada', horario: 'Horário', textos: 'Textos do site',
  marca: 'Marca', google: 'Google', empresa: 'Dados legais',
});
export const ECRA_ESTUDIO = 'Dados do estúdio';
export const ECRAS_DAS_SECCOES = Object.freeze({ google: 'Avaliações' });
/* O QUE O PAINEL NUNCA MUDA nos dados do estúdio: os campos com `hidden: true`
   no .pages.yml («um campo que não se deve mexer, à vista, é um convite a
   mexer») — continuam no ficheiro, mudam-se no repositório. O Worker do painel
   recusa uma gravação que os mude — ver mudancasBloqueadas(). Os índices dos
   dias de cada linha do horário (escondidos também) viajam com a linha. */
export const BLOQUEADOS_DEFINICOES = Object.freeze(['contactos.whatsapp', 'morada.distrito', 'morada.pais', 'morada.mapa',
  'morada.latitude', 'morada.longitude', 'google.incorporar', 'google.endpoint', 'capa']);

/* ------------------------------------------------------------------ */
/* Limites                                                             */
/* ------------------------------------------------------------------ */

/* Os números: [mínimo, máximo] (os do .pages.yml: ordem a partir de 1, as
   estrelas de 1 a 5, a nota de 0 a 5 com uma casa). */
export const LIMITES = Object.freeze({ ordem: [1, 9999], preco: [0, 100000], estrelas: [1, 5], nota: [0, 5], total: [0, 1000000] });
/* Tamanhos máximos dos textos, em caracteres. Folgados: o maior texto de hoje
   cabe com sobra. `fotos`: o máximo de um trabalho (o álbum maior do
   Instagram, de onde vieram, tem 20). */
export const TAMANHOS = Object.freeze({
  veiculo: 80, servicoTrabalho: 60, fotos: 20, caminhoFoto: 300,
  nomeProduto: 80, descricao: 400, formato: 40,
  nomeServico: 80, curto: 30, servicos: 40, obras: 40,
  legenda: 300, alt: 200, pares: 20,
  autor: 60, textoCritica: 1500, notaTraducao: 80, criticas: 30,
  telefoneTexto: 20, email: 160, url: 500,
  rua: 160, codigoPostal: 10, localidade: 60,
  dias: 40, horas: 40, horario: 10,
  heroiTitulo: 80, heroiLinha: 24, heroiLinhas: 4, heroiSub: 160, sobre: 1500,
  reclamo: 100, descricaoMarca: 300, nomeMarca: 80, nomeCompleto: 160,
  titular: 120, forma: 80, nif: 20,
});
/* O que o Worker do painel aceita gravar (recusa acima); aqui só se lembra, a
   partir de 80 %. */
export const TECTOS = Object.freeze({ ficheiroBytes: 64 * 1024, aviso: 0.8 });

/* ------------------------------------------------------------------ */
/* Ajudantes que o painel e o Worker também usam                      */
/* ------------------------------------------------------------------ */

const eObjecto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const ausente = (x) => x === null || x === undefined;
const vazio = (x) => ausente(x) || (typeof x === 'string' && x.trim() === '') || (Array.isArray(x) && x.length === 0);
const temTexto = (x) => typeof x === 'string' && x.trim() !== '';
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const bytesDe = (s) => new TextEncoder().encode(s).length;

export const terminacaoDe = (texto) => (typeof texto === 'string' && texto.endsWith('\n') ? '\n' : '');
/* Como os ficheiros estão escritos: 2 espaços e a terminação de cada um (hoje
   todos acabam em \n; o Pages CMS gravava sem). Abrir e gravar sem mexer
   deixa o ficheiro igual, byte a byte. */
export function serializar(obj, terminacao = '') { return JSON.stringify(obj, null, 2) + (terminacao || ''); }

/* O endereço de um item a partir do nome do ficheiro (sem «.json»). */
export const slugDoFicheiro = (nome) => String(nome).replace(/\.json$/, '');
/* O identificador que o painel gera (gerarSlug): minúsculas, algarismos e
   hífenes (o `pattern: '^[a-z0-9-]+$'` do .pages.yml, sem hífenes nas pontas). */
export const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* NIF português: 9 algarismos, o primeiro nunca é 0, e o de controlo (módulo
   11). Os dados guardam-no com espaços («316 614 610»): contam os algarismos. */
export const algarismosDoNif = (nif) => (typeof nif === 'number' ? String(nif) : String(nif ?? '')).replace(/\s+/g, '');
export function nifValido(nif) {
  const s = algarismosDoNif(nif);
  if (!/^[1-9][0-9]{8}$/.test(s)) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += Number(s[i]) * (9 - i);
  const resto = soma % 11;
  return (resto < 2 ? 0 : 11 - resto) === Number(s[8]);
}

/* O IDENTIFICADOR DE UM ITEM NOVO: gerado UMA vez, ao criar, a partir do nome
   (o carro do trabalho, o nome do produto ou do serviço), e nunca mais muda —
   liga um trabalho às galerias dos serviços, é o nome do ficheiro, e é a
   âncora de um serviço (/#s-<identificador>). Minúsculas, sem acentos, o resto
   passa a hífen («Mercedes-AMG CLA 45 S» → mercedes-amg-cla-45-s). Repetido:
   -2, -3… `omissao`: a base quando o nome não dá nada. */
export function gerarSlug(nome, existentes = [], omissao = 'item') {
  const ja = existentes instanceof Set ? existentes : new Set(existentes);
  let base = String(ausente(nome) ? '' : nome)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 80).replace(/-+$/, '');
  if (!base) base = omissao;
  let slug = base;
  for (let n = 2; ja.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/* Caracteres de controlo, por escape e nunca literais no código. */
const RE_CONTROLO_LINHA = /[\u0000-\u001F\u007F]/;
const RE_CONTROLO_TEXTO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/* «</script» e «<!--»: os dados do estúdio e os nomes dos serviços vão para o
   JSON-LD de TODAS as páginas (um <script> com o JSON.stringify do gerador, que
   não os escapa): um fecha o elemento a meio e o outro muda a forma como o
   browser o lê. Não há texto honesto que os precise. */
const RE_PARTE_A_PAGINA = /<\/script|<!--/i;

/* Telefones portugueses, 9 algarismos: telemóvel (91, 92, 93, 96) e fixo (2…).
   O WhatsApp é um telemóvel com o indicativo 351 à frente. */
const RE_TELEMOVEL = /^9[1236][0-9]{7}$/;
const RE_FIXO = /^2[1-9][0-9]{7}$/;
const RE_WHATSAPP = /^3519[1236][0-9]{7}$/;
const RE_TELEFONE_TEXTO = /^[0-9 +.-]+$/;
export const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const emailValido = (v) => typeof v === 'string' && v.length <= TAMANHOS.email && RE_EMAIL.test(v.trim());
export const RE_CODIGO_POSTAL = /^[0-9]{4}-[0-9]{3}$/;
/* A REDE DE UM TELEFONE, para a nota do custo da chamada que o site escreve
   junto do número (DL 59/2021): o site escreve sempre «(Chamada para a rede
   móvel nacional)», por isso o telefone tem de ser um telemóvel. */
export const redeDoTelefone = (n) => (typeof n !== 'string' ? null : RE_TELEMOVEL.test(n) ? 'movel' : RE_FIXO.test(n) ? 'fixa' : null);

/* Um endereço https:// inteiro, sem espaços, aspas nem «<>». */
export function urlHttps(v) {
  if (typeof v !== 'string' || !/^https:\/\/[^\s"'<>\\]+$/.test(v.trim())) return false;
  try { return new URL(v.trim()).protocol === 'https:'; } catch { return false; }
}

/* --- as fotografias ------------------------------------------------------- */

/**
 * O NOME DE UMA FOTOGRAFIA DENTRO DA SUA BIBLIOTECA, como o gerador o lê
 * (radicalFoto): sem as barras à frente e sem «assets/img/<pasta>/». As três
 * formas que os dados podem ter: «assets/img/obras/x-828.webp» (a que o painel
 * e o Pages CMS escrevem), «x» (o radical, a forma antiga) e
 * «assets/img/obras/foto.jpg» (um ficheiro solto). Um caminho de OUTRA
 * biblioteca, ou de uma subpasta, não é da biblioteca: → null.
 */
export function nomeNaBiblioteca(caminho, pasta) {
  if (typeof caminho !== 'string' || !tem(BIBLIOTECAS, pasta)) return null;
  const limpo = caminho.replace(/^\/+/, '').replace(new RegExp(`^${BIBLIOTECAS[pasta]}/`), '');
  if (!limpo || limpo.includes('/') || limpo.includes('\\')) return null;
  return limpo;
}

/* O radical de uma fotografia tratada a partir do nome dentro da biblioteca
   («x-828.webp», «x-414.avif» ou «x»), ou null se o nome é de um ficheiro solto. */
const radicalDoNome = (nome) => {
  const sem = nome.replace(RE_VARIANTE, '');
  if (sem !== nome) return sem;
  return /\.[a-z0-9]+$/i.test(nome) ? null : nome;
};

/**
 * UMA FOTOGRAFIA EXISTE PARA O SITE com a mesma conta do gerador:
 *   · uma TRATADA (o nome é uma das cópias, ou o radical) quando a de 828 em
 *     WebP está na pasta — e então o site pede as QUATRO no srcset, e as
 *     quatro têm de lá estar (a auditoria trava a publicação por uma que falte);
 *   · um ficheiro SOLTO quando está na pasta, com extensão de fotografia.
 * listarPasta(pasta) → os nomes do que está nessa pasta ([] se não existir).
 * `pasta`: 'obras' ou 'loja' (a biblioteca do campo).
 */
export function fotografiaExiste(caminho, listarPasta, pasta = 'obras') {
  const nome = nomeNaBiblioteca(caminho, pasta);
  if (!nome || typeof listarPasta !== 'function') return false;
  const l = listarPasta(BIBLIOTECAS[pasta]);
  const lista = new Set(Array.isArray(l) ? l : []);
  const radical = radicalDoNome(nome);
  if (radical !== null && lista.has(`${radical}-828.webp`)) return SUFIXOS_COPIAS.every((s) => lista.has(`${radical}${s}`));
  const ext = /\.([a-z0-9]+)$/i.exec(nome)?.[1]?.toLowerCase();
  return Boolean(ext) && EXTENSOES_FOTO.includes(ext) && lista.has(nome);
}

/** A MESMA FOTOGRAFIA, para as listas: o radical de uma tratada (as quatro
 *  cópias são uma fotografia só), ou o nome do ficheiro solto. */
export function chaveDaFoto(caminho, pasta = 'obras') {
  const nome = nomeNaBiblioteca(caminho, pasta);
  if (!nome) return `?${String(caminho)}`;
  const r = radicalDoNome(nome);
  return r !== null ? `${BIBLIOTECAS[pasta]}/${r}` : `${BIBLIOTECAS[pasta]}/${nome}`;
}

/* Um caminho de fotografia como o painel e o Pages CMS os escrevem: dentro da
   biblioteca do campo (com ou sem a barra à frente), ou só o nome. Nada de
   «..», barras para trás, aspas, nem os sinais que partem um endereço (# ? %):
   o gerador escreve o nome dentro de src="…" sem o escapar. Espaços e acentos
   aceitam-se dentro do nome (um ficheiro solto vai em src, que os aceita). À
   volta do caminho, não: o gerador lê-o tal e qual e não acha o ficheiro. */
export function caminhoDeFotoValido(c, pasta = 'obras') {
  if (typeof c !== 'string') return false;
  const s = c.trim();
  if (!s || s !== c || s.length > TAMANHOS.caminhoFoto) return false;
  if (RE_CONTROLO_LINHA.test(s) || /["<>\\#?%]/.test(s)) return false;
  const nome = nomeNaBiblioteca(s, pasta);
  if (!nome || nome === '.' || nome === '..' || nome.trim() !== nome) return false;
  const ext = /\.([a-z0-9]+)$/i.exec(nome)?.[1]?.toLowerCase();
  return ext ? EXTENSOES_FOTO.includes(ext) : /^[A-Za-z0-9_-]+$/.test(nome);
}

/* Igualdade de valores lidos de JSON, com null ≡ ausente e sem ligar à ordem
   das chaves. */
function mesmoValor(a, b) {
  if (ausente(a) && ausente(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => mesmoValor(x, b[i]));
  }
  if (eObjecto(a) || eObjecto(b)) {
    if (!eObjecto(a) || !eObjecto(b)) return false;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!mesmoValor(a[k], b[k])) return false;
    return true;
  }
  return a === b;
}

/* Os textos de um valor (em profundidade), com o caminho de cada um. */
function textosDe(v, caminho = '') {
  if (typeof v === 'string') return [[caminho, v]];
  const filhos = Array.isArray(v) ? Array.from(v, (x, i) => [i, x]) : eObjecto(v) ? Object.entries(v) : [];
  return filhos.flatMap(([k, x]) => textosDe(x, caminho ? `${caminho}.${k}` : String(k)));
}

/* Lê um ficheiro: o TEXTO (string), o objecto já lido, ou null/undefined. */
function lerJson(valor) {
  if (ausente(valor)) return { ausente: true };
  if (typeof valor !== 'string') return { obj: valor, texto: null };
  try { return { obj: JSON.parse(valor), texto: valor }; } catch (e) { return { ilegivel: String((e && e.message) || e).slice(0, 120), texto: valor }; }
}

/* Uma linha só, cortada a 80: o nome de um item nas mensagens e nos ecrãs. */
const umaLinha = (t, n = 80) => {
  const s = typeof t === 'string' ? t.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/* No site, como o gerador decide: tudo menos `publicado: false`. */
export const noSite = (x) => eObjecto(x) && x.publicado !== false;
export const nomeDoTrabalho = (t, slug = '') => umaLinha(eObjecto(t) ? t.veiculo : '') || slug || 'trabalho sem nome';
export const nomeDoProduto = (p, slug = '') => umaLinha(eObjecto(p) ? p.nome : '') || slug || 'produto sem nome';
export const nomeDoServico = (s, i = 0) => umaLinha(eObjecto(s) ? s.nome : '') || (eObjecto(s) && temTexto(s.slug) ? s.slug : `serviço ${i + 1}`);
export const nomeDoPar = (p, i = 0) => umaLinha(eObjecto(p) ? p.veiculo : '') || `comparador ${i + 1}`;
export const nomeDaCritica = (c, i = 0) => umaLinha(eObjecto(c) ? c.autor : '') || `testemunho ${i + 1}`;
/* O NOME DE QUEM DEU UM TESTEMUNHO, como a política de privacidade promete: o
   nome próprio e a inicial do apelido, com ponto («Nelson P.», «Ana-Rita M.»,
   «João S.»). Um nome completo, só o nome próprio ou uma inicial sem ponto
   não servem: o testemunho não aparece no site até estar assim. */
const RE_AUTOR = /^\p{Lu}\p{Ll}+(?:[-'’]\p{Lu}?\p{Ll}+)* \p{Lu}\.$/u;
export const autorValido = (t) => typeof t === 'string' && t.length <= TAMANHOS.autor && RE_AUTOR.test(t.trim());
/* No site, como o gerador decide: só o testemunho que o cliente autorizou. */
export const testemunhoNoSite = (c) => eObjecto(c) && c.autorizado === true;

/* A CHAVE DE UM ITEM DE UMA LISTA nas chaves dos problemas: o identificador
   (os serviços e os comparadores têm um; as avaliações, o autor), e a posição
   só quando não há nenhum. Assim reordenar a lista não faz um problema que
   já existia passar por novo. Repetidos ganham «#2», «#3». */
function chavesDosItens(lista, deUm) {
  const vistas = new Map();
  return lista.map((x, i) => {
    const base = deUm(x) || `#${i + 1}`;
    const n = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}
const normal = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/* --- os campos de texto, de número e de fotografia (para todos os itens) ----- */

/* Um texto de um campo pelo rótulo que o dono vê. `classeVazio`: o que acontece
   quando falta ('bloqueia' — a lei ou o gerador; 'avisa' — um obrigatório do
   formulário; 'lembrete'; null — opcional). → true se é um texto preenchido. */
function conferirTexto(out, base, { valor, chave, campo, rotulo, max, classeVazio = null, porque = '', linha = true }) {
  const juntar = (classe, ch, mensagem, extra = {}) => out.push({ ...base, classe, chave: ch, campo, mensagem, ...extra });
  if (vazio(valor)) {
    if (classeVazio === 'bloqueia') juntar('bloqueia', chave, `Preencha «${rotulo}»: ${porque || 'é obrigatório por lei'}, e sem isso o site não é publicado.`);
    else if (classeVazio === 'avisa') juntar('avisa', chave, `Preencha «${rotulo}»${porque ? `: ${porque}` : '.'}`);
    else if (classeVazio === 'lembrete') juntar('avisa', chave, `Falta «${rotulo}»${porque ? `: ${porque}` : '.'}`, { lembrete: true });
    return false;
  }
  if (typeof valor !== 'string') { juntar(classeVazio === 'bloqueia' ? 'bloqueia' : 'avisa', chave, `«${rotulo}» tem de ser texto.`); return false; }
  if (valor.length > max) juntar('avisa', `${chave}:tamanho`, `«${rotulo}» tem mais de ${max} caracteres (tem ${valor.length}).`);
  if ((linha ? RE_CONTROLO_LINHA : RE_CONTROLO_TEXTO).test(valor)) juntar('avisa', `${chave}:controlo`, `«${rotulo}» tem caracteres invisíveis${linha ? ' (ex.: uma mudança de linha)' : ''}. Escreva-o outra vez.`);
  return true;
}
/* Um número inteiro (ou com casas) dentro dos limites; ausente passa. */
function conferirNumero(out, base, { valor, chave, campo, rotulo, limites, casas = 0, obrigatorio = false, mensagem }) {
  if (ausente(valor) || valor === '') {
    if (obrigatorio) out.push({ ...base, classe: 'avisa', chave, campo, mensagem: `Preencha «${rotulo}».` });
    return;
  }
  const [min, max] = limites;
  const passo = 10 ** casas;
  const ok = typeof valor === 'number' && Number.isFinite(valor) && valor >= min && valor <= max && Math.abs(Math.round(valor * passo) - valor * passo) < 1e-6;
  if (!ok) out.push({ ...base, classe: 'avisa', chave, campo, mensagem: mensagem ?? `«${rotulo}» é um número ${casas ? `com até ${casas === 1 ? 'uma casa decimal' : `${casas} casas decimais`}` : 'inteiro'} de ${String(min).replace('.', ',')} a ${String(max).replace('.', ',')}.` });
}
const conferirBooleano = (out, base, { valor, chave, campo, rotulo }) => {
  if (!ausente(valor) && typeof valor !== 'boolean') out.push({ ...base, classe: 'avisa', chave, campo, mensagem: `«${rotulo}» tem de ser sim ou não.` });
};

/* ------------------------------------------------------------------ */
/* Um trabalho                                                          */
/* ------------------------------------------------------------------ */

/* Os problemas de UM trabalho. O painel usa-o campo a campo.
   ctx = { nome, listarPasta?(pasta), servicos?: [serviço] | null }
   Sem listarPasta não se confere se as fotografias existem (só a forma); sem
   servicos não se lembra o trabalho que não está em galeria nenhuma. */
export function problemasDoTrabalho(t, ctx = {}) {
  const nome = typeof ctx.nome === 'string' ? ctx.nome : '';
  const slug = slugDoFicheiro(nome);
  const out = [];
  if (!eObjecto(t)) return out;   // a forma do ficheiro é do problemas(): bloqueia
  const base = { ficheiro: ficheiroDoTrabalho(nome), ecra: `Trabalhos › ${nomeDoTrabalho(t, slug)}`, slug };
  const ch = (regra) => `trabalho:${slug}:${regra}`;
  const R = NOMES_CAMPOS.trabalho;
  const neutraliza = (regra, efeito, campo, mensagem, extra = {}) => out.push({ ...base, classe: 'neutraliza', chave: ch(regra), campo, efeito, mensagem, ...extra });
  const avisa = (regra, campo, mensagem, extra = {}) => out.push({ ...base, classe: 'avisa', chave: ch(regra), campo, mensagem, ...extra });

  /* Sem o carro ou sem o que se fez, o texto alternativo das fotografias
     ficava «undefined — undefined» (o gerador escreve-o nos dois): o trabalho
     fica escondido até estar preenchido. */
  for (const campo of ['veiculo', 'servico']) {
    const x = t[campo];
    if (vazio(x)) neutraliza(campo, 'esconder', campo, `Falta «${R[campo]}»: o trabalho fica escondido do site até o preencher.`);
    else if (typeof x !== 'string') neutraliza(campo, 'esconder', campo, `«${R[campo]}» tem de ser texto: o trabalho fica escondido do site até ser corrigido.`);
    else conferirTexto(out, base, { valor: x, chave: ch(`${campo}`), campo, rotulo: R[campo], max: campo === 'veiculo' ? TAMANHOS.veiculo : TAMANHOS.servicoTrabalho });
  }

  /* AS FOTOGRAFIAS TÊM DE SER UMA LISTA: o gerador faz `t.fotos.includes(…)`
     (a galeria de um serviço sem trabalhos escolhidos) e `t.fotos[0]` (as
     fotografias da capa, nos destacados) — com outra coisa rebentava a meio.
     Na cópia que o gerador lê fica uma lista vazia. */
  const fotos = t.fotos;
  if (!Array.isArray(fotos)) {
    neutraliza('fotos-lista', 'sem_fotografia', 'fotos', ausente(fotos)
      ? 'O trabalho não tem a lista das fotografias: no site fica sem fotografias. Junte-as no painel.'
      : 'As fotografias não estão gravadas como uma lista: no site o trabalho fica sem fotografias. Escolha-as outra vez.', { lista: true });
  }
  const lista = Array.isArray(fotos) ? fotos : [];
  const vistos = new Set();
  lista.forEach((c, indice) => {
    const nomeFoto = typeof c === 'string' ? (c.split('/').pop() || c) : String(c);
    const extra = { foto: c, indice };
    if (!caminhoDeFotoValido(c, 'obras')) {
      if (!vistos.has(`x:${String(c)}`)) {
        vistos.add(`x:${String(c)}`);
        neutraliza(`foto-invalida:${String(c)}`, 'sem_fotografia', 'fotos', `A fotografia «${nomeFoto.slice(0, 80)}» não é uma fotografia da biblioteca dos trabalhos: não aparece no site. Tire-a do trabalho e escolha-a outra vez.`, extra);
      }
      return;
    }
    const k = chaveDaFoto(c, 'obras');
    if (vistos.has(k)) { avisa(`foto-repetida:${k}`, 'fotos', `A fotografia «${nomeFoto}» está duas vezes no trabalho. Tire uma delas.`, extra); return; }
    vistos.add(k);
    if (typeof ctx.listarPasta === 'function' && !fotografiaExiste(c, ctx.listarPasta, 'obras')) {
      neutraliza(`foto-em-falta:${k}`, 'sem_fotografia', 'fotos', `A fotografia «${nomeFoto}» já não está na biblioteca: não aparece no site. Tire-a do trabalho, ou carregue-a outra vez.`, extra);
    }
  });
  if (lista.length > TAMANHOS.fotos) avisa('fotos-a-mais', 'fotos', `O trabalho tem ${lista.length} fotografias; o máximo é ${TAMANHOS.fotos}. Tire as que estão a mais.`);

  for (const b of BOOLEANOS_TRABALHO) conferirBooleano(out, base, { valor: t[b], chave: ch(b), campo: b, rotulo: R[b] });
  conferirNumero(out, base, { valor: t.ordem, chave: ch('ordem'), campo: 'ordem', rotulo: R.ordem, limites: LIMITES.ordem,
    mensagem: `A ordem é um número inteiro de 1 a ${LIMITES.ordem[1]} (o número mais baixo aparece primeiro).` });

  /* O CAMPO `slug` É O QUE O GERADOR USA para ligar o trabalho às galerias dos
     serviços, e o painel escreve-o igual ao nome do ficheiro. */
  if (t.slug !== slug) {
    avisa('slug', 'slug', ausente(t.slug)
      ? `Falta o identificador deste trabalho (o nome do ficheiro): nenhum serviço o consegue mostrar na galeria. Só o Renato o pode corrigir.`
      : `O identificador deste trabalho («${umaLinha(String(t.slug), 40)}») não é o nome do ficheiro («${slug}»): os serviços que o mostram na galeria podem não o encontrar. Só o Renato o pode corrigir.`);
  }

  // --- lembretes (só os do site) ------------------------------------------------
  if (noSite(t) && !lista.some((c) => typeof c === 'string' && c.trim() !== '')) {
    avisa('sem-fotos', 'fotos', 'O trabalho não tem fotografias: não aparece em galeria nenhuma.', { lembrete: true });
  }
  if (noSite(t) && Array.isArray(ctx.servicos) && lista.length) {
    const naGaleria = ctx.servicos.some((sv) => eObjecto(sv) && temTexto(sv.imagem) && (Array.isArray(sv.obras) && sv.obras.length
      ? sv.obras.includes(t.slug)
      : lista.includes(sv.imagem)));
    if (!naGaleria) avisa('fora-das-galerias', 'galerias', 'Este trabalho não está na galeria de nenhum serviço: no site, não aparece em sítio nenhum. Escolha em que serviços aparece (em baixo, «Galerias dos serviços»).', { lembrete: true });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Um produto                                                           */
/* ------------------------------------------------------------------ */

/* A fotografia que o gerador mostra num produto: a do campo `foto`, ou, sem
   ela, a que tem o nome do produto (`p.foto || p.slug` — as dez de hoje). */
export const fotografiaDoProduto = (p) => (eObjecto(p) ? (temTexto(p.foto) ? p.foto : (typeof p.slug === 'string' ? p.slug : '')) : '');

export function problemasDoProduto(p, ctx = {}) {
  const nome = typeof ctx.nome === 'string' ? ctx.nome : '';
  const slug = slugDoFicheiro(nome);
  const out = [];
  if (!eObjecto(p)) return out;
  const base = { ficheiro: ficheiroDoProduto(nome), ecra: `Loja › ${nomeDoProduto(p, slug)}`, slug };
  const ch = (regra) => `produto:${slug}:${regra}`;
  const R = NOMES_CAMPOS.produto;
  const neutraliza = (regra, efeito, campo, mensagem, extra = {}) => out.push({ ...base, classe: 'neutraliza', chave: ch(regra), campo, efeito, mensagem, ...extra });
  const avisa = (regra, campo, mensagem, extra = {}) => out.push({ ...base, classe: 'avisa', chave: ch(regra), campo, mensagem, ...extra });

  if (vazio(p.nome)) neutraliza('nome', 'esconder', 'nome', 'Falta o nome do produto: fica escondido da loja até o escrever.');
  else if (typeof p.nome !== 'string') neutraliza('nome', 'esconder', 'nome', 'O nome do produto tem de ser texto: fica escondido da loja até ser corrigido.');
  else conferirTexto(out, base, { valor: p.nome, chave: ch('nome'), campo: 'nome', rotulo: R.nome, max: TAMANHOS.nomeProduto });

  /* A categoria é do .pages.yml (uma lista fechada); o site escreve-a tal e
     qual no cartão. Uma que não está na lista (dois produtos de hoje:
     «Preparação» e «Manutenção») lembra-se, sem prender. */
  if (vazio(p.familia)) avisa('familia', 'familia', 'Escolha a categoria do produto.');
  else if (typeof p.familia !== 'string') avisa('familia', 'familia', 'A categoria tem de ser uma da lista. Escolha-a outra vez.');
  else if (!FAMILIAS.includes(p.familia)) avisa('familia-fora', 'familia', `A categoria «${umaLinha(p.familia, 40)}» não é nenhuma das da lista (${FAMILIAS.join(', ')}). O site mostra-a na mesma; escolha uma da lista quando puder.`, { lembrete: true });

  conferirTexto(out, base, { valor: p.descricao, chave: ch('descricao'), campo: 'descricao', rotulo: R.descricao, max: TAMANHOS.descricao, linha: false });
  conferirTexto(out, base, { valor: p.formato, chave: ch('formato'), campo: 'formato', rotulo: R.formato, max: TAMANHOS.formato });

  /* O PREÇO: vazio (null) é «Sob consulta» — o gerador mostra-o com qualquer
     valor falso, 0 incluído. Com um valor, é o preço final com IVA. */
  conferirNumero(out, base, { valor: p.preco, chave: ch('preco'), campo: 'preco', rotulo: R.preco, limites: LIMITES.preco, casas: 2,
    mensagem: `O preço é só o número, sem € (ex.: 18 ou 24,50), de 0 a ${LIMITES.preco[1]} €. Vazio fica «Sob consulta».` });

  /* A FOTOGRAFIA: sem nenhuma, o cartão do produto ficava com uma imagem
     partida — e a auditoria do site travava a publicação inteira. O produto
     fica escondido da loja até ter uma. */
  /* `tirarFoto`: na cópia que o gerador lê sai também o caminho — a auditoria
     do site confere TODOS os caminhos de data/, publicados ou não, e travava a
     publicação por um que não existe. */
  if (!ausente(p.foto) && p.foto !== '' && !caminhoDeFotoValido(p.foto, 'loja')) {
    neutraliza('foto-invalida', 'esconder', 'foto', 'A fotografia do produto não é uma fotografia da biblioteca da loja: o produto fica escondido da loja até escolher outra.', { foto: p.foto, tirarFoto: true });
  } else if (typeof ctx.listarPasta === 'function' && (temTexto(p.foto) || noSite(p)) && !fotografiaExiste(fotografiaDoProduto(p), ctx.listarPasta, 'loja')) {
    /* Um produto ESCONDIDO sem fotografia escolhida não parte nada: o gerador
       não o desenha, e nos dados não há caminho nenhum para a auditoria
       conferir. Pode gravar-se escondido e ganhar a fotografia depois (o
       painel cria-o assim); ligar «Mostrar na loja» sem ela é que não. */
    neutraliza('sem-foto', 'esconder', 'foto', temTexto(p.foto)
      ? 'A fotografia do produto já não está na biblioteca: o produto fica escondido da loja até escolher outra.'
      : 'O produto não tem fotografia: fica escondido da loja até ter uma.', temTexto(p.foto) ? { foto: p.foto, tirarFoto: true } : {});
  }

  conferirBooleano(out, base, { valor: p.publicado, chave: ch('publicado'), campo: 'publicado', rotulo: R.publicado });
  conferirNumero(out, base, { valor: p.ordem, chave: ch('ordem'), campo: 'ordem', rotulo: R.ordem, limites: LIMITES.ordem,
    mensagem: `A ordem é um número inteiro de 1 a ${LIMITES.ordem[1]} (o número mais baixo aparece primeiro).` });
  if (p.slug !== slug) {
    avisa('slug', 'slug', `O identificador deste produto não é o nome do ficheiro («${slug}»): sem fotografia escolhida, o site procura a do nome errado. Só o Renato o pode corrigir.`);
  }
  for (const [c, x] of textosDe(p)) {
    if (RE_PARTE_A_PAGINA.test(x)) { avisa('partia-a-pagina', c.split('.')[0], 'Um texto tem «</script» ou «<!--», que não podem ir para o site. Escreva-o outra vez.'); break; }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Os serviços (data/lista-servicos.json)                              */
/* ------------------------------------------------------------------ */

/* ctx = { listarPasta?, trabalhos?: Map(slug → trabalho) | null } */
export function problemasDosServicos(d, ctx = {}) {
  const ficheiro = FICHEIROS.servicos;
  const out = [];
  const bloqueia = (chave, mensagem, extra = {}) => out.push({ classe: 'bloqueia', chave: `servicos:${chave}`, ficheiro, ecra: 'Serviços', mensagem, ...extra });
  if (!eObjecto(d) || !Array.isArray(d.servicos)) {
    bloqueia('forma', 'A lista dos serviços não tem a forma certa: sem ela o site não se consegue gerar. Só o Renato a pode corrigir.');
    return out;
  }
  const lista = d.servicos;
  if (!lista.length) out.push({ classe: 'avisa', chave: 'servicos:vazia', ficheiro, ecra: 'Serviços', campo: 'servicos', mensagem: 'Não há nenhum serviço: a secção «O que fazemos» fica vazia. Junte pelo menos um.' });
  if (lista.length > TAMANHOS.servicos) out.push({ classe: 'avisa', chave: 'servicos:quantos', ficheiro, ecra: 'Serviços', campo: 'servicos', mensagem: `Há ${lista.length} serviços; o máximo é ${TAMANHOS.servicos}.` });
  const chaves = chavesDosItens(lista, (s) => (eObjecto(s) && typeof s.slug === 'string' && RE_SLUG.test(s.slug) ? s.slug : ''));
  const slugs = new Map();
  for (const s of lista) if (eObjecto(s) && typeof s.slug === 'string') slugs.set(s.slug, (slugs.get(s.slug) ?? 0) + 1);
  const trabalhos = ctx.trabalhos instanceof Map ? ctx.trabalhos : null;
  const R = NOMES_CAMPOS.servico;

  lista.forEach((s, i) => {
    const k = chaves[i];
    const base = { ficheiro, ecra: `Serviços › ${nomeDoServico(s, i)}`, slug: k, indice: i };
    const ch = (regra) => `servicos:${k}:${regra}`;
    const avisa = (regra, campo, mensagem, extra = {}) => out.push({ ...base, classe: 'avisa', chave: ch(regra), campo: `servicos.${i}.${campo}`, mensagem, ...extra });
    /* O gerador lê cada serviço sem perguntar (sv.imagem): um que não é um
       objecto rebentava-o. */
    if (!eObjecto(s)) { out.push({ ...base, classe: 'bloqueia', chave: ch('forma'), mensagem: `O ${i + 1}.º serviço da lista não tem a forma de um serviço: sem ela o site não se consegue gerar. Só o Renato o pode corrigir.` }); return; }
    conferirTexto(out, base, { valor: s.nome, chave: ch('nome'), campo: `servicos.${i}.nome`, rotulo: R.nome, max: TAMANHOS.nomeServico, classeVazio: 'avisa', porque: 'é o que aparece na lista e no azulejo.' });
    conferirTexto(out, base, { valor: s.curto, chave: ch('curto'), campo: `servicos.${i}.curto`, rotulo: R.curto, max: TAMANHOS.curto });
    /* O identificador é a âncora do serviço (/#s-<identificador>) e o id do
       azulejo: um repetido dava dois sítios com o mesmo endereço. */
    if (vazio(s.slug) || typeof s.slug !== 'string' || !RE_SLUG.test(s.slug)) avisa('slug', 'slug', 'O identificador deste serviço (o endereço do bloco) não está bem: só minúsculas, números e hífenes. Só o Renato o pode corrigir.');
    else if (slugs.get(s.slug) > 1) avisa('slug-repetido', 'slug', `Há mais de um serviço com o identificador «${s.slug}»: ficavam dois blocos com o mesmo endereço.`);
    /* A FOTOGRAFIA: com ela, o serviço é um azulejo da montra; sem ela, só um
       nome na lista. Uma que já não existe partia o azulejo (e a auditoria
       travava a publicação): na cópia que o gerador lê, o serviço fica só com
       o nome. */
    const img = s.imagem;
    if (!vazio(img)) {
      const nomeFoto = typeof img === 'string' ? (img.split('/').pop() || img) : String(img);
      if (!caminhoDeFotoValido(img, 'obras')) out.push({ ...base, classe: 'neutraliza', chave: ch('foto-invalida'), campo: `servicos.${i}.imagem`, efeito: 'sem_fotografia', foto: img, mensagem: `A fotografia «${umaLinha(nomeFoto, 60)}» não é uma fotografia da biblioteca: o serviço aparece só como nome na lista, sem azulejo. Escolha-a outra vez.` });
      else if (typeof ctx.listarPasta === 'function' && !fotografiaExiste(img, ctx.listarPasta, 'obras')) out.push({ ...base, classe: 'neutraliza', chave: ch('foto-em-falta'), campo: `servicos.${i}.imagem`, efeito: 'sem_fotografia', foto: img, mensagem: `A fotografia «${umaLinha(nomeFoto, 60)}» já não está na biblioteca: o serviço aparece só como nome na lista, sem azulejo. Escolha outra.` });
    }
    /* OS TRABALHOS DA GALERIA: uma lista de identificadores de trabalhos. */
    const ob = s.obras;
    if (!ausente(ob)) {
      if (!Array.isArray(ob) || ob.some((x) => typeof x !== 'string')) avisa('obras', 'obras', 'Os trabalhos da galeria não estão gravados como uma lista: escolha-os outra vez.');
      else {
        if (ob.length > TAMANHOS.obras) avisa('obras-quantos', 'obras', `A galeria tem ${ob.length} trabalhos; o máximo é ${TAMANHOS.obras}.`);
        if (trabalhos) {
          const faltam = [...new Set(ob.filter((x) => !trabalhos.has(x)))];
          for (const x of faltam) avisa(`obra-desconhecida:${x}`, 'obras', `A galeria aponta para um trabalho que já não existe («${umaLinha(x, 40)}»): tire-o da lista.`);
        }
      }
    }
    /* UMA GALERIA VAZIA: carregar no azulejo não abria nada. */
    if (trabalhos && temTexto(img) && (ausente(ob) || Array.isArray(ob))) {
      const daGaleria = [...trabalhos.values()].filter((t) => noSite(t) && (Array.isArray(ob) && ob.length ? ob.includes(t.slug) : Array.isArray(t.fotos) && t.fotos.includes(img)));
      if (!daGaleria.some((t) => Array.isArray(t.fotos) && t.fotos.length)) avisa('galeria-vazia', 'obras', 'Carregar neste azulejo não abre fotografia nenhuma: escolha os trabalhos que a galeria mostra.', { lembrete: true });
    }
    for (const [c, x] of textosDe(s)) {
      if (RE_PARTE_A_PAGINA.test(x)) { out.push({ ...base, classe: 'bloqueia', chave: ch('partia-a-pagina'), campo: `servicos.${i}.${c.split('.')[0]}`, mensagem: 'Um texto deste serviço tem «</script» ou «<!--», que não podem ir para o site (o nome vai para dentro de todas as páginas). Apague-o e escreva-o outra vez.' }); break; }
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Antes e depois (data/pares.json)                                    */
/* ------------------------------------------------------------------ */

/* A lista como o gerador a lê: o ficheiro é { pares: [...] } (o do backoffice)
   ou a lista solta (como era antes). → a lista, [] sem pares, ou null se a
   forma não serve (rebentava o gerador). */
export function listaDePares(d) {
  if (Array.isArray(d)) return d;
  if (!eObjecto(d)) return null;
  if (ausente(d.pares)) return [];
  return Array.isArray(d.pares) ? d.pares : null;
}

export function problemasDosPares(d, ctx = {}) {
  const ficheiro = FICHEIROS.pares;
  const out = [];
  const lista = listaDePares(d);
  if (!lista) {
    out.push({ classe: 'bloqueia', chave: 'pares:forma', ficheiro, ecra: 'Antes e depois', mensagem: 'A lista dos comparadores não tem a forma certa: sem ela o site não se consegue gerar. Só o Renato a pode corrigir.' });
    return out;
  }
  if (!lista.length) out.push({ classe: 'avisa', chave: 'pares:vazia', ficheiro, ecra: 'Antes e depois', campo: 'pares', mensagem: 'Não há nenhum comparador: a secção «Antes e depois» fica vazia. Junte pelo menos um.' });
  if (lista.length > TAMANHOS.pares) out.push({ classe: 'avisa', chave: 'pares:quantos', ficheiro, ecra: 'Antes e depois', campo: 'pares', mensagem: `Há ${lista.length} comparadores; o máximo é ${TAMANHOS.pares}.` });
  const chaves = chavesDosItens(lista, (p) => (eObjecto(p) && typeof p.slug === 'string' && RE_SLUG.test(p.slug) ? p.slug : ''));
  const R = NOMES_CAMPOS.par;
  lista.forEach((p, i) => {
    const k = chaves[i];
    const base = { ficheiro, ecra: `Antes e depois › ${nomeDoPar(p, i)}`, slug: k, indice: i };
    const ch = (regra) => `pares:${k}:${regra}`;
    const campo = (c) => `pares.${i}.${c}`;
    /* O gerador ordena-os (a.ordem): um que não é um objecto rebentava-o. */
    if (!eObjecto(p)) { out.push({ ...base, classe: 'bloqueia', chave: ch('forma'), mensagem: `O ${i + 1}.º comparador não tem a forma de um comparador: sem ela o site não se consegue gerar. Só o Renato o pode corrigir.` }); return; }
    conferirTexto(out, base, { valor: p.veiculo, chave: ch('veiculo'), campo: campo('veiculo'), rotulo: R.veiculo, max: TAMANHOS.veiculo, classeVazio: 'avisa' });
    conferirTexto(out, base, { valor: p.servico, chave: ch('servico'), campo: campo('servico'), rotulo: R.servico, max: TAMANHOS.servicoTrabalho, classeVazio: 'avisa' });
    /* AS DUAS FOTOGRAFIAS: sem uma delas (ou com uma que já não existe), o
       comparador ficava com uma imagem partida e a auditoria travava a
       publicação. Na cópia que o gerador lê, o comparador sai. */
    const fotos = {};
    for (const lado of ['antes', 'depois']) {
      const c = p[lado];
      const rot = lado === 'antes' ? 'ANTES' : 'DEPOIS';
      fotos[lado] = c;
      if (vazio(c)) out.push({ ...base, classe: 'neutraliza', chave: ch(`${lado}`), campo: campo(lado), efeito: 'esconder', mensagem: `Falta a fotografia ${rot}: o comparador fica fora do site até ter as duas.` });
      else if (!caminhoDeFotoValido(c, 'obras')) out.push({ ...base, classe: 'neutraliza', chave: ch(`${lado}-invalida`), campo: campo(lado), efeito: 'esconder', foto: c, mensagem: `A fotografia ${rot} não é uma fotografia da biblioteca: o comparador fica fora do site até a escolher outra vez.` });
      else if (typeof ctx.listarPasta === 'function' && !fotografiaExiste(c, ctx.listarPasta, 'obras')) out.push({ ...base, classe: 'neutraliza', chave: ch(`${lado}-em-falta`), campo: campo(lado), efeito: 'esconder', foto: c, mensagem: `A fotografia ${rot} já não está na biblioteca: o comparador fica fora do site até escolher outra.` });
    }
    if (temTexto(fotos.antes) && temTexto(fotos.depois) && chaveDaFoto(fotos.antes) === chaveDaFoto(fotos.depois)) {
      out.push({ ...base, classe: 'avisa', chave: ch('mesma-foto'), campo: campo('depois'), mensagem: 'As duas fotografias são a mesma: escolha a de ANTES e a de DEPOIS.' });
    }
    conferirNumero(out, base, { valor: p.ordem, chave: ch('ordem'), campo: campo('ordem'), rotulo: R.ordem, limites: LIMITES.ordem,
      mensagem: `A ordem é um número inteiro de 1 a ${LIMITES.ordem[1]} (os dois com o número mais baixo é que ficam à vista).` });
    conferirTexto(out, base, { valor: p.legenda, chave: ch('legenda'), campo: campo('legenda'), rotulo: R.legenda, max: TAMANHOS.legenda, linha: false });
    for (const a of ['alt_antes', 'alt_depois']) {
      conferirTexto(out, base, { valor: p[a], chave: ch(a), campo: campo(a), rotulo: R[a], max: TAMANHOS.alt, classeVazio: 'lembrete',
        porque: 'quem não vê a imagem (e o Google) fica sem saber o que lá está. Descreva o que está na fotografia.' });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Os testemunhos (data/avaliacoes.json)                               */
/* ------------------------------------------------------------------ */

/* OS TESTEMUNHOS DE CLIENTES (decisão do Renato, 11 out 2026): só aparecem
   no site os que o cliente autorizou (`autorizado: true`), com o nome próprio
   e a inicial do apelido, o texto, e as estrelas e a nota de tradução se as
   tiverem. Com a autorização de quem o escreveu, o texto deixa de ser
   «conteúdo copiado do Google» e passa a ser um testemunho dado ao estúdio —
   o que resolve os termos do Google, a protecção de dados (o fundamento é o
   consentimento) e a regra das avaliações de consumidores (DL 57/2008: dizer
   como se garante que vêm de clientes reais; a nota por baixo di-lo).
   Um testemunho sem nome no formato certo ou sem texto fica fora do site (na
   cópia que o gerador lê) até ser corrigido; um que não diga se foi
   autorizado não aparece (o gerador só mostra os autorizados), e o painel não
   o deixa gravar assim. */
export function problemasDasAvaliacoes(d) {
  const ficheiro = FICHEIROS.avaliacoes;
  const out = [];
  if (!eObjecto(d) || !Array.isArray(d.criticas)) {
    out.push({ classe: 'bloqueia', chave: 'avaliacoes:forma', ficheiro, ecra: 'Avaliações', mensagem: 'Os testemunhos não têm a forma certa: sem ela o site não se consegue gerar. Só o Renato os pode corrigir.' });
    return out;
  }
  const lista = d.criticas;
  if (lista.length > TAMANHOS.criticas) out.push({ classe: 'avisa', chave: 'avaliacoes:quantas', ficheiro, ecra: 'Avaliações', campo: 'criticas', mensagem: `Há ${lista.length} testemunhos; o máximo é ${TAMANHOS.criticas}.` });
  const chaves = chavesDosItens(lista, (c) => (eObjecto(c) ? normal(c.autor) : ''));
  const R = NOMES_CAMPOS.critica;
  lista.forEach((c, i) => {
    const k = chaves[i];
    const base = { ficheiro, ecra: `Avaliações › ${nomeDaCritica(c, i)}`, slug: k, indice: i };
    const ch = (regra) => `avaliacoes:${k}:${regra}`;
    const campo = (x) => `criticas.${i}.${x}`;
    const fora = (regra, x, mensagem) => out.push({ ...base, classe: 'neutraliza', chave: ch(regra), campo: campo(x), efeito: 'esconder', mensagem });
    if (!eObjecto(c)) { out.push({ ...base, classe: 'bloqueia', chave: ch('forma'), mensagem: `O ${i + 1}.º testemunho não tem a forma de um testemunho: sem ela o site não se consegue gerar. Só o Renato o pode corrigir.` }); return; }
    if (vazio(c.autor)) fora('autor', 'autor', 'Falta o nome do cliente: o testemunho não aparece no site até o escrever.');
    else if (!autorValido(c.autor)) fora('autor-formato', 'autor', 'Escreva o nome próprio e a inicial do apelido, com ponto (ex.: «Nelson P.»): é só isso que a política de privacidade diz que se publica. O testemunho não aparece no site até estar assim.');
    if (vazio(c.texto) || typeof c.texto !== 'string') fora('texto', 'texto', 'Falta o testemunho: não aparece no site até o escrever.');
    else conferirTexto(out, base, { valor: c.texto, chave: ch('texto'), campo: campo('texto'), rotulo: R.texto, max: TAMANHOS.textoCritica, linha: false });
    conferirNumero(out, base, { valor: c.estrelas, chave: ch('estrelas'), campo: campo('estrelas'), rotulo: R.estrelas, limites: LIMITES.estrelas,
      mensagem: 'As estrelas são um número inteiro de 1 a 5 (ou nenhum).' });
    conferirTexto(out, base, { valor: c.nota_traducao, chave: ch('nota_traducao'), campo: campo('nota_traducao'), rotulo: R.nota_traducao, max: TAMANHOS.notaTraducao });
    if (typeof c.autorizado !== 'boolean') out.push({ ...base, classe: 'avisa', chave: ch('autorizado'), campo: campo('autorizado'), mensagem: 'Diga se o cliente autorizou mostrar este testemunho no site: até lá, não aparece.' });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Os dados do estúdio (data/definicoes.json)                          */
/* ------------------------------------------------------------------ */

/* ctx = { listarPasta? } (para as fotografias da capa). */
export function problemasDasDefinicoes(d, ctx = {}) {
  const ficheiro = FICHEIROS.definicoes;
  const out = [];
  const ecraDe = (s) => (s ? ECRAS_DAS_SECCOES[s] ?? `${ECRA_ESTUDIO} › ${SECCOES_DEFINICOES[s]}` : ECRA_ESTUDIO);
  const juntar = (classe, chave, seccao, campo, mensagem, extra = {}) => out.push({ classe, chave: `definicoes:${chave}`, ficheiro, ecra: ecraDe(seccao), campo, mensagem, ...extra });
  const bloqueia = (...a) => juntar('bloqueia', ...a);
  const avisa = (...a) => juntar('avisa', ...a);
  const lembra = (chave, seccao, campo, mensagem) => juntar('avisa', chave, seccao, campo, mensagem, { lembrete: true });
  if (!eObjecto(d)) { bloqueia('forma', null, undefined, 'Os dados do estúdio não têm a forma certa. Só o Renato os pode corrigir.'); return out; }

  /* As secções que o gerador lê sem perguntar (D.contactos.telefone,
     D.horario.map, …): sem uma delas rebentava a meio. */
  for (const s of ['contactos', 'morada', 'textos', 'marca', 'google', 'empresa']) {
    if (!eObjecto(d[s])) bloqueia(`${s}:forma`, s, s, `A secção «${SECCOES_DEFINICOES[s]}» não está gravada, e sem ela o site não se consegue gerar. Preencha os campos dela e grave outra vez.`);
  }
  if (!Array.isArray(d.horario)) bloqueia('horario:forma', 'horario', 'horario', 'O horário não está gravado como uma lista, e sem ele o site não se consegue gerar. Escreva as linhas do horário e grave outra vez.');

  const fora = new Set(['capa']);
  const partidos = textosDe(Object.fromEntries(Object.entries(d).filter(([k]) => !fora.has(k)))).filter(([, t]) => RE_PARTE_A_PAGINA.test(t));
  if (partidos.length) {
    const seccao = partidos[0][0].split('.')[0];
    bloqueia('partia-a-pagina', tem(SECCOES_DEFINICOES, seccao) ? seccao : null, partidos[0][0], 'Um texto tem «</script» ou «<!--», que não podem ir para o site. Apague-o e escreva-o outra vez.');
  }

  const texto = (o, k, seccao, rotulo, max, opcoes = {}) => conferirTexto(out, { ficheiro, ecra: ecraDe(seccao) }, {
    valor: o[k], chave: `definicoes:${seccao}.${k}`, campo: `${seccao}.${k}`, rotulo, max, ...opcoes,
  });

  // --- contactos --------------------------------------------------------------
  const c = d.contactos;
  if (eObjecto(c)) {
    /* O telefone vai para os botões «Ligar», para o menu e para o rodapé de
       TODAS as páginas (tel:+351…): vazio, ou sem os 9 algarismos, partia-os. */
    const num = c.telefone;
    if (vazio(num)) bloqueia('contactos.telefone', 'contactos', 'contactos.telefone', 'Preencha «Telefone (para ligar)»: é o botão «Ligar» de todas as páginas, e sem ele o site não é publicado.');
    else if (typeof num !== 'string' || !/^[0-9]{9}$/.test(num)) bloqueia('contactos.telefone', 'contactos', 'contactos.telefone', '«Telefone (para ligar)» são nove algarismos seguidos, sem espaços (ex.: 912345678): sem isso o botão «Ligar» de todas as páginas não funciona, e o site não é publicado.');
    else if (redeDoTelefone(num) !== 'movel') avisa('contactos.telefone:rede', 'contactos', 'contactos.telefone', 'O telefone tem de ser um telemóvel (começa por 91, 92, 93 ou 96): o site escreve junto dele «(Chamada para a rede móvel nacional)».');
    const txt = c.telefone_texto;
    if (vazio(txt)) bloqueia('contactos.telefone_texto', 'contactos', 'contactos.telefone_texto', 'Preencha «Telefone (como aparece)»: é o número que se lê em todas as páginas, e sem ele o site não é publicado.');
    else if (typeof txt !== 'string' || !RE_TELEFONE_TEXTO.test(txt) || txt.length > TAMANHOS.telefoneTexto) avisa('contactos.telefone_texto', 'contactos', 'contactos.telefone_texto', '«Telefone (como aparece)» só pode ter algarismos e espaços (ex.: 912 345 678).');
    else if (typeof num === 'string' && /^[0-9]{9}$/.test(num) && txt.replace(/[^0-9]/g, '').replace(/^351(?=[0-9]{9}$)/, '') !== num) avisa('contactos.telefone_texto:outro', 'contactos', 'contactos.telefone_texto', '«Telefone (como aparece)» não é o mesmo número de «Telefone (para ligar)».');
    /* O EMAIL É OBRIGATÓRIO POR LEI (DL 7/2004, art. 10.º): aparece na
       Informação legal e na Política de Privacidade. O WhatsApp não substitui. */
    if (vazio(c.email)) bloqueia('contactos.email', 'contactos', 'contactos.email', 'Preencha o e-mail: é obrigatório por lei (artigo 10.º do Decreto-Lei n.º 7/2004) — o WhatsApp não substitui —, e sem ele o site não é publicado.');
    else if (!emailValido(c.email)) avisa('contactos.email:formato', 'contactos', 'contactos.email', 'Este e-mail não parece estar certo (ex.: nome@gmail.com).');
    if (vazio(c.instagram)) avisa('contactos.instagram', 'contactos', 'contactos.instagram', 'Preencha o Instagram: é para lá que vão o «Ver tudo no Instagram», o azulejo da montra e o ícone do rodapé.');
    else if (!urlHttps(c.instagram)) avisa('contactos.instagram:formato', 'contactos', 'contactos.instagram', 'O Instagram é o endereço completo da página, a começar por https:// (ex.: https://www.instagram.com/perfectfinish.pt).');
    if (vazio(c.facebook)) lembra('contactos.facebook', 'contactos', 'contactos.facebook', 'Sem o Facebook, o ícone do Facebook no rodapé não leva a lado nenhum.');
    else if (!urlHttps(c.facebook)) avisa('contactos.facebook:formato', 'contactos', 'contactos.facebook', 'O Facebook é o endereço completo da página, a começar por https://.');
    /* O WHATSAPP (escondido no .pages.yml) é o de todos os botões «Pedir
       orçamento» e «Pedir por WhatsApp»: o dono não o muda no painel. */
    if (!(typeof c.whatsapp === 'string' && RE_WHATSAPP.test(c.whatsapp))) bloqueia('contactos.whatsapp', 'contactos', 'contactos.whatsapp', 'O número do WhatsApp dos botões não está certo (o 351 seguido de um telemóvel, sem espaços): sem ele os botões «Pedir orçamento» não funcionam, e o site não é publicado. Só o Renato o pode corrigir.');
  }

  // --- a morada ------------------------------------------------------------------
  const m = d.morada;
  if (eObjecto(m)) {
    const porque = 'a lei obriga a morada completa na Informação legal (DL 7/2004, art. 10.º)';
    texto(m, 'rua', 'morada', 'Rua e número', TAMANHOS.rua, { classeVazio: 'bloqueia', porque });
    if (texto(m, 'codigo_postal', 'morada', 'Código postal', TAMANHOS.codigoPostal, { classeVazio: 'bloqueia', porque }) && !RE_CODIGO_POSTAL.test(m.codigo_postal)) {
      avisa('morada.codigo_postal:formato', 'morada', 'morada.codigo_postal', 'O código postal escreve-se 0000-000, completo (ex.: 2400-446).');
    }
    texto(m, 'localidade', 'morada', 'Localidade', TAMANHOS.localidade, { classeVazio: 'bloqueia', porque });
    if (vazio(m.pais) || typeof m.pais !== 'string') avisa('morada.pais', 'morada', 'morada.pais', 'Falta o país da morada (aparece na Informação legal). Só o Renato o pode corrigir.');
    if (!ausente(m.latitude) && !(typeof m.latitude === 'number' && m.latitude >= -90 && m.latitude <= 90)) avisa('morada.latitude', 'morada', 'morada.latitude', 'A latitude do mapa não é um número. Só o Renato a pode corrigir.');
    if (!ausente(m.longitude) && !(typeof m.longitude === 'number' && m.longitude >= -180 && m.longitude <= 180)) avisa('morada.longitude', 'morada', 'morada.longitude', 'A longitude do mapa não é um número. Só o Renato a pode corrigir.');
    if (!vazio(m.mapa) && !urlHttps(m.mapa)) avisa('morada.mapa', 'morada', 'morada.mapa', 'O endereço do mapa não é um endereço https://. Só o Renato o pode corrigir.');
  }

  // --- o horário -------------------------------------------------------------------
  if (Array.isArray(d.horario)) {
    if (!d.horario.length) avisa('horario:vazio', 'horario', 'horario', 'O horário está vazio: escreva pelo menos uma linha (ex.: Segunda a sexta — 09:00 – 18:30).');
    if (d.horario.length > TAMANHOS.horario) avisa('horario:quantas', 'horario', 'horario', `O horário tem ${d.horario.length} linhas; o máximo é ${TAMANHOS.horario}.`);
    const base = { ficheiro, ecra: ecraDe('horario') };
    d.horario.forEach((h, i) => {
      /* O gerador lê cada linha sem perguntar (h.dias): uma que não é um
         objecto rebentava-o. */
      if (!eObjecto(h)) { bloqueia(`horario.${i}:forma`, 'horario', `horario.${i}`, `A ${i + 1}.ª linha do horário não tem a forma de uma linha. Só o Renato a pode corrigir.`); return; }
      /* O caminho do campo leva a posição da linha: o painel leva o foco a ela. */
      conferirTexto(out, base, { valor: h.dias, chave: `definicoes:horario.${i}.dias`, campo: `horario.${i}.dias`, rotulo: `Dias (linha ${i + 1})`, max: TAMANHOS.dias, classeVazio: 'avisa' });
      conferirTexto(out, base, { valor: h.horas, chave: `definicoes:horario.${i}.horas`, campo: `horario.${i}.horas`, rotulo: `Horas (linha ${i + 1})`, max: TAMANHOS.horas, classeVazio: 'avisa' });
      /* Os índices dos dias (escondidos) dizem ao site que linha marcar como
         «hoje». */
      if (!ausente(h.indices) && !(typeof h.indices === 'string' && /^[0-6](,[0-6])*$/.test(h.indices))) avisa(`horario.${i}.indices`, 'horario', `horario.${i}.dias`, `Os dias da semana da ${i + 1}.ª linha (em números) não estão certos. Escreva os dias outra vez (ex.: Segunda a sexta), ou fale com o Renato.`);
    });
  }

  // --- os textos do site ---------------------------------------------------------------
  const t = d.textos;
  if (eObjecto(t)) {
    if (texto(t, 'heroi_titulo', 'textos', 'Título grande da capa', TAMANHOS.heroiTitulo, { classeVazio: 'avisa', linha: false, porque: 'é o título da página inicial.' })) {
      const linhas = t.heroi_titulo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (linhas.length > TAMANHOS.heroiLinhas) lembra('textos.heroi_titulo:linhas', 'textos', 'textos.heroi_titulo', `O título tem ${linhas.length} linhas: com mais de ${TAMANHOS.heroiLinhas} enche o ecrã do telemóvel.`);
      else if (linhas.some((l) => l.length > TAMANHOS.heroiLinha)) lembra('textos.heroi_titulo:linha-longa', 'textos', 'textos.heroi_titulo', `Uma linha do título tem mais de ${TAMANHOS.heroiLinha} letras: num telemóvel não cabe numa linha. Duas ou três palavras por linha.`);
    }
    texto(t, 'heroi_sub', 'textos', 'Linha por baixo do título', TAMANHOS.heroiSub, { classeVazio: 'avisa', porque: 'é o que o Google lê para saber do que trata a página.' });
    texto(t, 'sobre', 'textos', 'Texto sobre o estúdio', TAMANHOS.sobre, { linha: false });
  }

  // --- a marca ---------------------------------------------------------------------------
  const mc = d.marca;
  if (eObjecto(mc)) {
    texto(mc, 'reclamo', 'marca', 'Linha pequena acima do título', TAMANHOS.reclamo, { classeVazio: 'avisa', porque: 'aparece no topo da capa.' });
    texto(mc, 'descricao', 'marca', 'Descrição curta', TAMANHOS.descricaoMarca, { classeVazio: 'avisa', linha: false, porque: 'aparece no rodapé de todas as páginas e é o que o Google usa para descrever o negócio.' });
    texto(mc, 'nome', 'marca', 'Nome', TAMANHOS.nomeMarca, { classeVazio: 'avisa', porque: 'aparece no rodapé, nos separadores do browser e no Google.' });
    texto(mc, 'nome_completo', 'marca', 'Nome completo (legal)', TAMANHOS.nomeCompleto, { classeVazio: 'bloqueia', porque: 'é a denominação que a lei obriga na Informação legal (DL 7/2004, art. 10.º)' });
  }

  // --- o Google -----------------------------------------------------------------------------
  const g = d.google;
  if (eObjecto(g)) {
    /* A nota e o número de avaliações escrevem-se no bloco das avaliações: sem
       eles, o site escrevia «undefined». */
    conferirNumero(out, { ficheiro, ecra: ecraDe('google') }, { valor: g.nota, chave: 'definicoes:google.nota', campo: 'google.nota', rotulo: 'Nota', limites: LIMITES.nota, casas: 1, obrigatorio: true,
      mensagem: 'A nota é a média que o perfil do Google mostra: um número de 0 a 5, com uma casa (ex.: 4,9).' });
    conferirNumero(out, { ficheiro, ecra: ecraDe('google') }, { valor: g.total, chave: 'definicoes:google.total', campo: 'google.total', rotulo: 'Número de avaliações', limites: LIMITES.total, obrigatorio: true,
      mensagem: 'O número de avaliações é um número inteiro (ex.: 94).' });
    if (vazio(g.perfil)) avisa('google.perfil', 'google', 'google.perfil', 'Preencha o endereço do perfil: é para lá que vai o botão «Ver todas no Google».');
    else if (!urlHttps(g.perfil)) avisa('google.perfil:formato', 'google', 'google.perfil', 'O endereço do perfil começa por https:// (copie-o da barra do browser, no perfil do Google).');
    if (!vazio(g.incorporar) && !urlHttps(g.incorporar)) avisa('google.incorporar', 'google', 'google.incorporar', 'O endereço do mapa incorporado não é um endereço https://. Só o Renato o pode corrigir.');
  }

  // --- os dados legais -------------------------------------------------------------------------
  const e = d.empresa;
  if (eObjecto(e)) {
    texto(e, 'titular', 'empresa', 'Nome civil completo do titular', TAMANHOS.titular, { classeVazio: 'bloqueia', porque: 'é obrigatório por lei (o nome comercial não chega)' });
    texto(e, 'forma', 'empresa', 'Forma jurídica', TAMANHOS.forma, { classeVazio: 'avisa', porque: 'aparece na Informação legal (ex.: Empresário em Nome Individual).' });
    /* O NIF: a auditoria do site trava a publicação sem os 9 algarismos. O
       algarismo de controlo só avisa (um engano escreve-se; o site sai na
       mesma). */
    if (vazio(e.nif)) bloqueia('empresa.nif', 'empresa', 'empresa.nif', 'Preencha o NIF: é obrigatório por lei, e sem ele o site não é publicado.');
    else if (!/^[0-9]{9}$/.test(algarismosDoNif(e.nif))) bloqueia('empresa.nif', 'empresa', 'empresa.nif', 'O NIF tem 9 algarismos (pode ter espaços, ex.: 316 614 610): sem isso o site não é publicado.');
    else if (!nifValido(e.nif)) avisa('empresa.nif:controlo', 'empresa', 'empresa.nif', 'Este NIF não é válido: o último algarismo não bate certo com os outros. Veja-o num documento das Finanças.');
  }

  // --- a capa (escondida) -------------------------------------------------------------------------
  if (!ausente(d.capa) && !(eObjecto(d.capa) && (ausente(d.capa.fotos) || (Array.isArray(d.capa.fotos) && d.capa.fotos.every((x) => typeof x === 'string'))))) {
    bloqueia('capa:forma', null, 'capa', 'As fotografias da capa não estão gravadas como uma lista, e sem isso o site não se consegue gerar. Só o Renato as pode corrigir.');
  } else if (eObjecto(d.capa) && Array.isArray(d.capa.fotos) && typeof ctx.listarPasta === 'function') {
    /* A auditoria do site confere que cada caminho de data/ existe: uma
       fotografia da capa que já não está na biblioteca travava a publicação. */
    const faltam = d.capa.fotos.filter((c) => c !== '' && !fotografiaExiste(c, ctx.listarPasta, 'obras'));
    if (faltam.length) bloqueia('capa:fotos', null, 'capa', `${faltam.length === 1 ? 'Uma fotografia' : `${faltam.length} fotografias`} da capa já não ${faltam.length === 1 ? 'está' : 'estão'} na biblioteca, e o site não é publicado assim. Só o Renato as pode corrigir.`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Todos                                                               */
/* ------------------------------------------------------------------ */

/* O contexto que liga os ficheiros: os serviços (para o trabalho que não está
   em galeria nenhuma) e os trabalhos (para a galeria de um serviço). Vem de
   `opcoes.contexto` (o painel e o Worker conferem só os ficheiros que mudaram,
   mas dão o resto aqui), ou dos próprios dados. */
function contextoDe(dados, opcoes) {
  const c = eObjecto(opcoes.contexto) ? opcoes.contexto : {};
  const s = tem(dados, 'servicos') ? lerJson(dados.servicos) : tem(c, 'servicos') ? lerJson(c.servicos) : null;
  const servicos = s && eObjecto(s.obj) && Array.isArray(s.obj.servicos) ? s.obj.servicos : null;
  /* Os trabalhos do contexto com os dos dados por cima (um trabalho que esta
     gravação apaga vem a null, e sai). */
  let trabalhos = null;
  if (eObjecto(c.trabalhos) || eObjecto(dados.trabalhos)) {
    const todos = { ...(eObjecto(c.trabalhos) ? c.trabalhos : {}), ...(eObjecto(dados.trabalhos) ? dados.trabalhos : {}) };
    trabalhos = new Map();
    for (const nome of Object.keys(todos)) {
      const l = lerJson(todos[nome]);
      if (eObjecto(l.obj)) trabalhos.set(typeof l.obj.slug === 'string' ? l.obj.slug : slugDoFicheiro(nome), l.obj);
    }
  }
  return { servicos, trabalhos };
}

/* problemas(dados, opcoes)
 *   dados:  ver o cabeçalho;
 *   opcoes: { listarPasta?(pasta) → nomes — o que o gerador vê, para
 *             fotografiaExiste(); contexto?: dados completos para as ligações
 *             entre ficheiros (ver contextoDe) }
 *   → [problema]: as definições, os serviços, os comparadores, as
 *     avaliações, os trabalhos e os produtos, por esta ordem. */
export function problemas(dados = {}, opcoes = {}) {
  const lista = [];
  const d = eObjecto(dados) ? dados : {};
  const ctx = contextoDe(d, opcoes);
  const listarPasta = typeof opcoes.listarPasta === 'function' ? opcoes.listarPasta : null;

  const unico = (chave, ecra, conferir) => {
    if (!tem(d, chave)) return;
    const ficheiro = FICHEIROS[chave];
    const l = lerJson(d[chave]);
    if (l.ausente) { lista.push({ classe: 'bloqueia', chave: `${chave}:ausente`, ficheiro, ecra, mensagem: `Falta o ficheiro ${ficheiro}: sem ele o site não se consegue gerar. Só o Renato o pode repor.` }); return; }
    if (l.ilegivel) { lista.push({ classe: 'bloqueia', chave: `${chave}:ilegivel`, ficheiro, ecra, mensagem: `O ficheiro ${ficheiro} não se consegue ler (JSON inválido: ${l.ilegivel}). Só o Renato o pode corrigir.` }); return; }
    lista.push(...conferir(l.obj));
    const bytes = l.texto !== null ? bytesDe(l.texto) : bytesDe(serializar(l.obj));
    if (bytes > TECTOS.ficheiroBytes * TECTOS.aviso) lista.push({ classe: 'avisa', chave: `${chave}:tecto`, ficheiro, ecra, lembrete: true, mensagem: `Este ficheiro está a chegar ao limite do painel (${Math.round(bytes / 1024)} de ${TECTOS.ficheiroBytes / 1024} KB). Encurte os textos mais compridos.` });
  };
  unico('definicoes', ECRA_ESTUDIO, (o) => problemasDasDefinicoes(o, { listarPasta }));
  unico('servicos', 'Serviços', (o) => problemasDosServicos(o, { listarPasta, trabalhos: ctx.trabalhos }));
  unico('pares', 'Antes e depois', (o) => problemasDosPares(o, { listarPasta }));
  unico('avaliacoes', 'Avaliações', problemasDasAvaliacoes);

  const colecao = (chaveDados, tipo, ecraRaiz, conferir, ficheiroDe) => {
    const mapa = d[chaveDados];
    if (!eObjecto(mapa)) return;
    for (const nome of Object.keys(mapa).sort()) {
      const valor = mapa[nome];
      if (ausente(valor)) continue;
      const slug = slugDoFicheiro(nome);
      const ficheiro = ficheiroDe(nome);
      const ecra = `${ecraRaiz} › ${slug || nome}`;
      const base = { ficheiro, slug };
      if (!slug) { lista.push({ classe: 'bloqueia', chave: `${tipo}:${nome}:sem-nome`, ecra, ...base, mensagem: `O ficheiro ${ficheiro} não tem nome. Só o Renato o pode corrigir.` }); continue; }
      const l = lerJson(valor);
      if (l.ilegivel) { lista.push({ classe: 'bloqueia', chave: `${tipo}:${slug}:ilegivel`, ecra, ...base, mensagem: `O ficheiro deste ${tipo === 'trabalho' ? 'trabalho' : 'produto'} não se consegue ler (JSON inválido: ${l.ilegivel}). Só o Renato o pode corrigir.` }); continue; }
      if (!eObjecto(l.obj)) { lista.push({ classe: 'bloqueia', chave: `${tipo}:${slug}:forma`, ecra, ...base, mensagem: `O ficheiro deste ${tipo === 'trabalho' ? 'trabalho' : 'produto'} não tem a forma certa (sem ela o site não se consegue gerar). Só o Renato o pode corrigir.` }); continue; }
      if (!RE_SLUG.test(slug)) {
        lista.push({ classe: 'avisa', chave: `${tipo}:${slug}:nome-do-ficheiro`, ecra, ...base, mensagem: `O nome do ficheiro («${slug}») não é como os outros (só minúsculas, algarismos e hífenes): o site publica-o na mesma, mas o painel não o consegue gravar. Só o Renato o pode corrigir.` });
      }
      lista.push(...conferir(l.obj, nome));
      const bytes = l.texto !== null ? bytesDe(l.texto) : bytesDe(serializar(l.obj));
      if (bytes > TECTOS.ficheiroBytes * TECTOS.aviso) lista.push({ classe: 'avisa', chave: `${tipo}:${slug}:tecto`, ecra, ...base, lembrete: true, mensagem: `Este ficheiro está a chegar ao limite do painel (${Math.round(bytes / 1024)} de ${TECTOS.ficheiroBytes / 1024} KB).` });
    }
  };
  colecao('trabalhos', 'trabalho', 'Trabalhos', (o, nome) => problemasDoTrabalho(o, { nome, listarPasta, servicos: ctx.servicos }), ficheiroDoTrabalho);
  colecao('loja', 'produto', 'Loja', (o, nome) => problemasDoProduto(o, { nome, listarPasta }), ficheiroDoProduto);
  return lista;
}

/* ------------------------------------------------------------------ */
/* A cópia que o gerador lê                                            */
/* ------------------------------------------------------------------ */

/* neutralizar(dados, lista) → { ficheiros, efeitos, mudou }
 *   Os problemas «neutraliza» aplicados a uma CÓPIA dos dados:
 *     · um trabalho ou um produto que se esconde: publicado false;
 *     · as fotografias de um trabalho que não existem saem da lista (e a lista
 *       que não é uma lista passa a vazia);
 *     · um serviço com uma fotografia que não existe fica só com o nome;
 *     · um comparador sem as duas fotografias sai da lista.
 *   ficheiros: { <caminho>: texto } — SÓ os que mudam, com a terminação que tinham;
 *   efeitos:   o que muda NO SITE, por item:
 *              [{ ficheiro, slug, nome, efeitos: [...], motivos: [...], fotos: [...] }]
 *   mudou:     false → a cópia é o repositório, byte a byte. */
export function neutralizar(dados = {}, lista = []) {
  const d = eObjecto(dados) ? dados : {};
  const porFicheiro = new Map();
  for (const p of Array.isArray(lista) ? lista : []) {
    if (p && p.classe === 'neutraliza' && typeof p.ficheiro === 'string') porFicheiro.set(p.ficheiro, [...(porFicheiro.get(p.ficheiro) || []), p]);
  }
  const ficheiros = {};
  const efeitos = [];

  /* Os trabalhos e os produtos: um ficheiro cada. */
  const colecao = (chaveDados, ficheiroDe, nomeDe) => {
    const mapa = d[chaveDados];
    if (!eObjecto(mapa)) return;
    for (const nome of Object.keys(mapa).sort()) {
      const ficheiro = ficheiroDe(nome);
      const prs = porFicheiro.get(ficheiro);
      if (!prs) continue;
      const l = lerJson(mapa[nome]);
      if (!eObjecto(l.obj)) continue;
      const x = JSON.parse(JSON.stringify(l.obj));
      const estaNoSite = x.publicado !== false;
      const feitos = []; const motivos = []; const fotos = [];
      let mudou = false;
      if (prs.some((p) => p.efeito === 'esconder')) {
        if (estaNoSite) { x.publicado = false; mudou = true; feitos.push('esconder'); }
        motivos.push(...prs.filter((p) => p.efeito === 'esconder').map((p) => p.mensagem));
      }
      if (prs.some((p) => p.tirarFoto) && tem(x, 'foto')) { delete x.foto; mudou = true; }
      if (prs.some((p) => p.efeito === 'sem_fotografia' && p.lista)) { x.fotos = []; mudou = true; }
      const tirar = new Set(prs.filter((p) => p.efeito === 'sem_fotografia' && !p.lista).map((p) => String(p.foto)));
      if (tirar.size && Array.isArray(x.fotos)) {
        const antes = x.fotos.length;
        x.fotos = x.fotos.filter((c) => !tirar.has(String(c)));
        if (x.fotos.length !== antes) mudou = true;
      }
      const semFoto = prs.filter((p) => p.efeito === 'sem_fotografia');
      if (semFoto.length && estaNoSite && !feitos.includes('esconder')) {
        feitos.push('sem_fotografia');
        motivos.push(...semFoto.map((p) => p.mensagem));
        fotos.push(...semFoto.filter((p) => !p.lista).map((p) => p.foto));
      }
      if (mudou) ficheiros[ficheiro] = serializar(x, terminacaoDe(l.texto));
      if (feitos.length) efeitos.push({ ficheiro, slug: slugDoFicheiro(nome), nome: nomeDe(l.obj, slugDoFicheiro(nome)), efeitos: feitos, motivos, fotos });
    }
  };
  colecao('trabalhos', ficheiroDoTrabalho, nomeDoTrabalho);
  colecao('loja', ficheiroDoProduto, nomeDoProduto);

  /* Os serviços: a fotografia que não existe sai do serviço (fica só o nome). */
  const prsServicos = porFicheiro.get(FICHEIROS.servicos);
  if (prsServicos && tem(d, 'servicos')) {
    const l = lerJson(d.servicos);
    if (eObjecto(l.obj) && Array.isArray(l.obj.servicos)) {
      const x = JSON.parse(JSON.stringify(l.obj));
      let mudou = false;
      for (const p of prsServicos) {
        if (p.efeito !== 'sem_fotografia' || !Number.isInteger(p.indice)) continue;
        const s = x.servicos[p.indice];
        if (eObjecto(s) && s.imagem !== '') { s.imagem = ''; mudou = true; efeitos.push({ ficheiro: FICHEIROS.servicos, slug: p.slug, nome: nomeDoServico(l.obj.servicos[p.indice], p.indice), efeitos: ['sem_fotografia'], motivos: [p.mensagem], fotos: [p.foto] }); }
      }
      if (mudou) ficheiros[FICHEIROS.servicos] = serializar(x, terminacaoDe(l.texto));
    }
  }
  /* Os testemunhos: um sem nome no formato certo ou sem texto sai da lista
     (e só se diz que mudou no site se estava autorizado — os outros já lá não
     apareciam). */
  const prsCriticas = porFicheiro.get(FICHEIROS.avaliacoes);
  if (prsCriticas && tem(d, 'avaliacoes')) {
    const l = lerJson(d.avaliacoes);
    if (eObjecto(l.obj) && Array.isArray(l.obj.criticas)) {
      const sair = new Set(prsCriticas.filter((p) => p.efeito === 'esconder' && Number.isInteger(p.indice)).map((p) => p.indice));
      if (sair.size) {
        const x = JSON.parse(JSON.stringify(l.obj));
        x.criticas = x.criticas.filter((_, i) => !sair.has(i));
        ficheiros[FICHEIROS.avaliacoes] = serializar(x, terminacaoDe(l.texto));
        for (const i of [...sair].sort((a, b) => a - b)) {
          if (testemunhoNoSite(l.obj.criticas[i])) efeitos.push({ ficheiro: FICHEIROS.avaliacoes, slug: prsCriticas.find((p) => p.indice === i)?.slug, nome: nomeDaCritica(l.obj.criticas[i], i), efeitos: ['esconder'], motivos: prsCriticas.filter((p) => p.indice === i).map((p) => p.mensagem), fotos: [] });
        }
      }
    }
  }
  /* Os comparadores: um sem as duas fotografias sai da lista. */
  const prsPares = porFicheiro.get(FICHEIROS.pares);
  if (prsPares && tem(d, 'pares')) {
    const l = lerJson(d.pares);
    const lp = listaDePares(l.obj);
    if (lp) {
      const sair = new Set(prsPares.filter((p) => p.efeito === 'esconder' && Number.isInteger(p.indice)).map((p) => p.indice));
      if (sair.size) {
        const ficam = lp.filter((_, i) => !sair.has(i));
        const x = Array.isArray(l.obj) ? ficam : { ...JSON.parse(JSON.stringify(l.obj)), pares: JSON.parse(JSON.stringify(ficam)) };
        ficheiros[FICHEIROS.pares] = serializar(x, terminacaoDe(l.texto));
        for (const i of [...sair].sort((a, b) => a - b)) efeitos.push({ ficheiro: FICHEIROS.pares, slug: prsPares.find((p) => p.indice === i)?.slug, nome: nomeDoPar(lp[i], i), efeitos: ['esconder'], motivos: prsPares.filter((p) => p.indice === i).map((p) => p.mensagem), fotos: [] });
      }
    }
  }
  return { ficheiros, efeitos, mudou: Object.keys(ficheiros).length > 0 };
}

const DESCRICAO_EFEITOS = { esconder: 'escondido do site', sem_fotografia: 'com fotografias que não aparecem' };
export const descreverEfeitos = (e) => e.efeitos.map((x) => (x === 'sem_fotografia' && e.fotos.length
  ? `${e.fotos.length} fotografia${e.fotos.length === 1 ? '' : 's'} que não aparece${e.fotos.length === 1 ? '' : 'm'}`
  : DESCRICAO_EFEITOS[x] || x)).join(' e ');

/* ------------------------------------------------------------------ */
/* O que o painel não pode mudar ao gravar                             */
/* ------------------------------------------------------------------ */

const obter = (o, caminho) => caminho.split('.').reduce((x, k) => (eObjecto(x) ? x[k] : undefined), o);

/* mudancasBloqueadas(antes, depois, qual) → [{ caminho, motivo }] ([] = pode gravar)
 *   qual = 'definicoes': os campos escondidos não mudam (BLOQUEADOS_DEFINICOES),
 *          e uma chave de topo nova só pode ser uma das SECCOES_DEFINICOES;
 *   qual = 'trabalho' | 'produto': as chaves que o formulário não conhece não
 *          mudam (nem aparecem, nem desaparecem), e o identificador também não;
 *   qual = 'servicos' | 'pares' | 'avaliacoes': o resto do ficheiro (fora da
 *          lista) não muda, e em cada item com identificador as chaves que o
 *          formulário não conhece também não. */
export function mudancasBloqueadas(antes, depois, qual = 'definicoes') {
  const a = eObjecto(antes) ? antes : {};
  const d = eObjecto(depois) ? depois : {};
  const out = [];
  const fixas = (campos, prefixo = '') => (x, y) => {
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (campos.includes(k) || mesmoValor(x[k], y[k])) continue;
      out.push({ caminho: `${prefixo}${k}`, motivo: tem(x, k) ? 'mudou' : 'chave_nova' });
    }
  };
  if (qual === 'trabalho' || qual === 'produto') {
    fixas(qual === 'trabalho' ? CAMPOS_TRABALHO : CAMPOS_PRODUTO)(a, d);
    if (tem(a, 'slug') && !mesmoValor(a.slug, d.slug)) out.push({ caminho: 'slug', motivo: 'mudou' });
    return out;
  }
  if (qual === 'servicos' || qual === 'pares' || qual === 'avaliacoes') {
    const chaveLista = { servicos: 'servicos', pares: 'pares', avaliacoes: 'criticas' }[qual];
    const campos = { servicos: CAMPOS_SERVICO, pares: CAMPOS_PAR, avaliacoes: CAMPOS_CRITICA }[qual];
    /* Um ficheiro de pares que é a lista solta (a forma antiga) compara-se como
       lista; mudar a forma do ficheiro (lista ↔ objecto) não é coisa do painel. */
    if (Array.isArray(antes) !== Array.isArray(depois)) out.push({ caminho: chaveLista, motivo: 'forma' });
    else if (!Array.isArray(depois)) fixas([chaveLista])(a, d);
    const la = Array.isArray(antes) ? antes : (Array.isArray(a[chaveLista]) ? a[chaveLista] : []);
    const ld = Array.isArray(depois) ? depois : (Array.isArray(d[chaveLista]) ? d[chaveLista] : []);
    if (qual !== 'avaliacoes') {
      const porSlug = new Map(la.filter((x) => eObjecto(x) && typeof x.slug === 'string').map((x) => [x.slug, x]));
      ld.forEach((x, i) => {
        if (!eObjecto(x) || typeof x.slug !== 'string' || !porSlug.has(x.slug)) return;
        fixas(campos, `${chaveLista}.${i}.`)(porSlug.get(x.slug), x);
      });
    }
    return out;
  }
  for (const caminho of BLOQUEADOS_DEFINICOES) {
    if (!mesmoValor(obter(a, caminho), obter(d, caminho))) out.push({ caminho, motivo: 'mudou' });
  }
  for (const k of Object.keys(d)) {
    if (tem(a, k) || tem(SECCOES_DEFINICOES, k) || out.some((x) => x.caminho === k)) continue;
    out.push({ caminho: k, motivo: 'chave_nova' });
  }
  /* AS LINHAS DO HORÁRIO podem entrar, sair e mudar de lugar. Os dias da
     semana em números (`indices`, escondidos no .pages.yml) também mudam: o
     painel escreve-os a partir dos dias («Segunda a sexta» → 1,2,3,4,5), para o
     site marcar a linha de hoje (sem eles, o site.js marcava-a aos domingos).
     Uns números estragados são um aviso das regras (problemasDasDefinicoes). */
  if (Array.isArray(d.horario)) {
    d.horario.forEach((h, i) => {
      if (eObjecto(h)) for (const k of Object.keys(h)) if (!CAMPOS_HORARIO.includes(k)) out.push({ caminho: `horario.${i}.${k}`, motivo: 'chave_nova' });
    });
  }
  return out;
}

/* A ORDEM DAS CHAVES AO GRAVAR: as que já estavam no ficheiro ficam onde
   estavam; uma nova entra antes da primeira que, na ordem do ficheiro, vem
   depois dela (e no fim, se nenhuma vier); as que a ordem não conhece vão
   para o fim. As que saíram, saem. */
export function ordenarComo(antes, depois, ordem = CAMPOS_TRABALHO) {
  if (!eObjecto(depois)) return depois;
  const a = eObjecto(antes) ? antes : {};
  const chaves = Object.keys(a).filter((k) => tem(depois, k));
  const novas = Object.keys(depois).filter((k) => !chaves.includes(k));
  for (const k of novas.filter((x) => ordem.includes(x))) {
    const i = ordem.indexOf(k);
    const j = chaves.findIndex((x) => ordem.includes(x) && ordem.indexOf(x) > i);
    if (j < 0) chaves.push(k); else chaves.splice(j, 0, k);
  }
  chaves.push(...novas.filter((x) => !ordem.includes(x)));
  const out = {};
  for (const k of chaves) out[k] = depois[k];
  return out;
}
