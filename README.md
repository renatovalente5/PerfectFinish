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

---

## Por preencher (depende do cliente)

Estão assinalados como aviso pela auditoria, e não travam a publicação:

1. **E-mail.** Obrigatório pelo artigo 10.º do Decreto-Lei n.º 7/2004. O
   WhatsApp não substitui. Preencher em *Dados do estúdio › Contactos*.
2. **Nome civil completo do titular.** Também exigido pelo mesmo artigo — o
   nome comercial não chega. Preencher em *Dados do estúdio › Dados legais*.
3. **Código postal.** O `2420-125` foi tirado do perfil do Google do próprio
   cliente, mas os registos dos CTT associam esse código a Pereiras,
   Caranguejeira. Confirmar nos CTT antes de o fixar no Google Business
   Profile e nos dados estruturados.
4. **Preços da loja.** Estão todos como «Sob consulta». Os produtos foram
   propostos por nós; confirmar quais existem mesmo e a que preço (por lei,
   preço final com IVA).
5. **Fotografias em falta:** interiores (não existe nenhuma em todo o acervo) e
   tira mossas (as que há não aguentam publicação, e é o serviço que dá nome à
   casa). Um close-up com tábua de leitura, antes e depois, no mesmo
   enquadramento, resolvia.
6. **Telefone.** Um roll-up numa das fotografias lê `968 828 910`; em todo o
   resto lê-se `968 828 510`. Confirmar qual está errado.
