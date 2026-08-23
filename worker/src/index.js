/**
 * Avaliações do Google para o site do Perfect Finish Studio.
 *
 * Dois caminhos:
 *   GET /avaliacoes        → classificação, número de avaliações e as (até) 5
 *                            avaliações que a Places API devolve
 *   GET /foto?u=<endereço> → reenvia a fotografia do autor
 *
 * Regra que atravessa tudo: NÃO SE GUARDA NADA. Sem KV, sem Cache API, sem
 * `cf.cacheTtl`. Os termos do Google Maps Platform proíbem copiar e guardar
 * avaliações, e a Google não publica nenhuma janela de cache permitida para
 * este conteúdo. Vai-se buscar, entrega-se, esquece-se.
 *
 * A fotografia do autor é reenviada por aqui, e não apontada directamente,
 * porque um `<img src="https://lh3.googleusercontent.com/...">` manda o
 * endereço IP de cada visitante para os Estados Unidos antes de ele carregar
 * em coisa nenhuma. Assim o visitante só fala com este Worker.
 */

const ORIGENS = [
  "https://renatovalente5.github.io",
  "http://localhost:8813",
];

const cabecalhos = (origem) => ({
  "access-control-allow-origin": ORIGENS.includes(origem) ? origem : ORIGENS[0],
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
});

export default {
  async fetch(pedido, ambiente) {
    const url = new URL(pedido.url);
    const origem = pedido.headers.get("origin") || "";

    if (pedido.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          ...cabecalhos(origem),
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-max-age": "86400",
        },
      });
    }
    if (pedido.method !== "GET") {
      return new Response("Método não permitido", { status: 405 });
    }

    if (url.pathname === "/foto") return fotografia(url, origem);
    if (url.pathname !== "/avaliacoes") {
      return new Response(JSON.stringify({ erro: "caminho desconhecido" }), {
        status: 404, headers: cabecalhos(origem),
      });
    }

    if (!ambiente.GOOGLE_API_KEY || !ambiente.PLACE_ID) {
      return new Response(
        JSON.stringify({ erro: "faltam GOOGLE_API_KEY e/ou PLACE_ID" }),
        { status: 500, headers: cabecalhos(origem) }
      );
    }

    try {
      const resposta = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(ambiente.PLACE_ID)}?languageCode=pt-PT`,
        {
          headers: {
            "X-Goog-Api-Key": ambiente.GOOGLE_API_KEY,
            // Só os campos que se usam: a facturação da Places API depende da
            // máscara, e pedir de mais custa dinheiro sem servir para nada.
            // NÃO pedir `reviewSummary`: os resumos não existem para Portugal.
            "X-Goog-FieldMask":
              "id,displayName,rating,userRatingCount,googleMapsUri,reviews",
          },
        }
      );

      if (!resposta.ok) {
        return new Response(
          JSON.stringify({ erro: "a Google recusou o pedido", estado: resposta.status }),
          { status: 502, headers: cabecalhos(origem) }
        );
      }

      const dados = await resposta.json();
      const base = `${url.origin}/foto?u=`;

      return new Response(JSON.stringify({
        rating: dados.rating ?? null,
        userRatingCount: dados.userRatingCount ?? null,
        googleMapsUri: dados.googleMapsUri ?? null,
        // A Places API devolve no máximo 5, ordenadas por relevância, e não
        // aceita nenhum parâmetro de ordenação nem de paginação.
        ordenacao: "relevancia",
        reviews: (dados.reviews || []).map((r) => ({
          texto: r.originalText?.text || r.text?.text || "",
          idioma: r.originalText?.languageCode || r.text?.languageCode || "",
          estrelas: r.rating,
          quando: r.relativePublishTimeDescription || "",
          autor: r.authorAttribution?.displayName || "",
          autorUri: r.authorAttribution?.uri || "",
          // A fotografia passa por aqui, para não expor o IP do visitante.
          foto: r.authorAttribution?.photoUri
            ? base + encodeURIComponent(r.authorAttribution.photoUri)
            : "",
          uri: r.googleMapsUri || "",
        })),
      }), { headers: cabecalhos(origem) });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: String(erro) }), {
        status: 502, headers: cabecalhos(origem),
      });
    }
  },
};

/** Reenvia a fotografia do autor. Valida o domínio e não guarda nada. */
async function fotografia(url, origem) {
  const alvo = url.searchParams.get("u");
  if (!alvo) return new Response("falta u", { status: 400 });

  let destino;
  try {
    destino = new URL(alvo);
  } catch {
    return new Response("endereço inválido", { status: 400 });
  }
  // Sem esta verificação o Worker era um proxy aberto para a internet toda.
  const permitido = destino.protocol === "https:" &&
    /(^|\.)googleusercontent\.com$/.test(destino.hostname);
  if (!permitido) return new Response("domínio não permitido", { status: 403 });

  const imagem = await fetch(destino.toString());
  if (!imagem.ok) return new Response("não encontrada", { status: 404 });

  return new Response(imagem.body, {
    headers: {
      "content-type": imagem.headers.get("content-type") || "image/jpeg",
      "cache-control": "no-store",
      "access-control-allow-origin": ORIGENS.includes(origem) ? origem : ORIGENS[0],
    },
  });
}
