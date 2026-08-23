#!/usr/bin/env python3
"""Compõe a imagem de fundo da capa.

O problema: as fotografias têm 414×414 px. Esticar uma delas para 2560 px de
largura dá uma ampliação de seis vezes e nota-se logo — o site inteiro passa a
parecer de má qualidade.

A solução: em vez de UMA fotografia esticada, um MOSAICO de muitas, cada uma ao
seu tamanho quase nativo. Assim cada peça está nítida e o conjunto lê-se como
uma parede de trabalho do estúdio. Por cima leva um escurecimento forte com
inclinação, para o texto do herói assentar, um foco quente dourado no topo e
uma vinheta.

Saem duas versões, porque um recorte só não serve às duas orientações:
  capa-larga.*   2560×1200  para computador
  capa-alta.*    1200×1700  para telemóvel

Correr:  python3 scripts/capa.py
"""

from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
OBRAS = RAIZ / "assets" / "img" / "obras"
DESTINO = RAIZ / "assets" / "img" / "capa"

TINTA = (0x1A, 0x17, 0x17)
OURO = (0xAC, 0x8A, 0x39)

# As peças escolhidas: carros escuros e brilhantes, que é o que aguenta ficar
# debaixo de um véu escuro sem virar uma mancha. Fotografias claras (a parede
# branca da oficina) ficam cinzentas e sujas por baixo do véu.
PECAS = [
    "audi-q4-etron-1", "ferrari-roma-1", "audi-q7-camaleao-1", "amg-cla-45s-1",
    "porsche-911-992-1", "rolls-royce-wraith-1", "lotus-emeya-ppf-1",
    "tesla-model-y-1", "audi-etron-gt-1", "vw-scirocco-r-1", "bmw-serie-5-touring-1",
    "maserati-ghibli-1", "porsche-911-targa-gts-1", "ford-mustang-dark-horse-1",
    "mercedes-classe-a-1", "tesla-pincas-1", "smart-fortwo-1", "bmw-serie-5-pelicula-1",
    "audi-q7-camaleao-2", "ferrari-roma-2", "amg-cla-45s-2", "audi-q4-etron-2",
]

FORMATOS = [
    #  nome          largura altura  colunas
    ("capa-larga",   2560,  1200,   7),
    ("capa-alta",    1200,  1700,   3),
]


def mosaico(largura: int, altura: int, colunas: int, semente: int) -> Image.Image:
    """Preenche a tela com peças quadradas, em quinconce."""
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
            # Variar um pouco o brilho de peça para peça tira a monotonia e
            # disfarça as costuras.
            im = ImageEnhance.Brightness(im).enhance(aleatorio.uniform(0.82, 1.0))
            tela.paste(im, (int(x), int(linha * lado)))
    return tela


def veu(imagem: Image.Image, alta: bool) -> Image.Image:
    """Escurece com inclinação, acende um foco dourado e fecha com vinheta."""
    largura, altura = imagem.size

    # O mosaico entra dessaturado: as cores dos carros competiriam com o
    # dourado da marca e o herói ficava um arco-íris.
    base = ImageEnhance.Color(imagem).enhance(0.30)
    base = ImageEnhance.Contrast(base).enhance(1.06)
    base = base.filter(ImageFilter.GaussianBlur(2.4))  # lê-se como fundo, não como colagem

    # Véu escuro: quase opaco onde vai o texto, mais leve no lado oposto.
    escuro = Image.new("RGB", (largura, altura), (0x10, 0x0E, 0x0E))
    mascara = Image.new("L", (largura, altura))
    desenho = ImageDraw.Draw(mascara)
    if alta:
        # No telemóvel o texto está em cima: escurece de cima para baixo.
        for y in range(altura):
            f = y / altura
            desenho.line([0, y, largura, y], fill=int(250 - 86 * min(1, f * 1.25)))
    else:
        # No computador o texto está à esquerda.
        for x in range(largura):
            f = x / largura
            desenho.line([x, 0, x, altura], fill=int(248 - 96 * min(1, f * 1.15)))
    imagem = Image.composite(escuro, base, mascara)

    # Foco quente dourado, como as luminárias hexagonais da oficina.
    luz = Image.new("L", (largura, altura), 0)
    pincel = ImageDraw.Draw(luz)
    cx, cy = largura * (0.5 if alta else 0.34), -altura * 0.18
    raio = max(largura, altura) * 0.95
    for i in range(70, 0, -1):
        r = raio * i / 70
        pincel.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(52 * (1 - i / 70) ** 1.8))
    luz = luz.filter(ImageFilter.GaussianBlur(max(largura, altura) / 22))
    imagem = Image.composite(Image.new("RGB", (largura, altura), OURO), imagem, luz)

    # Vinheta.
    vinheta = Image.new("L", (largura, altura), 0)
    pv = ImageDraw.Draw(vinheta)
    for i in range(60):
        f = i / 60
        mx, my = largura * 0.30 * f, altura * 0.30 * f
        pv.ellipse([mx, my, largura - mx, altura - my], fill=int(88 * f ** 2))
    vinheta = vinheta.filter(ImageFilter.GaussianBlur(min(largura, altura) / 12))
    return Image.composite(imagem, Image.new("RGB", (largura, altura), (0, 0, 0)),
                           Image.eval(vinheta, lambda v: 255 - v))


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    for indice, (nome, largura, altura, colunas) in enumerate(FORMATOS):
        imagem = veu(mosaico(largura, altura, colunas, 7 + indice), alta=altura > largura)
        for extensao, argumentos in (("webp", {"quality": 78, "method": 6}),
                                     ("avif", {"quality": 55})):
            caminho = DESTINO / f"{nome}.{extensao}"
            try:
                imagem.save(caminho, extensao.upper(), **argumentos)
                print(f"→ {caminho.name:20} {largura}×{altura}  "
                      f"{caminho.stat().st_size/1024:6.0f} kB")
            except Exception as erro:  # noqa: BLE001
                print(f"  ({extensao} falhou: {erro})")


if __name__ == "__main__":
    main()
