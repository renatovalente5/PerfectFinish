/* =========================================================================
   PERFECT FINISH STUDIO — comportamento
   Sem bibliotecas. Cada bloco é independente: se um falhar, os outros
   continuam, e a página continua a funcionar sem nenhum deles.
   ========================================================================= */
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------------------------------------- cabeçalho que encolhe */
  /* Pedido explícito: logótipo grande no topo, mais pequeno ao descer, e
     grande outra vez ao voltar ao topo.
     Feito com uma classe e uma transição de CSS, e não com uma animação
     ligada ao scroll: isto é uma mudança de estado (grande/pequeno), não uma
     interpolação contínua, e assim funciona em todos os motores — as
     animações ligadas ao scroll ainda não existem no Firefox.
     As duas fasquias diferentes (desce aos 60, sobe aos 30) evitam que o
     cabeçalho fique a saltar entre os dois estados quando alguém pára a
     rolar mesmo em cima do limite. */
  const cabecalho = $(".cabecalho");
  if (cabecalho) {
    const DESCER = 60, SUBIR = 30;
    let encolhido = false, agendado = false;

    const avaliar = () => {
      agendado = false;
      const y = window.scrollY;
      if (!encolhido && y > DESCER) { encolhido = true; cabecalho.dataset.encolhido = "sim"; }
      else if (encolhido && y < SUBIR) { encolhido = false; cabecalho.dataset.encolhido = "nao"; }
    };
    const aoRolar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(avaliar);
    };
    addEventListener("scroll", aoRolar, { passive: true });
    avaliar(); // já pode vir a meio da página, num recarregamento
  }

  /* --------------------------------------------------------- menu móvel */
  /* Ocupa o ecrã todo, como foi pedido. Fecha com Esc, ao tocar numa
     ligação, e ao passar para desktop. */
  const botaoMenu = $(".menu-botao");
  const menu = $(".menu");
  if (botaoMenu && menu) {
    const abrir = (sim) => {
      botaoMenu.setAttribute("aria-expanded", String(sim));
      menu.dataset.aberto = sim ? "sim" : "nao";
      document.body.dataset.menu = sim ? "aberto" : "fechado";
      botaoMenu.setAttribute("aria-label", sim ? "Fechar menu" : "Abrir menu");
      if (sim) $(".menu__lista a", menu)?.focus({ preventScroll: true });
    };

    botaoMenu.addEventListener("click", () =>
      abrir(botaoMenu.getAttribute("aria-expanded") !== "true"));

    menu.addEventListener("click", (e) => { if (e.target.closest("a")) abrir(false); });

    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.dataset.aberto === "sim") { abrir(false); botaoMenu.focus(); }
    });

    // Se a janela crescer com o menu aberto, o menu desaparece por CSS mas o
    // body ficava travado sem rolar. Isto desfaz o estado.
    matchMedia("(min-width: 60.0625rem)").addEventListener("change", (e) => {
      if (e.matches) abrir(false);
    });
  }

  /* ------------------------------------------------ comparador antes/depois */
  /* O <input type="range"> faz o trabalho todo de acessibilidade; aqui só se
     copia o valor para uma variável de CSS. */
  $$(".comparador").forEach((cmp) => {
    const controlo = $("input", cmp);
    if (!controlo) return;
    const pintar = () => cmp.style.setProperty("--p", controlo.value + "%");
    controlo.addEventListener("input", pintar, { passive: true });
    pintar();
  });

  /* ---------------------------------------------------------------- lupa */
  /* O `popover` trata da camada de topo, do Esc e do fecho ao tocar fora.
     Aqui só se enche a imagem antes de abrir — assim há um só <dialog> para
     a galeria toda, em vez de um por fotografia. */
  const lupa = $("#lupa");
  if (lupa) {
    const imagem = $("img", lupa);
    const nota = $(".lupa__nota", lupa);
    $$("[data-lupa]").forEach((botao) => {
      botao.addEventListener("click", () => {
        const fonte = botao.dataset.lupa;
        const alternativo = botao.dataset.lupaAlt || "";
        imagem.src = fonte;
        imagem.alt = alternativo;
        if (nota) nota.textContent = botao.dataset.lupaNota || "";
        lupa.showPopover();
      });
    });
  }

  /* ------------------------------------------------- horário: marcar hoje */
  /* Feito no cliente, de propósito: o site é estático e uma página gerada às
     3 da manhã não sabe em que dia é lida. */
  const horario = $(".horario");
  if (horario) {
    const hoje = new Date().getDay(); // 0 = domingo
    $$("li", horario).forEach((linha) => {
      const dias = (linha.dataset.dias || "").split(",").map(Number);
      if (dias.includes(hoje)) linha.dataset.hoje = "sim";
    });
  }

  /* ------------------------------------- consentimento e mapa da Google */
  /* O site não põe cookies. A autorização serve para uma coisa só: carregar
     o mapa da Google, que é um pedido a um servidor de terceiros. Guarda-se
     em localStorage (não é cookie, não viaja em pedidos nenhuns). */
  const CHAVE = "pf-mapa";
  const guardado = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
  const guardar = (v) => { try { localStorage.setItem(CHAVE, v); } catch { /* modo privado */ } };

  const carregarMapa = () => {
    const alvo = $(".mapa[data-incorporar]");
    if (!alvo || $("iframe", alvo)) return;
    const marco = document.createElement("iframe");
    marco.src = alvo.dataset.incorporar;
    marco.loading = "lazy";
    marco.title = "Mapa com a localização do Perfect Finish Studio, em Leiria";
    marco.referrerPolicy = "no-referrer-when-downgrade";
    marco.allowFullscreen = true;
    alvo.textContent = "";
    alvo.append(marco);
  };

  const aviso = $(".cookies");
  if (aviso) {
    const decidir = (valor) => {
      guardar(valor);
      aviso.remove();
      if (valor === "sim") carregarMapa();
    };
    $(".cookies [data-aceitar]", document)?.addEventListener("click", () => decidir("sim"));
    $(".cookies [data-recusar]", document)?.addEventListener("click", () => decidir("nao"));
    if (guardado()) aviso.remove();
  }
  if (guardado() === "sim") carregarMapa();
  $("[data-carregar-mapa]")?.addEventListener("click", () => { guardar("sim"); carregarMapa(); });

  /* ----------------------------------------------- avaliações em directo */
  /* Se houver um endereço configurado (o Cloudflare Worker), vai buscar a
     nota e as avaliações à Places API através dele. Se não houver, ou se
     falhar, fica o que já está escrito no HTML — que é a nota real à data da
     última publicação, com ligação ao perfil. Nunca fica um espaço vazio.

     Os textos das avaliações NÃO são guardados no repositório: os termos da
     Google proíbem expressamente copiar e guardar avaliações. Só passam pelo
     ecrã de quem está a ver. */
  const bloco = $("[data-avaliacoes]");
  const fonte = bloco?.dataset.avaliacoes;
  if (bloco && fonte) {
    const ir = () => fetch(fonte, { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((dados) => {
        if (typeof dados.rating === "number") {
          const valor = $(".nota__valor", bloco);
          if (valor) valor.textContent = dados.rating.toFixed(1).replace(".", ",");
        }
        if (typeof dados.userRatingCount === "number") {
          const conta = $(".nota__conta", bloco);
          if (conta) conta.textContent = dados.userRatingCount + " avaliações no Google";
        }
      })
      .catch(() => { /* fica o que estava. É por isso que estava lá. */ });

    // Só se pede quando o bloco entra no ecrã: mantém o uso dentro do
    // patamar gratuito da API e não atrasa o primeiro desenho da página.
    if ("IntersectionObserver" in window) {
      const olho = new IntersectionObserver((entradas) => {
        if (entradas.some((e) => e.isIntersecting)) { olho.disconnect(); ir(); }
      }, { rootMargin: "200px" });
      olho.observe(bloco);
    } else { ir(); }
  }
})();
