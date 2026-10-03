"""Découpe le logo EduSphere en calques pour l'animation de l'application Android.

Calques (même cadre, superposables) : E, S, croissant doré, tête, feuilles,
pixels. Les couleurs du logo ne sont pas modifiées.

    python mobile/outils/decouper-logo.py
"""
import os
from collections import deque
from PIL import Image

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SOURCE = os.path.join(RACINE, 'frontend', 'src', 'assets', 'logo-full.png')
SORTIE = os.path.join(RACINE, 'frontend', 'src', 'mobile', 'logo')
os.makedirs(SORTIE, exist_ok=True)

im = Image.open(SOURCE).convert('RGBA')
W, H = im.size
# Emblème seul (sans le nom) : partie haute du logo.
cadre = (int(W * .30), int(H * .17), int(W * .68), int(H * .59))
im = im.crop(cadre)
w, h = im.size
px = im.load()


def fond(p):
    return p[0] > 225 and p[1] > 225 and p[2] > 225


def dore(p):
    r, g, b, _ = p
    return r > 190 and g > 140 and b < 120 and r - b > 90


def sombre(p):
    r, g, b, _ = p
    return (r + g + b) / 3 < 75 and b < 110


masque = [[None] * w for _ in range(h)]
for y in range(h):
    for x in range(w):
        p = px[x, y]
        if fond(p):
            continue
        masque[y][x] = 'dore' if dore(p) else ('sombre' if sombre(p) else 'couleur')

# Composantes connexes de chaque famille de couleur.
vu = [[False] * w for _ in range(h)]
composantes = []
for y in range(h):
    for x in range(w):
        if masque[y][x] is None or vu[y][x]:
            continue
        fam = masque[y][x]
        pts = []
        q = deque([(x, y)]); vu[y][x] = True
        while q:
            a, b = q.popleft(); pts.append((a, b))
            for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                if 0 <= c < w and 0 <= d < h and not vu[d][c] and masque[d][c] == fam:
                    vu[d][c] = True; q.append((c, d))
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        composantes.append({'fam': fam, 'pts': pts, 'n': len(pts),
                            'cx': sum(xs) / len(xs) / w, 'cy': sum(ys) / len(ys) / h,
                            'bbox': (min(xs) / w, min(ys) / h, max(xs) / w, max(ys) / h)})

calques = {nom: Image.new('RGBA', (w, h), (0, 0, 0, 0)) for nom in ('e', 's', 'dore', 'tete', 'feuilles', 'pixels')}


def classer(c):
    x0, y0, x1, y1 = c['bbox']
    taille = max(x1 - x0, y1 - y0)
    if c['n'] < 40:
        return None                                  # poussières d'anticrénelage
    if c['cx'] > .62 and c['cy'] < .30 and taille < .12:
        return 'pixels'                              # petits carrés en haut à droite
    if c['fam'] == 'dore':
        return 'dore'
    if c['fam'] == 'sombre':
        if .35 < c['cx'] < .65 and .45 < c['cy'] < .70 and taille < .14:
            return 'tete'                            # le rond du personnage
        if c['cy'] > .62 and .25 < c['cx'] < .80 and y0 > .55:
            return 'feuilles'
        return 'e'
    # Couleurs : le S, sauf l'arc du haut du cercle (fin du E, qui vire au
    # bleu) et le liseré clair de la barre du E.
    if c['cx'] < .36 or (c['cy'] < .14 and c['cx'] < .80):
        return 'e'
    return 's'


for c in composantes:
    nom = classer(c)
    if not nom:
        continue
    for x, y in c['pts']:
        calques[nom].putpixel((x, y), px[x, y])

# La tête touche les feuilles par l'anticrénelage : on la sépare par la
# géométrie (le blob du haut, au-dessus de la ligne où les feuilles commencent).
feuilles = calques['feuilles']
fa = feuilles.load()
lignes = [y for y in range(h) if any(fa[x, y][3] > 0 for x in range(w))]
vide = None
for y in range(lignes[0], lignes[-1]):
    if not any(fa[x, y][3] > 40 for x in range(w)):
        vide = y; break
if vide is None:                                     # pas de ligne vide : coupe sous le rond
    largeurs = [(y, sum(1 for x in range(w) if fa[x, y][3] > 40)) for y in lignes]
    debut = largeurs[0][0]
    vide = next(y for y, n in largeurs if y > debut + 8 and n > 3 * max(n2 for y2, n2 in largeurs if y2 < debut + 8))
tete = calques['tete']
for y in range(lignes[0], vide):
    for x in range(w):
        if fa[x, y][3] > 0:
            tete.putpixel((x, y), fa[x, y]); fa[x, y] = (0, 0, 0, 0)

# Dans cette bande, seul le blob central et rond est la tête : les pointes
# des feuilles (à gauche et à droite) retournent au calque des feuilles.
ta = tete.load()
vus, blobs = set(), []
for y in range(h):
    for x in range(w):
        if ta[x, y][3] > 60 and (x, y) not in vus:
            pts, q = [], deque([(x, y)]); vus.add((x, y))
            while q:
                a, b = q.popleft(); pts.append((a, b))
                for c2, d2 in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= c2 < w and 0 <= d2 < h and (c2, d2) not in vus and ta[c2, d2][3] > 60:
                        vus.add((c2, d2)); q.append((c2, d2))
            blobs.append(pts)
milieu = w * (sum(x for b in blobs for x, _ in b) / max(1, sum(len(b) for b in blobs))) / w
rond = min(blobs, key=lambda b: abs(sum(x for x, _ in b) / len(b) - milieu)) if blobs else []
xs = [x for x, _ in rond]; ys = [y for _, y in rond]
x0, x1, y0, y1 = min(xs) - 2, max(xs) + 2, min(ys) - 2, max(ys) + 2
for y in range(h):
    for x in range(w):
        if ta[x, y][3] > 0 and not (x0 <= x <= x1 and y0 <= y <= y1):
            fa[x, y] = ta[x, y]; ta[x, y] = (0, 0, 0, 0)

for nom, calque in calques.items():
    calque.save(os.path.join(SORTIE, f'{nom}.png'), optimize=True)
    bb = calque.getbbox()
    print(nom, bb)

# Aperçu de contrôle : calques recomposés.
apercu = Image.new('RGBA', (w, h), (255, 255, 255, 255))
for calque in calques.values():
    apercu.alpha_composite(calque)
apercu.save(os.path.join(os.environ.get('TEMP', '.'), 'logo_recompose.png'))
print('cadre', w, h)
