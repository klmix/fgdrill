#!/usr/bin/env python3
"""Bereitet ein Charakterbild so auf, wie es die Icons im Projekt haben.

    python tools/make-icon.py ggst jam pfad/zum/bild.png
    python tools/make-icon.py sf6 mai https://example.com/mai.png

Was passiert:
  1. Rand wegschneiden. Viele Wiki-Icons haben einen weichen, runden
     Rahmen. Geschnitten wird auf den voll deckenden Bereich - damit faellt
     der Rahmen weg und das Gesicht fuellt die Kachel wie bei den anderen.
  2. Mittig auf Quadrat. Nicht jede Vorlage ist quadratisch; beim blossen
     Skalieren entstuende sonst ein Rand.
  3. Auf 134 Pixel bringen - die Groesse aller Icons im Projekt.
  4. Was noch durchsichtig ist, auf den Kachelgrund legen.
  5. Auf 256 Farben bringen. Bei 27 bis 60 Pixeln Anzeigegroesse ist davon
     nichts zu sehen, spart aber gut die Haelfte.

Braucht Pillow:  pip install pillow
"""

import argparse
import os
import sys
import urllib.request

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow fehlt. Installieren mit:  pip install pillow")

KANTE = 134          # Kantenlaenge aller Icons im Projekt
FARBEN = 256         # Palette; darunter faengt es an zu bandieren

# Der Grund, auf den durchsichtige Stellen gelegt werden. Er sollte zur
# Kachel passen, sonst zeichnet sich eine Ecke ab.
GRUND = {
    "ggst":  (58, 56, 56),
    "sf6":   (58, 56, 56),
    "bbcf":  (58, 56, 56),
    "gbvsr": (58, 56, 56),
}
GRUND_VORGABE = (58, 56, 56)

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lade(quelle):
    if quelle.startswith(("http://", "https://")):
        anfrage = urllib.request.Request(
            quelle, headers={"User-Agent": "FGDrills icon tool"})
        with urllib.request.urlopen(anfrage) as antwort:
            import io
            return Image.open(io.BytesIO(antwort.read()))
    return Image.open(quelle)


def rand_weg(im):
    """Schneidet auf den voll deckenden Bereich - weiche Rahmen fallen weg."""
    if im.mode != "RGBA":
        return im

    voll = im.getchannel("A").point(lambda v: 255 if v >= 250 else 0)
    kasten = voll.getbbox()
    return im.crop(kasten) if kasten else im


def quadrat(im):
    kante = min(im.size)
    links = (im.width - kante) // 2
    oben = (im.height - kante) // 2
    return im.crop((links, oben, links + kante, oben + kante))


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("spiel", help="Kennung des Spiels, z.B. ggst")
    p.add_argument("charakter", help="Kennung des Charakters, z.B. jam")
    p.add_argument("bild", help="Datei oder Adresse")
    p.add_argument("--kein-zuschnitt", action="store_true",
                   help="den Rand stehen lassen")
    p.add_argument("--grund", metavar="RRGGBB",
                   help="eigene Grundfarbe fuer durchsichtige Stellen")
    p.add_argument("--kante", type=int, default=KANTE, help=f"Groesse (Vorgabe {KANTE})")
    args = p.parse_args()

    im = lade(args.bild).convert("RGBA")
    vorher = im.size

    if not args.kein_zuschnitt:
        im = rand_weg(im)
    im = quadrat(im).resize((args.kante, args.kante), Image.LANCZOS)

    if args.grund:
        farbe = tuple(int(args.grund.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    else:
        farbe = GRUND.get(args.spiel, GRUND_VORGABE)

    grund = Image.new("RGBA", im.size, farbe + (255,))
    flach = Image.alpha_composite(grund, im).convert("RGB")

    ordner = os.path.join(WURZEL, "assets", "chars", args.spiel)
    os.makedirs(ordner, exist_ok=True)
    ziel = os.path.join(ordner, args.charakter + ".png")

    flach.quantize(colors=FARBEN, method=Image.MEDIANCUT,
                   dither=Image.FLOYDSTEINBERG).save(ziel, optimize=True)

    print(f"{vorher[0]}x{vorher[1]} -> {args.kante}x{args.kante}, "
          f"{os.path.getsize(ziel) / 1024:.1f} KB")
    print(f"geschrieben: {os.path.relpath(ziel, WURZEL)}")
    print(f"Nicht vergessen: {{ id: \"{args.charakter}\", name: \"...\", short: \"..\" }} "
          f"in games/{args.spiel}.js eintragen.")


if __name__ == "__main__":
    main()
