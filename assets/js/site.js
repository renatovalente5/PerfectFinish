/* =========================================================================
   PERFECT FINISH STUDIO — comportamento
   Sem bibliotecas. Cada bloco é independente: se um falhar, os outros
   continuam, e a página continua a funcionar sem nenhum deles.
   ========================================================================= */
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* O cabeçalho deste ficheiro sempre disse que «cada bloco é independente: se
     um falhar, os outros continuam». Não era verdade: isto é um IIFE único e
     uma excepção em qualquer bloco parava todos os seguintes. Foi apontado como
     o gatilho MAIS PROVÁVEL do comparador ficar sem régua — mais provável do
     que o site.js não carregar. Agora é verdade. */
  const falhou = (bloco, erro) => {
    console.error(`Perfect Finish — o bloco «${bloco}» falhou e foi ignorado:`, erro);
  };

  try {
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

  } catch (erro) { falhou("cabeçalho", erro); }

  try {
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

  } catch (erro) { falhou("menu", erro); }

  try {
    /* ------------------------------------------------ comparador antes/depois */
    /* O <input type="range"> faz o trabalho todo: setas, Home/End, PageUp, o
       toque, a caneta, o clique no carril, e o nome e o valor para leitores de
       ecrã. Aqui só se copia o valor para duas variáveis de CSS. */
    const comparadores = $$(".comparador");
    /* Qual o comparador com o ponteiro em baixo. Um só, sempre — e assim bastam
       dois escutadores na página em vez de dois por comparador. */
    let activo = null;

    comparadores.forEach((cmp) => {
      const regua = $(".comparador__regua", cmp);
      if (!regua) return;

      /* Nasce `disabled` no HTML: sem este ficheiro não teria como funcionar, e
         um controlo que apanha foco e não faz nada é pior do que não existir. */
      regua.disabled = false;
      /* E só AGORA se abre o estado interactivo no CSS, comparador a comparador.
         O atributo é o portão de `.comparador[data-vivo]`, e é posto depois de a
         régua estar ligada — nunca antes. Se este ficheiro não correr, ou se
         falhar antes de chegar aqui, o comparador fica no díptico, que é a forma
         que funciona sem JavaScript. Antes o portão era um `data-js` escrito no
         <head>, e uma falha do site.js deixava meia fotografia cortada ao meio
         sem controlo nenhum — pior do que não ter JavaScript. */
      cmp.dataset.vivo = "sim";

      const pintar = () => {
        const v = Number(regua.value);
        cmp.style.setProperty("--p", v + "%");
        cmp.style.setProperty("--n", String(v / 100));
      };

      /* Primeiro gesto humano: desliga a demonstração ligada ao scroll. A
         animação estava a segurar 50%, que é o valor com que a régua nasce, por
         isso a passagem ao controlo manual não dá salto. */
      const assumir = () => { cmp.dataset.manual = "sim"; };
      regua.addEventListener("keydown", assumir, { passive: true });
      regua.addEventListener("pointerdown", () => { assumir(); activo = cmp; },
                             { capture: true, passive: true });

      /* A transição sai da frente só quando o ponteiro MEXE, e não já no
         pointerdown. Assim um clique no carril desliza até ao ponto (fica bem) e
         um arrastar cola ao dedo (fica certo) — o mesmo controlo dá as duas
         coisas sem as confundir. */
      regua.addEventListener("pointermove", () => {
        if (activo === cmp) cmp.dataset.arrastar = "sim";
      }, { passive: true });

      regua.addEventListener("input", () => { assumir(); pintar(); }, { passive: true });
      pintar();
    });

    /* Na página toda, e não em cada comparador: o pointerup pode cair fora da
       fotografia se o dedo sair dela a arrastar. */
    if (comparadores.length) {
      const largar = () => {
        if (!activo) return;
        delete activo.dataset.arrastar;
        activo = null;
      };
      addEventListener("pointerup", largar, { passive: true });
      addEventListener("pointercancel", largar, { passive: true });
    }

  } catch (erro) { falhou("comparador", erro); }

  try {
    /* ---------------------------------------------------------------- lupa */
    /* O `popover` trata da camada de topo, do Esc e do fecho ao tocar fora.
       Há um só <dialog> para a galeria toda — enche-se antes de abrir.

       Cada trabalho tem até quatro fotografias, e por isso a lupa anda para a
       frente e para trás: por botão, pelas setas do teclado e por arrastar o
       dedo. Sem isto, 34 das 52 fotografias do portefólio não apareciam em
       sítio nenhum. */
    const lupa = $("#lupa");
    if (lupa) {
      const imagem = $("img", lupa);
      const nota = $(".lupa__nota", lupa);
      const setas = $$("[data-passo]", lupa);
      let fotos = [];
      let indice = 0;
      let titulo = "";

      const pintar = () => {
        const f = fotos[indice];
        if (!f) return;
        imagem.src = f.src;
        imagem.alt = f.alt || "";
        const conta = fotos.length > 1 ? ` — ${indice + 1} de ${fotos.length}` : "";
        if (nota) nota.textContent = titulo + conta;
        // Com uma só fotografia as setas não fazem nada: escondem-se em vez de
        // ficarem lá a não responder.
        setas.forEach((s) => { s.hidden = fotos.length < 2; });
      };

      const andar = (passo) => {
        if (fotos.length < 2) return;
        indice = (indice + passo + fotos.length) % fotos.length;
        pintar();
      };

      setas.forEach((s) =>
        s.addEventListener("click", (e) => { e.stopPropagation(); andar(Number(s.dataset.passo)); }));

      $$("[data-galeria]").forEach((botao) => {
        botao.addEventListener("click", () => {
          try { fotos = JSON.parse(botao.dataset.galeria); }
          catch { fotos = []; }
          if (!fotos.length) return;
          indice = 0;
          titulo = botao.dataset.titulo || "";
          pintar();
          lupa.showPopover();
        });
      });

      addEventListener("keydown", (e) => {
        if (!lupa.matches(":popover-open")) return;
        if (e.key === "ArrowRight") { e.preventDefault(); andar(1); }
        if (e.key === "ArrowLeft")  { e.preventDefault(); andar(-1); }
      });

      // Arrastar o dedo. Só conta se for claramente horizontal, senão rouba o
      // gesto de fechar arrastando para baixo que as pessoas tentam por hábito.
      let x0 = null, y0 = null;
      lupa.addEventListener("touchstart", (e) => {
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      }, { passive: true });
      lupa.addEventListener("touchend", (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        const dy = e.changedTouches[0].clientY - y0;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) andar(dx < 0 ? 1 : -1);
        x0 = y0 = null;
      }, { passive: true });
    }

  } catch (erro) { falhou("lupa", erro); }

  try {
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

  } catch (erro) { falhou("horário", erro); }

  try {
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

    /* Descarregar o mapa outra vez. Guarda-se o conteúdo original do sítio do
       mapa (o convite com o botão) ANTES de o substituir pelo iframe, porque
       retirar a autorização tem de ter efeito real: sem isto o iframe da Google
       ficava lá, e «retirei» era mentira. */
    const sitioMapa = $(".mapa[data-incorporar]");
    const convite = sitioMapa ? sitioMapa.innerHTML : null;
    const descarregarMapa = () => {
      if (!sitioMapa || convite === null) return;
      sitioMapa.innerHTML = convite;
      ligarBotaoMapa();
    };

    function ligarBotaoMapa() {
      $("[data-carregar-mapa]")?.addEventListener("click", () => { guardar("sim"); carregarMapa(); });
    }

    /* O aviso deixa de ser removido do DOM e passa a ser escondido: é o que
       permite reabri-lo pelo «Preferências». O `hidden` só funciona aqui porque
       a folha declara `[hidden] { display: none !important }` — sem o
       `!important`, o `display: grid` do autor ganhava-lhe. */
    const aviso = $(".cookies");
    if (aviso) {
      const decidir = (valor) => {
        guardar(valor);
        aviso.hidden = true;
        if (valor === "sim") carregarMapa(); else descarregarMapa();
      };
      $(".cookies [data-aceitar]", document)?.addEventListener("click", () => decidir("sim"));
      $(".cookies [data-recusar]", document)?.addEventListener("click", () => decidir("nao"));
      if (guardado()) aviso.hidden = true;
    }
    if (guardado() === "sim") carregarMapa();
    ligarBotaoMapa();

    /* RETIRAR A AUTORIZAÇÃO. O artigo 7.º/3 do RGPD exige que retirar seja tão
       fácil como dar, e até aqui não havia forma nenhuma: a decisão ficava em
       localStorage para sempre. Esta ligação existe em todas as páginas. */
    $$("[data-preferencias]").forEach((b) => b.addEventListener("click", () => {
      try { localStorage.removeItem(CHAVE); } catch { /* modo privado */ }
      descarregarMapa();
      if (aviso) {
        aviso.hidden = false;
        aviso.scrollIntoView({ block: "nearest" });
        $(".cookies [data-aceitar]", document)?.focus();
      }
    }));

  } catch (erro) { falhou("consentimento", erro); }

  try {
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
  } catch (erro) { falhou("avaliações", erro); }

})();
