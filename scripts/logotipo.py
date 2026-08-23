#!/usr/bin/env python3
"""Prepara os ficheiros do logótipo a partir do original vectorial (_fonte/logo.pdf).

O PDF do cliente tem duas páginas — a versão sobre fundo escuro e a versão sobre
fundo branco. O desenho é o MESMO nas duas: gradientes dourados sobre fundo
transparente. Por isso basta extrair uma delas e serve para qualquer fundo.

O que este script faz, e porquê:

  1. `pdftocairo -svg` dá o desenho em curvas, com os gradientes originais
     intactos. Nada é redesenhado — é o ficheiro do cliente.
  2. O viewBox vem do tamanho da folha A4, com o logótipo perdido no meio.
     Recortamos o viewBox para a caixa do desenho, senão qualquer `width`
     no HTML fica a dimensionar folha em branco.
  3. Separamos o conjunto completo (escudo + letras) do símbolo (só o escudo),
     porque o site precisa dos dois: o conjunto no cabeçalho, o símbolo no
     favicon, nos separadores e nos sítios pequenos.
  4. Os gradientes vêm com 99 paragens cada — é a forma como o Cairo aproxima
     a malha do Illustrator. São monótonos, portanto reduzem-se a poucas
     paragens sem diferença visível e o ficheiro fica quatro vezes menor.

Correr:  python3 scripts/logotipo.py
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "_fonte" / "logo.pdf"
DESTINO = RAIZ / "assets" / "img" / "marca"

# Caixas medidas no espaço do SVG extraído (pontos). Vêm da união das áreas de
# preenchimento de cada elemento — ver a função `caixas()`, que as recalcula e
# avisa se o PDF mudar.
GRUPOS = {
    # elemento             -> gradientes que lhe pertencem
    "assinatura": [0],       # PERFECT FINISH STUDIO
    "autor": [1],            # BY GALHARDO
    "escudo": [2, 3, 4, 5],  # escudo + monograma PF
    "filetes": [6, 7],       # os dois traços que acompanham BY GALHARDO
}

# Margem de respiro em volta do desenho, em pontos. Sem isto o traço exterior
# do escudo encosta ao limite e é cortado no ecrã em alguns zooms.
MARGEM = 4.0


def executa(*args: str) -> None:
    try:
        subprocess.run(args, check=True, capture_output=True)
    except FileNotFoundError:
        sys.exit(f"Falta o programa `{args[0]}`. Instale com: brew install poppler")
    except subprocess.CalledProcessError as erro:
        sys.exit(f"`{args[0]}` falhou: {erro.stderr.decode(errors='replace')[:400]}")


def extrai_svg(pagina: int, destino: Path) -> str:
    """Corre o pdftocairo numa página e devolve o SVG em texto."""
    executa(
        "pdftocairo", "-svg",
        "-f", str(pagina), "-l", str(pagina),
        str(FONTE), str(destino),
    )
    return destino.read_text(encoding="utf-8")


def caixas(svg: str) -> dict[int, tuple[float, float, float, float]]:
    """Caixa (x0, y0, x1, y1) de cada gradiente, lida do rectângulo que preenche."""
    resultado: dict[int, tuple[float, float, float, float]] = {}
    padrao = r'<path fill-rule="nonzero" fill="url\(#linear-pattern-(\d+)\)" d="([^"]+)"'
    for indice, desenho in re.findall(padrao, svg):
        numeros = [float(n) for n in re.findall(r"-?\d+\.?\d*(?:e-?\d+)?", desenho)]
        xs, ys = numeros[0::2], numeros[1::2]
        if xs and ys:
            resultado[int(indice)] = (min(xs), min(ys), max(xs), max(ys))
    return resultado


def uniao(cxs: dict[int, tuple[float, float, float, float]], indices: list[int]):
    presentes = [cxs[i] for i in indices if i in cxs]
    if not presentes:
        sys.exit(f"Não encontrei os gradientes {indices} no SVG — o PDF mudou?")
    return (
        min(c[0] for c in presentes), min(c[1] for c in presentes),
        max(c[2] for c in presentes), max(c[3] for c in presentes),
    )


def reduz_gradientes(svg: str, maximo: int = 12) -> str:
    """Reduz as paragens de cada gradiente, mantendo a primeira e a última.

    As paragens do Cairo são monótonas: descem de forma regular do dourado claro
    para o escuro. Guardar uma em cada N não muda o que se vê e corta o ficheiro
    para menos de um quarto.
    """

    def trata(bloco: re.Match[str]) -> str:
        texto = bloco.group(0)
        paragens = re.findall(r"<stop[^>]*/>", texto)
        if len(paragens) <= maximo:
            return texto
        passo = (len(paragens) - 1) / (maximo - 1)
        escolhidas = [paragens[round(i * passo)] for i in range(maximo)]
        # A última tem de ser exactamente a última, para o tom escuro não mudar.
        escolhidas[-1] = paragens[-1]
        cabeca = texto[: texto.index("<stop")]
        return cabeca + "\n".join(escolhidas) + "\n</linearGradient>"

    return re.sub(r"<linearGradient.*?</linearGradient>", trata, svg, flags=re.S)


def recorta(svg: str, manter: list[int], caixa: tuple[float, float, float, float]) -> str:
    """Devolve um SVG só com os gradientes pedidos e o viewBox na caixa deles."""
    x0, y0, x1, y1 = caixa
    x0 -= MARGEM; y0 -= MARGEM; x1 += MARGEM; y1 += MARGEM
    largura, altura = x1 - x0, y1 - y0

    # Cada elemento é `<g clip-path><g clip-path><path fill=url(#grad)/></g></g>`
    # ou, nos filetes, com um só nível.
    #
    # Isto foi feito com uma expressão regular e saiu mal: com grupos
    # encaixados, o motor começava a contar no <g> de dentro e arrastava o
    # </g> do de fora, deixando seis fechos a mais e um SVG que o navegador
    # recusava. Contar a profundidade é aborrecido e funciona sempre.
    blocos: list[str] = []
    corpo = svg[svg.index("</defs>") + len("</defs>"):]
    posicao = 0
    while True:
        inicio = corpo.find("<g ", posicao)
        if inicio == -1:
            break
        profundidade, i = 0, inicio
        while i < len(corpo):
            if corpo.startswith("<g", i) and corpo[i + 2] in " >":
                profundidade += 1
                i += 2
            elif corpo.startswith("</g>", i):
                profundidade -= 1
                i += 4
                if profundidade == 0:
                    break
            else:
                i += 1
        bloco = corpo[inicio:i]
        posicao = i
        usado = re.search(r"url\(#linear-pattern-(\d+)\)", bloco)
        if usado and int(usado.group(1)) in manter:
            blocos.append(bloco.strip())

    if len(blocos) != len(manter):
        sys.exit(f"Esperava {len(manter)} elementos, apanhei {len(blocos)}. O PDF mudou?")

    # Só os `defs` de que os blocos escolhidos precisam.
    precisos = set()
    for bloco in blocos:
        precisos.update(re.findall(r'url\(#([\w-]+)\)', bloco))
        precisos.update(re.findall(r'clip-path="url\(#([\w-]+)\)"', bloco))

    defs: list[str] = []
    for definicao in re.findall(r"<clipPath id=\"[^\"]+\">.*?</clipPath>|<linearGradient id=\"[^\"]+\".*?</linearGradient>", svg, re.S):
        identificador = re.search(r'id="([^"]+)"', definicao).group(1)
        if identificador in precisos:
            defs.append(definicao.strip())

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{x0:.2f} {y0:.2f} {largura:.2f} {altura:.2f}" '
        'role="img" aria-label="Perfect Finish Studio">\n'
        "<defs>\n" + "\n".join(defs) + "\n</defs>\n"
        + "\n".join(blocos) + "\n</svg>\n"
    )


def main() -> None:
    if not FONTE.exists():
        sys.exit(f"Não encontrei {FONTE}")
    DESTINO.mkdir(parents=True, exist_ok=True)

    temporario = DESTINO / "_bruto.svg"
    svg = extrai_svg(2, temporario)  # página 2: desenho sobre fundo branco
    temporario.unlink(missing_ok=True)

    cxs = caixas(svg)
    print(f"Elementos encontrados no PDF: {len(cxs)}")
    for nome, indices in GRUPOS.items():
        x0, y0, x1, y1 = uniao(cxs, indices)
        print(f"  {nome:12} x {x0:7.2f}..{x1:7.2f}   y {y0:7.2f}..{y1:7.2f}")

    svg = reduz_gradientes(svg)

    conjunto = [i for indices in GRUPOS.values() for i in indices]
    ficheiros = {
        # nome                 elementos                              caixa
        "logotipo.svg":       (conjunto,                              conjunto),
        "simbolo.svg":        (GRUPOS["escudo"],                       GRUPOS["escudo"]),
        "assinatura.svg":     (GRUPOS["assinatura"] + GRUPOS["autor"] + GRUPOS["filetes"],
                               GRUPOS["assinatura"] + GRUPOS["autor"] + GRUPOS["filetes"]),
    }

    for nome, (manter, para_caixa) in ficheiros.items():
        conteudo = recorta(svg, manter, uniao(cxs, para_caixa))
        (DESTINO / nome).write_text(conteudo, encoding="utf-8")
        caixa = re.search(r'viewBox="([^"]+)"', conteudo).group(1)
        tamanho = len(conteudo) / 1024
        print(f"→ {nome:18} {tamanho:5.1f} kB   viewBox={caixa}")

    print("\nPara os PNG (favicon, imagem social): python3 scripts/favicons.py")


if __name__ == "__main__":
    main()
