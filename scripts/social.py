#!/usr/bin/env python3
"""Desenha o cartão de partilha (og.png), 1200x630.

É a imagem que aparece no WhatsApp, no Facebook e no X quando alguém partilha o
endereço do site. Existia como ficheiro feito à mão, sem script — ninguém sabia
refazê-la, e por isso ficou com o slogan «PROTEÇÃO ABSOLUTA» muito depois de
esse slogan ter saído do site, e com a estrela a sair como quadrado vazio,
porque a fonte não tem esse glifo.

Usa as fontes REAIS do site. Estão em woff2, que o Pillow não lê, portanto
converte-se com o fontTools para TTF numa pasta temporária. Assim o cartão não
fica com uma fonte substituta que não é a da marca.

NÃO leva a nota do Google, o número de avaliações nem o telefone: foi pedido que
saíssem. Também não leva números escritos à mão que envelheçam sozinhos.

Correr:  python3 scripts/social.py   (depois de scripts/logotipo.py)
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
MARCA = RAIZ / "assets" / "img" / "marca"
FONTES = RAIZ / "assets" / "fonts"

L, A = 1200, 630
TINTA = (0x1A, 0x17, 0x17)
ELEVADO = (0x2B, 0x26, 0x26)
OSSO = (0xED, 0xE8, 0xDF)
OSSO_MEIO = (0xB5, 0xAE, 0xA3)
OURO = (0xAC, 0x8A, 0x39)
OURO_ALTO = (0xCB, 0xAD, 0x4F)

# O sobrescrito NÃO repete «Perfect Finish Studio»: isso já está escrito no
# logótipo ao lado, e repeti-lo gastava a única linha pequena do cartão.
SOBRESCRITO = "LEIRIA · DESDE 2009"
TITULO = ["ESTÚDIO DE", "CUSTOMIZAÇÃO", "PREMIUM"]
SERVICOS = "Tira mossas · Películas · PPF · Envelopamento · Car detail"

# A COLUNA DO TEXTO. O tamanho do título não é escolhido a olho: mede-se a
# linha mais larga e reduz-se até caber, com uma asserção a travar o resto. É o
# que impede o cartão de sair com uma palavra encostada à margem se alguém
# mudar as palavras.
COLUNA_X = 512
COLUNA_FIM = 1136


def ttf(pasta: Path, nome: str) -> Path:
    """woff2 → ttf, porque o Pillow não abre woff2."""
    destino = pasta / f"{nome}.ttf"
    f = TTFont(FONTES / f"{nome}.woff2")
    f.flavor = None
    f.save(destino)
    return destino


def espacado(texto: str, espaco: float) -> str:
    """Espaçamento entre letras à mão: o Pillow não tem letter-spacing."""
    return espaco and (" " * 0).join(texto) or texto


def escreve_espacado(d, xy, texto, fonte, cor, espaco):
    x, y = xy
    for c in texto:
        d.text((x, y), c, font=fonte, fill=cor)
        x += d.textlength(c, font=fonte) + espaco
    return x


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp)
        archivo = ttf(p, "archivo-latin")
        inter = ttf(p, "inter-tight-latin")
        f_sobre = ImageFont.truetype(archivo, 22)
        f_serv = ImageFont.truetype(inter, 25)

        img = Image.new("RGB", (L, A), TINTA)
        d = ImageDraw.Draw(img)

        # Fundo: um foco quente vindo do canto superior esquerdo, como as
        # luminárias hexagonais da oficina. Feito por camadas de elipses, não
        # por gradiente linear, para não parecer um degradé de folha de cálculo.
        luz = Image.new("L", (L, A), 0)
        pin = ImageDraw.Draw(luz)
        for i in range(70, 0, -1):
            r = max(L, A) * 1.15 * i / 70
            pin.ellipse([-L * 0.25 - r / 2, -A * 0.5 - r / 2,
                         -L * 0.25 + r / 2, -A * 0.5 + r / 2],
                        fill=int(46 * (1 - i / 70) ** 1.6))
        img = Image.composite(Image.new("RGB", (L, A), ELEVADO), img, luz)
        d = ImageDraw.Draw(img)

        # O logótipo à esquerda. 300 e não 340: a 340 a palavra «STUDIO» do
        # logótipo chegava aos 460 px e tocava na coluna do texto.
        logo = Image.open(MARCA / "logotipo-1600.png").convert("RGBA")
        logo.thumbnail((300, 300), Image.LANCZOS)
        img.paste(logo, (128, (A - logo.height) // 2), logo)

        # O corpo do título: o maior que faça a linha mais larga caber na coluna.
        largura = COLUNA_FIM - COLUNA_X
        corpo = 84
        while corpo > 40:
            f = ImageFont.truetype(archivo, corpo)
            if max(d.textlength(l, font=f) for l in TITULO) <= largura:
                break
            corpo -= 2
        f_tit = ImageFont.truetype(archivo, corpo)
        maior = max(d.textlength(l, font=f_tit) for l in TITULO)
        assert maior <= largura, f"o título não cabe: {maior:.0f} px em {largura}"
        print(f"   título a {corpo} px; linha mais larga {maior:.0f} de {largura} px")

        passo = int(corpo * 0.98)
        # Bloco centrado na vertical: sobrescrito + título + filete + serviços.
        # A conta tem de incluir TUDO, incluindo a altura da linha dos
        # serviços: sem ela o bloco saía 40 px acima do centro (medido).
        alturaSobre = 52
        alturaFilete = 14 + 2 + 28
        alturaServicos = f_serv.getbbox(SERVICOS)[3]
        alturaBloco = alturaSobre + len(TITULO) * passo + alturaFilete + alturaServicos
        y = (A - alturaBloco) // 2
        x = COLUNA_X

        escreve_espacado(d, (x, y), SOBRESCRITO, f_sobre, OURO, 5.0)
        y += 52

        for i, linha in enumerate(TITULO):
            d.text((x, y), linha, font=f_tit, fill=OURO_ALTO if i == 1 else OSSO)
            y += passo

        y += 14
        d.line([(x, y), (x + 230, y)], fill=OURO, width=2)

        y += 28
        d.text((x, y), SERVICOS, font=f_serv, fill=OSSO_MEIO)
        fimServicos = d.textlength(SERVICOS, font=f_serv)
        assert x + fimServicos <= COLUNA_FIM + 12, "a linha dos serviços passa a margem"

        img.save(MARCA / "og.png", optimize=True)
        k = (MARCA / "og.png").stat().st_size / 1024
        print(f"→ og.png  {L}x{A}  {k:.1f} kB")
        for proibido in ("4,9", "★", "968", "PROTEÇÃO ABSOLUTA"):
            assert proibido not in " ".join([SOBRESCRITO, *TITULO, SERVICOS]), proibido
        print("   sem nota, sem avaliações, sem telefone, sem o slogan antigo")


if __name__ == "__main__":
    main()
