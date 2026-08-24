# Perfect Finish Studio

Site do **Perfect Finish Studio** — estúdio de customização automóvel em
Leiria: tira mossas sem pintura, películas solares, PPF, envelopamento e car
detail.

- **Site:** <https://renatovalente5.github.io/PerfectFinish/>
- **Backoffice:** <https://app.pagescms.org/renatovalente5/PerfectFinish>
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

O cliente grava no backoffice → o Pages CMS escreve em `data/` → o GitHub
Actions corre o gerador e a auditoria → o site é publicado. Um a três minutos.

## Comandos

```bash
node scripts/gerar.mjs      # gera _site/
node scripts/auditar.mjs    # trava a publicação se algo estiver mal
```

Ver em local:

```bash
python3 -m http.server 8813 --directory _dev
```

`_dev/PerfectFinish` é um atalho para `_site`. Existe porque o site é gerado
para a subpasta `/PerfectFinish` (é onde vive no GitHub Pages) e assim os
caminhos absolutos batem certo em local e em produção. Abrir
<http://localhost:8813/PerfectFinish/>.

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

**O prefixo `/PerfectFinish`.** Sem CNAME, o site vive numa subpasta e todos os
caminhos absolutos têm de a incluir. O gerador trata disso e a auditoria
verifica. Se um dia houver domínio próprio, basta criar o ficheiro `CNAME` na
raiz — o gerador detecta e passa a gerar para a raiz do domínio.

**Sem `npm install`.** O gerador é Node puro e o GitHub Actions não instala
nada. É de propósito: é o que faz isto continuar a publicar daqui a dois anos.

**O `.pages.yml` falha em silêncio.** O Pages CMS valida o ficheiro com Zod
**apenas no editor de configuração**; o caminho de execução (`config-store.ts`)
não chama essa validação. Um tipo de campo inventado ou um campo esquecido
carrega meio a funcionar, sem erro nenhum — e o cliente não tem como perceber.
Por isso `scripts/auditar.mjs` verifica duas coisas e trava a publicação:
todos os `type:` existem mesmo, e todo o campo presente em `data/` é editável
no backoffice.

Para uma validação completa contra o schema verdadeiro (feita a 23-08-2026
contra a versão 2.1.8, resultado **válido**):

```bash
git clone --depth 1 https://github.com/hunvreus/pagescms.git /tmp/pagescms
mkdir /tmp/valida && cd /tmp/valida && npm init -y && npm install zod@3.25.76 js-yaml
cp /tmp/pagescms/lib/config-schema.ts .
sed -i '' 's|from "@/fields/registry"|from "./registry.ts"|' config-schema.ts
ls /tmp/pagescms/fields/core | node -e 'let t=[];process.stdin.on("data",d=>t.push(d)).on("end",()=>require("fs").writeFileSync("registry.ts",`export const fieldTypes = new Set(${JSON.stringify(t.join("").trim().split("\n"))});`))'
# depois: um script que faça ConfigSchema.safeParse(yaml.load(...))
```

---

## Primeiro acesso ao backoffice

O <https://app.pagescms.org> pede uma autorização do GitHub (OAuth) na
primeira entrada. **Só o dono da conta a pode dar** — não é algo que se faça
por ele. Passos:

1. Entrar em <https://app.pagescms.org> e escolher «Sign in with GitHub».
2. Autorizar o acesso ao repositório `PerfectFinish` (só a esse).
3. Abrir <https://app.pagescms.org/renatovalente5/PerfectFinish>.

Depois disso o cliente pode ser convidado como colaborador e passa a entrar
com o email dele.

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
