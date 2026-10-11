# Perfect Finish Studio

Site do **Perfect Finish Studio** — estúdio de customização automóvel em
Leiria: tira mossas sem pintura, películas solares, PPF, envelopamento e car
detail.

- **Site:** <https://renatovalente5.github.io/PerfectFinish/>
- **Backoffice:** <https://backoffice.perfectfinishstudio.pt> — o painel próprio do site
  (repositório privado `perfectfinish-painel`), que substituiu o Pages CMS
- **Plano e decisões:** [`PLANO.md`](PLANO.md)

---

## Como funciona

Site estático. Sem servidor, sem base de dados, sem dependências.

```
data/          o conteúdo, em JSON — é isto que o backoffice edita
  definicoes.json      contactos, morada, horário, textos, dados legais
  servicos/*.json      as 5 páginas de serviço
  trabalhos/*.json     o portefólio
  loja/*.json          os produtos
  pares.json           os comparadores antes/depois
assets/        CSS, JS, tipos de letra e imagens já tratadas
scripts/       o gerador e as ferramentas
_fonte/        material de origem (logótipo, fotografias originais)
worker/        o Cloudflare Worker das avaliações em directo (opcional)
_site/         resultado da geração — não é versionado
```

O cliente grava no painel → o painel confere as regras e faz um commit em
`data/` (e as fotografias em `assets/img/`) → o GitHub Actions corre a guarda,
o gerador e a auditoria → o site é publicado. Um a três minutos.

## Comandos

```bash
node scripts/gerar.mjs      # gera _site/
node scripts/auditar.mjs    # trava a publicação se algo estiver mal
node scripts/test-site.mjs  # a bateria do gerador, do site.js e da auditoria (em local)
```

Ver em local:

```bash
python3 -m http.server 8813 --directory _site
```

Abrir <http://localhost:8813/>. Serve-se `_site` na RAIZ porque é aí que o site
vive desde que existe o domínio próprio: com CNAME os caminhos absolutos deixam
de ter o prefixo `/PerfectFinish`, e um servidor local que sirva numa subpasta
mostra o site sem imagens nem JavaScript — o que faz parecer que a alteração que
se acabou de fazer está estragada, quando o que está errado é a montagem local.

(A montagem antiga era `_dev/PerfectFinish` como atalho para `_site`. Existia porque o site era gerado
para a subpasta `/PerfectFinish`, que é onde vivia no github.io. Já não é o caso.)

## Ferramentas (correr só quando a origem muda)

```bash
python3 scripts/logotipo.py    # extrai o logótipo vectorial de _fonte/logo.pdf
python3 scripts/favicons.py    # favicon e imagem social, a partir do mesmo PDF
python3 scripts/imagens.py     # trata as fotografias e tapa matrículas e rostos
python3 scripts/produtos.py    # desenha as embalagens da loja
```

Precisam de `poppler` (`brew install poppler`) e de Pillow.

---

## Coisas que é preciso saber antes de mexer

**As fotografias têm 414×414 px.** São as miniaturas do Instagram e do
Facebook, não os originais. Por isso não há herói de largura total com
fotografia e a grelha é toda quadrada, servida no máximo a 828 px. Quando
houver originais: substituir `_fonte/originais/`, actualizar
`_fonte/fotografias.json` e correr `scripts/imagens.py`.

**As matrículas e os rostos são tapados no ficheiro**, por
`scripts/imagens.py`, a partir das zonas em `_fonte/rgpd.json`. Não é CSS: um
desfoque por CSS continua a servir a fotografia original a quem abrir o
endereço da imagem. Fotografias novas precisam de nova passagem.

**Não se copiam avaliações do Google para o repositório.** Os termos do Google
Maps Platform proíbem-no («copy and save … user reviews»), e num repositório
público ficaria para sempre no histórico. Ver [`worker/README.md`](worker/README.md).
O que o site mostra são **testemunhos de clientes** (`data/avaliacoes.json`),
publicados com a autorização de cada um: só aparecem os que têm
`autorizado: true`, com o nome próprio (um ou dois nomes) e a inicial do apelido
(«Nelson P.», «Ana Rita M.»: a guarda confere o formato), o texto, e as estrelas e a nota de tradução se as
tiverem — sem data. Sem nenhum autorizado, a secção mostra só o cartão da nota
do Google. A política de privacidade diz o fundamento (o consentimento) e como
se pede a retirada. **Só se guarda o que o cliente autorizou**: este repositório
é público, e o que está em `data/` lê-se no GitHub, apareça ou não no site. O
painel não grava um testemunho sem a autorização; um que chegue por outro
caminho (o Pages CMS) não aparece, e a guarda avisa. As três avaliações que
estavam copiadas do Google, por autorizar, saíram do ficheiro (11 out 2026): a
lista está vazia, e cada uma volta, a partir do histórico, quando o cliente a
autorizar.

**O prefixo `/PerfectFinish`.** Sem CNAME, o site vive numa subpasta e todos os
caminhos absolutos têm de a incluir. O gerador trata disso e a auditoria
verifica. Se um dia houver domínio próprio, basta criar o ficheiro `CNAME` na
raiz — o gerador detecta e passa a gerar para a raiz do domínio.

**Sem `npm install`.** O gerador é Node puro e o GitHub Actions não instala
nada. É de propósito: é o que faz isto continuar a publicar daqui a dois anos.

**A guarda do conteúdo.** Antes de gerar, o CI corre `.github/guardas.mjs`
com as regras de `.github/regras.mjs` — as mesmas que o painel
(`backoffice.perfectfinishstudio.pt`) confere ao gravar; o painel tem uma cópia
byte a byte em `estatico/js/regras.js`. Pára só no que partia o site ou a lei
(a estrutura dos ficheiros, o nome civil do titular, a denominação, o NIF, a
morada, o e-mail, o telefone e o WhatsApp de todas as páginas); um trabalho ou
um produto com problemas sai do site só na cópia que o gerador lê, e uma
fotografia que já não existe sai da lista. A prova é `node
.github/test-guardas.mjs` (em local; não corre no CI): re-joga os commits de
`data/`, apaga cada chave de cada ficheiro, e publica de ponta a ponta mais de
cem casos estragados de propósito. Quando se mudam as regras, copiam-se para o
painel (`cp .github/regras.mjs ../perfectfinish-painel/estatico/js/regras.js`).

**O `.pages.yml` falha em silêncio** (enquanto existir: sai do repositório
depois de o painel estar no ar, e a auditoria deixa de o conferir). O Pages CMS
valida o ficheiro com Zod
**apenas no editor de configuração**; o caminho de execução (`config-store.ts`)
não chama essa validação. Um tipo de campo inventado ou um campo esquecido
carrega meio a funcionar, sem erro nenhum — e o cliente não tem como perceber.
Por isso `scripts/auditar.mjs` verifica duas coisas e trava a publicação:
todos os `type:` existem mesmo, e todo o campo presente em `data/` é editável
no backoffice.

Para uma validação completa contra o schema verdadeiro (última feita a
24-08-2026, resultado **válido**):

```bash
git clone --depth 1 https://github.com/hunvreus/pagescms.git /tmp/pagescms
mkdir /tmp/valida && cd /tmp/valida && npm init -y && npm install zod@3.25.76 js-yaml
cp /tmp/pagescms/lib/config-schema.ts .
sed -i '' 's|from "@/fields/registry"|from "./registry.ts"|' config-schema.ts
ls /tmp/pagescms/fields/core | node -e 'let t=[];process.stdin.on("data",d=>t.push(d)).on("end",()=>require("fs").writeFileSync("registry.ts",`export const fieldTypes = new Set(${JSON.stringify(t.join("").trim().split("\n"))});`))'
# depois: um script que faça ConfigSchema.safeParse(yaml.load(...))
```

---

## O que o cliente vê no backoffice

Seis entradas, pela ordem do menu do painel (que tem ainda o Início, a
Publicação, a Ajuda e a Conta):

| | O que é | Onde aparece no site |
|---|---|---|
| **Trabalhos** | Um carro e as suas fotografias | As galerias que abrem nos azulejos dos serviços |
| **Antes e depois** | Os comparadores | Secção «Antes e depois» — os dois primeiros à vista |
| **Serviços** | Os treze serviços | Com fotografia = azulejo; sem = nome na lista |
| **Avaliações** | A nota do Google e os testemunhos de clientes | Secção de avaliações (os testemunhos só com a autorização do cliente) |
| **Loja** | Os produtos | Página da Loja |
| **Dados do estúdio** | Contactos, morada, horário, textos, dados legais | Todo o site |

**Os campos técnicos não aparecem no painel**: coordenadas, endereços de mapa,
o servidor das avaliações em directo, as peças do mosaico da capa. Continuam no
ficheiro e editam-se aqui — um campo que não se deve mexer, à vista, é um
convite a mexer. Os dias da semana em números (`indices`, para o site marcar a
linha de hoje) também não se vêem: o painel escreve-os a partir dos dias
(«Segunda a sexta» → `1,2,3,4,5`).

**As cinco páginas de serviço saíram de `data/`** para
`_fonte/servicos-desligados/`. Estão desligadas (`PAGINAS_DE_SERVICO = false`) e
eram 12 campos por serviço dos quais o site usava dois: o cliente podia escrever
uma FAQ inteira e nada aparecia. Se voltarem a ser ligadas, mover a pasta de
volta para `data/servicos` e declarar os campos outra vez.

## Entrar no backoffice

Em <https://backoffice.perfectfinishstudio.pt> entra-se com o email: o painel
manda um código de 8 algarismos (de `painel@perfectfinishstudio.pt`), sem
palavra-passe e sem conta no GitHub. Só entram os emails da lista do painel
(`ADMINS`, no repositório do painel). As gravações chegam ao repositório pela
GitHub App do painel, como commits «Painel: …». O ecrã «Ajuda» do painel diz o
que fazer em cada caso, e a quem ligar numa avaria.

## Por preencher (depende do cliente)

A auditoria assinala-os como aviso e não travam a publicação. **A 24-08-2026 os
dois obrigatórios por lei estão preenchidos** — o e-mail e o nome civil do
titular (Welington de Oliveira Galhardo, Empresário em Nome Individual) — e a
auditoria passa a zero erros e zero avisos.

1. **A ficha do Google do novo endereço.** O mapa e a ligação da morada são
   feitos por COORDENADAS, e não pela ficha do sítio: o endereço que o cliente
   mandou é da ficha de outra empresa («Varzea Do Lis — Actividades Hoteleiras,
   Lda.») e o mapa mostraria esse nome. Quando o cliente actualizar a morada no
   Google Business Profile dele, trocar `morada.mapa` e `google.incorporar` pela
   ficha própria — aí o mapa passa a mostrar «Perfect Finish Studio».
2. **O número da morada.** O cliente escreveu «Estr. Nacional 242 113». Ficou
   como «n.º 113», que é a leitura mais provável (é a forma como o Google
   formata moradas, e um código postal de cidade não combina com um marco
   quilométrico). Confirmar que não é «km 113».
3. **Preços da loja.** Estão todos como «Sob consulta». Os produtos foram
   propostos por nós; confirmar quais existem mesmo e a que preço (por lei,
   preço final com IVA).
4. **Fotografias em falta:** interiores (não existe nenhuma em todo o acervo) e
   tira mossas (as que há não aguentam publicação, e é o serviço que dá nome à
   casa). Um close-up com tábua de leitura, antes e depois, no mesmo
   enquadramento, resolvia.
5. **Telefone.** Um roll-up numa das fotografias lê `968 828 910`; em todo o
   resto lê-se `968 828 510`. Confirmar qual está errado.
