#!/usr/bin/env python3
"""Desenha as imagens dos produtos da loja.

O cliente ainda não tem fotografias dos produtos. Em vez de ir buscar imagens
de bancos — que ficam com outra luz, outro fundo e outra marca — desenham-se
aqui, todas no mesmo estúdio virtual: parede quente escura, uma luz que entra
pela esquerda, aresta dourada, sombra e reflexo no chão. Assim a loja lê-se
como o resto do site, e no dia em que houver fotografias reais trocam-se
ficheiro a ficheiro sem mexer em mais nada.

São embalagens genéricas, sem marca de terceiros e sem imitar nenhum produto
existente.

A lição da primeira versão: num fundo preto, a embalagem TEM de ser
visivelmente mais clara do que a parede. Ficou tudo preto sobre preto e não
se via nada. O corpo é agora um degradé que vai de um cinzento quente médio
até ao escuro, e a aresta iluminada é larga e forte.

Correr:  python3 scripts/produtos.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "assets" / "img" / "loja"
PRODUTOS = RAIZ / "data" / "loja"

LADO = 1000
MEDIDAS = [414, 828]

TINTA = (0x1A, 0x17, 0x17)
OURO = (0xAC, 0x8A, 0x39)
OURO_ALTO = (0xCB, 0xAD, 0x4F)
OURO_BRILHO = (0xD4, 0xB7, 0x56)
OSSO = (0xED, 0xE8, 0xDF)

CHAO = 0.815  # onde assenta a embalagem, em fracção da altura


def fonte(tamanho: int, negrito: bool = False) -> ImageFont.FreeTypeFont:
    for caminho in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if negrito
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        try:
            return ImageFont.truetype(caminho, tamanho)
        except OSError:
            continue
    return ImageFont.load_default()


def degrade_vertical(caixa, cima, baixo) -> Image.Image:
    """Um rectângulo com degradé de cima para baixo, do tamanho da caixa."""
    largura = max(1, int(caixa[2] - caixa[0]))
    altura = max(1, int(caixa[3] - caixa[1]))
    tira = Image.new("RGB", (1, altura))
    for y in range(altura):
        f = y / max(1, altura - 1)
        tira.putpixel((0, y), tuple(int(cima[i] + (baixo[i] - cima[i]) * f) for i in range(3)))
    return tira.resize((largura, altura), Image.BILINEAR)


def fundo() -> Image.Image:
    """Parede com um foco quente em cima à esquerda, e chão mais escuro."""
    base = Image.new("RGB", (LADO, LADO), (0x14, 0x12, 0x11))

    luz = Image.new("L", (LADO, LADO), 0)
    pincel = ImageDraw.Draw(luz)
    cx, cy, raio = LADO * 0.36, LADO * 0.24, LADO * 0.78
    for i in range(80, 0, -1):
        r = raio * i / 80
        pincel.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(255 * (1 - i / 80) ** 1.6))
    luz = luz.filter(ImageFilter.GaussianBlur(LADO / 22))
    base = Image.composite(Image.new("RGB", (LADO, LADO), (0x39, 0x33, 0x30)), base, luz)

    chao = Image.new("L", (LADO, LADO), 0)
    ImageDraw.Draw(chao).rectangle([0, int(LADO * CHAO), LADO, LADO], fill=190)
    chao = chao.filter(ImageFilter.GaussianBlur(LADO / 55))
    return Image.composite(Image.new("RGB", (LADO, LADO), (0x0E, 0x0C, 0x0C)), base, chao)


def sombra(imagem: Image.Image, x0, x1, base_y) -> Image.Image:
    """Elipse escura por baixo da embalagem: é o que a assenta no chão."""
    largura = x1 - x0
    camada = Image.new("L", (LADO, LADO), 0)
    ImageDraw.Draw(camada).ellipse(
        [x0 - largura * 0.42, base_y - largura * 0.10,
         x1 + largura * 0.42, base_y + largura * 0.17], fill=175)
    camada = camada.filter(ImageFilter.GaussianBlur(LADO / 34))
    return Image.composite(Image.new("RGB", (LADO, LADO), (0, 0, 0)), imagem, camada)


def silhueta(forma: str, caixa, raio, tampa, gargalo) -> Image.Image:
    """Máscara branca com o recorte da embalagem (corpo + tampa)."""
    x0, y0, x1, y1 = caixa
    largura = x1 - x0
    mascara = Image.new("L", (LADO, LADO), 0)
    p = ImageDraw.Draw(mascara)

    if forma == "pano":
        # Desenha de baixo para cima, para a camada de cima ficar por cima.
        alt = (y1 - y0) * 0.56
        for i, desvio in enumerate((30, 15, 0)):
            topo = y1 - alt - (2 - i) * (y1 - y0 - alt) / 2
            p.rounded_rectangle([x0 + (2 - i) * desvio * .0 + desvio * .6, topo,
                                 x1 - desvio * .6, topo + alt], radius=14, fill=255)
        return mascara

    ombro = y0 + (y1 - y0) * gargalo if gargalo else y0
    if gargalo:
        p.rounded_rectangle([x0 + largura * 0.33, y0, x1 - largura * 0.33, ombro + raio],
                            radius=raio * 0.45, fill=255)
    p.rounded_rectangle([x0, ombro, x1, y1], radius=raio, fill=255)
    if tampa:
        tx = largura * (0.31 if gargalo else 0.06)
        p.rounded_rectangle([x0 + tx, y0 - tampa, x1 - tx, y0 + raio * 0.5],
                            radius=raio * 0.3, fill=255)
    return mascara


def desenha(produto: dict) -> Image.Image:
    FORMAS = {
        #            larg  alt   raio tampa gargalo
        "garrafa": (0.34, 0.60, 30, 52, 0.15),
        "spray":   (0.31, 0.55, 24, 86, 0.17),
        "boiao":   (0.40, 0.32, 34, 30, 0.0),
        # A pilha de toalhas precisa de ser alta: a etiqueta assenta na
        # camada de cima e, com uma pilha baixa, o nome ficava ilegível.
        "pano":    (0.50, 0.46, 16, 0, 0.0),
    }
    fw, fh, raio, tampa, gargalo = FORMAS.get(produto.get("forma", "garrafa"), FORMAS["garrafa"])

    imagem = fundo()
    largura, altura = LADO * fw, LADO * fh
    x0 = (LADO - largura) / 2
    base_y = LADO * CHAO
    caixa = (x0, base_y - altura, x0 + largura, base_y)

    imagem = sombra(imagem, x0, x0 + largura, base_y)

    # Corpo: um degradé claramente mais claro do que a parede, senão a
    # embalagem desaparece no fundo.
    recorte = silhueta(produto.get("forma", "garrafa"), caixa, raio, tampa, gargalo)
    topo = int(caixa[1] - tampa - 4)
    corpo = degrade_vertical((0, topo, LADO, LADO), (0x5A, 0x51, 0x4C), (0x1C, 0x19, 0x18))
    tela = Image.new("RGB", (LADO, LADO), (0x1C, 0x19, 0x18))
    tela.paste(corpo, (0, topo))
    imagem = Image.composite(tela, imagem, recorte)

    # Aresta iluminada à esquerda e reflexo frio à direita, ambos dentro da
    # silhueta (por isso a máscara é multiplicada pelo recorte).
    if produto.get("forma") != "pano":
        brilho = Image.new("RGB", (LADO, LADO), (0, 0, 0))
        mb = Image.new("L", (LADO, LADO), 0)
        pb, pm = ImageDraw.Draw(brilho), ImageDraw.Draw(mb)
        y_ini = caixa[1] + (altura * gargalo if gargalo else 0)
        pb.rectangle([x0, y_ini, x0 + largura * 0.13, base_y], fill=OURO_BRILHO)
        pm.rectangle([x0, y_ini, x0 + largura * 0.13, base_y], fill=235)
        pb.rectangle([x0 + largura * 0.88, y_ini + altura * .05, x0 + largura, base_y - altura * .03],
                     fill=(0x9A, 0x8C, 0x76))
        pm.rectangle([x0 + largura * 0.88, y_ini + altura * .05, x0 + largura, base_y - altura * .03],
                     fill=150)
        brilho = brilho.filter(ImageFilter.GaussianBlur(9))
        mb = Image.composite(mb.filter(ImageFilter.GaussianBlur(10)),
                             Image.new("L", (LADO, LADO), 0), recorte)
        imagem = Image.composite(brilho, imagem, mb)

    imagem = rotulo(imagem, caixa, produto["nome"], produto.get("familia", ""),
                    produto.get("forma", "garrafa"))
    imagem = reflexo(imagem, int(base_y))
    return vinheta(imagem)


def rotulo(imagem, caixa, titulo, familia, forma) -> Image.Image:
    x0, y0, x1, y1 = caixa
    largura, altura = x1 - x0, y1 - y0
    rx0, rx1 = x0 + largura * 0.07, x1 - largura * 0.07
    if forma == "pano":
        # A etiqueta ocupa quase toda a camada de cima da pilha.
        ry0 = y0 + altura * 0.05
        ry1 = y0 + altura * 0.47
    else:
        ry0 = y0 + altura * (0.40 if not forma == "boiao" else 0.20)
        ry1 = ry0 + altura * (0.44 if not forma == "boiao" else 0.62)

    camada = imagem.copy()
    p = ImageDraw.Draw(camada)
    p.rounded_rectangle([rx0, ry0, rx1, ry1], radius=9, fill=(0x11, 0x0F, 0x0E))
    p.rounded_rectangle([rx0, ry0, rx1, ry1], radius=9, outline=OURO, width=3)

    caixa_alt = ry1 - ry0
    cx = (rx0 + rx1) / 2

    # Escudo PF
    lado_e = min((rx1 - rx0) * 0.30, caixa_alt * 0.34)
    ey = ry0 + caixa_alt * 0.10
    p.polygon([(cx - lado_e / 2, ey + lado_e * 0.14), (cx, ey), (cx + lado_e / 2, ey + lado_e * 0.14),
               (cx + lado_e / 2, ey + lado_e * 0.60), (cx, ey + lado_e), (cx - lado_e / 2, ey + lado_e * 0.60)],
              outline=OURO_ALTO, width=3)
    f_pf = fonte(int(lado_e * 0.44), True)
    b = p.textbbox((0, 0), "PF", font=f_pf)
    p.text((cx - (b[2] - b[0]) / 2, ey + lado_e * 0.31 - (b[3] - b[1]) / 2), "PF",
           font=f_pf, fill=OURO_ALTO)

    # Nome, quebrado para caber
    f_nome = fonte(int(caixa_alt * 0.115), True)
    limite = (rx1 - rx0) - 26
    linhas, linha = [], ""
    for palavra in titulo.upper().split():
        tentativa = (linha + " " + palavra).strip()
        if p.textlength(tentativa, font=f_nome) <= limite:
            linha = tentativa
        else:
            linhas.append(linha) if linha else None
            linha = palavra
    if linha:
        linhas.append(linha)

    y = ey + lado_e + caixa_alt * 0.10
    for texto in linhas[:3]:
        p.text((cx - p.textlength(texto, font=f_nome) / 2, y), texto, font=f_nome, fill=OSSO)
        y += caixa_alt * 0.135

    p.line([cx - (rx1 - rx0) * 0.20, ry1 - caixa_alt * 0.20,
            cx + (rx1 - rx0) * 0.20, ry1 - caixa_alt * 0.20], fill=OURO, width=2)
    f_fam = fonte(int(caixa_alt * 0.085))
    espacado = " ".join(familia.upper())
    p.text((cx - p.textlength(espacado, font=f_fam) / 2, ry1 - caixa_alt * 0.155),
           espacado, font=f_fam, fill=OURO)
    return camada


def reflexo(imagem: Image.Image, base_y: int) -> Image.Image:
    altura = int(LADO * 0.15)
    tira = imagem.crop((0, base_y - altura, LADO, base_y)).transpose(Image.FLIP_TOP_BOTTOM)
    tira = tira.filter(ImageFilter.GaussianBlur(7))
    desvanecer = Image.new("L", (LADO, altura))
    d = ImageDraw.Draw(desvanecer)
    for y in range(altura):
        d.line([0, y, LADO, y], fill=int(70 * (1 - y / altura) ** 1.8))
    saida = imagem.copy()
    saida.paste(Image.composite(tira, imagem.crop((0, base_y, LADO, base_y + altura)), desvanecer),
                (0, base_y))
    return saida


def vinheta(imagem: Image.Image) -> Image.Image:
    """Vinheta leve. A primeira versão usava 150 e engolia a imagem toda."""
    mascara = Image.new("L", (LADO, LADO), 0)
    p = ImageDraw.Draw(mascara)
    for i in range(60):
        f = i / 60
        m = LADO * 0.30 * f
        p.ellipse([m, m, LADO - m, LADO - m], fill=int(70 * f ** 2))
    mascara = mascara.filter(ImageFilter.GaussianBlur(LADO / 14))
    return Image.composite(imagem, Image.new("RGB", (LADO, LADO), (0, 0, 0)),
                           Image.eval(mascara, lambda v: 255 - v))


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    fichas = sorted(PRODUTOS.glob("*.json"))
    if not fichas:
        raise SystemExit(f"Não há produtos em {PRODUTOS}")

    for ficha in fichas:
        produto = json.loads(ficha.read_text(encoding="utf-8"))
        imagem = desenha(produto)
        for lado in MEDIDAS:
            reduzida = imagem.resize((lado, lado), Image.LANCZOS)
            reduzida.save(DESTINO / f"{produto['slug']}-{lado}.webp", "WEBP", quality=84, method=6)
            try:
                reduzida.save(DESTINO / f"{produto['slug']}-{lado}.avif", "AVIF", quality=60)
            except Exception:
                pass
        print(f"→ {produto['slug']:26} {produto.get('forma','garrafa')}")

    peso = sum(f.stat().st_size for f in DESTINO.iterdir()) / 1024
    print(f"\n{len(fichas)} produtos · {len(list(DESTINO.iterdir()))} ficheiros · {peso:.0f} kB")


if __name__ == "__main__":
    main()
