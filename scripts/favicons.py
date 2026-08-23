#!/usr/bin/env python3
"""Gera os ficheiros PNG do logótipo: favicon, atalho do iOS e imagem social.

Tudo sai do vectorial original (_fonte/logo.pdf), rasterizado uma única vez a
alta resolução com o Cairo e depois reduzido com o Pillow. Reduzir a partir de
um mestre grande dá um resultado mais limpo do que rasterizar directo ao tamanho
pequeno — o traço fino do escudo a 32 px é o caso onde isso se nota.

(Houve uma tentativa de fazer isto com o Chrome sem interface. Ficava pendurado
a partir do segundo ficheiro, por causa do perfil partilhado com o Chrome que o
utilizador tem aberto. O Cairo não tem esse problema e é muito mais rápido.)

O símbolo vai sobre uma placa escura arredondada, e não sobre transparência: um
escudo dourado de traço fino sobre nada desaparece na barra de separadores,
tanto no tema claro como no escuro. A placa usa o preto quente do próprio
logótipo.

Correr:  python3 scripts/favicons.py   (depois de scripts/logotipo.py)
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "_fonte" / "logo.pdf"
MARCA = RAIZ / "assets" / "img" / "marca"

PAGINA = 2      # a página do PDF com o desenho sem fundo pintado
RESOLUCAO = 600  # pontos por polegada do mestre

TINTA = (0x23, 0x1F, 0x20)  # o preto quente do próprio logótipo

# Caixas do desenho, em pontos, medidas por scripts/logotipo.py.
CAIXAS = {
    "logotipo": (45.53, 238.45, 557.29, 612.61),   # escudo + letras
    "simbolo": (157.36, 238.45, 437.07, 529.12),   # só o escudo
}

# ficheiro                 origem      lado  placa
FICHEIROS = [
    ("favicon-32.png",     "simbolo",    32,  True),
    ("favicon-48.png",     "simbolo",    48,  True),
    ("favicon-180.png",    "simbolo",   180,  True),
    ("favicon-192.png",    "simbolo",   192,  True),
    ("favicon-512.png",    "simbolo",   512,  True),
    ("simbolo-1024.png",   "simbolo",  1024, False),
    ("logotipo-1600.png",  "logotipo", 1600, False),
]

RESPIRO_PLACA = 0.17  # fracção do lado deixada em volta do escudo, dentro da placa
RAIO_PLACA = 0.22     # raio dos cantos da placa, em fracção do lado


def mestre(pasta: Path) -> Image.Image:
    """Rasteriza a página do logótipo com fundo transparente."""
    destino = pasta / "mestre"
    try:
        subprocess.run([
            "pdftocairo", "-png", "-transp", "-singlefile",
            "-r", str(RESOLUCAO),
            "-f", str(PAGINA), "-l", str(PAGINA),
            str(FONTE), str(destino),
        ], check=True, capture_output=True, timeout=180)
    except FileNotFoundError:
        sys.exit("Falta o `pdftocairo`. Instale com: brew install poppler")
    except subprocess.CalledProcessError as erro:
        sys.exit(f"pdftocairo falhou: {erro.stderr.decode(errors='replace')[:400]}")
    return Image.open(destino.with_suffix(".png")).convert("RGBA")


def recorta(imagem: Image.Image, caixa: tuple[float, float, float, float]) -> Image.Image:
    """Recorta a caixa dada em pontos, convertida para píxeis do mestre."""
    escala = RESOLUCAO / 72
    x0, y0, x1, y1 = (round(v * escala) for v in caixa)
    return imagem.crop((x0, y0, x1, y1))


def em_quadrado(desenho: Image.Image, lado: int, respiro: float) -> Image.Image:
    """Centra o desenho num quadrado transparente, com respiro à volta."""
    util = round(lado * (1 - 2 * respiro))
    copia = desenho.copy()
    copia.thumbnail((util, util), Image.LANCZOS)
    tela = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    tela.paste(copia, ((lado - copia.width) // 2, (lado - copia.height) // 2), copia)
    return tela


def com_placa(desenho: Image.Image, lado: int) -> Image.Image:
    """Assenta o desenho numa placa escura de cantos arredondados."""
    # Desenha-se a 4x e reduz-se, porque o `rounded_rectangle` do Pillow não
    # suaviza os cantos: a 32 px directos ficam em escada.
    grande = lado * 4
    placa = Image.new("RGBA", (grande, grande), (0, 0, 0, 0))
    ImageDraw.Draw(placa).rounded_rectangle(
        [0, 0, grande - 1, grande - 1],
        radius=round(grande * RAIO_PLACA), fill=(*TINTA, 255))
    placa.alpha_composite(em_quadrado(desenho, grande, RESPIRO_PLACA))
    return placa.resize((lado, lado), Image.LANCZOS)


def main() -> None:
    if not FONTE.exists():
        sys.exit(f"Não encontrei {FONTE}")
    MARCA.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as pasta:
        pagina = mestre(Path(pasta))
        print(f"mestre rasterizado: {pagina.width}x{pagina.height} px a {RESOLUCAO} ppp")
        pecas = {nome: recorta(pagina, caixa) for nome, caixa in CAIXAS.items()}

    for nome, origem, lado, placa in FICHEIROS:
        desenho = pecas[origem]
        if placa:
            imagem = com_placa(desenho, lado)
        else:
            copia = desenho.copy()
            copia.thumbnail((lado, lado), Image.LANCZOS)
            imagem = copia
        imagem.save(MARCA / nome, optimize=True)
        print(f"→ {nome:22} {imagem.width:>4}x{imagem.height:<4}  {(MARCA/nome).stat().st_size/1024:7.1f} kB")

    # Um .ico para os navegadores e as ferramentas antigas que ainda pedem
    # /favicon.ico à raiz do site sem olhar ao que o HTML declara.
    com_placa(pecas["simbolo"], 256).save(
        MARCA / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"→ {'favicon.ico':22}            {(MARCA/'favicon.ico').stat().st_size/1024:7.1f} kB")


if __name__ == "__main__":
    main()
