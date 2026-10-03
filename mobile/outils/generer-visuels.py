"""Icônes et écran de démarrage de l'application Android EduSphere.

Génère, à partir du logo du site, les images natives du projet Android
(mobile/android/app/src/main/res) : icône classique et ronde, icône adaptative
(Android 8+), écran de démarrage. Couleurs de la marque, inchangées.

    python mobile/outils/generer-visuels.py
"""
import os
from collections import deque
from PIL import Image, ImageDraw, ImageFont, ImageFilter

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LOGO = os.path.join(RACINE, 'frontend', 'src', 'assets', 'logo-icon.png')
RES = os.path.join(RACINE, 'mobile', 'android', 'app', 'src', 'main', 'res')

MARINE, BLEU, TEAL, VERT, OR = (11, 30, 61), (29, 95, 168), (21, 122, 140), (31, 138, 84), (240, 173, 46)
POLICE = 'C:/Windows/Fonts/segoeuib.ttf'
POLICE_SOUS = 'C:/Windows/Fonts/seguisb.ttf'


def logo_transparent():
    """Le fichier du logo a un fond presque blanc : on le rend transparent
    (remplissage depuis les bords), sans toucher aux couleurs du logo."""
    im = Image.open(LOGO).convert('RGBA')
    w, h = im.size
    px = im.load()
    clair = lambda p: p[0] > 228 and p[1] > 228 and p[2] > 228
    vus = set()
    file = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while file:
        x, y = file.popleft()
        if (x, y) in vus or not (0 <= x < w and 0 <= y < h):
            continue
        vus.add((x, y))
        if clair(px[x, y]):
            px[x, y] = (255, 255, 255, 0)
            file.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im.crop(im.getbbox())


def place(fond, logo, part):
    l = logo.copy()
    l.thumbnail((int(fond.width * part), int(fond.height * part)), Image.LANCZOS)
    fond.alpha_composite(l, ((fond.width - l.width) // 2, (fond.height - l.height) // 2))
    return fond


def disque(taille, couleur=(255, 255, 255, 255)):
    m = Image.new('L', (taille * 4, taille * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, taille * 4 - 1, taille * 4 - 1), fill=255)
    m = m.resize((taille, taille), Image.LANCZOS)
    if len(couleur) == 4 and couleur[3] < 255:
        m = m.point(lambda v: v * couleur[3] // 255)
    d = Image.new('RGBA', (taille, taille), couleur[:3] + (255,))
    d.putalpha(m)
    return d


def flou(image, rayon):
    """Floute une forme sur une toile agrandie, pour que le flou ne soit pas coupé."""
    marge = int(rayon * 3)
    toile = Image.new('RGBA', (image.width + 2 * marge, image.height + 2 * marge), (0, 0, 0, 0))
    toile.alpha_composite(image, (marge, marge))
    return toile.filter(ImageFilter.GaussianBlur(rayon))


def degrade(w, h):
    """Dégradé de la marque, en diagonale : marine, bleu, sarcelle, vert."""
    arrets = [(0, MARINE), (.42, BLEU), (.68, TEAL), (1, VERT)]
    petit = Image.new('RGB', (64, 96))
    for y in range(96):
        for x in range(64):
            t = (x / 63 * .45 + y / 95 * .55)
            for (a, ca), (b, cb) in zip(arrets, arrets[1:]):
                if a <= t <= b:
                    k = (t - a) / (b - a)
                    petit.putpixel((x, y), tuple(int(ca[i] + (cb[i] - ca[i]) * k) for i in range(3)))
                    break
    return petit.resize((w, h), Image.BICUBIC).convert('RGBA')


def glyphe(taille, part=.46, anneau=.40):
    """Marque de l'icône : un E blanc géométrique et le point doré de la marque,
    dans un fin anneau (la « sphère »). Dessiné en 4x puis réduit (bords nets)."""
    T = taille * 4
    im = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if anneau:
        r, ep = T * anneau, T * .02
        d.ellipse((T / 2 - r, T / 2 - r, T / 2 + r, T / 2 + r), outline=(255, 255, 255, 70), width=int(ep))
    g = T * part                                  # côté du carré du glyphe
    x0, y0 = (T - g) / 2 - g * .05, (T - g) / 2
    u = lambda a, b, c, e: (x0 + a * g, y0 + b * g, x0 + c * g, y0 + e * g)
    rr = g * .07
    blanc = (255, 255, 255, 255)
    rr = g * .045
    d.rounded_rectangle(u(.14, .08, .31, .92), radius=rr, fill=blanc)    # fût
    d.rounded_rectangle(u(.14, .08, .82, .24), radius=rr, fill=blanc)    # barre haute
    d.rounded_rectangle(u(.14, .42, .66, .58), radius=rr, fill=blanc)    # barre du milieu
    d.rounded_rectangle(u(.14, .76, .82, .92), radius=rr, fill=blanc)    # barre basse
    d.rounded_rectangle(u(.75, .425, .90, .575), radius=rr * .6, fill=OR + (255,))  # point doré
    return im.resize((taille, taille), Image.LANCZOS)


def forme(taille, rond):
    m = Image.new('L', (taille * 4, taille * 4), 0)
    if rond:
        ImageDraw.Draw(m).ellipse((0, 0, taille * 4 - 1, taille * 4 - 1), fill=255)
    else:
        ImageDraw.Draw(m).rounded_rectangle((0, 0, taille * 4 - 1, taille * 4 - 1), radius=taille * 4 * .22, fill=255)
    return m.resize((taille, taille), Image.LANCZOS)


def icones(logo):
    """Icône de l'application : pas le logo complet, mais une marque simple
    (E blanc, point doré, anneau) sur le dégradé EduSphere."""
    for dossier, t in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
        rep = os.path.join(RES, f'mipmap-{dossier}')
        for nom, rond in (('ic_launcher.png', False), ('ic_launcher_round.png', True)):
            fond = degrade(t, t)
            fond.alpha_composite(glyphe(t, part=.50))
            fond.putalpha(forme(t, rond))
            fond.save(os.path.join(rep, nom))
        f = t * 108 // 48                          # icône adaptative (108 dp)
        degrade(f, f).convert('RGB').save(os.path.join(rep, 'ic_launcher_background.png'))
        glyphe(f, part=.30, anneau=.29).save(os.path.join(rep, 'ic_launcher_foreground.png'))


def ecran(w, h, logo):
    im = degrade(w, h)
    court = min(w, h)
    # halo très léger derrière le sceau, comme sur le site
    cy = int(h * (.42 if h > w else .40))
    halo = flou(disque(int(court * .50), (255, 255, 255, 30)), court * .04)
    im.alpha_composite(halo, ((w - halo.width) // 2, cy - halo.height // 2))
    # sceau blanc avec ombre douce
    s = int(court * .30)
    ombre = flou(disque(s, (0, 0, 0, 80)), s * .07)
    im.alpha_composite(ombre, ((w - ombre.width) // 2, cy - ombre.height // 2 + int(s * .06)))
    im.alpha_composite(place(disque(s), logo, .64), ((w - s) // 2, cy - s // 2))
    # nom + point doré, puis sous-titre espacé
    d = ImageDraw.Draw(im)
    p = ImageFont.truetype(POLICE, int(court * .105))
    nom = 'EduSphere'
    lw = d.textlength(nom, font=p)
    point = int(court * .022)
    x = (w - lw - point * 2.2) / 2
    y = cy + s // 2 + int(court * .07)
    d.text((x, y), nom, font=p, fill=(255, 255, 255, 255))
    asc = p.getbbox(nom)
    pc = y + (asc[1] + asc[3]) / 2
    d.rounded_rectangle((x + lw + point * 1.0, pc - point / 2, x + lw + point * 2.0, pc + point / 2), radius=point * .25, fill=OR)
    ps = ImageFont.truetype(POLICE_SOUS, int(court * .032))
    sous = ' '.join('PLATEFORME DE GESTION SCOLAIRE')
    sw = d.textlength(sous, font=ps)
    d.text(((w - sw) / 2, y + asc[3] + int(court * .045)), sous, font=ps, fill=(214, 228, 244, 215))
    return im.convert('RGB')


def ecrans(logo):
    # Écran natif affiché pendant le chargement : le seul dégradé de la marque.
    # L'animation d'ouverture de l'application (frontend/src/mobile) y
    # construit ensuite le logo et le nom : pas de logo en double.
    # (ecran(w, h, logo) donne la version fixe avec sceau et nom, si besoin.)
    for dossier in os.listdir(RES):
        chemin = os.path.join(RES, dossier, 'splash.png')
        if dossier.startswith('drawable') and os.path.exists(chemin):
            w, h = Image.open(chemin).size
            degrade(w, h).convert('RGB').save(chemin, optimize=True)


if __name__ == '__main__':
    logo = logo_transparent()
    icones(logo)
    ecrans(logo)
    print('icônes et écrans de démarrage générés')
