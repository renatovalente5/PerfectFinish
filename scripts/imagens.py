#!/usr/bin/env python3
"""Prepara as fotografias dos trabalhos para o site.

O que entra: os ficheiros como vieram das redes sociais, em `_fonte/originais`.
O que sai: `assets/img/obras/<nome-legivel>.webp` (e `.avif`), já com as
matrículas e os rostos tapados.

Três coisas a saber antes de mexer aqui:

1. TODOS os originais têm 414x414 px. São as miniaturas que o Instagram e o
   Facebook servem, não as fotografias do telemóvel. É pouco: um tile de 400 px
   num ecrã de retina precisava de 800. Por isso exportamos duas medidas — a
   nativa (414) para a grelha, e uma ampliada por Lanczos com máscara de
   nitidez (828) para o herói, os comparadores e a lupa. A ampliação com
   Lanczos + nitidez lê-se melhor do que deixar o browser ampliar sozinho, que
   faz uma interpolação simples e devolve uma imagem mole.
   Quando o cliente enviar os originais, troca-se a pasta de origem e corre-se
   isto outra vez — o resto do site não muda.

2. As matrículas e os rostos são tapados AQUI, no ficheiro, e não por CSS.
   Um desfoque por CSS continua a servir a fotografia original a quem abrir o
   endereço da imagem. As zonas vêm de `_fonte/rgpd.json`, levantadas numa
   passagem de leitura das imagens uma a uma.

3. Não se faz mais nenhum tratamento de cor. As cores dos carros SÃO o produto
   (a película camaleão do Q7 muda de lilás para turquesa) e qualquer filtro
   global estragava isso. O escurecimento, a vinheta e o grão que uniformizam
   os fundos são feitos por CSS, onde se afinam sem voltar a exportar.

Correr:  python3 scripts/imagens.py
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
ORIGINAIS = RAIZ / "_fonte" / "originais"
ZONAS = RAIZ / "_fonte" / "rgpd.json"
MAPA = RAIZ / "_fonte" / "fotografias.json"
DESTINO = RAIZ / "assets" / "img" / "obras"

MEDIDAS = [414, 828]          # nativa e ampliada
QUALIDADE_WEBP = 82
QUALIDADE_AVIF = 58           # o AVIF aguenta números mais baixos que o WebP

# Quanto se alarga cada zona a tapar, em fracção do lado da imagem. As caixas
# vêm de leitura visual e podem ficar uns píxeis curtas; é mais barato tapar a
# mais do que deixar um canto do carácter à vista. Pouco chega: com a mistura
# de pixelização e desfoque abaixo, os caracteres perdem-se muito antes de a
# caixa acabar.
FOLGA = 0.018

# Frase que a leitura usa para marcar a chapa da própria casa (aquela que diz
# PERFECT FINISH em vez de uma matrícula). Essa não se tapa — é publicidade,
# não é dado pessoal.
DISPENSA = "não precisa de desfoque"


def zonas_por_ficheiro() -> dict[str, list[dict]]:
    if not ZONAS.exists():
        print(f"  aviso: {ZONAS.name} não existe — nada será tapado")
        return {}
    dados = json.loads(ZONAS.read_text(encoding="utf-8"))
    mapa: dict[str, list[dict]] = {}
    for entrada in dados:
        guardar = [
            r for r in entrada.get("regioes", [])
            if DISPENSA not in (r.get("nota") or "")
        ]
        if guardar:
            mapa[entrada["ficheiro"]] = guardar
    return mapa


def tapa(imagem: Image.Image, regioes: list[dict]) -> Image.Image:
    """Desfoca as zonas indicadas, com folga, sem tocar no resto da imagem."""
    largura, altura = imagem.size
    saida = imagem.copy()
    for regiao in regioes:
        x = (regiao["x"] - FOLGA) * largura
        y = (regiao["y"] - FOLGA) * altura
        w = (regiao["w"] + 2 * FOLGA) * largura
        h = (regiao["h"] + 2 * FOLGA) * altura
        caixa = (
            max(0, int(x)), max(0, int(y)),
            min(largura, int(x + w)), min(altura, int(y + h)),
        )
        if caixa[2] <= caixa[0] or caixa[3] <= caixa[1]:
            continue
        recorte = saida.crop(caixa)
        saida.paste(desfaz(recorte), caixa)
    return saida


def desfaz(recorte: Image.Image) -> Image.Image:
    """Torna a zona ilegível sem a transformar num rectângulo cinzento.

    Um desfoque gaussiano forte a sério faz a média de tudo e deixa uma placa
    de cor lisa — lê-se como censura e estraga a fotografia, que num site
    destes é o produto. Em vez disso reduz-se a zona a meia dúzia de píxeis e
    volta a esticar-se: os caracteres desaparecem por completo, mas as cores e
    as luzes do sítio mantêm-se, e o que fica parece uma chapa fora de foco.
    O desfoque suave por cima só tira os degraus da pixelização.
    """
    largura, altura = recorte.size
    grossura = max(3, round(min(largura, altura) / 7))
    pequeno = recorte.resize(
        (max(1, largura // grossura), max(1, altura // grossura)), Image.BOX)
    voltado = pequeno.resize((largura, altura), Image.BILINEAR)
    return voltado.filter(ImageFilter.GaussianBlur(max(1.5, min(largura, altura) / 12)))


def exporta(imagem: Image.Image, base: Path, lado: int) -> list[str]:
    """Grava uma medida em WebP e AVIF. Devolve o que gravou."""
    if imagem.width != lado:
        copia = imagem.resize((lado, lado), Image.LANCZOS)
        if lado > imagem.width:
            # Só ao ampliar. A máscara de nitidez devolve contraste às arestas
            # que o Lanczos suaviza; sem ela a imagem ampliada parece embaciada.
            copia = copia.filter(ImageFilter.UnsharpMask(radius=1.4, percent=105, threshold=3))
    else:
        copia = imagem

    feitos = []
    caminho = base.with_name(f"{base.name}-{lado}.webp")
    copia.save(caminho, "WEBP", quality=QUALIDADE_WEBP, method=6)
    feitos.append(caminho.name)

    caminho = base.with_name(f"{base.name}-{lado}.avif")
    try:
        copia.save(caminho, "AVIF", quality=QUALIDADE_AVIF)
        feitos.append(caminho.name)
    except Exception as erro:  # noqa: BLE001 — o AVIF é um extra; o WebP chega
        print(f"    (AVIF falhou em {base.name}-{lado}: {erro})")
    return feitos


def main() -> None:
    if not MAPA.exists():
        sys.exit(f"Falta {MAPA} — é o mapa de «nome no site» → «ficheiro original».")

    mapa = json.loads(MAPA.read_text(encoding="utf-8"))
    regioes = zonas_por_ficheiro()

    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True, exist_ok=True)

    tapadas = 0
    total = 0
    for nome, ficheiro in sorted(mapa.items()):
        origem = ORIGINAIS / ficheiro
        if not origem.exists():
            sys.exit(f"Não encontrei {origem}")

        imagem = Image.open(origem).convert("RGB")
        marcas = regioes.get(ficheiro, [])
        if marcas:
            imagem = tapa(imagem, marcas)
            tapadas += 1

        for lado in MEDIDAS:
            exporta(imagem, DESTINO / nome, lado)
        total += 1
        etiqueta = f"  [{len(marcas)} zona(s) tapada(s)]" if marcas else ""
        print(f"→ {nome:38} {ficheiro[:26]}…{etiqueta}")

    peso = sum(f.stat().st_size for f in DESTINO.iterdir()) / 1024
    print(f"\n{total} fotografias · {tapadas} com zonas tapadas · "
          f"{len(list(DESTINO.iterdir()))} ficheiros · {peso:.0f} kB no total")


if __name__ == "__main__":
    main()
