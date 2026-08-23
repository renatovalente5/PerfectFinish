# Avaliações do Google em directo

O site mostra sempre a classificação e o número de avaliações. Por omissão,
mostra os valores escritos em `data/definicoes.json`, que alguém tem de
actualizar de vez em quando no backoffice.

Esta pasta tem o que é preciso para os passar a **buscar ao Google a cada
visita**. São 15 minutos de configuração e fica a custo zero.

---

## Porquê um Worker e não uma chamada directa

Três razões, todas obrigatórias:

1. **A chave da API não pode ir no site.** Qualquer pessoa a veria no código
   da página e podia gastá-la. O Worker guarda-a do lado do servidor.
2. **Os termos da Google proíbem guardar avaliações.** O contrato do Google
   Maps Platform proíbe expressamente «copy and save business names,
   addresses, or user reviews», e tem uma cláusula de «No Caching». Por isso o
   Worker **não guarda nada** — vai buscar, entrega, esquece. Guardar as
   avaliações num ficheiro do repositório (que é público) seria a violação
   mais clara possível, e ficaria para sempre no histórico do Git.
3. **As fotografias dos autores.** O Google exige que sejam mostradas, mas
   apontar directamente para `googleusercontent.com` envia o endereço IP de
   cada visitante para os Estados Unidos sem consentimento. O Worker vai
   buscá-las e reenvia-as, sem guardar — assim o visitante só fala com o nosso
   domínio.

---

## Passos

### 1. Google Cloud

1. <https://console.cloud.google.com> → criar projecto.
2. Activar a **Places API (New)**. (A antiga não serve.)
3. **Credenciais** → criar chave de API.
4. Na chave, em «Restrições de API», escolher **apenas** Places API (New).
5. **IAM e administração › Quotas** → limitar «Places API (New) — Requests per
   day» a, por exemplo, **200**. Isto é um travão de segurança: não existe
   limite por tipo de chamada, só por API, portanto é aqui que se impede uma
   conta descontrolada.

Custo real esperado: **0 €**. Cada visita que chega ao bloco das avaliações
gasta uma chamada «Place Details Enterprise + Atmosphere», e há 1000 grátis
por mês. O pedido só é feito quando o bloco entra no ecrã, não em cada
carregamento de página.

### 2. Descobrir o Place ID

<https://developers.google.com/maps/documentation/places/web-service/place-id>
→ procurar «Perfect Finish Leiria» → copiar o identificador que começa por
`ChIJ`.

O perfil corresponde ao CID `16767504117327010045`
(`https://www.google.com/maps?cid=16767504117327010045`).

**Antes de avançar, leia as cinco avaliações que a API devolve.** A Places API
devolve no máximo **5**, ordenadas por relevância, e **não há forma** de pedir
as mais recentes nem de excluir nenhuma. Se alguma das cinco não servir,
não vale a pena ligar isto — fica-se pela classificação, que é o que já está.

### 3. Publicar o Worker

```bash
npm install -g wrangler
cd worker
wrangler login
wrangler secret put GOOGLE_API_KEY      # cola a chave quando pedir
wrangler secret put PLACE_ID            # cola o ChIJ...
wrangler deploy
```

O `wrangler deploy` devolve um endereço tipo
`https://perfectfinish-avaliacoes.<conta>.workers.dev`.

### 4. Ligar no site

No backoffice, em **Dados do estúdio › Google e avaliações › Endereço das
avaliações em directo**, colar:

```
https://perfectfinish-avaliacoes.<conta>.workers.dev/avaliacoes
```

Gravar. A partir daí a classificação e o número de avaliações passam a vir do
Google em cada visita.

---

## O que fica por fazer se quiser mostrar o TEXTO das avaliações

O Worker já devolve os textos. Falta o lado do site, e há regras a cumprir:

- **Logótipo «Google Maps»** junto ao bloco, com a arte oficial, altura entre
  16 e 19 px, e o espaço livre à volta que a Google exige.
- **Nome e fotografia do autor** em cada avaliação, e ligação para a avaliação
  no Google.
- **Dizer como estão ordenadas** («ordenadas por relevância, segundo o
  Google»). É obrigatório, não é uma cortesia.
- **Separar visualmente** o que vem do Google do que é nosso.
- **Não pôr um mapa ao lado.** Os termos para o Espaço Económico Europeu
  (§15.1, em vigor desde 8 de Julho de 2025) proíbem usar conteúdo da Places
  API junto de um mapa. Por isso, neste site, as avaliações ficam na página
  inicial e o mapa fica só nos Contactos.
- **Política de privacidade**: indicar a Google como origem, o interesse
  legítimo como fundamento (art. 6.º, n.º 1, al. f) do RGPD), o direito de
  oposição, e a Cloudflare como subcontratante.

## Alternativa, se a Google recusar

Pedir acesso à **Business Profile API** (Application For Basic API Access). É
gratuita, devolve **todas** as avaliações, deixa ordenar por data e permite
guardar em cache até 30 dias por escrito. A quota começa em zero e a aprovação
é lenta, mas não há desvantagem em pedir em paralelo — se for aprovada, muda-se
só a origem dos dados dentro do Worker.
