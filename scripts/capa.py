#!/usr/bin/env python3
"""Compõe a imagem de fundo da capa.

O problema: as fotografias têm 414×414 px. Esticar uma delas para 2560 px de
largura é ampliar seis vezes e nota-se logo — o site inteiro passa a parecer de
má qualidade.

A solução: um MOSAICO de poucas peças GRANDES, cada uma perto do seu tamanho
nativo. Poucas e grandes, e não muitas e pequenas: com peças grandes
reconhece-se o carro (o Rolls-Royce, o Ferrari, o AMG), e é isso que faz a capa
valer alguma coisa.

DUAS TENTATIVAS FALHARAM ANTES DESTA, e vale a pena não as repetir:

  1. Véu escuro por cima de tudo, dessaturado a 30% e desfocado 2,4 px. As
     fotografias ficavam lama. Foi a queixa do cliente.
  2. Peças pequenas (7 colunas). Nenhum carro se lia como carro; parecia
     textura.

O que funciona, e é o que está aqui:

  · as fotografias mantêm quase toda a cor (85%) e não levam desfoque;
  · o escurecimento é SÓ atrás do texto, numa faixa com um lado esbatido —
    é o que dá contraste ao texto sem apagar a fotografia;
  · do lado de fora dessa faixa fica um véu leve (13%), só para o conjunto
    assentar e o dourado do texto não competir com a cor dos carros.

Saem duas versões, porque um recorte só não serve às duas orientações:
  capa-larga.*   2560×1180  para computador (véu à esquerda, por CSS)
  capa-alta.*     900×900   para telemóvel (véu em cima, por CSS)

Correr:  python3 scripts/capa.py
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
OBRAS = RAIZ / "assets" / "img" / "obras"
DESTINO = RAIZ / "assets" / "img" / "capa"

TINTA = (0x1A, 0x17, 0x17)
OURO = (0xAC, 0x8A, 0x39)

# Peças escolhidas por serem reconhecíveis e por terem luz própria. A ordem
# importa: as primeiras caem no lado direito da versão larga, que é o lado que
# fica à vista, fora do painel do texto.
PECAS = [
    "audi-q7-camaleao-1", "amg-cla-45s-1", "rolls-royce-wraith-1", "ferrari-roma-1",
    "audi-q4-etron-1", "lotus-emeya-ppf-1", "porsche-911-992-1", "tesla-model-y-1",
    "audi-etron-gt-1", "vw-scirocco-r-1", "maserati-ghibli-1", "bmw-serie-5-touring-1",
    "porsche-911-targa-gts-1", "ford-mustang-dark-horse-1", "tesla-pincas-1",
    "mercedes-classe-a-1", "smart-fortwo-1", "bmw-serie-5-pelicula-1",
]

FORMATOS = [
    #  nome          largura altura  colunas  painel de texto
    ("capa-larga",   2560,  1180,   4,      -1.0),    # -1 = sem painel
    # NENHUMA das duas leva painel gravado. O véu é feito por CSS.
    #
    # Gravá-lo na imagem parecia boa ideia e não é: o painel fica ancorado à
    # IMAGEM, e a imagem entra com `object-fit: cover`, que corta de forma
    # diferente a cada largura de ecrã. O texto, esse, está num contentor
    # centrado. A 1920 px o contentor começa aos 352 px e o texto saía do
    # painel — medido, 1,75:1 no sobrescrito.
    # Em CSS o véu acompanha o layout e não o recorte, e afina-se sem voltar a
    # gerar imagem nenhuma.
    ("capa-alta",     900,   900,   2,      -1.0),    # -1 = sem painel
]

COR = 0.85          # quase toda a cor. Já esteve a 0.30 e as fotografias morriam.
BRILHO = (0.90, 1.05)


def mosaico(largura: int, altura: int, colunas: int, semente: int) -> Image.Image:
    """Peças quadradas grandes, em quinconce."""
    aleatorio = random.Random(semente)
    lado = largura / colunas
    linhas = int(altura / lado) + 2
    tela = Image.new("RGB", (largura, altura), TINTA)

    disponiveis = [p for p in PECAS if (OBRAS / f"{p}-828.webp").exists()]
    if not disponiveis:
        raise SystemExit("Não encontrei as fotografias em assets/img/obras — "
                         "corra antes scripts/imagens.py")

    i = 0
    for linha in range(linhas):
        # Meia peça de desvio em linhas alternadas: sem isto lê-se como uma
        # folha de cálculo, com isto lê-se como uma parede.
        desvio = -lado / 2 if linha % 2 else 0
        coluna = -1
        while True:
            coluna += 1
            x = desvio + coluna * lado
            if x >= largura:
                break
            peca = disponiveis[i % len(disponiveis)]
            i += 1
            im = Image.open(OBRAS / f"{peca}-828.webp").convert("RGB")
            n = int(lado) + 2
            im = im.resize((n, n), Image.LANCZOS)
            # A peça é maior do que o ficheiro, portanto leva nitidez — o
            # Lanczos suaviza as arestas e a máscara devolve-lhes contraste.
            if n > 828:
                im = im.filter(ImageFilter.UnsharpMask(radius=1.3, percent=95, threshold=3))
            im = ImageEnhance.Brightness(im).enhance(aleatorio.uniform(*BRILHO))
            tela.paste(im, (int(x), int(linha * lado)))
    return ImageEnhance.Color(tela).enhance(COR)


def painel(imagem: Image.Image, fim: float) -> Image.Image:
    """Escurece SÓ atrás do texto, esbatendo para o lado da fotografia.

    `fim` é onde acaba o esbatimento, em fracção da largura. Com 0 o painel
    fica no topo (versão de telemóvel, onde o texto está em cima).
    """
    largura, altura = imagem.size
    escuro = Image.new("RGB", (largura, altura), (0x0F, 0x0D, 0x0D))
    mascara = Image.new("L", (largura, altura), 0)
    desenho = ImageDraw.Draw(mascara)

    if fim < 0:
        pass                      # sem painel: o esbatimento é feito por CSS
    else:
        inicio = int(largura * fim * 0.55)
        limite = int(largura * fim)
        desenho.rectangle([0, 0, inicio, altura], fill=236)
        for x in range(inicio, limite):
            f = (x - inicio) / max(1, limite - inicio)
            desenho.line([x, 0, x, altura], fill=int(236 * (1 - f)))

    mascara = mascara.filter(ImageFilter.GaussianBlur(largura / 44))
    imagem = Image.composite(escuro, imagem, mascara)

    # Véu leve por cima de tudo. Leve — 13%, não os 97% da primeira tentativa.
    veu = Image.new("RGB", (largura, altura), (0x14, 0x11, 0x11))
    imagem = Image.blend(imagem, veu, 0.13)

    # Foco quente, como as luminárias hexagonais da oficina.
    luz = Image.new("L", (largura, altura), 0)
    pincel = ImageDraw.Draw(luz)
    cx, cy = largura * (0.5 if fim < 0 else 0.3), -altura * 0.2
    raio = max(largura, altura) * 0.9
    for i in range(60, 0, -1):
        r = raio * i / 60
        pincel.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(34 * (1 - i / 60) ** 1.8))
    luz = luz.filter(ImageFilter.GaussianBlur(max(largura, altura) / 24))
    return Image.composite(Image.new("RGB", (largura, altura), OURO), imagem, luz)


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    for indice, (nome, largura, altura, colunas, fim) in enumerate(FORMATOS):
        imagem = painel(mosaico(largura, altura, colunas, 11 + indice), fim)
        for extensao, argumentos in (("webp", {"quality": 80, "method": 6}),
                                     ("avif", {"quality": 58})):
            caminho = DESTINO / f"{nome}.{extensao}"
            try:
                imagem.save(caminho, extensao.upper(), **argumentos)
                print(f"→ {caminho.name:20} {largura}×{altura}  "
                      f"{caminho.stat().st_size/1024:6.0f} kB")
            except Exception as erro:  # noqa: BLE001
                print(f"  ({extensao} falhou: {erro})")


if __name__ == "__main__":
    main()
