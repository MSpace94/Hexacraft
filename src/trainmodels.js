// Les véhicules de la collection HexaTrains (venus de apercu-trains.html) : locomotives, tenders,
// voitures et wagons, dessinés en pavés texturés 16 x 16 comme les blocs.
// Conventions : 1 unité = 1 bloc ; X le long de la voie, l'avant vers +X ; y = 0 sur le dessus du
// rail ; le véhicule est centré. build(nom) renvoie un groupe dont userData donne la longueur, la
// hauteur, les places assises (seats), les attelages (couple : front, rear), les tourelles, la
// cheminée (smoke). Dans le jeu : instance(nom) (un modèle fait une fois, puis copié).
import * as T from 'three';

export const HexaTrains = (() => {
  const PX = 16;
  const Z = 1.3; // demi-largeur de la caisse
  const GAUGE = 0.72; // demi-écartement des roues
  const WT = 0.08; // épaisseur des murs

  // ---------- Textures pixel ----------
  function rng(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const shade = (c, k) => c.map((v) => v * k);
  const fill = (px, c, j) => { for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) px(x, y, c, j); };
  const colX = (px, x, c) => { for (let y = 0; y < PX; y++) px(x, y, c); };
  const rowY = (px, y, c) => { for (let x = 0; x < PX; x++) px(x, y, c); };

  function vitre(frame) {
    return (px) => {
      fill(px, frame, 5);
      for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) px(x, y, [120, 160, 190, 0.28], 6);
      for (let i = 0; i < 6; i++) { px(4 + i, 10 - i, [210, 230, 245, 0.6]); px(5 + i, 10 - i, [180, 210, 230, 0.5]); }
    };
  }
  function hublot(frame) {
    return (px) => {
      for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d < 4.8) px(x, y, x - y > 2 && x - y < 5 ? [210, 230, 245, 0.6] : [120, 160, 190, 0.28], 6);
        else if (d < 6.4) px(x, y, [196, 160, 80], 8);
        else px(x, y, frame, 5);
      }
    };
  }
  function roue(spoke, rim) {
    return (px) => {
      for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
        const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy);
        if (d > 6.2) px(x, y, rim, 6);
        else if (d < 1.9) px(x, y, shade(rim, 1.35), 4);
        else {
          const f = (((Math.atan2(dy, dx) / (Math.PI / 4)) % 1) + 1) % 1;
          px(x, y, f < 0.22 || f > 0.78 ? spoke : [18, 18, 20], 6);
        }
      }
    };
  }

  const DEFS = {
    // tôle noire bleutée du carénage, joints de panneaux
    carenage(px) {
      const c = [32, 36, 46]; fill(px, c, 4);
      colX(px, 0, shade(c, 0.62)); rowY(px, 0, shade(c, 0.78));
      for (let y = 3; y < PX; y += 5) px(2, y, shade(c, 1.6));
    },
    peinture(px) { const c = [40, 42, 48]; fill(px, c, 5); colX(px, 0, shade(c, 0.7)); },
    noir(px) { fill(px, [28, 28, 31], 6); },
    blanc(px) { fill(px, [230, 228, 220], 5); },
    rouge(px) { const c = [168, 42, 34]; fill(px, c, 8); rowY(px, 0, shade(c, 0.7)); rowY(px, 15, shade(c, 0.7)); },
    acier(px) { fill(px, [128, 132, 138], 12); },
    laiton(px) { fill(px, [190, 150, 72], 12); },
    gris(px) {
      const c = [146, 152, 160]; fill(px, c, 6);
      colX(px, 0, shade(c, 0.74)); rowY(px, 0, shade(c, 0.8));
      for (let y = 2; y < PX; y += 3) { px(2, y, shade(c, 1.25)); px(13, y, shade(c, 1.25)); }
    },
    citerne(px, rnd) {
      const c = [104, 128, 82]; fill(px, c, 12);
      for (let i = 0; i < 11; i++) {
        const x = (rnd() * PX) | 0, y = (rnd() * PX) | 0;
        px(x, y, [130, 88, 52], 10); px((x + 1) % PX, y, [108, 72, 44], 10); px(x, (y + 1) % PX, [118, 80, 48], 10);
      }
      colX(px, 0, shade(c, 0.68));
      for (let y = 1; y < PX; y += 3) px(2, y, shade(c, 1.22));
    },
    // intérieur de la cuve : rouille sombre
    cuve(px, rnd) {
      fill(px, [84, 62, 42], 14);
      for (let i = 0; i < 12; i++) px((rnd() * PX) | 0, (rnd() * PX) | 0, [58, 42, 30], 6);
      colX(px, 0, [60, 46, 32]);
    },
    vert(px) {
      const c = [38, 116, 62]; fill(px, c, 5);
      colX(px, 0, shade(c, 0.68)); colX(px, 8, shade(c, 0.84)); rowY(px, 15, shade(c, 0.7));
    },
    deux(px) {
      DEFS.vert(px);
      ['###', '..#', '###', '#..', '###'].forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '#') for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) px(5 + x * 2 + a, 3 + y * 2 + b, [234, 202, 66], 6);
      }));
    },
    toit(px) { const c = [214, 214, 204]; fill(px, c, 6); rowY(px, 7, shade(c, 0.88)); },
    charbon(px, rnd) { fill(px, [24, 24, 26], 10); for (let i = 0; i < 16; i++) px((rnd() * PX) | 0, (rnd() * PX) | 0, [72, 72, 78]); },
    bois(px) { const c = [104, 78, 52]; fill(px, c, 12); rowY(px, 0, shade(c, 0.7)); rowY(px, 8, shade(c, 0.78)); },
    // plancher : lames dans le sens de la voie
    plancher(px) {
      const c = [132, 100, 66]; fill(px, c, 10);
      for (const y of [0, 4, 8, 12]) rowY(px, y, shade(c, 0.72));
      for (const [x, y] of [[5, 1], [12, 5], [3, 9], [10, 13]]) for (let k = 0; k < 3; k++) px(x, y + k, shade(c, 0.72));
    },
    // peinture intérieure des cabines de conduite
    cabine(px) { const c = [70, 84, 66]; fill(px, c, 5); rowY(px, 0, shade(c, 0.8)); },
    plafond(px) { const c = [222, 214, 190]; fill(px, c, 4); colX(px, 0, shade(c, 0.9)); },
    // boiseries de la voiture
    boiserie(px) {
      const c = [126, 84, 50]; fill(px, c, 8);
      colX(px, 0, shade(c, 0.7)); rowY(px, 0, shade(c, 0.7));
      for (let i = 2; i < 14; i++) { px(2, i, shade(c, 1.15)); px(i, 2, shade(c, 1.15)); }
    },
    // banquettes en lattes vernies
    banc(px) { const c = [158, 108, 58]; fill(px, c, 8); for (const y of [0, 5, 10, 15]) rowY(px, y, shade(c, 0.66)); },
    rail(px) { fill(px, [92, 94, 100], 10); rowY(px, 15, [176, 178, 184]); rowY(px, 14, [150, 152, 158]); },
    phare(px) {
      fill(px, [255, 236, 168], 6);
      for (let i = 0; i < PX; i++) { px(i, 0, [70, 70, 70]); px(i, 15, [70, 70, 70]); px(0, i, [70, 70, 70]); px(15, i, [70, 70, 70]); }
      for (let i = 3; i < 7; i++) px(i, i, [255, 255, 255]);
    },
    // manomètre
    cadran(px) {
      for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        px(x, y, d > 6.2 ? [190, 150, 72] : [236, 232, 220], 4);
      }
      for (let i = 0; i < 5; i++) px(7 + i, 7 - i, [30, 30, 30]);
    },
    vitreNoir: vitre([32, 36, 46]),
    vitreGris: vitre([146, 152, 160]),
    vitreVert: vitre([38, 116, 62]),
    hublotGris: hublot([146, 152, 160]),
    roueRouge: roue([162, 40, 34], [64, 64, 68]),
    roueGrise: roue([62, 64, 68], [92, 94, 98]),
    // planches verticales peintes (fourgon rouge, wagon brun)
    rougeWagon(px) { const c = [166, 44, 36]; fill(px, c, 7); for (const x of [0, 4, 8, 12]) colX(px, x, shade(c, 0.72)); },
    brun(px) { const c = [102, 62, 44]; fill(px, c, 7); for (const x of [0, 4, 8, 12]) colX(px, x, shade(c, 0.7)); },
    brunInt(px) { const c = [140, 104, 70]; fill(px, c, 9); for (const x of [0, 5, 10]) colX(px, x, shade(c, 0.75)); },
    toitGris(px) { const c = [164, 170, 174]; fill(px, c, 6); rowY(px, 0, shade(c, 0.85)); rowY(px, 8, shade(c, 0.9)); },
    toile(px) { const c = [196, 176, 132]; fill(px, c, 10); for (let i = 0; i < PX; i += 3) { px(i, 7, shade(c, 0.8)); px(7, i, shade(c, 0.8)); } },
    jaune(px) { fill(px, [224, 188, 40], 10); },
    vertLoco(px) {
      const c = [42, 86, 60]; fill(px, c, 5);
      colX(px, 0, shade(c, 0.7)); rowY(px, 0, shade(c, 0.8));
      for (let y = 3; y < PX; y += 5) px(2, y, shade(c, 1.4));
    },
    vitreRouge: vitre([166, 44, 36]),
    vitreBrun: vitre([102, 62, 44]),
    hublotVert: hublot([42, 86, 60]),
    roueVerte: roue([46, 96, 64], [62, 62, 66]),
    vertPomme(px) {
      const c = [92, 146, 70]; fill(px, c, 5);
      colX(px, 0, shade(c, 0.72)); rowY(px, 0, shade(c, 0.82));
    },
    roueVertePomme: roue([92, 146, 70], [50, 50, 54]),
    // lot 3
    rougeVif(px) { const c = [176, 36, 32]; fill(px, c, 6); colX(px, 0, shade(c, 0.72)); rowY(px, 0, shade(c, 0.8)); },
    teck(px) { const c = [150, 96, 52]; fill(px, c, 9); for (const x of [0, 4, 8, 12]) colX(px, x, shade(c, 0.74)); },
    grisBois(px) { const c = [122, 106, 88]; fill(px, c, 9); for (const x of [0, 5, 10]) colX(px, x, shade(c, 0.72)); },
    persienne(px) { for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) px(x, y, y % 4 === 0 ? [44, 38, 32] : y % 4 === 1 ? [150, 132, 110] : [124, 108, 90], 5); },
    paille(px, rnd) { fill(px, [196, 170, 92], 18); for (let i = 0; i < 20; i++) { const x = (rnd() * PX) | 0, y = (rnd() * PX) | 0; px(x, y, [160, 132, 60]); px((x + 1) % PX, y, [160, 132, 60]); } },
    eau(px) { fill(px, [70, 120, 170], 10); },
    conteneur(px) { const c = [214, 186, 128]; fill(px, c, 5); for (let x = 0; x < PX; x++) if (x % 4 === 0) colX(px, x, shade(c, 0.8)); else if (x % 4 === 2) colX(px, x, shade(c, 1.07)); },
    conteneurInt(px) { const c = [150, 140, 122]; fill(px, c, 5); for (let x = 0; x < PX; x += 4) colX(px, x, shade(c, 0.8)); },
    brunRouge(px) { const c = [122, 48, 36]; fill(px, c, 6); rowY(px, 0, shade(c, 0.75)); },
    carton(px) { const c = [178, 138, 88]; fill(px, c, 8); rowY(px, 7, [204, 176, 128]); rowY(px, 8, [204, 176, 128]); colX(px, 0, shade(c, 0.8)); },
    blancLoco(px) { const c = [232, 232, 226]; fill(px, c, 4); colX(px, 0, shade(c, 0.86)); rowY(px, 0, shade(c, 0.9)); },
    grille(px) { for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) px(x, y, y % 3 === 0 ? [36, 36, 38] : [120, 122, 126], 5); },
    zebra(px) { for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) px(x, y, ((x + y) >> 2) & 1 ? [228, 186, 32] : [30, 30, 30], 6); },
    bleuNuit(px) { const c = [30, 44, 92]; fill(px, c, 4); colX(px, 0, shade(c, 0.72)); rowY(px, 15, shade(c, 0.8)); },
    or(px) { fill(px, [206, 166, 72], 10); },
    creme(px) { const c = [228, 220, 198]; fill(px, c, 4); rowY(px, 0, shade(c, 0.9)); },
    acajou(px) {
      const c = [112, 52, 34]; fill(px, c, 6);
      colX(px, 0, shade(c, 0.7)); rowY(px, 0, shade(c, 0.7));
      for (let i = 3; i < 13; i++) { px(3, i, shade(c, 1.25)); px(i, 3, shade(c, 1.25)); }
    },
    velours(px) { const c = [142, 30, 42]; fill(px, c, 8); rowY(px, 0, shade(c, 0.7)); },
    nappe(px) { fill(px, [242, 240, 234], 4); rowY(px, 15, [204, 200, 190]); colX(px, 0, [204, 200, 190]); },
    drap(px) { fill(px, [236, 232, 220], 4); for (let y = 0; y < 5; y++) rowY(px, y, [124, 40, 44]); rowY(px, 5, [206, 166, 72]); },
    tapis(px) { const c = [116, 30, 36]; fill(px, c, 6); for (let y = 2; y < PX; y += 4) for (let x = 2; x < PX; x += 4) px(x, y, [206, 166, 72]); },
    malle(px) { const c = [104, 64, 36]; fill(px, c, 8); rowY(px, 3, [206, 166, 72]); rowY(px, 12, [206, 166, 72]); colX(px, 0, shade(c, 0.7)); },
    // camouflage : taches qui se raccordent d'un bloc à l'autre
    camo(px, rnd) {
      fill(px, [152, 148, 134], 8);
      for (let i = 0; i < 6; i++) {
        const cx = rnd() * PX, cy = rnd() * PX, rx = 2 + rnd() * 3, ry = 1.2 + rnd() * 2, col = i % 2 ? [88, 98, 70] : [120, 98, 72];
        for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
          const dx = Math.min(Math.abs(x - cx), PX - Math.abs(x - cx)), dy = Math.min(Math.abs(y - cy), PX - Math.abs(y - cy));
          if ((dx / rx) ** 2 + (dy / ry) ** 2 < 1) px(x, y, col, 6);
        }
      }
    },
    camoInt(px) { const c = [96, 100, 92]; fill(px, c, 5); for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(x, y, shade(c, 1.35)); },
    fente(px) { fill(px, [152, 148, 134], 8); for (let y = 6; y < 10; y++) rowY(px, y, [16, 16, 18]); },
    vitreBleu: vitre([30, 44, 92]),
    vitreBlanc: vitre([232, 232, 226]),
    vitreTeck: vitre([150, 96, 52]),
    // lot 4
    camoSable(px, rnd) {
      fill(px, [208, 192, 140], 8);
      for (let k = 0; k < 2; k++) {
        const ph = rnd() * 6.28, amp = 1.5 + rnd() * 2, y0 = rnd() * PX;
        for (let x = 0; x < PX; x++) {
          const y = Math.round(y0 + amp * Math.sin((x / PX) * 6.283 + ph));
          px(x, ((y % PX) + PX) % PX, [112, 134, 80], 6); px(x, (((y + 1) % PX) + PX) % PX, [128, 148, 92], 6);
        }
      }
      { const ph = rnd() * 6.28, x0 = rnd() * PX; for (let y = 0; y < PX; y++) { const x = Math.round(x0 + 2 * Math.sin((y / PX) * 6.283 + ph)); px(((x % PX) + PX) % PX, y, [112, 134, 80], 6); } }
      for (let i = 0; i < 7; i++) { const x = (rnd() * PX) | 0, y = (rnd() * PX) | 0; px(x, y, [176, 100, 72], 8); px((x + 1) % PX, y, [176, 100, 72], 8); px(x, (y + 1) % PX, [160, 92, 66], 8); }
    },
    fenteSable(px) { fill(px, [208, 192, 140], 8); for (let y = 6; y < 10; y++) rowY(px, y, [16, 16, 18]); },
    bacheGris(px) { const c = [150, 152, 146]; fill(px, c, 10); for (const x of [3, 9, 14]) colX(px, x, shade(c, 0.85)); },
    vertDB(px) { const c = [52, 98, 66]; fill(px, c, 5); colX(px, 0, shade(c, 0.72)); rowY(px, 15, shade(c, 0.78)); },
    grisToit(px) { const c = [150, 154, 156]; fill(px, c, 6); rowY(px, 0, shade(c, 0.86)); },
    skaiVert(px) { const c = [70, 110, 84]; fill(px, c, 6); for (const y of [0, 8]) rowY(px, y, shade(c, 0.75)); },
    vitreSable: vitre([208, 192, 140]),
    vitreVertDB: vitre([52, 98, 66]),
    hublotNoir: hublot([40, 42, 48]),
    // lot 5
    vertY(px) { const c = [46, 104, 70]; fill(px, c, 5); rowY(px, 15, shade(c, 0.75)); },
    cremeY(px) { const c = [226, 218, 172]; fill(px, c, 5); rowY(px, 0, shade(c, 0.9)); },
    aluToit(px) { const c = [176, 180, 184]; fill(px, c, 6); rowY(px, 0, shade(c, 0.85)); rowY(px, 8, shade(c, 1.06)); },
    vertFonce(px) { const c = [34, 72, 48]; fill(px, c, 4); colX(px, 0, shade(c, 0.75)); rowY(px, 15, shade(c, 0.8)); },
    grisFonce(px) { const c = [80, 84, 88]; fill(px, c, 6); rowY(px, 0, shade(c, 0.85)); },
    bleuAcier(px) { const c = [38, 48, 66]; fill(px, c, 4); colX(px, 0, shade(c, 0.8)); },
    grain(px, rnd) { fill(px, [212, 180, 104], 20); for (let i = 0; i < 26; i++) px((rnd() * PX) | 0, (rnd() * PX) | 0, [176, 140, 72]); },
    grilleSol(px) { for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) px(x, y, x % 4 === 0 || y % 4 === 0 ? [150, 154, 160] : [70, 72, 76], 6); },
    brunClair(px) { const c = [160, 98, 58]; fill(px, c, 8); for (const y of [0, 4, 8, 12]) rowY(px, y, shade(c, 0.74)); for (const x of [2, 13]) for (const y of [2, 6, 10, 14]) px(x, y, shade(c, 0.6)); },
    brunFonce(px) { const c = [116, 70, 42]; fill(px, c, 6); for (let y = 2; y < PX; y += 4) px(7, y, shade(c, 0.6)); },
    rougeGs(px) { const c = [128, 56, 44]; fill(px, c, 7); for (const x of [0, 4, 8, 12]) colX(px, x, shade(c, 0.72)); },
    tube(px) { const c = [42, 42, 46]; fill(px, c, 6); rowY(px, 0, shade(c, 1.3)); },
    tubeInt(px) { fill(px, [70, 66, 62], 10); },
    camoTrois(px) {
      for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
        const d = (((x + y + Math.round(Math.sin((y / PX) * 6.283) * 1.5)) % PX) + PX) % PX;
        px(x, y, d < 4 ? [96, 112, 64] : d >= 8 && d < 11 ? [124, 92, 60] : [190, 176, 96], 7);
      }
    },
    fenteTrois(px) { fill(px, [190, 176, 96], 8); for (let y = 6; y < 10; y++) rowY(px, y, [16, 16, 18]); },
    grisMilitaire(px) { const c = [104, 108, 106]; fill(px, c, 8); for (const y of [0, 5, 10]) rowY(px, y, shade(c, 0.75)); },
    avion(px, rnd) { fill(px, [126, 156, 146], 6); for (let i = 0; i < 8; i++) { const x = (rnd() * PX) | 0, y = (rnd() * PX) | 0; px(x, y, [60, 84, 64]); px((x + 1) % PX, y, [60, 84, 64]); } },
    sable(px, rnd) { fill(px, [198, 174, 118], 8); for (let i = 0; i < 6; i++) px((rnd() * PX) | 0, (rnd() * PX) | 0, [150, 128, 86]); for (const [x, y] of [[2, 2], [13, 13]]) px(x, y, [120, 100, 70]); },
    fenteSableClair(px) { fill(px, [198, 174, 118], 8); for (let y = 6; y < 10; y++) rowY(px, y, [16, 16, 18]); },
    camoBois(px) {
      for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
        const d = (((x - y + Math.round(Math.sin((y / PX) * 6.283 * 2) * 1.2)) % PX) + PX) % PX;
        let c = [104, 118, 74];
        if (d >= 3 && d < 6) c = [130, 96, 72]; else if (d === 6) c = [222, 206, 120];
        px(x, y, y % 4 === 0 ? shade(c, 0.75) : c, 6);
      }
    },
    vitreVertY: vitre([46, 104, 70]),
    vitreVertFonce: vitre([34, 72, 48]),
    vitreBrunClair: vitre([160, 98, 58]),
    vitreBois: vitre([104, 118, 74]),
    vitreAvion: vitre([120, 124, 128]),
    // lot 6
    bleuMarine(px) { const c = [36, 46, 98]; fill(px, c, 4); colX(px, 0, shade(c, 0.78)); },
    blancCreme(px) { const c = [236, 232, 214]; fill(px, c, 4); colX(px, 0, shade(c, 0.9)); },
    vitreConte: vitre([236, 232, 214]),
    roueDisque(px) {
      for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        px(x, y, d > 6.2 ? [78, 80, 84] : d < 1.9 ? [122, 124, 128] : d > 3.6 && d < 4.6 ? [34, 35, 38] : [48, 50, 54], 6);
      }
    },
  };

  const texCache = new Map();
  function texture(name) {
    if (texCache.has(name)) return texCache.get(name);
    const def = DEFS[name];
    if (!def) throw new Error('texture inconnue : ' + name);
    const c = document.createElement('canvas');
    c.width = c.height = PX;
    const g = c.getContext('2d');
    let seed = 7;
    for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
    const rnd = rng(seed);
    const px = (x, y, col, j = 0) => {
      const d = j ? (rnd() - 0.5) * 2 * j : 0;
      g.clearRect(x, y, 1, 1);
      g.fillStyle = `rgba(${clamp(col[0] + d)},${clamp(col[1] + d)},${clamp(col[2] + d)},${col.length > 3 ? col[3] : 1})`;
      g.fillRect(x, y, 1, 1);
    };
    def(px, rnd);
    const t = new T.CanvasTexture(c);
    t.userData.name = name; t.userData.canvas = c;
    // pixels nets de près, versions réduites au loin : les textures ne scintillent plus
    t.magFilter = T.NearestFilter; t.minFilter = T.NearestMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
    texCache.set(name, t);
    return t;
  }
  const matCache = new Map();
  function mat(name, side = T.FrontSide) {
    if (REMAP && REMAP[name]) name = REMAP[name];
    const k = name + '|' + side;
    if (!matCache.has(k)) {
      const map = texture(name);
      const o = { map, flatShading: true, side };
      if (/^(vitre|hublot)/.test(name)) { o.transparent = true; o.depthWrite = false; } // vitres : on voit au travers
      if (name === 'phare') { o.emissive = new T.Color(0xffffff); o.emissiveMap = map; }
      if (name === 'plafond') { o.emissive = new T.Color(0x555555); o.emissiveMap = map; } // éclairé par les lampes
      matCache.set(k, new T.MeshLambertMaterial(o));
    }
    return matCache.get(k);
  }

  // ---------- Textures en pile : toutes les textures 16 × 16 dans une seule texture (une couche chacune) ----------
  // Un véhicule fusionné se dessine alors en un ou deux appels au lieu d'un par matériau.
  const LAYERS = 512, layerOf = new Map();
  const atlasData = new Uint8Array(PX * PX * 4 * LAYERS);
  const atlas = new T.DataArrayTexture(atlasData, PX, PX, LAYERS);
  atlas.magFilter = T.NearestFilter; atlas.minFilter = T.NearestMipmapLinearFilter; atlas.generateMipmaps = true; atlas.anisotropy = 8;
  atlas.wrapS = atlas.wrapT = T.RepeatWrapping;
  if ('colorSpace' in atlas) atlas.colorSpace = T.SRGBColorSpace;
  const atlasU = { value: atlas };
  function layer(tex) {
    const name = tex.userData.name;
    if (layerOf.has(name)) return layerOf.get(name);
    const i = layerOf.size;
    if (i >= LAYERS) throw new Error('trop de textures');
    const img = tex.userData.canvas.getContext('2d').getImageData(0, 0, PX, PX).data;
    // la toile a le haut en premier, la texture le bas : on retourne les lignes
    for (let y = 0; y < PX; y++) atlasData.set(img.subarray((PX - 1 - y) * PX * 4, (PX - y) * PX * 4), (i * PX * PX + y * PX) * 4);
    layerOf.set(name, i);
    atlas.needsUpdate = true;
    return i;
  }
  // matériau d'un véhicule : Lambert ordinaire, mais la texture est prise dans la pile (couche et lueur par sommet).
  // Les roues tournent dans le shader (centre et 1/rayon par sommet, distance parcourue en uniforme) et les toits
  // de la vue en coupe s'effacent dans le shader : tout le véhicule tient en une seule forme.
  function vehicleMat(U, transparent) {
    const m = new T.MeshLambertMaterial({ flatShading: true, transparent, depthWrite: !transparent });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uAtlas = atlasU; sh.uniforms.uDist = U.dist; sh.uniforms.uCut = U.cut;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aTex;\nattribute vec3 aWheel;\nattribute float aCut;\nuniform float uDist;\nuniform float uCut;\nvarying vec2 vTex;\nvarying vec2 vAUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTex = aTex;\nvAUv = uv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (aWheel.z != 0.0) { float a = -uDist * aWheel.z; float c = cos(a), s = sin(a); vec2 d = transformed.xy - aWheel.xy; transformed.xy = aWheel.xy + vec2(c * d.x - s * d.y, s * d.x + c * d.y); }\nif (aCut * uCut > 0.5) transformed = vec3(0.0);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nprecision highp sampler2DArray;\nuniform sampler2DArray uAtlas;\nvarying vec2 vTex;\nvarying vec2 vAUv;')
        .replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture(uAtlas, vec3(vAUv, vTex.x));\ndiffuseColor *= sampledDiffuseColor;')
        .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = sampledDiffuseColor.rgb * vTex.y;');
    };
    m.customProgramCacheKey = () => 'vehicule';
    return m;
  }
  const lueur = (m) => (m.emissiveMap ? m.emissive.r : 0);

  // ---------- Construction : formes, collisions, places ----------
  let ctx = null; // { solids, seats } du véhicule en cours
  const side = (s, a = Z, t = 0.02) => (s > 0 ? [a, a + t] : [-a - t, -a]);
  const cut = (m) => { m.userData.cut = true; return m; };
  const solid = (x0, x1, y0, y1, z0, z1) => ctx.solids.push([x0, x1, y0, y1, Math.min(z0, z1), Math.max(z0, z1)]);
  const seat = (x, y, z, yaw) => ctx.seats.push({ x, y, z, yaw });

  // pavé de x0 à x1, y0 à y1, z0 à z1 ; tile : la texture se répète une fois par bloc
  function B(p, tex, x0, x1, y0, y1, z0, z1, tile = true) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const g = new T.BoxGeometry(w, h, d);
    if (tile) {
      const uv = g.attributes.uv, S = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * S[f][0], uv.getY(k) * S[f][1]);
      }
    }
    const m = new T.Mesh(g, mat(tex));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    p.add(m);
    return m;
  }
  // pavé solide (on se cogne dedans)
  function S(p, tex, x0, x1, y0, y1, z0, z1, tile) { solid(x0, x1, y0, y1, z0, z1); return B(p, tex, x0, x1, y0, y1, z0, z1, tile); }

  // Mur à deux faces (peinture dehors, intérieur dedans), percé de portes et de fenêtres.
  // axis 'x' : le mur court le long de X, sa face extérieure est en z = at ; axis 'z' : le long de Z, en x = at.
  // dir : sens de l'extérieur (+1 ou -1). holes : [a0, a1, y0, y1, vitre] ; sans vitre c'est un passage.
  function wall(p, w) {
    const { axis, a0, a1, y0, y1, at, dir, out, inn } = w, t = w.t || WT;
    const holes = (w.holes || []).slice().sort((h, k) => h[0] - k[0]);
    const rects = [];
    let cur = a0;
    for (const h of holes) {
      if (h[0] > cur) rects.push([cur, h[0], y0, y1]);
      if (h[2] > y0) rects.push([h[0], h[1], y0, h[2]]);
      if (h[3] < y1) rects.push([h[0], h[1], h[3], y1]);
      cur = h[1];
    }
    if (cur < a1) rects.push([cur, a1, y0, y1]);
    const put = (tex, ra0, ra1, ry0, ry1, n0, n1, tile = true) => {
      const lo = Math.min(n0, n1), hi = Math.max(n0, n1);
      return axis === 'x' ? B(p, tex, ra0, ra1, ry0, ry1, lo, hi, tile) : B(p, tex, lo, hi, ry0, ry1, ra0, ra1, tile);
    };
    const box = (ra0, ra1, ry0, ry1, n0, n1) => {
      const lo = Math.min(n0, n1), hi = Math.max(n0, n1);
      if (axis === 'x') solid(ra0, ra1, ry0, ry1, lo, hi); else solid(lo, hi, ry0, ry1, ra0, ra1);
    };
    const mid = at - dir * t / 2, back = at - dir * t;
    for (const [ra0, ra1, ry0, ry1] of rects) {
      const mo = put(out, ra0, ra1, ry0, ry1, at, mid);
      const mi = put(inn, ra0, ra1, ry0, ry1, mid, back);
      if (w.cut) { cut(mo); cut(mi); }
      box(ra0, ra1, ry0, ry1, at, back);
    }
    for (const h of holes) if (h[4]) {
      put(h[4], h[0], h[1], h[2], h[3], mid + 0.012, mid - 0.012, false);
      box(h[0], h[1], h[2], h[3], at, back);
    }
  }

  function tileCyl(g, seg, r, h, arc = Math.PI * 2) {
    const uv = g.attributes.uv, n = (seg + 1) * 2, su = Math.max(1, Math.round(r * arc));
    for (let i = 0; i < n; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * Math.max(h, 0.25));
  }
  // cylindre couché le long de X ; o.sy aplatit la section, o.cap : texture des bouts
  function CX(p, tex, r, x0, x1, y, z = 0, o = {}) {
    const seg = o.seg || 10, len = x1 - x0;
    const g = new T.CylinderGeometry(r, r, len, seg);
    tileCyl(g, seg, r, len);
    g.rotateZ(-Math.PI / 2);
    if (o.sy) g.scale(1, o.sy, 1);
    const capM = mat(o.cap || tex);
    const m = new T.Mesh(g, [mat(tex), capM, capM]);
    m.position.set((x0 + x1) / 2, y, z);
    p.add(m);
    return m;
  }
  // tube couché le long de X, ouvert aux bouts ; hole : trou de 60° sur le dessus ; inner : vu du dedans
  function TX(p, tex, r, x0, x1, y, hole = false, inner = false) {
    const seg = hole ? 10 : 12, len = x1 - x0, arc = hole ? (5 * Math.PI) / 3 : Math.PI * 2;
    const g = new T.CylinderGeometry(r, r, len, seg, 1, true, hole ? (5 * Math.PI) / 3 : 0, arc);
    tileCyl(g, seg, r, len, arc);
    g.rotateZ(-Math.PI / 2);
    const m = new T.Mesh(g, mat(tex, inner ? T.BackSide : T.FrontSide));
    m.position.set((x0 + x1) / 2, y, 0);
    p.add(m);
    return m;
  }
  // disque tourné vers +X (dir 1) ou -X (dir -1)
  function DISC(p, tex, r, x, y, dir) {
    const g = new T.CircleGeometry(r, 12);
    g.rotateY((dir * Math.PI) / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 2);
    const m = new T.Mesh(g, mat(tex));
    m.position.set(x, y, 0);
    p.add(m);
    return m;
  }
  // cylindre debout (rTop pour un cône tronqué) ; open : sans fond ni couvercle, visible des deux côtés
  function CY(p, tex, r, y0, y1, x, z = 0, seg = 8, rTop = r, open = false) {
    const h = y1 - y0, g = new T.CylinderGeometry(rTop, r, h, seg, 1, open);
    tileCyl(g, seg, Math.max(r, rTop), h);
    const m = new T.Mesh(g, mat(tex, open ? T.DoubleSide : T.FrontSide));
    m.position.set(x, (y0 + y1) / 2, z);
    p.add(m);
    return m;
  }
  // demi-cylindre debout tourné vers +X (dir 1) ou -X (dir -1), étiré de sx en X
  function HC(p, tex, r, y0, y1, x, sx = 1, dir = 1) {
    const h = y1 - y0, g = new T.CylinderGeometry(r, r, h, 10, 1, false, dir > 0 ? 0 : Math.PI, Math.PI);
    tileCyl(g, 10, r, h, Math.PI);
    g.scale(sx, 1, 1);
    const m = new T.Mesh(g, mat(tex));
    m.position.set(x, (y0 + y1) / 2, 0);
    p.add(m);
    return m;
  }
  // demi-ellipsoïde (nez) tourné vers +X ou -X
  function NOSE(p, tex, x, y, rx, ry, rz, dir = 1) {
    const g = new T.SphereGeometry(1, 12, 8, dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 3);
    g.scale(rx, ry, rz);
    const m = new T.Mesh(g, mat(tex));
    m.position.set(x, y, 0);
    p.add(m);
    return m;
  }
  // essieu : deux roues (rayon r) posées sur le rail
  // essieu : les deux roues forment une seule pièce, qui tourne autour de l'axe
  const axleCache = new Map();
  function axleGeo(r) {
    const k = r.toFixed(3);
    if (axleCache.has(k)) return axleCache.get(k);
    const parts = [-1, 1].map((s) => {
      const c = new T.CylinderGeometry(r, r, 0.16, 12);
      tileCyl(c, 12, r, 0.16);
      c.rotateX(Math.PI / 2);
      c.translate(0, 0, s * GAUGE);
      return c;
    });
    // bandes des deux roues d'abord (acier), puis toutes les faces (rayons) : deux appels de dessin par essieu
    const g = new T.BufferGeometry(), band = [], faces = [], pos = [], nor = [], uv = [];
    let off = 0;
    for (const c of parts) {
      pos.push(...c.attributes.position.array); nor.push(...c.attributes.normal.array); uv.push(...c.attributes.uv.array);
      const ix = c.index.array;
      for (const gr of c.groups) for (let i = gr.start; i < gr.start + gr.count; i++) (gr.materialIndex === 0 ? band : faces).push(ix[i] + off);
      off += c.attributes.position.count;
    }
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex([...band, ...faces]);
    g.addGroup(0, band.length, 0);
    g.addGroup(band.length, faces.length, 1);
    axleCache.set(k, g);
    return g;
  }
  function W(p, face, r, x) {
    const m = new T.Mesh(axleGeo(r), [mat('acier'), mat(face)]);
    m.position.set(x, r, 0);
    m.userData.wheel = r;
    m.userData.shared = true;
    p.add(m);
  }
  // tampons et attelage au bout x, vers dir
  function buffers(p, x, dir, y = 0.8) {
    const lo = (a, b) => Math.min(a, b), hi = (a, b) => Math.max(a, b);
    for (const s of [-1, 1]) {
      const z = s * 0.85, b = x + dir * 0.3, c = x + dir * 0.38;
      CX(p, 'acier', 0.1, lo(x, b), hi(x, b), y, z, { seg: 8 });
      CX(p, 'acier', 0.22, lo(b, c), hi(b, c), y, z, { seg: 10 });
    }
    B(p, 'noir', lo(x, x + dir * 0.3), hi(x, x + dir * 0.3), y - 0.12, y + 0.06, -0.1, 0.1);
  }
  function filet(p, x0, x1, y) { for (const s of [-1, 1]) B(p, 'blanc', x0, x1, y - 0.06, y + 0.06, ...side(s)); }
  // bielle d'accouplement qui suit les manivelles
  function rod(p, x0, x1, y, r) {
    for (const s of [-1, 1]) {
      const m = B(p, 'acier', x0 - 0.12, x1 + 0.12, y - 0.05, y + 0.05, ...side(s, 0.86, 0.06));
      m.userData.rod = { x: (x0 + x1) / 2, y, crank: r * 0.42, wheel: r };
    }
  }
  // marchepied à deux marches sous une porte latérale (x0..x1), du sol jusqu'au plancher
  function steps(p, x0, x1, floor, inset = Z - 0.12) {
    for (const s of [-1, 1]) {
      S(p, 'noir', x0, x1, floor * 0.3, floor * 0.3 + 0.06, ...side(s, inset, 0.26));
      S(p, 'noir', x0, x1, floor * 0.66, floor * 0.66 + 0.06, ...side(s, inset, 0.14));
    }
  }
  // fond de chaudière dans une cabine : porte du foyer, manomètres, régulateur
  function backhead(p, x, y0, half) {
    B(p, 'peinture', x - 0.22, x, y0, y0 + 1.95, -half, half);
    B(p, 'laiton', x - 0.25, x - 0.22, y0 + 0.4, y0 + 0.85, -0.26, 0.26);
    for (const z of [-0.38, 0.38]) CX(p, 'laiton', 0.13, x - 0.26, x - 0.22, y0 + 1.65, z, { cap: 'cadran' });
    for (const z of [-0.6, 0.6]) B(p, 'vitreNoir', x - 0.25, x - 0.22, y0 + 1.0, y0 + 1.45, z - 0.04, z + 0.04, false);
    B(p, 'acier', x - 0.55, x - 0.22, y0 + 1.3, y0 + 1.36, -0.66, -0.6);
    solid(x - 0.25, x, y0, y0 + 1.95, -half, half);
  }

  // ---------- Véhicules ----------
  // Locomotive carénée (Pacific des années 1930) : caisse profilée, filets blancs, jupe sur les roues.
  // Cabine : plancher à 1,2, porte de chaque côté à l'arrière, passage vers le tender au fond.
  function carenee() {
    const g = begin();
    const F = 1.2; // plancher de la cabine
    B(g, 'noir', -6.8, 5.4, 0.4, 0.58, -0.95, 0.95);
    for (const x of [-2.8, -0.6, 1.6]) W(g, 'roueRouge', 1.0, x);
    W(g, 'roueGrise', 0.45, 3.7); W(g, 'roueGrise', 0.45, 4.85);
    W(g, 'roueGrise', 0.6, -4.9);
    // jupe, carénage, nez (pleins)
    S(g, 'carenage', -2.6, 5.4, 0.55, 1.7, -Z, Z);
    HC(g, 'carenage', Z, 0.55, 1.7, 5.4, 1.2);
    CX(g, 'carenage', Z, -2.55, 5.4, 2.55, 0, { seg: 12 });
    NOSE(g, 'carenage', 5.4, 2.55, 1.5, Z, Z);
    solid(-2.6, 5.4, 1.7, 3.85, -1.15, 1.15);
    solid(5.4, 6.7, 0.55, 3.4, -1.0, 1.0);
    B(g, 'carenage', 1.4, 4.4, 3.7, 4.12, -0.42, 0.42);
    NOSE(g, 'carenage', 4.4, 3.91, 0.7, 0.21, 0.42);
    B(g, 'carenage', -2.6, 1.4, 3.75, 3.98, -0.28, 0.28);
    // cabine creuse
    S(g, 'carenage', -6.8, -2.6, 0.55, F, -Z, Z);
    B(g, 'plancher', -6.8 + WT, -2.6 - WT, F, F + 0.01, -Z + WT, Z - WT);
    const doors = [-6.7, -6.0];
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -6.8, a1: -2.6, y0: F, y1: 3.9, at: s * Z, dir: s, out: 'carenage', inn: 'cabine',
        holes: [[doors[0], doors[1], F, 3.3], [-5.6, -4.7, 2.5, 3.4, 'vitreNoir'], [-4.3, -3.3, 2.5, 3.4, 'vitreNoir']] });
    }
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 3.9, at: -2.6, dir: 1, out: 'carenage', inn: 'cabine',
      holes: [[-1.2, -0.95, 3.45, 3.85, 'vitreNoir'], [0.95, 1.2, 3.45, 3.85, 'vitreNoir']] });
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 3.9, at: -6.8, dir: -1, out: 'carenage', inn: 'cabine',
      holes: [[-0.45, 0.45, F, 3.3]] });
    cut(S(g, 'peinture', -6.95, -2.45, 3.9, 4.05, -1.4, 1.4));
    cut(B(g, 'peinture', -6.4, -2.9, 4.05, 4.18, -0.8, 0.8));
    cut(B(g, 'cabine', -6.8 + WT, -2.6 - WT, 3.88, 3.9, -Z + WT, Z - WT));
    backhead(g, -2.68, F, 0.85);
    // sièges du mécanicien et du chauffeur
    for (const s of [-1, 1]) {
      S(g, 'peinture', -4.25, -3.8, F, F + 0.75, ...side(s, 0.72, 0.42)); // tabouret haut : on voit par la vitre
      B(g, 'cabine', -4.33, -4.25, F + 0.75, F + 1.25, ...side(s, 0.72, 0.42));
      seat(-4.0, F + 0.75, s * 0.93, s * 0.9);
    }
    steps(g, doors[0] + 0.05, doors[1] - 0.05, F);
    S(g, 'noir', -7.1, -6.8, F - 0.08, F, -0.5, 0.5); // tôle de passage vers le tender
    // filets blancs (coupés au droit des portes) et autour du nez
    filet(g, -6.8, 5.4, 1.0);
    filet(g, -6.8, doors[0], 1.66); filet(g, doors[1], 5.4, 1.66);
    for (const y of [1.0, 1.66]) HC(g, 'blanc', Z + 0.02, y - 0.06, y + 0.06, 5.4, 1.2);
    for (const s of [-1, 1]) CX(g, 'noir', 0.17, 6.5, 6.74, 1.25, s * 0.7, { cap: 'phare' });
    buffers(g, 6.55, 1, 0.78);
    buffers(g, -6.8, -1, 0.78);
    return finish(g, { name: 'carenee', smoke: [4.2, 4.15, 0], couple: [6.93, -7.18] });
  }

  // Tender caréné : caisse à eau pleine à l'arrière, soute à charbon ouverte sur la cabine à l'avant
  function tender() {
    const g = begin(), x0 = -4.6, x1 = 4.6, xs = 0.6, F = 1.2;
    B(g, 'noir', x0 + 0.2, x1 - 0.2, 0.42, 0.58, -0.95, 0.95);
    for (const bx of [-2.6, 2.6]) {
      W(g, 'roueGrise', 0.42, bx - 0.6); W(g, 'roueGrise', 0.42, bx + 0.6);
      for (const s of [-1, 1]) B(g, 'noir', bx - 1.15, bx + 1.15, 0.32, 0.5, ...side(s, 0.84, 0.06));
    }
    S(g, 'carenage', x0, x1, 0.55, F, -Z, Z);
    S(g, 'carenage', x0, xs, F, 3.4, -Z, Z);
    cut(CX(g, 'carenage', Z, x0 + 0.01, x1 - 0.01, 3.4, 0, { seg: 12, sy: 0.55 }));
    solid(x0, x1, 3.4, 4.1, -1.1, 1.1);
    cut(B(g, 'peinture', -2.2, -0.6, 4.0, 4.18, -0.45, 0.45)); // trappe à eau
    // soute à charbon
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: xs, a1: x1, y0: F, y1: 3.4, at: s * Z, dir: s, out: 'carenage', inn: 'cabine' });
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 3.4, at: x1, dir: 1, out: 'carenage', inn: 'cabine', holes: [[-0.45, 0.45, F, 3.2]] });
    B(g, 'cabine', xs, xs + 0.02, F, 3.34, -Z + WT, Z - WT);
    B(g, 'plancher', xs, x1 - WT, F, F + 0.01, -Z + WT, Z - WT);
    cut(B(g, 'cabine', xs, x1 - WT, 3.34, 3.4, -Z + WT, Z - WT));
    S(g, 'charbon', xs + 0.02, xs + 1.2, F, 2.5, -Z + WT, Z - WT);
    S(g, 'charbon', xs + 1.2, xs + 2.0, F, 1.8, -Z + WT, Z - WT);
    S(g, 'charbon', xs + 2.0, xs + 2.6, F, 1.45, -Z + WT, Z - WT);
    // soufflet vers la cabine
    S(g, 'noir', x1, x1 + 0.38, F - 0.1, F, -0.6, 0.6);
    for (const s of [-1, 1]) S(g, 'noir', x1, x1 + 0.38, F, 3.3, ...side(s, 0.52, 0.08));
    cut(S(g, 'noir', x1, x1 + 0.38, 3.3, 3.4, -0.6, 0.6));
    filet(g, x0, x1, 1.0); filet(g, x0, x1, 1.66);
    for (const y of [1.0, 1.66]) B(g, 'blanc', x0 - 0.02, x0, y - 0.06, y + 0.06, -Z - 0.02, Z + 0.02);
    buffers(g, x0, -1, 0.78);
    return finish(g, { name: 'tender', couple: [x1 + 0.3, x0 - 0.38], drawbar: true });
  }

  // Locomotive-tender 030 T : réservoirs gris rivetés, chaudière noire, traverse rouge.
  // Cabine : plancher à 1,1, portes ouvertes des deux côtés, soute à charbon au fond.
  function t030() {
    const g = begin(), F = 1.1;
    S(g, 'noir', -3.8, 3.9, 0.6, 1.0, -0.95, 0.95);
    S(g, 'noir', -3.8, 3.9, 1.0, F, -Z, Z);
    S(g, 'rouge', 3.9, 4.1, 0.55, 1.1, -Z, Z);
    S(g, 'noir', -4.0, -3.8, 0.55, 1.1, -Z, Z);
    for (const x of [-1.6, -0.2, 1.2]) W(g, 'roueGrise', 0.55, x);
    rod(g, -1.6, 1.2, 0.55, 0.55);
    // chaudière, boîte à fumée, cheminée, dôme
    CX(g, 'peinture', 0.9, -1.0, 2.6, 2.05);
    for (const x of [0.3, 1.9]) CX(g, 'laiton', 0.92, x, x + 0.07, 2.05);
    B(g, 'peinture', 2.6, 3.6, F, 1.5, -0.6, 0.6);
    CX(g, 'peinture', 0.95, 2.6, 3.6, 2.05);
    CX(g, 'peinture', 0.8, 3.6, 3.68, 2.05);
    solid(-1.0, 3.68, F, 3.0, -0.95, 0.95);
    CY(g, 'peinture', 0.26, 2.8, 3.95, 3.1, 0, 8, 0.22);
    CY(g, 'peinture', 0.34, 3.82, 4.0, 3.1);
    CY(g, 'peinture', 0.36, 2.8, 3.25, 1.3, 0, 10);
    CY(g, 'laiton', 0.28, 3.25, 3.34, 1.3, 0, 10);
    CY(g, 'laiton', 0.08, 2.85, 3.3, 0.1);
    for (const s of [-1, 1]) S(g, 'gris', -1.0, 2.3, F, 2.5, s > 0 ? 0.65 : -Z, s > 0 ? Z : -0.65);
    // cabine creuse
    B(g, 'plancher', -3.8 + WT, -1.0 - WT, F, F + 0.01, -Z + WT, Z - WT);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -3.8, a1: -1.0, y0: F, y1: 3.6, at: s * Z, dir: s, out: 'gris', inn: 'cabine',
        holes: [[-3.5, -2.8, 2.6, 3.2, 'vitreGris'], [-2.5, -1.6, F, 3.2]] });
      B(g, 'noir', 3.7, 3.88, 1.18, 1.5, s * 0.95 - 0.13, s * 0.95 + 0.13);
      CX(g, 'noir', 0.11, 3.88, 3.98, 1.34, s * 0.95, { cap: 'phare' });
    }
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 3.6, at: -1.0, dir: 1, out: 'gris', inn: 'cabine',
      holes: [[-1.0, -0.55, 3.0, 3.45, 'hublotGris'], [0.55, 1.0, 3.0, 3.45, 'hublotGris']] });
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 3.6, at: -3.8, dir: -1, out: 'gris', inn: 'cabine',
      holes: [[-0.9, -0.4, 2.7, 3.2, 'vitreGris'], [0.4, 0.9, 2.7, 3.2, 'vitreGris']] });
    cut(S(g, 'peinture', -3.95, -0.85, 3.6, 3.74, -1.42, 1.42));
    cut(B(g, 'peinture', -2.8, -2.0, 3.74, 3.86, -0.4, 0.4));
    cut(B(g, 'cabine', -3.8 + WT, -1.0 - WT, 3.58, 3.6, -Z + WT, Z - WT));
    backhead(g, -1.08, F, 0.75);
    S(g, 'charbon', -3.8 + WT, -3.25, F, 1.85, -Z + WT, Z - WT);
    B(g, 'bois', -3.25, -3.21, F, 1.9, -Z + WT, Z - WT);
    for (const s of [-1, 1]) {
      S(g, 'bois', -3.2, -2.75, F + 0.45, F + 0.52, ...side(s, 0.8, 0.42));
      B(g, 'noir', -3.0, -2.95, F, F + 0.45, ...side(s, 0.95, 0.1));
      seat(-2.97, F + 0.52, s * 1.0, s * 0.7);
    }
    steps(g, -2.45, -1.65, F);
    buffers(g, 4.1, 1);
    buffers(g, -4.0, -1);
    return finish(g, { name: 't030', smoke: [3.1, 4.0, 0], couple: [4.48, -4.38] });
  }

  // Wagon-citerne : cuve creuse, on monte par l'échelle et on entre par le trou d'homme du dôme
  function citerne() {
    const g = begin(), R = 1.25, Y = 2.35, XE = 3.3, H = 0.4;
    for (const s of [-1, 1]) S(g, 'citerne', -3.6, 3.6, 0.75, 1.05, ...side(s, 0.82, 0.2));
    for (const e of [-1, 1]) S(g, 'citerne', e > 0 ? 3.55 : -3.75, e > 0 ? 3.75 : -3.55, 0.7, 1.1, -1.25, 1.25);
    for (const x of [-2.3, 2.3]) {
      W(g, 'roueDisque', 0.5, x);
      for (const s of [-1, 1]) {
        B(g, 'citerne', x - 0.55, x + 0.55, 0.55, 0.75, ...side(s, 0.86, 0.06));
        B(g, 'noir', x - 0.15, x + 0.15, 0.36, 0.62, ...side(s, 0.86, 0.12));
      }
      B(g, 'citerne', x - 0.15, x + 0.15, 1.05, 1.55, -0.95, 0.95);
    }
    // cuve : peau extérieure (cachée en coupe) et peau intérieure, trouées sous le dôme
    for (const [a, b, hole] of [[-XE, -H, false], [-H, H, true], [H, XE, false]]) {
      cut(TX(g, 'citerne', R, a, b, Y, hole));
      TX(g, 'cuve', R - 0.06, a, b, Y, hole, true);
    }
    cut(DISC(g, 'citerne', R, XE, Y, 1)); cut(DISC(g, 'citerne', R, -XE, Y, -1));
    DISC(g, 'cuve', R - 0.06, XE - 0.01, Y, -1); DISC(g, 'cuve', R - 0.06, -XE + 0.01, Y, 1);
    for (const x of [-1.6, 1.6]) cut(CX(g, 'citerne', R + 0.03, x - 0.04, x + 0.04, Y, 0, { seg: 12 }));
    // dôme ouvert, couvercle relevé
    CY(g, 'citerne', 0.75, 3.25, 3.95, 0, 0, 12, 0.75, true);
    CY(g, 'citerne', 0.8, 3.9, 3.98, 0, 0, 12, 0.8, true);
    const lid = CY(g, 'citerne', 0.72, -0.03, 0.03, 0, 0, 12);
    lid.rotation.z = -1.35; lid.position.set(-0.96, 4.68, 0);
    // passerelles et garde-corps sur le dessus
    for (const [a, b] of [[-XE, -0.95], [0.95, XE]]) S(g, 'bois', a, b, 3.6, 3.66, -0.35, 0.35);
    for (const x of [-0.98, 0.98]) for (const z of [-0.9, 0.9]) B(g, 'acier', x - 0.03, x + 0.03, 3.2, 4.4, z - 0.03, z + 0.03);
    for (const z of [-0.9, 0.9]) B(g, 'acier', -1.01, 1.01, 4.37, 4.43, z - 0.03, z + 0.03);
    B(g, 'acier', 0.95, 1.01, 4.37, 4.43, -0.9, 0.9);
    // échelle sur le fond avant, échelle intérieure sous le trou d'homme
    for (const z of [-0.25, 0.25]) B(g, 'acier', XE + 0.01, XE + 0.06, 1.05, 3.7, z - 0.03, z + 0.03);
    for (let y = 1.3; y < 3.6; y += 0.3) S(g, 'acier', XE + 0.01, XE + 0.06, y - 0.025, y + 0.025, -0.25, 0.25);
    for (const z of [-0.22, 0.22]) B(g, 'acier', 0.3, 0.35, 1.36, 3.9, z - 0.03, z + 0.03);
    for (let y = 1.6; y < 3.9; y += 0.3) S(g, 'acier', 0.3, 0.35, y - 0.025, y + 0.025, -0.22, 0.22);
    // caillebotis au fond de la cuve
    S(g, 'acier', -XE + 0.1, XE - 0.1, 1.3, 1.36, -0.7, 0.7);
    CY(g, 'acier', 0.08, 0.8, 1.12, 0, 0);
    // collisions de la cuve (boîtes qui suivent à peu près la paroi, trou d'homme libre)
    solid(-XE, XE, 1.1, 1.3, -R, R);
    for (const s of [-1, 1]) solid(-XE, XE, 1.36, 3.3, s * 0.85, s * R);
    solid(-XE, -H, 3.3, 3.6, -0.85, 0.85); solid(H, XE, 3.3, 3.6, -0.85, 0.85);
    for (const s of [-1, 1]) solid(-H, H, 3.3, 3.6, s * 0.62, s * 0.85);
    solid(XE - 0.1, XE, 1.1, 3.6, -R, R); solid(-XE, -XE + 0.1, 1.1, 3.6, -R, R);
    buffers(g, 3.75, 1);
    buffers(g, -3.75, -1);
    return finish(g, { name: 'citerne', couple: [4.13, -4.13] });
  }

  // Voiture voyageurs de 2e classe : salle à banquettes en vis-à-vis, portes aux deux bouts,
  // plateformes ouvertes avec marchepieds de chaque côté
  function voiture() {
    const g = begin(), L = 4.0, F = 1.12, IZ = Z - 0.05 - WT; // IZ : face intérieure des murs
    S(g, 'noir', -4.62, 4.62, 0.75, 1.05, -1.0, 1.0);
    for (const x of [-2.8, 2.8]) {
      W(g, 'roueDisque', 0.5, x);
      for (const s of [-1, 1]) {
        B(g, 'noir', x - 0.6, x + 0.6, 0.55, 0.75, ...side(s, 0.86, 0.06));
        B(g, 'acier', x - 0.14, x + 0.14, 0.38, 0.62, ...side(s, 0.86, 0.12));
      }
    }
    S(g, 'vert', -L, L, 1.05, F, -1.25, 1.25);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    const wins = [-3, -1.5, 0, 1.5, 3];
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: 3.4, at: s * 1.25, dir: s, out: 'vert', inn: 'boiserie',
        holes: wins.map((x) => [x - 0.4, x + 0.4, 2.2, 3.05, 'vitreVert']) });
      for (const x of [-1.5, 1.5]) B(g, 'deux', x - 0.4, x + 0.4, 1.3, 2.0, ...side(s, 1.25), false);
      B(g, 'acier', -L + WT, L - WT, 3.0, 3.04, ...side(s, 0.82, IZ - 0.82)); // porte-bagages
    }
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -1.25 + WT, a1: 1.25 - WT, y0: F, y1: 3.4, at: e * L, dir: e, out: 'vert', inn: 'boiserie',
        holes: [[-0.4, 0.4, F, 3.0], [-1.0, -0.6, 2.2, 2.9, 'vitreVert'], [0.6, 1.0, 2.2, 2.9, 'vitreVert']] });
    }
    cut(CX(g, 'toit', 1.44, -4.5, 4.5, 3.4, 0, { seg: 14, sy: 0.36 }));
    solid(-4.5, 4.5, 3.4, 3.92, -1.44, 1.44);
    cut(B(g, 'plafond', -L + WT, L - WT, 3.32, 3.4, -IZ, IZ));
    for (const x of [-2, 0, 2]) {
      cut(CY(g, 'peinture', 0.12, 3.7, 4.0, x, 0, 8, 0.09));
      cut(B(g, 'phare', x - 0.12, x + 0.12, 3.27, 3.32, -0.12, 0.12));
    }
    // banquettes : dos à dos entre les fenêtres, contre les murs aux bouts ; allée au milieu
    const bench = (x0, x1, dir) => {
      for (const s of [-1, 1]) {
        S(g, 'banc', x0, x1, F + 0.4, F + 0.48, ...side(s, 0.36, IZ - 0.36));
        const front = dir > 0 ? x1 : x0;
        B(g, 'banc', front - 0.03, front + 0.03, F, F + 0.4, ...side(s, 0.36, IZ - 0.36));
        seat((x0 + x1) / 2, F + 0.48, s * (0.36 + IZ) / 2, dir > 0 ? 0 : Math.PI);
      }
    };
    for (const xb of [-2.25, -0.75, 0.75, 2.25]) {
      for (const s of [-1, 1]) S(g, 'banc', xb - 0.05, xb + 0.05, F, F + 1.15, ...side(s, 0.36, IZ - 0.36));
      bench(xb + 0.05, xb + 0.5, 1);
      bench(xb - 0.5, xb - 0.05, -1);
    }
    bench(-L + WT, -L + WT + 0.45, 1);
    bench(L - WT - 0.45, L - WT, -1);
    // plateformes aux deux bouts
    for (const e of [-1, 1]) {
      const a = e * L, b = e * 4.62, lo = Math.min(a, b), hi = Math.max(a, b), px = e * 4.58;
      S(g, 'noir', lo, hi, 0.95, 1.08, -1.2, 1.2);
      for (const s of [-1, 1]) {
        B(g, 'acier', px - 0.03, px + 0.03, 1.08, 2.1, s * 1.15 - 0.03, s * 1.15 + 0.03);
        S(g, 'acier', px - 0.03, px + 0.03, 2.05, 2.11, ...side(s, 0.45, 0.73));
        S(g, 'acier', px - 0.03, px + 0.03, 1.55, 1.6, ...side(s, 0.45, 0.73));
        S(g, 'noir', lo + 0.05, hi - 0.05, 0.36, 0.42, ...side(s, 1.05, 0.3));
        S(g, 'noir', lo + 0.05, hi - 0.05, 0.68, 0.74, ...side(s, 1.05, 0.15));
      }
      buffers(g, e * 4.62, e);
    }
    return finish(g, { name: 'voiture', couple: [5.0, -5.0] });
  }

  // ---------- Véhicules ajoutés : fourgon à vigie, wagon couvert, locomotive ancienne ----------
  // barre en biais dans le plan d'un mur (x, y), d'épaisseur w
  function brace(p, tex, x0, y0, x1, y1, z0, z1, w = 0.08) {
    const l = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const m = B(p, tex, mx - l / 2, mx + l / 2, my - w / 2, my + w / 2, z0, z1);
    m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    return m;
  }
  // garde-roue : demi-cylindre au-dessus d'une roue (axe Z)
  function splasher(p, tex, r, x, y, z, w) {
    const g = new T.CylinderGeometry(r, r, w, 12, 1, false, Math.PI / 2, Math.PI);
    tileCyl(g, 12, r, w, Math.PI);
    g.rotateX(Math.PI / 2);
    const m = new T.Mesh(g, mat(tex));
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }
  function axleBoxes(p, x, tex = 'noir') {
    for (const s of [-1, 1]) {
      B(p, tex, x - 0.55, x + 0.55, 0.55, 0.75, ...side(s, 0.86, 0.06));
      B(p, 'acier', x - 0.14, x + 0.14, 0.38, 0.62, ...side(s, 0.86, 0.12));
    }
  }
  // plateforme d'extrémité avec garde-corps (couleur rail) et marchepieds latéraux
  function platform(p, e, a, b, rail) {
    const lo = Math.min(e * a, e * b), hi = Math.max(e * a, e * b), px = e * (b - 0.04);
    S(p, 'noir', lo, hi, 0.95, 1.08, -1.2, 1.2);
    for (const s of [-1, 1]) {
      B(p, rail, px - 0.03, px + 0.03, 1.08, 2.1, s * 1.15 - 0.03, s * 1.15 + 0.03);
      S(p, rail, px - 0.03, px + 0.03, 2.05, 2.11, ...side(s, 0.45, 0.73));
      S(p, rail, px - 0.03, px + 0.03, 1.55, 1.6, ...side(s, 0.45, 0.73));
      B(p, rail, e * a - 0.03, e * a + 0.03, 1.4, 2.6, s * 1.32 - 0.03, s * 1.32 + 0.03); // main courante
      S(p, 'noir', lo + 0.05, hi - 0.05, 0.36, 0.42, ...side(s, 1.05, 0.3));
      S(p, 'noir', lo + 0.05, hi - 0.05, 0.68, 0.74, ...side(s, 1.05, 0.15));
    }
  }

  // Fourgon de queue à vigie : caisse rouge en planches, vigie au milieu du toit, plateformes jaunes.
  // Dedans : deux sièges perchés dans la vigie, banquettes, poêle, pupitre.
  function fourgon() {
    const g = begin(), L = 3.0, F = 1.12, IZ = 1.25 - WT, CX0 = 0.9, CZ = 0.85, RT = 3.3;
    S(g, 'noir', -3.65, 3.65, 0.75, 1.05, -1.0, 1.0);
    for (const x of [-1.6, 1.6]) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x); }
    S(g, 'rougeWagon', -L, L, 1.05, F, -1.25, 1.25);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.25, dir: s, out: 'rougeWagon', inn: 'boiserie',
        holes: [[-2.4, -1.7, 2.1, 2.8, 'vitreRouge'], [1.7, 2.4, 2.1, 2.8, 'vitreRouge']] });
      B(g, 'jaune', -2.6, 2.6, 1.55, 1.6, ...side(s, 1.25)); // filet jaune
    }
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -1.25 + WT, a1: 1.25 - WT, y0: F, y1: RT, at: e * L, dir: e, out: 'rougeWagon', inn: 'boiserie',
        holes: [[-0.4, 0.4, F, 3.0], [0.65, 1.0, 2.2, 2.8, 'vitreRouge']] });
    }
    // toit percé sous la vigie
    for (const e of [-1, 1]) cut(S(g, 'peinture', e > 0 ? CX0 : -3.3, e > 0 ? 3.3 : -CX0, RT, RT + 0.12, -1.42, 1.42));
    for (const s of [-1, 1]) cut(S(g, 'peinture', -CX0, CX0, RT, RT + 0.12, ...side(s, CZ, 1.42 - CZ)));
    for (const e of [-1, 1]) cut(B(g, 'plafond', e > 0 ? CX0 : -L + WT, e > 0 ? L - WT : -CX0, RT - 0.05, RT, -IZ, IZ));
    // vigie
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -CX0, a1: CX0, y0: RT, y1: 4.5, at: s * CZ, dir: s, out: 'rougeWagon', inn: 'boiserie', cut: true,
        holes: [[-0.65, -0.1, 3.65, 4.25, 'vitreRouge'], [0.1, 0.65, 3.65, 4.25, 'vitreRouge']] });
      wall(g, { axis: 'z', a0: -CZ + WT, a1: CZ - WT, y0: RT, y1: 4.5, at: s * CX0, dir: s, out: 'rougeWagon', inn: 'boiserie', cut: true,
        holes: [[-0.45, 0.45, 3.65, 4.25, 'vitreRouge']] });
    }
    cut(S(g, 'peinture', -CX0 - 0.15, CX0 + 0.15, 4.5, 4.62, -CZ - 0.15, CZ + 0.15));
    cut(B(g, 'plafond', -CX0 + WT, CX0 - WT, 4.45, 4.5, -CZ + WT, CZ - WT));
    // sièges perchés de la vigie, avec deux marches pour y grimper
    for (const s of [-1, 1]) {
      S(g, 'banc', -0.85, 0.85, F, 2.85, ...side(s, 0.42, IZ - 0.42));
      S(g, 'banc', s > 0 ? -0.85 : 0.45, s > 0 ? -0.45 : 0.85, 2.85, 3.25, ...side(s, 0.42, IZ - 0.42)); // dossier
      for (const [y, d] of [[1.7, 0.45], [2.3, 0.25]]) S(g, 'banc', s > 0 ? 0.85 : -0.85 - d, s > 0 ? 0.85 + d : -0.85, y - 0.04, y, ...side(s, 0.5, 0.5));
      seat(s > 0 ? -0.2 : 0.2, 2.85, s * 0.8, s > 0 ? 0 : Math.PI);
    }
    // banquettes le long des murs, poêle, pupitre, lampe
    S(g, 'banc', 1.5, 2.85, F + 0.4, F + 0.48, 0.72, IZ); seat(2.2, F + 0.48, 0.95, -Math.PI / 2);
    S(g, 'banc', -2.85, -1.5, F + 0.4, F + 0.48, -IZ, -0.72); seat(-2.2, F + 0.48, -0.95, Math.PI / 2);
    S(g, 'peinture', 2.05, 2.55, F, F + 0.9, -1.12, -0.62);
    CY(g, 'peinture', 0.08, F + 0.9, RT + 0.65, 2.3, -0.87);
    CY(g, 'peinture', 0.14, RT + 0.55, RT + 0.72, 2.3, -0.87);
    S(g, 'banc', -2.85, -2.0, F + 0.78, F + 0.84, 0.6, IZ);
    B(g, 'noir', -2.45, -2.4, F, F + 0.78, 0.85, 0.9);
    B(g, 'phare', -0.12, 0.12, RT - 0.1, RT - 0.05, -0.12, 0.12);
    for (const e of [-1, 1]) { platform(g, e, L, 3.62, 'jaune'); buffers(g, e * 3.62, e); }
    return finish(g, { name: 'fourgon', smoke: [2.3, RT + 0.75, -0.87], couple: [4.0, -4.0] });
  }

  // Wagon couvert : planches brunes, ferrures noires en croix, toit gris bombé, porte coulissante.
  // Porte ouverte côté +Z ; dedans, des caisses, des sacs et un tonneau.
  function couvert() {
    const g = begin(), L = 3.6, F = 1.15, IZ = 1.25 - WT;
    S(g, 'noir', -3.75, 3.75, 0.75, 1.05, -1.0, 1.0);
    for (const x of [-2.2, 2.2]) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x); }
    S(g, 'brun', -L, L, 1.05, F, -1.25, 1.25);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      const holes = [[-3.3, -2.9, 2.75, 3.1, 'vitreBrun'], [2.9, 3.3, 2.75, 3.1, 'vitreBrun']];
      if (s > 0) holes.push([-0.75, 0.75, F, 2.9]);
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: 3.3, at: s * 1.25, dir: s, out: 'brun', inn: 'brunInt', holes });
      const zz = side(s, 1.25, 0.03);
      for (const x of [-3.55, -2.2, -0.85, 0.85, 2.2, 3.55]) B(g, 'noir', x - 0.05, x + 0.05, F, 3.3, ...zz);
      B(g, 'noir', -L, L, 3.22, 3.3, ...zz); B(g, 'noir', -L, L, F, F + 0.08, ...zz);
      for (const [a, b] of [[-3.5, -2.25], [2.25, 3.5]]) { brace(g, 'noir', a, F, b, 2.7, ...zz); brace(g, 'noir', a, 2.7, b, F, ...zz); }
      for (const [a, b] of [[-2.15, -0.9], [0.9, 2.15]]) brace(g, 'noir', a, F, b, 3.2, ...zz);
      B(g, 'noir', -0.9, 2.4, 3.0, 3.06, ...side(s, 1.25, 0.06)); // rail de porte
      // porte : ouverte (poussée de côté) en +Z, fermée en -Z
      const [d0, d1] = s > 0 ? [0.8, 2.3] : [-0.75, 0.75], dz = side(s, 1.28, 0.05);
      B(g, 'brun', d0, d1, F, 2.95, ...dz);
      const ez = side(s, 1.33, 0.02);
      brace(g, 'noir', d0 + 0.08, F + 0.1, d1 - 0.08, 2.85, ...ez);
      B(g, 'noir', d0, d1, 2.0, 2.06, ...ez);
      S(g, 'bois', -0.8, 0.8, 0.5, 0.56, ...side(s, 1.25, 0.18)); // marchepied
    }
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -1.25 + WT, a1: 1.25 - WT, y0: F, y1: 3.3, at: e * L, dir: e, out: 'brun', inn: 'brunInt' });
      buffers(g, e * 3.75, e);
    }
    cut(CX(g, 'toitGris', 1.44, -3.75, 3.75, 3.3, 0, { seg: 14, sy: 0.3 }));
    solid(-3.75, 3.75, 3.3, 3.75, -1.44, 1.44);
    cut(B(g, 'brunInt', -L + WT, L - WT, 3.25, 3.3, -IZ, IZ));
    // chargement
    S(g, 'bois', -3.45, -2.65, F, F + 0.8, -IZ, -0.37);
    S(g, 'bois', -3.45, -2.85, F + 0.8, F + 1.4, -IZ, -0.6);
    S(g, 'bois', -2.6, -1.9, F, F + 0.55, -IZ, -0.4); seat(-2.25, F + 0.55, -0.78, 0);
    S(g, 'toile', 2.4, 3.45, F, F + 0.45, -IZ, -0.2);
    S(g, 'toile', 2.6, 3.45, F + 0.45, F + 0.8, -IZ, -0.45);
    CY(g, 'bois', 0.38, F, F + 0.95, 3.0, 0.7, 10);
    S(g, 'bois', -3.45, -2.4, F, F + 0.7, 0.45, IZ);
    B(g, 'phare', -0.12, 0.12, 3.17, 3.25, -0.12, 0.12);
    return finish(g, { name: 'couvert', couple: [4.13, -4.13] });
  }

  // Locomotive ancienne (type 120 du XIXe siècle) : longue chaudière verte cerclée de laiton,
  // grande cheminée à capuchon, gros dôme, deux grandes roues motrices sous garde-roues.
  // Cabine ouverte à l'arrière : plaque avant à hublots, toit, côtés à mi-hauteur.
  function loco19() {
    const g = begin(), F = 1.45;
    S(g, 'peinture', -3.3, 4.1, 0.6, 1.35, -0.55, 0.55);
    S(g, 'peinture', -3.3, 4.1, 1.35, F, -1.25, 1.25);
    S(g, 'rouge', 4.1, 4.3, 0.6, F, -1.25, 1.25);
    S(g, 'peinture', -3.5, -3.3, 0.6, F, -1.25, 1.25);
    W(g, 'roueVerte', 0.55, 3.3);
    for (const x of [1.35, -0.75]) {
      W(g, 'roueVerte', 1.0, x);
      for (const s of [-1, 1]) { splasher(g, 'vertLoco', 1.08, x, 1.0, s * 0.72, 0.26); splasher(g, 'laiton', 1.1, x, 1.0, s * 0.72, 0.1); }
    }
    rod(g, -0.75, 1.35, 1.0, 1.0);
    for (const s of [-1, 1]) CX(g, 'vertLoco', 0.28, 2.4, 3.05, 1.05, s * 1.05);
    // chaudière, boîte à fumée, cheminée à capuchon, dôme, soupapes
    CX(g, 'vertLoco', 0.78, -1.5, 3.4, 2.3);
    for (const x of [-0.4, 0.8, 2.2]) CX(g, 'laiton', 0.8, x, x + 0.07, 2.3);
    B(g, 'peinture', 3.4, 4.05, F, 1.75, -0.6, 0.6);
    CX(g, 'peinture', 0.84, 3.4, 4.05, 2.3);
    CX(g, 'peinture', 0.72, 4.05, 4.12, 2.3);
    solid(-1.5, 4.12, F, 3.15, -0.85, 0.85);
    CY(g, 'peinture', 0.22, 3.0, 4.55, 3.75, 0, 8, 0.26);
    CY(g, 'laiton', 0.3, 4.48, 4.75, 3.75, 0, 8, 0.38);
    CY(g, 'laiton', 0.42, 2.95, 3.5, 1.5, 0, 10);
    CY(g, 'laiton', 0.42, 3.5, 3.72, 1.5, 0, 10, 0.26);
    CY(g, 'laiton', 0.26, 3.72, 3.82, 1.5, 0, 10, 0.1);
    for (const z of [-0.15, 0.15]) CY(g, 'laiton', 0.08, 3.0, 3.5, -1.1, z);
    B(g, 'laiton', -1.35, -0.85, 3.5, 3.55, -0.03, 0.03);
    // foyer et cabine
    S(g, 'vertLoco', -1.55, -1.5, F, 3.0, -0.85, 0.85);
    B(g, 'plancher', -3.3, -1.58, F, F + 0.01, -1.17, 1.17);
    wall(g, { axis: 'z', a0: -1.25 + WT, a1: 1.25 - WT, y0: F, y1: 3.6, at: -1.5, dir: 1, out: 'vertLoco', inn: 'cabine',
      holes: [[-1.0, -0.5, 2.85, 3.35, 'hublotVert'], [0.5, 1.0, 2.85, 3.35, 'hublotVert']] });
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -2.6, a1: -1.5, y0: F, y1: 2.35, at: s * 1.25, dir: s, out: 'vertLoco', inn: 'cabine' });
      B(g, 'laiton', -2.6, -1.5, 2.35, 2.4, ...side(s, 1.17, 0.08));
      S(g, 'vertLoco', -2.7, -2.6, F, 3.6, ...side(s, 1.17, 0.08));
      S(g, 'bois', -2.55, -2.1, F + 0.45, F + 0.52, ...side(s, 0.75, 0.42));
      seat(-2.32, F + 0.52, s * 0.96, s * 0.6);
      B(g, 'noir', 4.05, 4.22, 1.5, 1.8, s * 0.9 - 0.13, s * 0.9 + 0.13);
      CX(g, 'noir', 0.1, 4.22, 4.3, 1.65, s * 0.9, { cap: 'phare' });
    }
    cut(S(g, 'peinture', -3.0, -1.4, 3.6, 3.72, -1.38, 1.38));
    cut(B(g, 'cabine', -2.7, -1.58, 3.56, 3.6, -1.17, 1.17));
    backhead(g, -1.58, F, 0.7);
    steps(g, -3.25, -2.7, F, 1.13);
    buffers(g, 4.3, 1);
    buffers(g, -3.5, -1);
    return finish(g, { name: 'loco19', smoke: [3.75, 4.75, 0], couple: [4.68, -3.6] });
  }

  // Tender de la locomotive ancienne : trois essieux, caisse à eau, charbon en tas, fosse avant
  function tender19() {
    const g = begin(), x0 = -2.7, x1 = 2.7, F = 1.45, xw = 1.8;
    S(g, 'peinture', x0, x1, 0.6, 1.2, -0.95, 0.95);
    for (const x of [-1.7, 0, 1.7]) {
      W(g, 'roueVerte', 0.48, x);
      for (const s of [-1, 1]) B(g, 'laiton', x - 0.14, x + 0.14, 0.35, 0.62, ...side(s, 0.86, 0.12));
    }
    for (const s of [-1, 1]) B(g, 'peinture', x0, x1, 0.65, 1.0, ...side(s, 0.86, 0.06));
    S(g, 'vertLoco', x0, x1, 1.2, F, -1.25, 1.25);
    S(g, 'vertLoco', x0, xw, F, 2.6, -1.2, 1.2);
    for (const s of [-1, 1]) B(g, 'laiton', x0, xw, 2.2, 2.26, ...side(s, 1.2, 0.02));
    // fosse à charbon ouverte sur la cabine
    B(g, 'plancher', xw, x1, F, F + 0.01, -1.12, 1.12);
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: xw, a1: x1, y0: F, y1: 2.3, at: s * 1.2, dir: s, out: 'vertLoco', inn: 'cabine' });
    B(g, 'cabine', xw, xw + 0.02, F, 2.6, -1.12, 1.12);
    // tas de charbon sur la caisse, entre deux rehausses
    for (const s of [-1, 1]) S(g, 'vertLoco', x0 + 0.6, xw, 2.6, 2.95, ...side(s, 1.15, 0.05));
    S(g, 'charbon', x0 + 0.6, xw, 2.6, 2.9, -1.15, 1.15);
    S(g, 'charbon', x0 + 1.0, xw - 0.1, 2.9, 3.2, -0.85, 0.85);
    S(g, 'charbon', x0 + 1.5, xw - 0.4, 3.2, 3.4, -0.5, 0.5);
    S(g, 'peinture', x0, x0 + 0.5, 2.6, 2.9, -0.9, 0.9); // coffre à outils
    S(g, 'noir', x1, x1 + 0.3, F - 0.08, F, -0.5, 0.5);
    B(g, 'noir', x0 - 0.06, x0, 1.7, 2.0, -0.8, -0.55);
    CX(g, 'noir', 0.1, x0 - 0.14, x0 - 0.06, 1.85, -0.67, { cap: 'phare' });
    buffers(g, x0, -1);
    return finish(g, { name: 'tender19', couple: [x1 + 0.3, x0 - 0.38], drawbar: true });
  }

  // Locomotive 262 « V2 » (années 1930) : longue chaudière vert pomme, petite cheminée,
  // trois grandes roues motrices, bissel à l'avant, essieu porteur sous la cabine,
  // tablier haut qui plonge vers la traverse avant. Cabine fermée à hautes fenêtres latérales.
  function v2() {
    const g = begin(), F = 1.5, BY = 2.95;
    S(g, 'noir', -6.0, 6.2, 0.6, 1.3, -0.6, 0.6);
    W(g, 'roueVertePomme', 0.5, 4.95);
    for (const x of [2.5, 0.35, -1.8]) W(g, 'roueVertePomme', 1.0, x);
    W(g, 'roueVertePomme', 0.6, -3.95);
    rod(g, -1.8, 2.5, 1.0, 1.0);
    // tablier haut, plongeant à l'avant
    for (const s of [-1, 1]) {
      S(g, 'noir', -3.6, 3.4, 2.05, 2.15, ...side(s, 0.95, 0.35));
      B(g, 'noir', -3.6, 3.4, 1.85, 2.05, ...side(s, 1.24, 0.06));
      brace(g, 'noir', 3.4, 2.1, 4.7, 1.3, ...side(s, 0.95, 0.35), 0.1);
      B(g, 'blanc', -3.6, 3.4, 1.84, 1.87, ...side(s, 1.3, 0.01));
      // cylindre, glissières, tige de piston
      CX(g, 'noir', 0.42, 3.5, 4.35, 1.15, s * 1.02);
      B(g, 'acier', 2.55, 3.5, 1.08, 1.2, ...side(s, 0.95, 0.06));
      B(g, 'acier', 2.2, 2.55, 0.95, 1.3, ...side(s, 0.95, 0.06));
    }
    S(g, 'noir', 4.6, 6.2, 1.25, 1.35, -1.25, 1.25);
    S(g, 'rouge', 6.2, 6.4, 0.6, 1.35, -1.25, 1.25);
    // chaudière, boîte à fumée, cheminée, dôme, soupapes
    CX(g, 'vertPomme', 0.95, -2.6, 4.2, BY, 0, { seg: 12 });
    for (const x of [-2.0, -0.2, 1.6, 3.4]) {
      CX(g, 'noir', 0.97, x, x + 0.08, BY, 0, { seg: 12 });
      CX(g, 'blanc', 0.975, x - 0.03, x, BY, 0, { seg: 12 });
    }
    CX(g, 'noir', 1.0, 4.2, 5.3, BY, 0, { seg: 12 });
    CX(g, 'noir', 0.86, 5.3, 5.4, BY, 0, { seg: 12 });
    B(g, 'acier', 5.4, 5.48, BY - 0.04, BY + 0.04, -0.3, 0.3);
    B(g, 'noir', 4.2, 5.3, 1.35, BY - 0.6, -0.7, 0.7);
    solid(-2.6, 5.4, 2.0, 3.95, -1.0, 1.0);
    CY(g, 'noir', 0.3, 3.85, 4.35, 4.75, 0, 8, 0.27);
    CY(g, 'noir', 0.36, 4.28, 4.4, 4.75, 0, 8, 0.36);
    CY(g, 'vertPomme', 0.5, 3.75, 4.12, 1.4, 0, 10, 0.32);
    for (const z of [-0.14, 0.14]) CY(g, 'laiton', 0.08, 3.8, 4.15, -2.0, z);
    CX(g, 'laiton', 0.06, 1.8, 3.3, 4.0, 0.25); // sifflet / tuyau
    // foyer
    S(g, 'vertPomme', -3.6, -2.6, 2.05, 3.85, -1.0, 1.0);
    // cabine
    S(g, 'vertPomme', -6.0, -3.6, 1.2, F, -Z, Z);
    B(g, 'plancher', -6.0 + WT, -3.6 - WT, F, F + 0.01, -Z + WT, Z - WT);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -6.0, a1: -3.6, y0: F, y1: 4.0, at: s * Z, dir: s, out: 'vertPomme', inn: 'cabine',
        holes: [[-5.95, -5.3, F, 3.25], [-4.55, -3.85, 2.95, 3.6, 'vitreVert'], [-5.15, -4.65, 2.95, 3.6, 'vitreVert']] });
      for (const [a, b] of [[-5.25, -3.7]]) {
        const zz = side(s, Z, 0.012);
        B(g, 'noir', a, b, 1.75, 1.8, ...zz); B(g, 'blanc', a, b, 1.8, 1.82, ...zz);
        B(g, 'noir', a, b, 2.75, 2.8, ...zz); B(g, 'blanc', a, b, 2.73, 2.75, ...zz);
      }
      B(g, 'laiton', -4.75, -4.25, 2.15, 2.4, ...side(s, Z, 0.02)); // plaque du numéro
      S(g, 'peinture', -4.95, -4.5, F, F + 0.75, ...side(s, 0.72, 0.42));
      B(g, 'cabine', -5.03, -4.95, F + 0.75, F + 1.25, ...side(s, 0.72, 0.42));
      seat(-4.72, F + 0.75, s * 0.93, s * 0.9);
      B(g, 'noir', 6.22, 6.38, 1.4, 1.75, s * 0.75 - 0.13, s * 0.75 + 0.13); // lanternes
      CX(g, 'noir', 0.1, 6.38, 6.46, 1.57, s * 0.75, { cap: 'phare' });
    }
    B(g, 'noir', 6.22, 6.38, 1.4, 1.75, -0.13, 0.13);
    CX(g, 'noir', 0.1, 6.38, 6.46, 1.57, 0, { cap: 'phare' });
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 4.0, at: -3.6, dir: 1, out: 'vertPomme', inn: 'cabine',
      holes: [[-1.15, -0.55, 3.3, 3.85, 'vitreVert'], [0.55, 1.15, 3.3, 3.85, 'vitreVert']] });
    cut(S(g, 'noir', -6.25, -3.5, 4.0, 4.12, -1.36, 1.36));
    cut(B(g, 'noir', -5.6, -3.9, 4.12, 4.22, -0.8, 0.8));
    cut(B(g, 'cabine', -6.0 + WT, -3.6 - WT, 3.96, 4.0, -Z + WT, Z - WT));
    backhead(g, -3.68, F, 0.85);
    steps(g, -5.9, -5.35, F, 1.13);
    S(g, 'noir', -6.2, -6.0, 0.7, F, -1.0, 1.0);
    S(g, 'noir', -6.3, -6.0, F - 0.08, F, -0.5, 0.5);
    buffers(g, 6.4, 1);
    return finish(g, { name: 'v2', smoke: [4.75, 4.45, 0], couple: [6.78, -6.3] });
  }

  // Tender à trois essieux de la V2 : caisse à rebord évasé, filets noir et blanc, charbon à l'avant
  function tenderV2() {
    const g = begin(), x0 = -3.6, x1 = 3.6, F = 1.5, xw = 2.7;
    S(g, 'noir', x0, x1, 0.6, 1.2, -0.95, 0.95);
    for (const x of [-2.2, 0, 2.2]) {
      W(g, 'roueVertePomme', 0.55, x);
      for (const s of [-1, 1]) B(g, 'noir', x - 0.18, x + 0.18, 0.4, 0.75, ...side(s, 0.94, 0.1));
    }
    for (const s of [-1, 1]) B(g, 'noir', x0 + 0.2, x1 - 0.2, 0.75, 1.15, ...side(s, 0.86, 0.08));
    S(g, 'vertPomme', x0, x1, 1.2, F, -1.25, 1.25);
    S(g, 'vertPomme', x0, xw, F, 3.1, -1.25, 1.25);
    for (const s of [-1, 1]) {
      S(g, 'vertPomme', x0, x1, 3.1, 3.32, ...side(s, 1.2, 0.1)); // rebord
      const zz = side(s, 1.25, 0.012);
      for (const [a, b, y0, y1] of [[x0 + 0.25, xw - 0.25, 1.75, 1.8], [x0 + 0.25, xw - 0.25, 2.8, 2.85]]) {
        B(g, 'noir', a, b, y0, y1, ...zz); B(g, 'blanc', a, b, y1, y1 + 0.02, ...zz);
      }
      for (const x of [x0 + 0.25, xw - 0.3]) { B(g, 'noir', x, x + 0.05, 1.75, 2.85, ...zz); B(g, 'blanc', x + 0.05, x + 0.07, 1.8, 2.8, ...zz); }
    }
    S(g, 'vertPomme', x0, x0 + 0.1, 3.1, 3.32, -1.25, 1.25);
    // fosse avant et charbon
    B(g, 'plancher', xw, x1, F, F + 0.01, -1.17, 1.17);
    B(g, 'cabine', xw, xw + 0.02, F, 3.1, -1.17, 1.17);
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: xw, a1: x1, y0: F, y1: 3.1, at: s * 1.25, dir: s, out: 'vertPomme', inn: 'cabine' });
    S(g, 'charbon', -0.8, xw, 3.1, 3.35, -1.15, 1.15);
    S(g, 'charbon', -0.2, xw - 0.1, 3.35, 3.6, -0.9, 0.9);
    S(g, 'charbon', 0.5, xw - 0.4, 3.6, 3.78, -0.5, 0.5);
    B(g, 'noir', x0 + 0.3, -0.8, 3.08, 3.12, -1.15, 1.15);
    CY(g, 'noir', 0.28, 3.1, 3.3, -2.6, 0, 10);
    S(g, 'noir', x1, x1 + 0.3, F - 0.08, F, -0.5, 0.5);
    B(g, 'noir', x0 - 0.06, x0, 1.8, 2.1, -0.8, -0.55);
    CX(g, 'noir', 0.1, x0 - 0.14, x0 - 0.06, 1.95, -0.67, { cap: 'phare' });
    buffers(g, x0, -1);
    return finish(g, { name: 'tenderV2', couple: [x1 + 0.3, x0 - 0.38], drawbar: true });
  }

  // ---------- Lot 3 : 220 américaine, Pacific 231 G, locotracteur, wagons, voitures de luxe, train blindé ----------
  // bogie à deux essieux centré en x
  function bogie(p, x, r = 0.42, face = 'roueDisque', frame = 'noir', half = 0.65) {
    W(p, face, r, x - half); W(p, face, r, x + half);
    for (const s of [-1, 1]) {
      B(p, frame, x - half - 0.45, x + half + 0.45, r - 0.12, r + 0.12, ...side(s, 0.86, 0.08));
      B(p, 'acier', x - 0.2, x + 0.2, r - 0.3, r + 0.05, ...side(s, 0.94, 0.06));
    }
    B(p, frame, x - 0.3, x + 0.3, r + 0.05, r + 0.38, -0.95, 0.95);
  }
  // groupe qui tourne (tourelle) : on le range dans userData.turrets
  function turret(p, x = 0) { const t = new T.Group(); t.position.x = x; p.add(t); ctx.turrets.push(t); return t; }
  const lamp = (p, x0, x1, y, z) => CX(p, 'noir', 0.13, x0, x1, y, z, { cap: 'phare' });

  // Locomotive américaine 220 (années 1860) : grandes roues rouges, cheminée en entonnoir,
  // grosse lanterne, chasse-pierres, cylindres et dôme en laiton, cabine en bois verni
  function american() {
    const g = begin(), F = 1.4;
    S(g, 'peinture', -3.2, 3.7, 0.6, 1.25, -0.55, 0.55);
    for (const x of [-0.6, -2.5]) W(g, 'roueRouge', 0.95, x);
    rod(g, -2.5, -0.6, 0.95, 0.95);
    for (const x of [2.15, 3.15]) W(g, 'roueRouge', 0.42, x);
    for (const s of [-1, 1]) {
      CX(g, 'laiton', 0.36, 1.85, 2.85, 1.15, s * 1.0);
      B(g, 'acier', 0.0, 1.85, 1.1, 1.2, ...side(s, 0.95, 0.06));
      S(g, 'peinture', -1.7, 3.7, 1.25, 1.32, ...side(s, 0.8, 0.45));
      B(g, 'laiton', -1.7, 3.7, 1.32, 1.36, ...side(s, 1.2, 0.05));
      CX(g, 'laiton', 0.04, -1.6, 2.6, 2.6, s * 0.83); // main courante
    }
    // chaudière, boîte à fumée, cheminée en entonnoir
    CX(g, 'peinture', 0.8, -1.7, 2.7, 2.15, 0, { seg: 12 });
    for (const x of [-1.0, 0.3, 1.6]) CX(g, 'laiton', 0.82, x, x + 0.08, 2.15, 0, { seg: 12 });
    CX(g, 'peinture', 0.86, 2.7, 3.7, 2.15, 0, { seg: 12 });
    CX(g, 'laiton', 0.55, 3.7, 3.75, 2.15, 0, { seg: 12 });
    CX(g, 'rougeVif', 0.28, 3.75, 3.78, 2.15, 0, { seg: 10 });
    B(g, 'peinture', 2.7, 3.7, 1.25, 1.6, -0.6, 0.6);
    solid(-1.7, 3.78, 1.32, 3.0, -0.86, 0.86);
    CY(g, 'peinture', 0.2, 2.9, 3.6, 3.0);
    CY(g, 'peinture', 0.24, 3.6, 4.4, 3.0, 0, 10, 0.62);
    CY(g, 'laiton', 0.64, 4.4, 4.47, 3.0, 0, 10);
    // lanterne
    B(g, 'rougeVif', 3.35, 3.95, 2.88, 2.96, -0.4, 0.4);
    B(g, 'rougeVif', 3.42, 3.92, 2.96, 3.6, -0.3, 0.3);
    B(g, 'rougeVif', 3.36, 3.98, 3.6, 3.7, -0.36, 0.36);
    CY(g, 'rougeVif', 0.08, 3.7, 3.85, 3.67);
    CX(g, 'laiton', 0.24, 3.92, 3.99, 3.28, 0, { cap: 'phare' });
    // dômes, cloche, sifflet
    CY(g, 'rougeVif', 0.32, 2.85, 3.35, 1.45, 0, 10);
    CY(g, 'laiton', 0.34, 3.35, 3.5, 1.45, 0, 10, 0.14);
    CY(g, 'laiton', 0.2, 3.0, 3.32, 0.6, 0, 10, 0.12);
    B(g, 'laiton', 0.56, 0.64, 2.85, 3.05, -0.22, 0.22);
    CY(g, 'laiton', 0.36, 2.85, 3.45, -0.4, 0, 10);
    CY(g, 'laiton', 0.38, 3.45, 3.62, -0.4, 0, 10, 0.12);
    CY(g, 'laiton', 0.05, 3.62, 3.85, -0.4);
    // chasse-pierres
    S(g, 'rougeVif', 3.7, 3.9, 0.85, 1.3, -1.2, 1.2);
    for (let z = -1.0; z <= 1.01; z += 0.25) brace(g, 'rougeVif', 3.9, 1.1, 4.9, 0.18, z - 0.05, z + 0.05, 0.07);
    B(g, 'rougeVif', 4.75, 4.95, 0.1, 0.22, -1.1, 1.1);
    solid(3.9, 4.9, 0.2, 1.1, -1.1, 1.1);
    // cabine en bois
    S(g, 'peinture', -3.2, -1.7, 1.25, F, -Z, Z);
    B(g, 'plancher', -3.2, -1.7 - WT, F, F + 0.01, -Z + WT, Z - WT);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -3.2, a1: -1.7, y0: F, y1: 3.3, at: s * Z, dir: s, out: 'teck', inn: 'boiserie',
        holes: [[-3.15, -2.65, F, 2.95], [-2.45, -1.9, 2.3, 2.95, 'vitreTeck']] });
      S(g, 'teck', -2.6, -2.1, F, F + 0.75, ...side(s, 0.72, 0.42));
      seat(-2.35, F + 0.75, s * 0.93, s * 0.9);
    }
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 3.3, at: -1.7, dir: 1, out: 'teck', inn: 'boiserie',
      holes: [[-1.1, -0.6, 2.4, 2.95, 'vitreTeck'], [0.6, 1.1, 2.4, 2.95, 'vitreTeck']] });
    cut(S(g, 'teck', -3.45, -1.5, 3.3, 3.42, -1.42, 1.42));
    cut(B(g, 'teck', -3.1, -1.8, 3.42, 3.62, -0.6, 0.6));
    cut(B(g, 'boiserie', -3.2, -1.7 - WT, 3.26, 3.3, -Z + WT, Z - WT));
    backhead(g, -1.78, F, 0.7);
    steps(g, -3.1, -2.7, F, 1.13);
    S(g, 'noir', -3.5, -3.2, F - 0.08, F, -0.5, 0.5);
    return finish(g, { name: 'american', smoke: [3.0, 4.5, 0], couple: [4.95, -3.5] });
  }
  function tenderUS() {
    const g = begin(), x0 = -3.0, x1 = 3.0, F = 1.4, xw = 1.9;
    S(g, 'peinture', x0, x1, 0.8, 1.2, -1.0, 1.0);
    for (const x of [-1.8, 1.8]) bogie(g, x, 0.42, 'roueRouge', 'peinture', 0.55);
    S(g, 'rougeVif', x0, x1, 1.2, F, -1.25, 1.25);
    S(g, 'rougeVif', x0, xw, F, 2.7, -1.2, 1.2);
    for (const s of [-1, 1]) {
      B(g, 'laiton', x0, xw, 2.62, 2.7, ...side(s, 1.2, 0.03));
      B(g, 'laiton', x0, xw, 1.55, 1.6, ...side(s, 1.2, 0.03));
      S(g, 'rougeVif', x0 + 0.3, xw, 2.7, 3.0, ...side(s, 1.1, 0.1));
      wall(g, { axis: 'x', a0: xw, a1: x1, y0: F, y1: 2.3, at: s * 1.2, dir: s, out: 'rougeVif', inn: 'boiserie' });
    }
    B(g, 'plancher', xw, x1, F, F + 0.01, -1.12, 1.12);
    B(g, 'boiserie', xw, xw + 0.02, F, 2.7, -1.12, 1.12);
    S(g, 'charbon', x0 + 0.4, xw, 2.7, 2.95, -1.1, 1.1);
    S(g, 'charbon', x0 + 0.8, xw - 0.2, 2.95, 3.2, -0.8, 0.8);
    CY(g, 'peinture', 0.22, 2.7, 2.95, x0 + 0.3);
    S(g, 'noir', x1, x1 + 0.3, F - 0.08, F, -0.5, 0.5);
    B(g, 'noir', x0 - 0.06, x0, 1.7, 2.0, -0.8, -0.55);
    CX(g, 'noir', 0.1, x0 - 0.14, x0 - 0.06, 1.85, -0.67, { cap: 'phare' });
    buffers(g, x0, -1);
    return finish(g, { name: 'tenderUS', couple: [x1 + 0.3, x0 - 0.38], drawbar: true });
  }

  // Pacific 231 G (SNCF) : noire, grands écrans pare-fumée, rangée de dômes, traverse avant rouge
  function p231() {
    const g = begin(), F = 1.5, BY = 2.85;
    S(g, 'noir', -6.0, 6.0, 0.6, 1.3, -0.6, 0.6);
    W(g, 'roueGrise', 0.48, 5.3); W(g, 'roueGrise', 0.48, 4.25);
    for (const x of [2.7, 0.55, -1.6]) W(g, 'roueGrise', 1.0, x);
    W(g, 'roueGrise', 0.6, -3.8);
    rod(g, -1.6, 2.7, 1.0, 1.0);
    for (const s of [-1, 1]) {
      S(g, 'peinture', -3.6, 4.6, 1.95, 2.05, ...side(s, 0.95, 0.33));
      CX(g, 'peinture', 0.42, 3.7, 4.6, 1.2, s * 1.02);
      B(g, 'acier', 2.75, 3.7, 1.12, 1.24, ...side(s, 0.95, 0.06));
      S(g, 'peinture', 4.0, 5.7, 2.05, 4.0, ...side(s, 1.2, 0.05)); // écran pare-fumée
      B(g, 'peinture', 4.0, 5.7, 3.95, 4.0, ...side(s, 1.05, 0.15));
      CX(g, 'acier', 0.05, -2.4, 3.9, 2.4, s * 0.98); // tuyauterie
      CX(g, 'acier', 0.06, -2.4, 2.0, 3.5, s * 0.6);
      lamp(g, 6.2, 6.3, 1.65, s * 0.75);
    }
    S(g, 'peinture', 4.6, 6.0, 1.2, 1.3, -1.25, 1.25);
    S(g, 'rouge', 6.0, 6.2, 0.6, 1.35, -1.25, 1.25);
    // chaudière, boîte à fumée
    CX(g, 'peinture', 0.95, -2.6, 4.2, BY, 0, { seg: 12 });
    for (const x of [-1.6, 0.2, 2.0]) CX(g, 'acier', 0.965, x, x + 0.06, BY, 0, { seg: 12 });
    CX(g, 'peinture', 1.0, 4.2, 5.4, BY, 0, { seg: 12 });
    CX(g, 'peinture', 0.88, 5.4, 5.5, BY, 0, { seg: 12 });
    CX(g, 'rouge', 0.18, 5.5, 5.53, BY + 0.4, 0, { seg: 10 });
    B(g, 'acier', 5.5, 5.56, BY - 0.04, BY + 0.04, -0.3, 0.3);
    B(g, 'peinture', 4.2, 5.4, 1.3, BY - 0.6, -0.7, 0.7);
    lamp(g, 5.45, 5.56, 3.62, 0);
    solid(-2.6, 5.5, 2.0, 3.85, -1.0, 1.0);
    // cheminée, réchauffeur, dômes, soupapes
    CY(g, 'peinture', 0.32, 3.75, 4.35, 4.85, 0, 10, 0.3);
    CY(g, 'peinture', 0.38, 4.3, 4.42, 4.85, 0, 10);
    B(g, 'peinture', 3.3, 4.2, 3.7, 4.05, -0.42, 0.42);
    CX(g, 'peinture', 0.22, 3.3, 4.2, 4.05);
    CY(g, 'peinture', 0.42, 3.7, 4.15, 2.3, 0, 10, 0.3);
    CY(g, 'peinture', 0.38, 3.7, 4.05, 0.8, 0, 10, 0.28);
    CY(g, 'peinture', 0.3, 3.7, 3.95, -0.6, 0, 10, 0.2);
    for (const z of [-0.14, 0.14]) CY(g, 'laiton', 0.08, 3.75, 4.1, -2.0, z);
    // foyer et cabine
    S(g, 'peinture', -3.6, -2.6, 2.05, 3.75, -1.0, 1.0);
    S(g, 'peinture', -6.0, -3.6, 1.2, F, -Z, Z);
    B(g, 'plancher', -6.0 + WT, -3.6 - WT, F, F + 0.01, -Z + WT, Z - WT);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -6.0, a1: -3.6, y0: F, y1: 4.0, at: s * Z, dir: s, out: 'peinture', inn: 'cabine',
        holes: [[-5.95, -5.3, F, 3.25], [-4.55, -3.85, 2.9, 3.55, 'vitreNoir'], [-5.15, -4.65, 2.9, 3.55, 'vitreNoir']] });
      S(g, 'peinture', -4.95, -4.5, F, F + 0.75, ...side(s, 0.72, 0.42));
      B(g, 'cabine', -5.03, -4.95, F + 0.75, F + 1.25, ...side(s, 0.72, 0.42));
      seat(-4.72, F + 0.75, s * 0.93, s * 0.9);
    }
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 4.0, at: -3.6, dir: 1, out: 'peinture', inn: 'cabine',
      holes: [[-1.15, -0.55, 3.3, 3.85, 'vitreNoir'], [0.55, 1.15, 3.3, 3.85, 'vitreNoir']] });
    cut(S(g, 'peinture', -6.25, -3.5, 4.0, 4.12, -1.38, 1.38));
    cut(B(g, 'peinture', -5.7, -3.8, 4.12, 4.22, -0.9, 0.9));
    cut(B(g, 'cabine', -6.0 + WT, -3.6 - WT, 3.96, 4.0, -Z + WT, Z - WT));
    backhead(g, -3.68, F, 0.85);
    steps(g, -5.9, -5.35, F, 1.13);
    S(g, 'noir', -6.2, -6.0, 0.7, F, -1.0, 1.0);
    S(g, 'noir', -6.3, -6.0, F - 0.08, F, -0.5, 0.5);
    buffers(g, 6.2, 1);
    return finish(g, { name: 'p231', smoke: [4.85, 4.45, 0], couple: [6.58, -6.3] });
  }
  function tender231() {
    const g = begin(), x0 = -4.2, x1 = 4.2, F = 1.5, xw = 3.2;
    S(g, 'noir', x0, x1, 0.8, 1.2, -1.0, 1.0);
    for (const x of [-2.6, 2.6]) bogie(g, x, 0.45, 'roueGrise', 'noir', 0.7);
    S(g, 'peinture', x0, x1, 1.2, F, -1.25, 1.25);
    S(g, 'peinture', x0, xw, F, 3.3, -1.25, 1.25);
    for (const s of [-1, 1]) {
      S(g, 'peinture', x0, x1, 3.3, 3.5, ...side(s, 1.2, 0.1));
      wall(g, { axis: 'x', a0: xw, a1: x1, y0: F, y1: 3.3, at: s * 1.25, dir: s, out: 'peinture', inn: 'cabine' });
      B(g, 'acier', x0 + 0.3, xw - 0.3, 2.3, 2.34, ...side(s, 1.25, 0.03));
    }
    S(g, 'peinture', x0, x0 + 0.1, 3.3, 3.5, -1.25, 1.25);
    B(g, 'plancher', xw, x1, F, F + 0.01, -1.17, 1.17);
    B(g, 'cabine', xw, xw + 0.02, F, 3.3, -1.17, 1.17);
    S(g, 'charbon', -1.0, xw, 3.3, 3.55, -1.15, 1.15);
    S(g, 'charbon', -0.3, xw - 0.1, 3.55, 3.8, -0.9, 0.9);
    S(g, 'charbon', 0.5, xw - 0.4, 3.8, 3.98, -0.5, 0.5);
    CY(g, 'peinture', 0.28, 3.3, 3.5, -3.0, 0, 10);
    S(g, 'noir', x1, x1 + 0.3, F - 0.08, F, -0.5, 0.5);
    B(g, 'noir', x0 - 0.06, x0, 1.8, 2.1, -0.8, -0.55);
    CX(g, 'noir', 0.1, x0 - 0.14, x0 - 0.06, 1.95, -0.67, { cap: 'phare' });
    buffers(g, x0, -1);
    return finish(g, { name: 'tender231', couple: [x1 + 0.3, x0 - 0.38], drawbar: true });
  }

  // Locotracteur diesel : capot blanc, tablier rouge, bouts zébrés, cabine vitrée à pupitre
  function locotracteur() {
    const g = begin(), L = 3.8, F = 1.25, CB = -0.7, CR = -3.5;
    S(g, 'noir', -L, L, 0.6, 1.0, -0.9, 0.9);
    S(g, 'brunRouge', -L, L, 1.0, F, -1.3, 1.3);
    for (const e of [-1, 1]) B(g, 'zebra', e > 0 ? L : -L - 0.03, e > 0 ? L + 0.03 : -L, 0.6, F, -1.3, 1.3);
    for (const x of [-1.6, 1.6]) { W(g, 'roueDisque', 0.55, x); axleBoxes(g, x); }
    CX(g, 'blancLoco', 0.3, -0.9, 0.9, 0.62, 0);
    // capot moteur
    S(g, 'blancLoco', CB, 3.5, F, 2.85, -0.85, 0.85);
    B(g, 'blancLoco', CB, 3.45, 2.85, 2.97, -0.7, 0.7);
    B(g, 'grille', 3.5, 3.52, 1.45, 2.7, -0.6, 0.6, false);
    for (const s of [-1, 1]) {
      B(g, 'grille', 1.9, 3.3, 1.6, 2.6, ...side(s, 0.85, 0.01), false);
      for (const x of [0.25, 1.15]) B(g, 'peinture', x - 0.02, x + 0.02, 1.4, 2.75, ...side(s, 0.85, 0.01));
      lamp(g, 3.5, 3.6, 2.6, s * 0.75);
      lamp(g, CR - 0.1, CR, 3.4, s * 0.8);
      // garde-corps le long du capot
      for (const x of [CB + 0.25, 1.4, 2.6, 3.65]) B(g, 'blancLoco', x - 0.03, x + 0.03, F, 2.3, s * 1.22 - 0.03, s * 1.22 + 0.03);
      for (const y of [1.8, 2.3]) S(g, 'blancLoco', CB + 0.25, 3.65, y - 0.03, y + 0.03, s * 1.22 - 0.03, s * 1.22 + 0.03);
    }
    for (const y of [1.8, 2.3]) S(g, 'blancLoco', 3.62, 3.68, y - 0.03, y + 0.03, -1.22, 1.22);
    CY(g, 'noir', 0.1, 2.97, 3.5, 2.6, 0.3);
    // cabine
    B(g, 'plancher', CR + WT, CB - WT, F, F + 0.01, -1.17, 1.17);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: CR, a1: CB, y0: F, y1: 3.75, at: s * 1.25, dir: s, out: 'blancLoco', inn: 'cabine',
        holes: [[-2.6, -1.8, F, 3.15], [-3.3, -2.85, 2.4, 3.2, 'vitreBlanc'], [-1.55, -0.95, 2.4, 3.2, 'vitreBlanc']] });
    }
    wall(g, { axis: 'z', a0: -1.17, a1: 1.17, y0: F, y1: 3.75, at: CB, dir: 1, out: 'blancLoco', inn: 'cabine',
      holes: [[-1.05, -0.2, 2.3, 3.35, 'vitreBlanc'], [0.2, 1.05, 2.3, 3.35, 'vitreBlanc']] });
    wall(g, { axis: 'z', a0: -1.17, a1: 1.17, y0: F, y1: 3.75, at: CR, dir: -1, out: 'blancLoco', inn: 'cabine',
      holes: [[-0.95, -0.2, 2.3, 3.25, 'vitreBlanc'], [0.2, 0.95, 2.3, 3.25, 'vitreBlanc']] });
    cut(S(g, 'blancLoco', CR - 0.12, CB + 0.12, 3.75, 3.86, -1.36, 1.36));
    cut(B(g, 'blancLoco', CR + 0.1, CB - 0.1, 3.86, 3.95, -1.0, 1.0));
    cut(B(g, 'cabine', CR + WT, CB - WT, 3.71, 3.75, -1.17, 1.17));
    // pupitre de conduite, deux sièges
    S(g, 'peinture', -1.3, CB - WT, F, F + 0.95, -1.1, 0.4);
    for (const z of [-0.75, -0.35]) CX(g, 'laiton', 0.11, -1.34, -1.3, F + 0.72, z, { cap: 'cadran' });
    for (const z of [-0.6, 0.1]) B(g, 'acier', -1.2, -1.15, F + 0.95, F + 1.3, z - 0.03, z + 0.03);
    S(g, 'peinture', CR + WT, -3.0, F, F + 0.95, -0.4, 1.1);
    for (const [x, z, yaw] of [[-1.85, -0.45, 0], [-2.65, 0.45, Math.PI]]) {
      S(g, 'noir', x - 0.15, x + 0.15, F, F + 0.45, z - 0.15, z + 0.15);
      S(g, 'velours', x - 0.25, x + 0.25, F + 0.45, F + 0.55, z - 0.25, z + 0.25);
      const bx = yaw ? x + 0.25 : x - 0.25;
      B(g, 'velours', bx - 0.04, bx + 0.04, F + 0.55, F + 1.05, z - 0.25, z + 0.25);
      seat(x, F + 0.55, z, yaw);
    }
    steps(g, -2.55, -1.85, F, 1.13);
    buffers(g, L, 1);
    buffers(g, -L, -1);
    return finish(g, { name: 'locotracteur', smoke: [2.6, 3.55, 0.3], couple: [L + 0.38, -L - 0.38] });
  }

  // Wagon à bestiaux à claires-voies : planches grises, persiennes, portes à deux battants, lanterneau.
  // Battants ouverts et rabattus côté +Z ; dedans, paille, bottes de foin et abreuvoir.
  function betail() {
    const g = begin(), L = 3.5, F = 1.15, IZ = 1.25 - WT, RT = 3.2;
    S(g, 'noir', -3.65, 3.65, 0.75, 1.05, -1.0, 1.0);
    for (const x of [-2.0, 2.0]) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x); }
    S(g, 'grisBois', -L, L, 1.05, F, -1.25, 1.25);
    B(g, 'paille', -L + WT, L - WT, F, F + 0.02, -IZ, IZ);
    for (const s of [-1, 1]) {
      const holes = [[-3.3, -1.75, 2.3, 3.0, 'persienne'], [1.75, 3.3, 2.3, 3.0, 'persienne']];
      if (s > 0) holes.push([-0.8, 0.8, F, 2.95]);
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.25, dir: s, out: 'grisBois', inn: 'grisBois', holes });
      const zz = side(s, 1.25, 0.03);
      for (const x of [-3.45, -1.65, -0.85, 0.85, 1.65, 3.45]) B(g, 'noir', x - 0.05, x + 0.05, F, RT, ...zz);
      B(g, 'noir', -L, L, RT - 0.08, RT, ...zz); B(g, 'noir', -L, L, F, F + 0.08, ...zz); B(g, 'noir', -L, L, 2.22, 2.28, ...zz);
      for (const [a, b] of [[-3.4, -1.7], [1.7, 3.4]]) brace(g, 'noir', a, F + 0.08, b, 2.22, ...zz, 0.07);
      // battants : ouverts et rabattus en +Z, fermés en -Z
      const leaves = s > 0 ? [[-1.62, -0.88], [0.88, 1.62]] : [[-0.8, 0], [0, 0.8]];
      const lz = s > 0 ? side(s, 1.28, 0.05) : side(s, 1.25, 0.04), ez = s > 0 ? side(s, 1.33, 0.02) : side(s, 1.29, 0.02);
      for (const [a, b] of leaves) {
        B(g, 'grisBois', a, b, F + 0.05, 2.95, ...lz);
        B(g, 'persienne', a + 0.08, b - 0.08, 2.35, 2.85, ...ez, false);
        brace(g, 'noir', a + 0.06, F + 0.12, b - 0.06, 2.2, ...ez, 0.06);
      }
      S(g, 'bois', -0.8, 0.8, 0.5, 0.56, ...side(s, 1.25, 0.18));
    }
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -1.25 + WT, a1: 1.25 - WT, y0: F, y1: RT, at: e * L, dir: e, out: 'grisBois', inn: 'grisBois',
        holes: [[-0.9, 0.9, 2.4, 3.0, 'persienne']] });
      buffers(g, e * 3.65, e);
    }
    cut(CX(g, 'grisBois', 1.42, -3.65, 3.65, RT, 0, { seg: 14, sy: 0.28 }));
    cut(B(g, 'grisBois', -0.9, 0.9, RT + 0.3, RT + 0.62, -0.5, 0.5));
    cut(B(g, 'peinture', -1.0, 1.0, RT + 0.62, RT + 0.68, -0.6, 0.6));
    solid(-3.65, 3.65, RT, RT + 0.45, -1.42, 1.42);
    cut(B(g, 'grisBois', -L + WT, L - WT, RT - 0.05, RT, -IZ, IZ));
    // foin, abreuvoir, lanterne
    S(g, 'paille', -3.35, -2.45, F, F + 0.55, -IZ, -0.3);
    S(g, 'paille', -3.35, -2.45, F + 0.55, F + 1.1, -IZ, -0.6);
    S(g, 'paille', -2.4, -1.6, F, F + 0.55, -IZ, -0.55);
    seat(-2.0, F + 0.55, -0.85, Math.PI / 2);
    S(g, 'bois', 2.3, 3.35, F, F + 0.5, -IZ, -0.6);
    B(g, 'eau', 2.38, 3.27, F + 0.42, F + 0.46, -IZ + 0.06, -0.68);
    B(g, 'phare', -0.12, 0.12, RT - 0.12, RT - 0.05, -0.12, 0.12);
    return finish(g, { name: 'betail', couple: [4.03, -4.03] });
  }

  // Wagon porte-conteneurs : châssis rouge brun sur bogies, un conteneur de 10 blocs.
  // Portes du conteneur ouvertes et rabattues à l'arrière ; dedans, palettes et cartons.
  function conteneur() {
    const g = begin(), L = 5.3, CL = 4.85, F = 1.32, IZ = 1.2 - WT, TOP = 3.9;
    S(g, 'brunRouge', -L, L, 0.95, 1.25, -0.5, 0.5);
    for (const s of [-1, 1]) S(g, 'brunRouge', -L, L, 0.9, 1.25, ...side(s, 0.9, 0.3));
    for (const x of [-3.9, 3.9]) bogie(g, x, 0.42, 'roueDisque', 'noir', 0.6);
    for (const s of [-1, 1]) S(g, 'noir', -L, -L + 0.45, 0.45, 0.5, ...side(s, 1.0, 0.25));
    // conteneur
    S(g, 'conteneur', -CL, CL, 1.25, F, -1.2, 1.2);
    B(g, 'plancher', -CL + WT, CL - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -CL + 0.1, a1: CL, y0: F, y1: TOP, at: s * 1.2, dir: s, out: 'conteneur', inn: 'conteneurInt' });
      S(g, 'conteneur', -CL, -CL + 0.1, F, TOP, ...side(s, 1.05, 0.15)); // montant de porte
      const lz = side(s, 1.2, 0.05);
      B(g, 'conteneur', -CL + 0.1, -CL + 1.2, F + 0.05, TOP - 0.05, ...lz); // battant rabattu
      for (const x of [-CL + 0.4, -CL + 0.9]) B(g, 'acier', x - 0.03, x + 0.03, F + 0.1, TOP - 0.1, ...side(s, 1.25, 0.03));
    }
    wall(g, { axis: 'z', a0: -1.2 + WT, a1: 1.2 - WT, y0: F, y1: TOP, at: CL, dir: 1, out: 'conteneur', inn: 'conteneurInt' });
    S(g, 'conteneur', -CL, -CL + 0.1, TOP - 0.25, TOP, -1.05, 1.05);
    cut(S(g, 'conteneur', -CL, CL, TOP, TOP + 0.06, -1.2, 1.2));
    cut(B(g, 'conteneurInt', -CL + WT, CL - WT, TOP - 0.03, TOP, -IZ, IZ));
    for (const x of [-CL, CL - 0.15]) for (const y of [1.25, TOP - 0.1]) for (const s of [-1, 1]) B(g, 'noir', x, x + 0.15, y, y + 0.12, ...side(s, 1.06, 0.16));
    // chargement
    for (const [x, z] of [[3.6, -0.55], [3.6, 0.55], [2.4, -0.55]]) {
      S(g, 'bois', x - 0.55, x + 0.55, F, F + 0.15, z - 0.5, z + 0.5);
      S(g, 'carton', x - 0.5, x + 0.5, F + 0.15, F + 1.05, z - 0.45, z + 0.45);
    }
    S(g, 'carton', 3.1, 4.1, F + 1.05, F + 1.8, -0.95, 0.0);
    S(g, 'bois', 2.4 - 0.55, 2.4 + 0.55, F, F + 0.15, 0.05, 1.05);
    S(g, 'carton', 1.95, 2.55, F + 0.15, F + 0.6, 0.15, 0.75);
    seat(2.25, F + 0.6, 0.45, Math.PI);
    B(g, 'phare', -0.15, 0.15, TOP - 0.09, TOP - 0.03, -0.15, 0.15);
    buffers(g, L, 1);
    buffers(g, -L, -1);
    return finish(g, { name: 'conteneur', couple: [L + 0.38, -L - 0.38] });
  }

  // ---- Voitures de luxe bleues (voiture-lits, voiture-restaurant, fourgon à bagages) ----
  // caisse commune : châssis, bogies, côtés percés, bouts avec intercirculation, toit crème
  function luxeShell(g, L, F, RT, holesFor) {
    S(g, 'noir', -L - 0.25, L + 0.25, 0.85, 1.1, -1.0, 1.0);
    for (const x of [-(L - 1.5), L - 1.5]) bogie(g, x, 0.42, 'roueDisque', 'noir', 0.6);
    S(g, 'bleuNuit', -L, L, 1.1, F, -1.25, 1.25);
    B(g, 'tapis', -L + WT, L - WT, F, F + 0.01, -1.17, 1.17);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.25, dir: s, out: 'bleuNuit', inn: 'acajou', holes: holesFor(s) });
      B(g, 'or', -L, L, 3.2, 3.24, ...side(s, 1.25, 0.012));
      B(g, 'or', -L, L, 1.14, 1.18, ...side(s, 1.25, 0.012));
    }
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -1.25 + WT, a1: 1.25 - WT, y0: F, y1: RT, at: e * L, dir: e, out: 'bleuNuit', inn: 'acajou', holes: [[-0.42, 0.42, F, 3.0]] });
      const a = e > 0 ? L : -L - 0.25, b = e > 0 ? L + 0.25 : -L;
      S(g, 'noir', a, b, F - 0.06, F, -0.5, 0.5);
      for (const s of [-1, 1]) S(g, 'noir', a, b, F, 3.1, ...side(s, 0.45, 0.08));
      cut(S(g, 'noir', a, b, 3.1, 3.2, -0.53, 0.53));
      buffers(g, e * (L + 0.25), e);
    }
    cut(CX(g, 'creme', 1.44, -L - 0.1, L + 0.1, RT, 0, { seg: 14, sy: 0.3 }));
    solid(-L, L, RT, RT + 0.45, -1.44, 1.44);
    for (let x = -L + 0.8; x < L - 0.4; x += 1.4) cut(CY(g, 'creme', 0.1, RT + 0.3, RT + 0.5, x, 0, 8, 0.13));
    cut(B(g, 'creme', -L + WT, L - WT, RT - 0.04, RT, -1.17, 1.17));
  }

  // Voiture-lits : couloir côté -Z, quatre compartiments avec lit, couchette haute et lavabo
  function lits() {
    const g = begin(), L = 5.0, F = 1.25, RT = 3.5, CZ = -0.4;
    const comps = [-3, -1, 1, 3];
    luxeShell(g, L, F, RT, (s) => {
      const h = [[-4.85, -4.3, F, 3.0], [4.3, 4.85, F, 3.0]];
      if (s < 0) for (const x of [-3, -2, -1, 0, 1, 2, 3]) h.push([x - 0.3, x + 0.3, 2.25, 3.0, 'vitreBleu']);
      else for (const c of comps) h.push([c - 0.45, c + 0.45, 2.25, 3.0, 'vitreBleu']);
      return h;
    });
    wall(g, { axis: 'x', a0: -4, a1: 4, y0: F, y1: RT - 0.04, at: CZ, dir: -1, out: 'acajou', inn: 'acajou',
      holes: comps.map((c) => [c - 0.85, c - 0.3, F, 2.95]) });
    for (const x of [-4, -2, 0, 2, 4]) wall(g, { axis: 'z', a0: CZ + WT, a1: 1.17, y0: F, y1: RT - 0.04, at: x + WT / 2, dir: 1, out: 'acajou', inn: 'acajou' });
    for (const c of comps) {
      const x0 = c - 0.92, x1 = c + 0.92;
      S(g, 'drap', x0, x1, F, F + 0.5, 0.42, 1.17);
      B(g, 'acajou', x0, x1, F, F + 0.42, 0.4, 0.43);
      S(g, 'drap', x0, x1, 2.3, 2.4, 0.55, 1.17);
      B(g, 'acier', x0, x1, 2.5, 2.54, 0.53, 0.57);
      S(g, 'acajou', c + 0.5, x1, F, F + 0.8, CZ + WT, 0.05);
      B(g, 'blanc', c + 0.55, x1 - 0.05, F + 0.8, F + 0.86, CZ + WT + 0.05, 0.0);
      B(g, 'phare', c - 0.12, c + 0.12, RT - 0.12, RT - 0.06, 0.4, 0.64);
      seat(c - 0.2, F + 0.5, 0.8, -Math.PI / 2);
    }
    for (const x of [-3, -1, 1, 3]) {
      S(g, 'velours', x - 0.25, x + 0.25, F + 0.5, F + 0.58, -1.17, -0.85);
      seat(x, F + 0.58, -1.0, Math.PI / 2);
    }
    steps(g, -4.8, -4.35, F, 1.13);
    steps(g, 4.35, 4.8, F, 1.13);
    return finish(g, { name: 'lits', couple: [L + 0.63, -L - 0.63] });
  }

  // Voiture-restaurant : salle à tables de deux, nappes et lampes, cuisine au bout +X
  function restaurant() {
    const g = begin(), L = 5.4, F = 1.25, RT = 3.5, K = 3.0;
    const bays = [-3.9, -2.45, -1.0, 0.45, 1.9];
    luxeShell(g, L, F, RT, (s) => {
      const h = [[-5.3, -4.9, F, 3.0]];
      for (const b of bays) h.push([b - 0.5, b + 0.5, 2.0, 3.05, 'vitreBleu']);
      if (s > 0) h.push([4.75, 5.25, F, 3.0]); else h.push([3.6, 4.4, 2.3, 3.0, 'vitreBleu']);
      return h;
    });
    for (const b of bays) for (const s of [-1, 1]) {
      const z0 = s > 0 ? 0.35 : -1.17, z1 = s > 0 ? 1.17 : -0.35;
      S(g, 'nappe', b - 0.32, b + 0.32, F + 0.72, F + 0.78, z0, z1);
      B(g, 'acajou', b - 0.05, b + 0.05, F, F + 0.72, (z0 + z1) / 2 - 0.05, (z0 + z1) / 2 + 0.05);
      CY(g, 'laiton', 0.04, F + 0.78, F + 1.0, b, s * 0.95);
      B(g, 'phare', b - 0.07, b + 0.07, F + 1.0, F + 1.12, s * 0.95 - 0.07, s * 0.95 + 0.07);
      for (const e of [-1, 1]) {
        const xc = b + e * 0.57, back = b + e * 0.75;
        S(g, 'velours', xc - 0.18, xc + 0.18, F + 0.42, F + 0.5, z0 + 0.08, z1 - 0.08);
        B(g, 'acajou', xc - 0.15, xc + 0.15, F, F + 0.42, z0 + 0.15, z1 - 0.15);
        S(g, 'velours', back - 0.04, back + 0.04, F + 0.5, F + 1.2, z0 + 0.08, z1 - 0.08);
        seat(xc, F + 0.5, (z0 + z1) / 2, e > 0 ? Math.PI : 0);
      }
    }
    for (const b of [-3.2, 0.4]) cut(B(g, 'phare', b - 0.15, b + 0.15, RT - 0.12, RT - 0.05, -0.15, 0.15));
    // cuisine
    wall(g, { axis: 'z', a0: -1.17, a1: 1.17, y0: F, y1: RT - 0.04, at: K, dir: -1, out: 'acajou', inn: 'acier', holes: [[-0.35, 0.35, F, 2.95]] });
    S(g, 'acier', K + 0.1, 4.6, F, F + 0.9, 0.55, 1.17);
    S(g, 'peinture', K + 0.1, 4.1, F, F + 0.9, -1.17, -0.5);
    B(g, 'noir', K + 0.15, 4.05, F + 0.9, F + 0.93, -1.12, -0.55);
    for (const x of [3.4, 3.8]) CY(g, 'acier', 0.16, F + 0.93, F + 1.15, x, -0.83, 10);
    S(g, 'acier', 4.2, 5.3, F + 1.6, F + 1.65, -1.17, -0.75);
    for (const x of [3.4, 3.8, 4.2]) CY(g, 'blanc', 0.12, F + 0.9, F + 0.95, x, 0.85, 10);
    B(g, 'phare', 4.0, 4.3, RT - 0.12, RT - 0.05, -0.15, 0.15);
    steps(g, -5.25, -4.95, F, 1.13);
    steps(g, 4.8, 5.2, F, 1.13);
    return finish(g, { name: 'restaurant', couple: [L + 0.63, -L - 0.63] });
  }

  // Fourgon à bagages : grandes portes au milieu, étagères, malles, bureau du chef de train, vigie sur le toit
  function fourgonLuxe() {
    const g = begin(), L = 5.0, F = 1.25, RT = 3.5;
    luxeShell(g, L, F, RT, () => [[-0.9, 0.9, F, 3.0], [-4.2, -3.6, 2.4, 3.0, 'vitreBleu'], [3.6, 4.2, 2.4, 3.0, 'vitreBleu'], [-2.6, -2.2, 2.4, 3.0, 'vitreBleu']]);
    for (const s of [-1, 1]) {
      for (const [a, b] of [[-0.9, 0], [0, 0.9]]) B(g, 'bleuNuit', a + (a < 0 ? -0.95 : 0.95), b + (a < 0 ? -0.95 : 0.95), F + 0.05, 3.0, ...side(s, 1.28, 0.05));
      S(g, 'bois', -0.9, 0.9, 0.55, 0.61, ...side(s, 1.25, 0.18));
      S(g, 'bois', 1.2, 4.8, 2.4, 2.46, ...side(s, 0.75, 0.42)); // étagères
      S(g, 'bois', 1.2, 4.8, 1.8, 1.86, ...side(s, 0.75, 0.42));
    }
    for (const [x, z, h] of [[1.6, -0.8, 0.5], [2.4, -0.85, 0.45], [3.2, 0.85, 0.55], [2.0, 0.8, 0.4], [1.6, -0.8, 0.35]]) {
      const y0 = F + (x === 1.6 && h === 0.35 ? 0.5 : 0);
      S(g, 'malle', x - 0.35, x + 0.35, y0, y0 + h, z - 0.3, z + 0.3);
    }
    for (const [x, z] of [[3.9, -0.9], [4.4, -0.9], [4.1, -0.9]]) CY(g, 'malle', 0.2, x === 4.1 ? 2.46 : 1.86, x === 4.1 ? 2.86 : 2.26, x, z, 8);
    // bureau du chef de train
    S(g, 'acajou', -4.6, -3.6, F, F + 0.8, 0.6, 1.17);
    B(g, 'nappe', -4.4, -4.0, F + 0.8, F + 0.82, 0.8, 1.05);
    S(g, 'velours', -4.0, -3.6, F + 0.45, F + 0.52, 0.05, 0.45);
    S(g, 'velours', -3.6, -3.56, F + 0.52, F + 1.1, 0.05, 0.45);
    seat(-3.8, F + 0.52, 0.25, Math.PI / 2);
    // vigie
    cut(S(g, 'bleuNuit', 3.4, 4.6, RT + 0.25, RT + 0.9, -0.55, 0.55));
    for (const s of [-1, 1]) cut(B(g, 'vitreBleu', 3.6, 4.4, RT + 0.45, RT + 0.8, ...side(s, 0.55, 0.01), false));
    cut(S(g, 'creme', 3.3, 4.7, RT + 0.9, RT + 0.98, -0.62, 0.62));
    steps(g, -0.85, 0.85, F, 1.13);
    return finish(g, { name: 'fourgonLuxe', couple: [L + 0.63, -L - 0.63] });
  }

  // ---- Train blindé (camouflage gris, vert et brun) ----
  function skirt(g, x0, x1, y0, y1, tex = 'camo') {
    for (const s of [-1, 1]) { const m = S(g, tex, x0, x1, y0, y1, ...side(s, 1.02, 0.12)); m.rotation.x = s * 0.3; }
  }
  // Locomotive blindée : caisse carrée sur la chaudière, nez en pente, cabine à fentes de vision
  function blindee() {
    const g = begin(), F = 1.5;
    S(g, 'noir', -4.8, 4.6, 0.6, 1.3, -0.6, 0.6);
    for (const x of [-2.6, -1.2, 0.2, 1.6, 3.0]) W(g, 'roueGrise', 0.62, x);
    skirt(g, -4.8, 4.6, 0.35, 1.3);
    S(g, 'camo', -4.8, 4.6, 1.3, F, -1.28, 1.28);
    S(g, 'camo', 4.6, 5.1, 0.35, 1.6, -1.2, 1.2);
    S(g, 'camo', -1.6, 4.2, F, 3.45, -0.95, 0.95);
    B(g, 'camo', -1.6, 4.0, 3.45, 3.62, -0.7, 0.7);
    brace(g, 'camo', 4.2, 3.4, 5.05, 1.55, -0.95, 0.95, 0.14);
    solid(4.2, 5.05, 1.5, 3.3, -0.95, 0.95);
    for (const s of [-1, 1]) { const m = B(g, 'camo', -1.6, 4.2, 2.9, 3.5, ...side(s, 0.8, 0.12)); m.rotation.x = -s * 0.5; }
    CY(g, 'camoInt', 0.25, 3.5, 3.85, 3.4);
    CY(g, 'camoInt', 0.3, 3.5, 3.75, 1.4, 0, 8);
    lamp(g, 5.1, 5.2, 1.3, 0.75); lamp(g, 5.1, 5.2, 1.3, -0.75);
    // cabine blindée
    B(g, 'plancher', -4.8 + WT, -1.6 - WT, F, F + 0.01, -Z + WT, Z - WT);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -4.8, a1: -1.6, y0: F, y1: 4.0, at: s * Z, dir: s, out: 'camo', inn: 'camoInt',
        holes: [[-4.7, -4.1, F, 3.15], [-3.7, -1.9, 3.0, 3.2, 'fente']] });
      S(g, 'camoInt', -3.6, -3.1, F, F + 0.75, ...side(s, 0.72, 0.42));
      seat(-3.35, F + 0.75, s * 0.93, s * 0.9);
    }
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 4.0, at: -1.6, dir: 1, out: 'camo', inn: 'camoInt',
      holes: [[-1.1, -0.25, 3.6, 3.8, 'fente'], [0.25, 1.1, 3.6, 3.8, 'fente']] });
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 4.0, at: -4.8, dir: -1, out: 'camo', inn: 'camoInt', holes: [[-0.45, 0.45, F, 3.2]] });
    cut(S(g, 'camo', -5.0, -1.4, 4.0, 4.15, -1.35, 1.35));
    cut(CY(g, 'camo', 0.42, 4.15, 4.5, -3.3, 0, 8));
    cut(B(g, 'camoInt', -4.8 + WT, -1.6 - WT, 3.96, 4.0, -Z + WT, Z - WT));
    backhead(g, -1.68, F, 0.75);
    steps(g, -4.65, -4.15, F, 1.13);
    S(g, 'noir', -5.1, -4.8, F - 0.08, F, -0.5, 0.5);
    buffers(g, 5.1, 1);
    return finish(g, { name: 'blindee', smoke: [3.4, 3.9, 0], couple: [5.48, -5.1] });
  }
  // Tender blindé : caisse fermée, fosse à charbon couverte reliée à la cabine
  function tenderBlinde() {
    const g = begin(), x0 = -3.2, x1 = 3.2, F = 1.5, xw = 2.0;
    S(g, 'noir', x0, x1, 0.6, 1.2, -0.9, 0.9);
    for (const x of [-2.0, -0.7, 0.6, 1.9]) W(g, 'roueGrise', 0.5, x);
    skirt(g, x0, x1, 0.35, 1.3);
    S(g, 'camo', x0, x1, 1.3, F, -1.28, 1.28);
    S(g, 'camo', x0, xw, F, 3.6, -1.25, 1.25);
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: xw, a1: x1, y0: F, y1: 3.6, at: s * 1.25, dir: s, out: 'camo', inn: 'camoInt' });
    B(g, 'plancher', xw, x1, F, F + 0.01, -1.17, 1.17);
    B(g, 'camoInt', xw, xw + 0.02, F, 3.6, -1.17, 1.17);
    S(g, 'charbon', xw + 0.02, xw + 0.5, F, F + 0.8, -1.17, 1.17);
    cut(S(g, 'camo', xw, x1 + 0.3, 3.6, 3.72, -1.3, 1.3));
    cut(B(g, 'camoInt', xw, x1, 3.56, 3.6, -1.17, 1.17));
    S(g, 'noir', x1, x1 + 0.3, F - 0.08, F, -0.5, 0.5);
    for (const s of [-1, 1]) S(g, 'camo', x1, x1 + 0.3, F, 3.6, ...side(s, 0.55, 0.1));
    buffers(g, x0, -1);
    return finish(g, { name: 'tenderBlinde', couple: [x1 + 0.3, x0 - 0.38], drawbar: true });
  }
  // Wagon canon : casemate à portes et fentes, tourelle qui tourne (userData.turrets), échelle pour y monter
  function wagonCanon() {
    const g = begin(), L = 4.6, F = 1.25, RT = 3.0;
    S(g, 'noir', -L, L, 0.6, 1.0, -0.9, 0.9);
    for (const x of [-2.9, 2.9]) bogie(g, x, 0.42, 'roueGrise', 'noir', 0.6);
    skirt(g, -L, L, 0.35, 1.25);
    S(g, 'camo', -L, L, 1.0, F, -1.28, 1.28);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -1.17, 1.17);
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.25, dir: s, out: 'camo', inn: 'camoInt',
      holes: [[-3.7, -3.0, F, 2.6], [-2.2, -1.2, 2.4, 2.6, 'fente'], [1.2, 3.8, 2.4, 2.6, 'fente']] });
    for (const e of [-1, 1]) wall(g, { axis: 'z', a0: -1.17, a1: 1.17, y0: F, y1: RT, at: e * L, dir: e, out: 'camo', inn: 'camoInt', holes: [[-0.8, 0.8, 2.4, 2.6, 'fente']] });
    for (const [a, b] of [[-L, -1.05], [1.05, L]]) cut(S(g, 'camo', a, b, RT, RT + 0.12, -1.3, 1.3));
    for (const s of [-1, 1]) cut(S(g, 'camo', -1.05, 1.05, RT, RT + 0.12, ...side(s, 1.05, 0.25)));
    for (const [a, b] of [[-L + WT, -1.05], [1.05, L - WT]]) cut(B(g, 'camoInt', a, b, RT - 0.04, RT, -1.17, 1.17));
    // tourelle
    const t = turret(g);
    CY(t, 'camo', 1.05, RT + 0.12, RT + 0.25, 0, 0, 12);
    for (const s of [-1, 1]) wall(t, { axis: 'x', a0: -0.95, a1: 0.95, y0: RT + 0.25, y1: RT + 1.35, at: s * 0.95, dir: s, out: 'camo', inn: 'camoInt' });
    wall(t, { axis: 'z', a0: -0.87, a1: 0.87, y0: RT + 0.25, y1: RT + 1.35, at: -0.95, dir: -1, out: 'camo', inn: 'camoInt' });
    wall(t, { axis: 'z', a0: -0.87, a1: 0.87, y0: RT + 0.25, y1: RT + 1.35, at: 0.95, dir: 1, out: 'camo', inn: 'camoInt', holes: [[-0.25, 0.25, RT + 0.55, RT + 0.95, 'fente']] });
    cut(B(t, 'camo', -1.0, 1.0, RT + 1.35, RT + 1.47, -1.0, 1.0));
    cut(CY(t, 'camo', 0.3, RT + 1.47, RT + 1.6, -0.4, 0.4, 8));
    B(t, 'camo', 0.95, 1.25, RT + 0.45, RT + 1.05, -0.35, 0.35);
    CX(t, 'camoInt', 0.13, 1.25, 3.7, RT + 0.75, 0);
    CX(t, 'camoInt', 0.17, 3.5, 3.8, RT + 0.75, 0);
    S(t, 'camoInt', -0.55, -0.15, RT + 0.25, RT + 0.65, -0.3, 0.3);
    seat(-0.35, RT + 0.65, 0, 0);
    // dedans : échelle, obus, bancs
    for (const z of [-0.25, 0.25]) B(g, 'acier', -0.75, -0.7, F, RT + 0.25, z - 0.03, z + 0.03);
    for (let y = F + 0.3; y < RT + 0.2; y += 0.3) S(g, 'acier', -0.75, -0.7, y - 0.025, y + 0.025, -0.25, 0.25);
    for (const s of [-1, 1]) {
      S(g, 'camoInt', 1.2, 3.8, F, F + 0.9, ...side(s, 0.75, 0.42));
      for (let x = 1.4; x < 3.7; x += 0.3) CY(g, 'laiton', 0.08, F + 0.9, F + 1.35, x, s * 0.96, 6);
      S(g, 'bois', -4.2, -2.4, F + 0.45, F + 0.52, ...side(s, 0.75, 0.42));
      for (const x of [-3.7, -2.9]) seat(x, F + 0.52, s * 0.96, -s * Math.PI / 2);
    }
    B(g, 'phare', -2.5, -2.2, RT - 0.1, RT - 0.04, -0.15, 0.15);
    steps(g, -3.65, -3.05, F, 1.13);
    buffers(g, L, 1);
    buffers(g, -L, -1);
    return finish(g, { name: 'wagonCanon', couple: [L + 0.38, -L - 0.38] });
  }
  // Wagon DCA : parapet blindé ouvert, affût quadruple qui tourne au milieu, caisses de munitions
  function wagonDCA() {
    const g = begin(), L = 4.0, F = 1.25, PT = 2.6;
    S(g, 'noir', -L, L, 0.6, 1.0, -0.9, 0.9);
    for (const x of [-2.4, 2.4]) bogie(g, x, 0.42, 'roueGrise', 'noir', 0.6);
    skirt(g, -L, L, 0.35, 1.25);
    S(g, 'camo', -L, L, 1.0, F, -1.28, 1.28);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -1.17, 1.17);
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: PT, at: s * 1.25, dir: s, out: 'camo', inn: 'camoInt' });
    for (const e of [-1, 1]) wall(g, { axis: 'z', a0: -1.17, a1: 1.17, y0: F, y1: PT, at: e * L, dir: e, out: 'camo', inn: 'camoInt', holes: [[-0.4, 0.4, F, 2.3]] });
    // affût
    CY(g, 'camoInt', 0.5, F, F + 0.6, 0, 0, 10);
    const t = turret(g);
    CY(t, 'camoInt', 0.9, F + 0.6, F + 0.72, 0, 0, 12);
    B(t, 'camo', -0.2, 0.2, F + 0.72, F + 1.6, -0.55, 0.55);
    const guns = new T.Group();
    guns.position.set(0, F + 1.4, 0);
    guns.rotation.z = 0.5;
    t.add(guns);
    for (const [y, z] of [[0.18, -0.32], [-0.18, -0.32], [0.18, 0.32], [-0.18, 0.32]]) {
      CX(guns, 'camoInt', 0.06, 0.0, 2.2, y, z);
      CX(guns, 'camoInt', 0.1, 1.9, 2.2, y, z);
    }
    B(guns, 'camo', -0.3, 0.4, -0.3, 0.3, -0.5, 0.5);
    B(t, 'camo', 0.45, 0.55, F + 1.0, F + 1.9, -0.75, 0.75); // bouclier
    for (const z of [-0.55, 0.55]) {
      S(t, 'camoInt', -0.75, -0.4, F + 0.72, F + 1.15, z - 0.17, z + 0.17);
      seat(-0.57, F + 1.15, z, 0);
    }
    for (const [x, z] of [[-3.2, -0.8], [-2.6, -0.8], [3.0, 0.8], [3.0, -0.8]]) S(g, 'bois', x - 0.25, x + 0.25, F, F + 0.4, z - 0.3, z + 0.3);
    buffers(g, L, 1);
    buffers(g, -L, -1);
    return finish(g, { name: 'wagonDCA', couple: [L + 0.38, -L - 0.38] });
  }

  // ---------- Lot 4 : Pacific LNER A3 / A1, tender à couloir, petite loco, voiture verte, train camouflé ----------
  // cône couché le long de X : rayon r0 en x0, r1 en x1
  function CXT(p, tex, r0, r1, x0, x1, y, z = 0, seg = 12) {
    const len = x1 - x0, g = new T.CylinderGeometry(r1, r0, len, seg);
    tileCyl(g, seg, Math.max(r0, r1), len);
    g.rotateZ(-Math.PI / 2);
    const m = new T.Mesh(g, [mat(tex), mat(tex), mat(tex)]);
    m.position.set((x0 + x1) / 2, y, z);
    p.add(m);
    return m;
  }
  // filet noir bordé de blanc, en rectangle sur un flanc
  function liningBox(p, x0, x1, y0, y1, s, at) {
    const zz = side(s, at, 0.012), zw = side(s, at, 0.006);
    for (const y of [y0, y1]) { B(p, 'noir', x0, x1, y - 0.03, y + 0.03, ...zz); B(p, 'blanc', x0 + 0.06, x1 - 0.06, y + (y === y0 ? 0.05 : -0.05) - 0.012, y + (y === y0 ? 0.05 : -0.05) + 0.012, ...zw); }
    for (const x of [x0, x1]) { B(p, 'noir', x - 0.03, x + 0.03, y0, y1, ...zz); B(p, 'blanc', x + (x === x0 ? 0.05 : -0.05) - 0.012, x + (x === x0 ? 0.05 : -0.05) + 0.012, y0 + 0.06, y1 - 0.06, ...zw); }
  }

  // Pacific LNER (A3 avec écrans pare-fumée et double cheminée, ou A1 d'origine) : vert pomme,
  // tablier haut qui plonge à l'avant, dôme allongé, cabine à grande fenêtre
  function lner(name, a3) {
    const g = begin(), F = 1.5, BY = 2.95;
    S(g, 'noir', -6.0, 6.2, 0.6, 1.3, -0.6, 0.6);
    W(g, 'roueVertePomme', 0.5, 5.15); W(g, 'roueVertePomme', 0.5, 4.15);
    for (const x of [2.4, 0.25, -1.9]) W(g, 'roueVertePomme', 1.05, x);
    W(g, 'roueVertePomme', 0.6, -4.0);
    rod(g, -1.9, 2.4, 1.05, 1.05);
    for (const s of [-1, 1]) {
      S(g, 'vertPomme', -3.6, 3.3, 2.15, 2.25, ...side(s, 0.95, 0.35));
      B(g, 'vertPomme', -3.6, 3.3, 1.95, 2.15, ...side(s, 1.24, 0.06));
      B(g, 'noir', -3.6, 3.3, 1.95, 2.0, ...side(s, 1.3, 0.01));
      brace(g, 'vertPomme', 3.3, 2.2, 4.65, 1.35, ...side(s, 0.95, 0.35), 0.1);
      CX(g, 'noir', 0.42, 3.4, 4.3, 1.2, s * 1.02);
      B(g, 'acier', 2.5, 3.4, 1.12, 1.24, ...side(s, 0.95, 0.06));
      CX(g, 'acier', 0.04, -2.5, 3.9, BY + 0.55, s * 0.84);
      if (a3) {
        S(g, 'noir', 3.9, 5.35, 2.25, 3.0, ...side(s, 1.22, 0.05));
        S(g, 'noir', 3.9, 4.8, 3.0, 3.8, ...side(s, 1.22, 0.05));
        brace(g, 'noir', 4.8, 3.8, 5.35, 3.0, ...side(s, 1.22, 0.05), 0.08);
      }
      lamp(g, 6.4, 6.5, 1.6, s * 0.78);
      liningBox(g, -5.25, -3.7, 1.75, 2.75, s, Z);
    }
    S(g, 'noir', 4.6, 6.2, 1.25, 1.35, -1.25, 1.25);
    S(g, 'rouge', 6.2, 6.4, 0.6, 1.35, -1.25, 1.25);
    lamp(g, 6.4, 6.5, 1.6, 0);
    // chaudière, boîte à fumée
    CX(g, 'vertPomme', 0.97, -2.6, 4.0, BY, 0, { seg: 12 });
    for (const x of [-2.0, -0.3, 1.4, 3.2]) {
      CX(g, 'noir', 0.985, x, x + 0.06, BY, 0, { seg: 12 });
      CX(g, 'blanc', 0.99, x - 0.025, x, BY, 0, { seg: 12 });
    }
    CX(g, 'noir', 1.0, 4.0, 5.3, BY, 0, { seg: 12 });
    CX(g, 'noir', 0.86, 5.3, 5.4, BY, 0, { seg: 12 });
    B(g, 'acier', 5.4, 5.46, BY - 0.04, BY + 0.04, -0.3, 0.3);
    B(g, 'noir', 4.0, 5.3, 1.35, BY - 0.6, -0.7, 0.7);
    lamp(g, 5.36, 5.46, BY + 0.75, 0);
    solid(-2.6, 5.4, 2.25, 3.95, -1.0, 1.0);
    if (a3) {
      const c = CY(g, 'noir', 0.28, 3.85, 4.3, 4.55, 0, 10); c.scale.x = 1.7;
      const l = CY(g, 'noir', 0.33, 4.25, 4.36, 4.55, 0, 10); l.scale.x = 1.65;
    } else {
      CY(g, 'noir', 0.3, 3.85, 4.6, 4.6, 0, 10, 0.27);
      CY(g, 'noir', 0.36, 4.52, 4.64, 4.6, 0, 10);
    }
    const d = CY(g, 'vertPomme', 0.4, 3.82, 4.12, 1.5, 0, 10, 0.3); d.scale.x = 2.2;
    for (const z of [-0.14, 0.14]) CY(g, 'laiton', 0.08, 3.85, 4.2, -1.9, z);
    CY(g, 'laiton', 0.05, 3.9, 4.25, -2.3);
    // foyer et cabine
    S(g, 'vertPomme', -3.6, -2.6, 2.25, 3.9, -1.0, 1.0);
    S(g, 'vertPomme', -6.0, -3.6, 1.2, F, -Z, Z);
    B(g, 'plancher', -6.0 + WT, -3.6 - WT, F, F + 0.01, -Z + WT, Z - WT);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -6.0, a1: -3.6, y0: F, y1: 4.0, at: s * Z, dir: s, out: 'vertPomme', inn: 'cabine',
        holes: [[-5.95, -5.35, F, 3.3], [-4.6, -3.85, 2.9, 3.6, 'vitreVert']] });
      S(g, 'peinture', -4.95, -4.5, F, F + 0.75, ...side(s, 0.72, 0.42));
      B(g, 'cabine', -5.03, -4.95, F + 0.75, F + 1.25, ...side(s, 0.72, 0.42));
      seat(-4.72, F + 0.75, s * 0.93, s * 0.9);
    }
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 4.0, at: -3.6, dir: 1, out: 'vertPomme', inn: 'cabine',
      holes: [[-1.15, -0.55, 3.3, 3.85, 'vitreVert'], [0.55, 1.15, 3.3, 3.85, 'vitreVert']] });
    cut(S(g, 'noir', -6.35, -3.5, 4.0, 4.12, -1.36, 1.36));
    cut(B(g, 'noir', -5.6, -3.9, 4.12, 4.2, -0.8, 0.8));
    cut(B(g, 'cabine', -6.0 + WT, -3.6 - WT, 3.96, 4.0, -Z + WT, Z - WT));
    backhead(g, -3.68, F, 0.85);
    steps(g, -5.9, -5.4, F, 1.13);
    S(g, 'noir', -6.3, -6.0, F - 0.08, F, -0.6, 0.6);
    buffers(g, 6.4, 1);
    return finish(g, { name, smoke: [a3 ? 4.55 : 4.6, a3 ? 4.4 : 4.7, 0], couple: [6.78, -6.3] });
  }
  const a3 = () => lner('a3', true);
  const a1 = () => lner('a1', false);

  // Tender à couloir : un couloir le long du côté +Z relie la cabine au train, porte et soufflet à l'arrière
  function tenderCouloir() {
    const g = begin(), x0 = -4.0, x1 = 4.0, F = 1.5, CZ = 0.45, TOP = 3.45, xw = 3.1;
    S(g, 'noir', x0, x1, 0.6, 1.2, -0.9, 0.9);
    for (const x of [-2.7, -0.9, 0.9, 2.7]) { W(g, 'roueVertePomme', 0.5, x); axleBoxes(g, x); }
    S(g, 'vertPomme', x0, x1, 1.2, F, -1.25, 1.25);
    // caisse à eau (pleine) et charbon dessus
    S(g, 'vertPomme', x0, xw, F, TOP, -1.25, CZ);
    S(g, 'vertPomme', xw, x1, 2.6, TOP, -1.25, CZ);
    S(g, 'charbon', -0.4, xw + 0.5, TOP, TOP + 0.3, -1.15, CZ - 0.05);
    S(g, 'charbon', 0.4, xw + 0.2, TOP + 0.3, TOP + 0.55, -0.9, CZ - 0.25);
    S(g, 'charbon', xw, xw + 0.06, F, 2.6, -1.17, CZ);
    B(g, 'plancher', xw + 0.06, x1, F, F + 0.01, -1.17, CZ);
    // couloir
    B(g, 'plancher', x0 + WT, x1, F, F + 0.01, CZ, 1.17);
    wall(g, { axis: 'x', a0: x0, a1: x1, y0: F, y1: TOP, at: 1.25, dir: 1, out: 'vertPomme', inn: 'cabine', holes: [[-3.4, -3.0, 2.7, 3.1, 'hublotVert']] });
    B(g, 'cabine', x0 + WT, x1, F, TOP - 0.1, CZ, CZ + 0.01);
    cut(S(g, 'vertPomme', x0, x1, TOP - 0.1, TOP, CZ, 1.25));
    cut(B(g, 'cabine', x0 + WT, x1, TOP - 0.14, TOP - 0.1, CZ, 1.17));
    B(g, 'phare', -0.15, 0.15, TOP - 0.2, TOP - 0.14, 0.7, 0.9);
    wall(g, { axis: 'z', a0: CZ, a1: 1.17, y0: F, y1: TOP, at: x0, dir: -1, out: 'vertPomme', inn: 'cabine', holes: [[0.5, 1.1, F, 3.2]] });
    S(g, 'vertPomme', x0 - 0.02, x0, F, TOP, -1.25, CZ);
    // soufflet arrière en face du couloir
    S(g, 'noir', x0 - 0.3, x0, F - 0.06, F, 0.4, 1.2);
    for (const z of [0.4, 1.12]) S(g, 'noir', x0 - 0.3, x0, F, 3.3, z, z + 0.08);
    cut(S(g, 'noir', x0 - 0.3, x0, 3.3, 3.4, 0.4, 1.2));
    for (const s of [-1, 1]) liningBox(g, x0 + 0.3, x1 - 0.3, 1.75, 3.2, s, 1.25);
    S(g, 'noir', x1, x1 + 0.3, F - 0.08, F, -0.6, 0.6);
    buffers(g, x0, -1);
    return finish(g, { name: 'tenderCouloir', couple: [x1 + 0.3, x0 - 0.38], drawbar: true });
  }

  // Petite locomotive noire à châssis rouge (030) et son petit tender
  function petite() {
    const g = begin(), F = 1.3;
    S(g, 'rougeVif', -2.9, 3.4, 0.55, 1.2, -0.7, 0.7);
    for (const x of [-1.4, 0.0, 1.4]) W(g, 'roueRouge', 0.6, x);
    rod(g, -1.4, 1.4, 0.6, 0.6);
    S(g, 'peinture', -2.9, 3.4, 1.2, F, -1.25, 1.25);
    S(g, 'rougeVif', 3.4, 3.6, 0.55, 1.35, -1.25, 1.25);
    CX(g, 'peinture', 0.82, -0.9, 2.6, 2.15);
    CX(g, 'peinture', 0.86, 2.6, 3.35, 2.15);
    CX(g, 'peinture', 0.74, 3.35, 3.42, 2.15);
    B(g, 'peinture', 2.6, 3.35, F, 1.6, -0.6, 0.6);
    solid(-0.9, 3.42, F, 3.0, -0.86, 0.86);
    CY(g, 'peinture', 0.24, 2.9, 3.75, 3.0, 0, 8, 0.22);
    CY(g, 'peinture', 0.3, 3.68, 3.8, 3.0);
    CY(g, 'peinture', 0.32, 2.9, 3.3, 1.7, 0, 10, 0.22);
    CY(g, 'peinture', 0.3, 2.9, 3.25, 0.4, 0, 10, 0.2);
    for (const s of [-1, 1]) {
      CX(g, 'peinture', 0.32, 2.4, 3.2, 1.0, s * 1.0);
      lamp(g, 3.6, 3.7, 1.6, s * 0.75);
      S(g, 'peinture', -0.9, 2.4, F, 1.9, ...side(s, 0.85, 0.35)); // caisses à eau
    }
    B(g, 'plancher', -2.9 + WT, -0.9 - WT, F, F + 0.01, -Z + WT, Z - WT);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -2.9, a1: -0.9, y0: F, y1: 3.5, at: s * Z, dir: s, out: 'peinture', inn: 'cabine',
        holes: [[-2.85, -2.3, F, 3.0], [-1.8, -1.1, 2.5, 3.1, 'vitreNoir']] });
      S(g, 'peinture', -2.0, -1.6, F, F + 0.7, ...side(s, 0.75, 0.42));
      seat(-1.8, F + 0.7, s * 0.96, s * 0.9);
    }
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 3.5, at: -0.9, dir: 1, out: 'peinture', inn: 'cabine',
      holes: [[-1.0, -0.55, 2.85, 3.3, 'hublotNoir'], [0.55, 1.0, 2.85, 3.3, 'hublotNoir']] });
    cut(S(g, 'peinture', -3.1, -0.75, 3.5, 3.6, -1.38, 1.38));
    cut(B(g, 'cabine', -2.9 + WT, -0.9 - WT, 3.46, 3.5, -Z + WT, Z - WT));
    backhead(g, -0.98, F, 0.7);
    steps(g, -2.8, -2.35, F, 1.13);
    S(g, 'noir', -3.2, -2.9, F - 0.08, F, -0.5, 0.5);
    buffers(g, 3.6, 1);
    return finish(g, { name: 'petite', smoke: [3.0, 3.85, 0], couple: [3.98, -3.2] });
  }
  function tenderPetit() {
    const g = begin(), x0 = -2.4, x1 = 2.4, F = 1.3, xw = 1.5;
    S(g, 'rougeVif', x0, x1, 0.55, 1.15, -0.8, 0.8);
    for (const x of [-1.2, 1.2]) { W(g, 'roueRouge', 0.5, x); axleBoxes(g, x, 'rougeVif'); }
    S(g, 'rougeVif', x0, x1, 1.15, F, -1.2, 1.2);
    S(g, 'peinture', x0, xw, F, 2.6, -1.15, 1.15);
    for (const s of [-1, 1]) {
      S(g, 'peinture', x0, xw, 2.6, 2.85, ...side(s, 1.05, 0.1));
      wall(g, { axis: 'x', a0: xw, a1: x1, y0: F, y1: 2.3, at: s * 1.15, dir: s, out: 'peinture', inn: 'cabine' });
    }
    S(g, 'charbon', x0 + 0.1, xw, 2.6, 2.85, -1.05, 1.05);
    S(g, 'charbon', x0 + 0.5, xw - 0.2, 2.85, 3.1, -0.75, 0.75);
    B(g, 'plancher', xw, x1, F, F + 0.01, -1.07, 1.07);
    B(g, 'cabine', xw, xw + 0.02, F, 2.6, -1.07, 1.07);
    S(g, 'noir', x1, x1 + 0.3, F - 0.08, F, -0.5, 0.5);
    buffers(g, x0, -1);
    return finish(g, { name: 'tenderPetit', couple: [x1 + 0.3, x0 - 0.38], drawbar: true });
  }

  // Voiture verte à toit gris : vestibules fermés aux bouts, salle à banquettes en vis-à-vis
  function voitureVerte() {
    const g = begin(), L = 4.4, F = 1.2, RT = 3.3, V = 3.4, IZ = 1.25 - WT;
    S(g, 'noir', -L - 0.2, L + 0.2, 0.75, 1.05, -1.0, 1.0);
    for (const x of [-2.8, 2.8]) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x); }
    S(g, 'vertDB', -L, L, 1.05, F, -1.25, 1.25);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    const wins = [-2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7];
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.25, dir: s, out: 'vertDB', inn: 'boiserie',
        holes: [...wins.map((x) => [x - 0.32, x + 0.32, 2.15, 2.95, 'vitreVertDB']), [-4.2, -3.6, F, 3.0], [3.6, 4.2, F, 3.0]] });
      B(g, 'acier', -V + WT, V - WT, 2.98, 3.02, ...side(s, 0.82, IZ - 0.82));
    }
    steps(g, -4.15, -3.65, F, 1.13);
    steps(g, 3.65, 4.15, F, 1.13);
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: RT, at: e * L, dir: e, out: 'vertDB', inn: 'boiserie', holes: [[-0.4, 0.4, F, 3.0]] });
      wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: RT - 0.04, at: e * V, dir: e, out: 'boiserie', inn: 'boiserie', holes: [[-0.4, 0.4, F, 2.95]] });
      const a = e > 0 ? L : -L - 0.2, b = e > 0 ? L + 0.2 : -L;
      S(g, 'noir', a, b, F - 0.06, F, -0.5, 0.5);
      for (const s of [-1, 1]) S(g, 'noir', a, b, F, 3.0, ...side(s, 0.45, 0.08));
      cut(S(g, 'noir', a, b, 3.0, 3.1, -0.53, 0.53));
      buffers(g, e * (L + 0.2), e);
    }
    cut(CX(g, 'grisToit', 1.44, -L - 0.1, L + 0.1, RT, 0, { seg: 14, sy: 0.3 }));
    solid(-L, L, RT, RT + 0.45, -1.44, 1.44);
    cut(B(g, 'plafond', -L + WT, L - WT, RT - 0.04, RT, -IZ, IZ));
    for (const x of [-2.4, 0, 2.4]) cut(B(g, 'phare', x - 0.12, x + 0.12, RT - 0.1, RT - 0.04, -0.12, 0.12));
    // banquettes en vis-à-vis de part et d'autre de l'allée
    const bench = (x0, x1, dir) => {
      for (const s of [-1, 1]) {
        S(g, 'skaiVert', x0, x1, F + 0.4, F + 0.48, ...side(s, 0.36, IZ - 0.36));
        const front = dir > 0 ? x1 : x0;
        B(g, 'boiserie', front - 0.03, front + 0.03, F, F + 0.4, ...side(s, 0.36, IZ - 0.36));
        seat((x0 + x1) / 2, F + 0.48, s * (0.36 + IZ) / 2, dir > 0 ? 0 : Math.PI);
      }
    };
    for (const xb of [-1.8, 0, 1.8]) {
      for (const s of [-1, 1]) S(g, 'skaiVert', xb - 0.05, xb + 0.05, F, F + 1.15, ...side(s, 0.36, IZ - 0.36));
      bench(xb + 0.05, xb + 0.5, 1);
      bench(xb - 0.5, xb - 0.05, -1);
    }
    bench(-V + WT, -V + WT + 0.45, 1);
    bench(V - WT - 0.45, V - WT, -1);
    return finish(g, { name: 'voitureVerte', couple: [L + 0.58, -L - 0.58] });
  }

  // ---- Train camouflé sable (taches rouges et lignes vertes) ----
  // Locomotive blindée à caissons : roues et châssis rouges, cabine à fenêtres
  function panzerlok() {
    const g = begin(), F = 1.5;
    S(g, 'rougeVif', -4.6, 4.4, 0.55, 1.25, -0.75, 0.75);
    for (const x of [-2.2, -0.9, 0.4, 1.7, 3.0]) W(g, 'roueRouge', 0.62, x);
    rod(g, -2.2, 3.0, 0.62, 0.62);
    S(g, 'camoSable', -4.6, 4.6, 1.25, F, -1.25, 1.25);
    S(g, 'camoSable', 2.5, 4.6, F, 3.9, -1.15, 1.15);
    S(g, 'camoSable', -1.6, 2.5, F, 3.45, -1.05, 1.05);
    B(g, 'camoSable', -1.3, 2.2, 3.45, 3.72, -0.7, 0.7);
    S(g, 'camoSable', -2.4, -1.6, F, 3.75, -1.15, 1.15);
    CY(g, 'camoSable', 0.28, 3.9, 4.2, 3.6, 0, 8);
    for (const s of [-1, 1]) {
      S(g, 'camoSable', 2.5, 4.6, 0.85, 1.25, ...side(s, 1.1, 0.12));
      B(g, 'fenteSable', 3.2, 4.0, 3.2, 3.45, ...side(s, 1.15, 0.01), false);
      lamp(g, 4.8, 4.9, 1.55, s * 0.75);
    }
    S(g, 'rougeVif', 4.6, 4.8, 0.55, 1.4, -1.25, 1.25);
    B(g, 'plancher', -4.6 + WT, -2.4 - WT, F, F + 0.01, -Z + WT, Z - WT);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -4.6, a1: -2.4, y0: F, y1: 4.0, at: s * Z, dir: s, out: 'camoSable', inn: 'camoInt',
        holes: [[-4.5, -3.95, F, 3.2], [-3.6, -2.75, 2.9, 3.45, 'vitreSable']] });
      S(g, 'camoInt', -3.5, -3.05, F, F + 0.75, ...side(s, 0.72, 0.42));
      seat(-3.27, F + 0.75, s * 0.93, s * 0.9);
    }
    wall(g, { axis: 'z', a0: -Z + WT, a1: Z - WT, y0: F, y1: 4.0, at: -2.4, dir: 1, out: 'camoSable', inn: 'camoInt',
      holes: [[-1.05, -0.3, 3.78, 3.95, 'fenteSable'], [0.3, 1.05, 3.78, 3.95, 'fenteSable']] });
    cut(S(g, 'camoSable', -4.75, -2.3, 4.0, 4.12, -1.38, 1.38));
    cut(B(g, 'camoInt', -4.6 + WT, -2.4 - WT, 3.96, 4.0, -Z + WT, Z - WT));
    backhead(g, -2.48, F, 0.75);
    steps(g, -4.45, -4.0, F, 1.13);
    S(g, 'noir', -4.9, -4.6, F - 0.08, F, -0.5, 0.5);
    buffers(g, 4.8, 1);
    return finish(g, { name: 'panzerlok', smoke: [3.6, 4.25, 0], couple: [5.18, -4.9] });
  }
  function tenderPanzer() {
    const g = begin(), x0 = -3.6, x1 = 3.6, F = 1.5, xw = 2.6;
    S(g, 'rougeVif', x0, x1, 0.8, 1.2, -1.0, 1.0);
    for (const x of [-2.2, 2.2]) bogie(g, x, 0.45, 'roueRouge', 'rougeVif', 0.65);
    S(g, 'camoSable', x0, x1, 1.2, F, -1.25, 1.25);
    S(g, 'camoSable', x0, xw, F, 3.4, -1.25, 1.25);
    S(g, 'charbon', x0 + 0.4, xw - 0.2, 3.4, 3.65, -1.05, 1.05);
    S(g, 'charbon', x0 + 1.0, xw - 0.6, 3.65, 3.9, -0.7, 0.7);
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: xw, a1: x1, y0: F, y1: 3.0, at: s * 1.25, dir: s, out: 'camoSable', inn: 'camoInt' });
    B(g, 'plancher', xw, x1, F, F + 0.01, -1.17, 1.17);
    B(g, 'camoInt', xw, xw + 0.02, F, 3.4, -1.17, 1.17);
    S(g, 'noir', x1, x1 + 0.3, F - 0.08, F, -0.5, 0.5);
    buffers(g, x0, -1);
    return finish(g, { name: 'tenderPanzer', couple: [x1 + 0.3, x0 - 0.38], drawbar: true });
  }
  // Fourgon de troupe : partie centrale surélevée, couchettes, table, poêle
  function fourgonSable() {
    const g = begin(), L = 3.8, F = 1.15, RT = 3.1, HT = 3.65, H0 = -2.4, H1 = 1.6, IZ = 1.25 - WT;
    S(g, 'noir', -3.95, 3.95, 0.75, 1.05, -1.0, 1.0);
    for (const x of [-2.2, 2.2]) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x); }
    S(g, 'camoSable', -L, L, 1.05, F, -1.25, 1.25);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.25, dir: s, out: 'camoSable', inn: 'camoInt',
        holes: [[2.6, 3.3, F, 2.95], [-3.4, -2.9, 2.3, 2.8, 'vitreSable'], [-0.6, 0.2, 2.3, 2.8, 'vitreSable']] });
      wall(g, { axis: 'x', a0: H0, a1: H1, y0: RT, y1: HT, at: s * 1.25, dir: s, out: 'camoSable', inn: 'camoInt', cut: true,
        holes: [[-1.6, -1.0, RT + 0.1, HT - 0.1, 'vitreSable']] });
      S(g, 'bois', 2.6, 3.3, 0.5, 0.56, ...side(s, 1.25, 0.18));
    }
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: RT, at: e * L, dir: e, out: 'camoSable', inn: 'camoInt', holes: [[-0.75, -0.25, 2.3, 2.8, 'vitreSable']] });
      wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: RT, y1: HT, at: e > 0 ? H1 : H0, dir: e, out: 'camoSable', inn: 'camoInt', cut: true });
      buffers(g, e * 3.95, e);
    }
    for (const [a, b] of [[-3.95, H0], [H1, 3.95]]) cut(S(g, 'camoSable', a, b, RT, RT + 0.1, -1.32, 1.32));
    cut(S(g, 'camoSable', H0 - 0.1, H1 + 0.1, HT, HT + 0.1, -1.32, 1.32));
    for (const [a, b] of [[-L + WT, H0], [H1, L - WT]]) cut(B(g, 'camoInt', a, b, RT - 0.04, RT, -IZ, IZ));
    cut(B(g, 'camoInt', H0 + WT, H1 - WT, HT - 0.04, HT, -IZ, IZ));
    // couchettes, table et bancs, poêle
    S(g, 'drap', -2.3, -0.5, F, F + 0.45, 0.45, IZ); seat(-1.4, F + 0.45, 0.8, -Math.PI / 2);
    S(g, 'drap', -2.3, -0.5, 2.3, 2.4, 0.55, IZ);
    S(g, 'drap', -2.3, -0.5, F, F + 0.45, -IZ, -0.45); seat(-1.4, F + 0.45, -0.8, Math.PI / 2);
    S(g, 'bois', 0.4, 1.4, F + 0.75, F + 0.8, -IZ, -0.4);
    B(g, 'bois', 0.85, 0.95, F, F + 0.75, -0.85, -0.75);
    for (const [x, yaw] of [[0.15, 0], [1.65, Math.PI]]) { S(g, 'bois', x - 0.15, x + 0.15, F, F + 0.45, -IZ, -0.4); seat(x, F + 0.45, -0.8, yaw); }
    S(g, 'peinture', 2.6, 3.3, F, F + 0.8, -IZ, -0.5);
    CY(g, 'peinture', 0.07, F + 0.8, RT + 0.6, 2.95, -0.85);
    B(g, 'phare', -0.5, -0.2, HT - 0.1, HT - 0.04, -0.15, 0.15);
    return finish(g, { name: 'fourgonSable', smoke: [2.95, RT + 0.6, -0.85], couple: [4.33, -4.33] });
  }
  // fusée couchée le long de X (empennage côté x0, ogive côté x1)
  function rocket(p, x0, x1, y, r, tex = 'camoSable') {
    CXT(p, tex, r * 0.82, r, x0, x0 + 1.3, y);
    CX(p, tex, r, x0 + 1.3, x1 - 2.4, y, 0, { seg: 12 });
    CXT(p, tex, r, 0.06, x1 - 2.4, x1, y);
    const f = new T.Group();
    f.position.set(0, y, 0);
    f.rotation.x = Math.PI / 4;
    p.add(f);
    for (const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const lo = (v) => (v > 0 ? r * 0.7 : v < 0 ? -r * 0.7 - 0.6 : -0.04), hi = (v) => (v > 0 ? r * 0.7 + 0.6 : v < 0 ? -r * 0.7 : 0.04);
      B(f, tex, x0, x0 + 1.4, lo(a), hi(a), lo(b), hi(b));
    }
    solid(x0, x1, y - r, y + r, -r, r);
  }
  // Wagon porte-fusée : long wagon plat sur bogies, berceau, portiques aux deux bouts, sièges des servants
  function fusee() {
    const g = begin(), L = 6.0, F = 1.25;
    S(g, 'camoSable', -L, L, 0.95, F, -1.2, 1.2);
    for (const x of [-4.3, 4.3]) bogie(g, x, 0.42, 'roueDisque', 'noir', 0.6);
    for (const s of [-1, 1]) S(g, 'camoSable', -4.6, 4.6, F, 1.55, ...side(s, 0.5, 0.25));
    for (const x of [-3.2, 0, 3.0]) {
      S(g, 'camoSable', x - 0.2, x + 0.2, 1.55, 1.85, -0.95, 0.95);
      for (const s of [-1, 1]) B(g, 'camoSable', x - 0.15, x + 0.15, 1.85, 2.6, ...side(s, 0.72, 0.12));
    }
    rocket(g, -5.0, 5.0, 2.55, 0.75);
    for (const e of [-1, 1]) {
      const x = e * (L - 0.25);
      for (const s of [-1, 1]) S(g, 'camoSable', x - 0.12, x + 0.12, F, 3.7, ...side(s, 1.0, 0.18));
      S(g, 'camoSable', x - 0.12, x + 0.12, 3.5, 3.75, -1.18, 1.18);
      S(g, 'camoInt', e * 5.45 - 0.2, e * 5.45 + 0.2, F, F + 0.45, -e * 0.6 - 0.2, -e * 0.6 + 0.2);
      seat(e * 5.45, F + 0.45, -e * 0.6, e > 0 ? Math.PI : 0);
      buffers(g, e * L, e);
    }
    return finish(g, { name: 'fusee', couple: [L + 0.38, -L - 0.38] });
  }
  // Wagon bâché : bâche creuse (on y entre par le rabat avant) sur un tronçon de fusée, ogive à l'air libre
  function bache() {
    const g = begin(), L = 5.5, F = 1.25, T0 = -5.0, T1 = 1.8, TOPB = 3.2;
    S(g, 'camoSable', -L, L, 0.95, F, -1.2, 1.2);
    for (const x of [-3.9, 3.9]) bogie(g, x, 0.42, 'roueDisque', 'noir', 0.6);
    B(g, 'plancher', T0, T1, F, F + 0.01, -1.12, 1.12);
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: T0, a1: T1, y0: F, y1: TOPB, at: s * 1.2, dir: s, out: 'bacheGris', inn: 'bacheGris' });
    wall(g, { axis: 'z', a0: -1.12, a1: 1.12, y0: F, y1: TOPB, at: T0, dir: -1, out: 'bacheGris', inn: 'bacheGris' });
    wall(g, { axis: 'z', a0: -1.12, a1: 1.12, y0: F, y1: TOPB, at: T1, dir: 1, out: 'bacheGris', inn: 'bacheGris', holes: [[-0.55, 0.55, F, 2.8]] });
    B(g, 'bacheGris', T1 + 0.02, T1 + 0.08, 2.0, 2.85, -0.95, -0.5); // rabat relevé
    cut(CX(g, 'bacheGris', 1.3, T0, T1, TOPB, 0, { seg: 14, sy: 0.3 }));
    solid(T0, T1, TOPB, TOPB + 0.4, -1.3, 1.3);
    for (let x = T0 + 1.0; x < T1; x += 1.6) for (const s of [-1, 1]) B(g, 'bacheGris', x - 0.1, x + 0.1, F + 0.2, TOPB, ...side(s, 1.2, 0.04));
    CX(g, 'camoSable', 0.62, T0 + 0.5, T1 - 0.4, 2.05, 0, { seg: 12 });
    solid(T0 + 0.5, T1 - 0.4, 1.43, 2.67, -0.62, 0.62);
    for (const x of [-3.8, -1.2]) S(g, 'bois', x - 0.2, x + 0.2, F, 1.5, -0.7, 0.7);
    B(g, 'phare', -1.75, -1.45, TOPB - 0.06, TOPB, -0.15, 0.15);
    // ogive sur son berceau, caisse et siège devant
    S(g, 'camoSable', 2.6, 2.9, F, 1.75, -0.8, 0.8);
    S(g, 'camoSable', 4.5, 4.8, F, 1.75, -0.6, 0.6);
    CX(g, 'camoSable', 0.6, 2.3, 3.0, 2.3);
    CXT(g, 'camoSable', 0.6, 0.06, 3.0, 5.2, 2.3);
    solid(2.3, 5.2, 1.7, 2.9, -0.6, 0.6);
    S(g, 'bois', 2.0, 2.4, F, F + 0.45, 0.65, 1.05);
    seat(2.2, F + 0.45, 0.85, Math.PI);
    for (const e of [-1, 1]) buffers(g, e * L, e);
    return finish(g, { name: 'bache', couple: [L + 0.38, -L - 0.38] });
  }

  // variante d'un modèle avec d'autres textures
  let REMAP = null;
  function variant(fn, name, remap) {
    return () => { REMAP = remap; try { const g = fn(); g.name = name; g.userData.name = name; return g; } finally { REMAP = null; } };
  }
  const couvertSable = variant(couvert, 'couvertSable', { brun: 'camoSable', toitGris: 'camoSable', brunInt: 'camoInt', vitreBrun: 'vitreSable' });

  // ---------- Lot 5 : voitures à bogies, trémie, guérite, tubes, wagons militaires, draisine ----------
  // anneau (bout de tube) tourné vers ±X
  function RING(p, tex, r0, r1, x, y, z) {
    const geo = new T.RingGeometry(r0, r1, 12);
    geo.rotateY(Math.PI / 2);
    const m = new T.Mesh(geo, mat(tex, T.DoubleSide));
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }
  // bandes d'une 2e couleur posées sur un flanc, qui contournent portes et fenêtres
  function overlay(g, tex, a0, a1, y0, y1, holes, s, at) {
    const ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h[2], h[3]]).filter((y) => y > y0 && y < y1)])].sort((a, b) => a - b);
    for (let i = 0; i < ys.length - 1; i++) {
      const b0 = ys[i], b1 = ys[i + 1], mid = (b0 + b1) / 2;
      const gaps = holes.filter((h) => h[2] < mid && h[3] > mid).map((h) => [h[0], h[1]]).sort((p, q) => p[0] - q[0]);
      let cur = a0;
      for (const [h0, h1] of gaps) { if (h0 > cur) B(g, tex, cur, h0, b0, b1, ...side(s, at, 0.008)); cur = Math.max(cur, h1); }
      if (cur < a1) B(g, tex, cur, a1, b0, b1, ...side(s, at, 0.008));
    }
  }

  // Voiture à bogies générique : vestibules à portes latérales aux deux bouts, intercirculation,
  // et dedans une salle à banquettes, des compartiments avec couloir, ou un fourgon à bagages
  function coach(o) {
    const g = begin(), L = o.L, F = 1.25, RT = o.RT || 3.45, IZ = 1.25 - WT, V = L - 0.9, CZ = -0.4;
    S(g, 'noir', -L - 0.2, L + 0.2, 0.85, 1.1, -1.0, 1.0);
    if (o.axles) for (const x of o.axles) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x); }
    else for (const x of [-(L - 1.7), L - 1.7]) bogie(g, x, 0.42, 'roueDisque', 'noir', 0.65);
    S(g, o.body, -L, L, 1.1, F, -1.25, 1.25);
    B(g, o.floor || 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    // compartiments (si besoin) et fenêtres
    let comps = [];
    if (o.layout === 'compartiments') {
      const n = Math.floor((2 * V) / 1.9), x0 = -n * 0.95;
      comps = Array.from({ length: n }, (_, i) => [x0 + i * 1.9, x0 + (i + 1) * 1.9]);
    }
    const doors = [[-L + 0.15, -L + 0.75, F, 3.0], [L - 0.75, L - 0.15, F, 3.0]];
    const winFor = (s) => {
      const w = [];
      if (o.layout === 'compartiments') for (const [a, b] of comps) { const c = (a + b) / 2, h = s > 0 ? 0.5 : 0.4; w.push([c - h, c + h, 2.2, 3.0]); }
      else if (o.layout === 'fourgon') { w.push([-V + 0.3, -V + 0.85, 2.3, 3.0], [V - 0.85, V - 0.3, 2.3, 3.0]); if (o.door !== false) w.push([-0.9, 0.9, F, 3.0, null]); }
      else for (let x = -V + 0.55; x <= V - 0.5; x += 1.0) w.push([x - 0.35, x + 0.35, 2.2, 3.0]);
      return w.map((h) => (h.length > 4 ? h.slice(0, 4) : [...h, o.glass]));
    };
    for (const s of [-1, 1]) {
      const holes = [...doors, ...winFor(s)];
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.25, dir: s, out: o.body, inn: o.inner, holes });
      if (o.upper) overlay(g, o.upper, -L, L, 2.05, RT, holes, s, 1.25);
      if (o.layout === 'fourgon' && o.door !== false) B(g, o.body, 0.95, 2.75, F + 0.05, 3.0, ...side(s, 1.28, 0.05)); // porte coulissante ouverte
    }
    for (const d of doors) steps(g, d[0] + 0.05, d[1] - 0.05, F, 1.13);
    if (o.layout === 'fourgon' && o.door !== false) steps(g, -0.85, 0.85, F, 1.13);
    // bouts : porte d'intercirculation, soufflet, tampons
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: RT, at: e * L, dir: e, out: o.body, inn: o.inner, holes: [[-0.4, 0.4, F, 3.0]] });
      if (o.layout !== 'fourgon') wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: RT - 0.04, at: e * V, dir: e, out: o.inner, inn: o.inner, holes: [[-0.4, 0.4, F, 2.95]] });
      const a = e > 0 ? L : -L - 0.2, b = e > 0 ? L + 0.2 : -L;
      S(g, 'noir', a, b, F - 0.06, F, -0.5, 0.5);
      for (const s of [-1, 1]) S(g, 'noir', a, b, F, 3.0, ...side(s, 0.45, 0.08));
      cut(S(g, 'noir', a, b, 3.0, 3.1, -0.53, 0.53));
      buffers(g, e * (L + 0.2), e);
    }
    cut(CX(g, o.roof, 1.44, -L - 0.1, L + 0.1, RT, 0, { seg: 14, sy: 0.3 }));
    solid(-L, L, RT, RT + 0.45, -1.44, 1.44);
    for (let x = -L + 0.9; x < L - 0.5; x += 1.6) cut(CY(g, o.roof, 0.1, RT + 0.3, RT + 0.5, x, 0, 8, 0.13));
    cut(B(g, 'plafond', -L + WT, L - WT, RT - 0.04, RT, -IZ, IZ));
    const st = o.seatTex || 'skaiVert';
    if (o.layout === 'salle') {
      const bench = (x0, x1, dir) => {
        for (const s of [-1, 1]) {
          S(g, st, x0, x1, F + 0.4, F + 0.48, ...side(s, 0.36, IZ - 0.36));
          const front = dir > 0 ? x1 : x0;
          B(g, o.inner, front - 0.03, front + 0.03, F, F + 0.4, ...side(s, 0.36, IZ - 0.36));
          seat((x0 + x1) / 2, F + 0.48, s * (0.36 + IZ) / 2, dir > 0 ? 0 : Math.PI);
        }
      };
      const start = -V + 0.05;
      bench(start, start + 0.45, 1);
      let p = start + 0.45 + 0.85;
      while (p + 1.0 + 0.85 + 0.45 <= V - 0.05) {
        bench(p, p + 0.45, -1);
        for (const s of [-1, 1]) S(g, st, p + 0.45, p + 0.55, F, F + 1.15, ...side(s, 0.36, IZ - 0.36));
        bench(p + 0.55, p + 1.0, 1);
        p += 1.85;
      }
      bench(p, p + 0.45, -1);
      for (let x = -V + 1.5; x < V; x += 2.4) cut(B(g, 'phare', x - 0.12, x + 0.12, RT - 0.1, RT - 0.04, -0.12, 0.12));
      for (const s of [-1, 1]) B(g, 'acier', -V + WT, V - WT, 2.98, 3.02, ...side(s, 0.82, IZ - 0.82));
    } else if (o.layout === 'compartiments') {
      wall(g, { axis: 'x', a0: -V, a1: V, y0: F, y1: RT - 0.04, at: CZ, dir: -1, out: o.inner, inn: o.inner,
        holes: comps.map(([a, b]) => [(a + b) / 2 - 0.35, (a + b) / 2 + 0.35, F, 2.95]) });
      const xs = [...new Set(comps.flat())];
      for (const x of xs) if (Math.abs(x) < V - 0.01) wall(g, { axis: 'z', a0: CZ + WT, a1: IZ, y0: F, y1: RT - 0.04, at: x + WT / 2, dir: 1, out: o.inner, inn: o.inner });
      for (const [a, b] of comps) {
        for (const [x0, x1, back, yaw] of [[a + 0.05, a + 0.6, a + 0.05, 0], [b - 0.6, b - 0.05, b - 0.13, Math.PI]]) {
          S(g, st, x0, x1, F + 0.4, F + 0.48, CZ + WT, IZ);
          B(g, o.inner, yaw ? x0 - 0.03 : x1 - 0.03, yaw ? x0 + 0.03 : x1 + 0.03, F, F + 0.4, CZ + WT, IZ);
          S(g, st, back, back + 0.08, F + 0.48, F + 1.2, CZ + WT, IZ);
          for (const z of [0.1, 0.8]) seat((x0 + x1) / 2, F + 0.48, z, yaw);
        }
        B(g, 'acier', a + 0.1, b - 0.1, 2.8, 2.84, 0.8, IZ);
        cut(B(g, 'phare', (a + b) / 2 - 0.12, (a + b) / 2 + 0.12, RT - 0.1, RT - 0.04, 0.3, 0.54));
      }
      for (let x = -V + 1.0; x < V; x += 2.2) cut(B(g, 'phare', x - 0.1, x + 0.1, RT - 0.1, RT - 0.04, -0.85, -0.65));
    } else {
      // fourgon : étagères, colis, malles, bureau du chef de train
      for (const s of [-1, 1]) S(g, 'bois', 1.2, V - 0.1, 2.3, 2.36, ...side(s, 0.75, 0.42));
      for (const [x, z, h] of [[1.6, -0.8, 0.5], [2.3, 0.85, 0.45], [1.6, 0.8, 0.6], [2.4, -0.85, 0.35]]) if (x < V - 0.4) S(g, 'malle', x - 0.3, x + 0.3, F, F + h, z - 0.28, z + 0.28);
      for (const [x, z] of [[-1.6, -0.85], [-2.2, -0.85]]) if (x > -V + 1.4) S(g, 'carton', x - 0.25, x + 0.25, F, F + 0.5, z - 0.25, z + 0.25);
      S(g, o.inner, -V + 0.1, -V + 1.0, F, F + 0.8, 0.6, IZ);
      B(g, 'nappe', -V + 0.3, -V + 0.7, F + 0.8, F + 0.82, 0.8, 1.05);
      S(g, st, -V + 1.0, -V + 1.4, F + 0.45, F + 0.52, 0.1, 0.5);
      seat(-V + 1.2, F + 0.52, 0.3, Math.PI / 2);
      for (const x of [-1.5, 1.5]) if (Math.abs(x) < V) cut(B(g, 'phare', x - 0.12, x + 0.12, RT - 0.1, RT - 0.04, -0.12, 0.12));
    }
    return finish(g, { name: o.name, couple: [L + 0.58, -L - 0.58] });
  }
  const voitureY = () => coach({ name: 'voitureY', L: 6.0, body: 'vertY', upper: 'cremeY', roof: 'grisToit', inner: 'boiserie', glass: 'vitreVertY', layout: 'compartiments', seatTex: 'velours' });
  const voitureEilzug = () => coach({ name: 'voitureEilzug', L: 5.8, body: 'vertDB', roof: 'aluToit', inner: 'boiserie', glass: 'vitreVertDB', layout: 'salle' });
  const voitureDzug = () => coach({ name: 'voitureDzug', L: 6.0, body: 'vertFonce', roof: 'grisFonce', inner: 'acajou', glass: 'vitreVertFonce', layout: 'compartiments', seatTex: 'skaiVert' });
  const fourgonDzug = () => coach({ name: 'fourgonDzug', L: 5.5, body: 'vertFonce', roof: 'grisFonce', inner: 'boiserie', glass: 'vitreVertFonce', layout: 'fourgon' });
  const fourgonVert = () => coach({ name: 'fourgonVert', L: 3.9, axles: [-2.2, 2.2], body: 'vertDB', roof: 'grisToit', inner: 'boiserie', glass: 'vitreVertDB', layout: 'fourgon' });

  // Trémie céréalière : caisse bleu acier à nervures, trappe sur le toit et échelle intérieure,
  // plateformes à garde-corps et échelles aux deux bouts, volant de frein jaune
  function tremie() {
    const g = begin(), L = 5.4, F = 1.35, TOP = 3.8, IZ = 1.25 - WT, P = 6.3;
    S(g, 'noir', -P, P, 0.85, 1.15, -1.0, 1.0);
    for (const x of [-4.4, 4.4]) bogie(g, x, 0.42, 'roueDisque', 'noir', 0.65);
    for (const x of [-2.2, 0, 2.2]) { S(g, 'bleuAcier', x - 0.7, x + 0.7, 0.7, 1.15, -0.9, 0.9); B(g, 'jaune', x - 0.1, x + 0.1, 0.62, 0.7, -0.1, 0.1); }
    S(g, 'bleuAcier', -L, L, 1.15, F, -1.25, 1.25);
    S(g, 'grain', -L + WT, L - WT, F, F + 0.6, -IZ, IZ);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: TOP, at: s * 1.25, dir: s, out: 'bleuAcier', inn: 'acier' });
      for (let x = -4.2; x <= 4.21; x += 1.4) B(g, 'bleuAcier', x - 0.04, x + 0.04, F, TOP, ...side(s, 1.25, 0.04));
    }
    for (const e of [-1, 1]) wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: TOP, at: e * L, dir: e, out: 'bleuAcier', inn: 'acier' });
    // toit avec trappe ouverte au milieu
    for (const [a, b] of [[-L - 0.05, -0.5], [0.5, L + 0.05]]) cut(CX(g, 'bleuAcier', 1.3, a, b, TOP, 0, { seg: 14, sy: 0.25 }));
    for (const s of [-1, 1]) cut(B(g, 'bleuAcier', -0.5, 0.5, TOP, TOP + 0.28, ...side(s, 0.4, 0.9)));
    solid(-L, -0.5, TOP, TOP + 0.33, -1.3, 1.3); solid(0.5, L, TOP, TOP + 0.33, -1.3, 1.3);
    for (const s of [-1, 1]) solid(-0.5, 0.5, TOP, TOP + 0.28, ...side(s, 0.4, 0.9));
    cut(B(g, 'acier', -0.5, 0.5, TOP + 0.33, TOP + 1.1, -0.44, -0.4));
    for (const [a, b] of [[-L + WT, -0.5], [0.5, L - WT]]) cut(B(g, 'acier', a, b, TOP - 0.04, TOP, -IZ, IZ));
    cut(S(g, 'grilleSol', -L, L, TOP + 0.33, TOP + 0.37, 0.45, 0.8));
    for (let y = F + 0.9; y < TOP + 0.2; y += 0.3) S(g, 'acier', 0.52, 0.56, y - 0.025, y + 0.025, -0.25, 0.25);
    for (const z of [-0.25, 0.25]) B(g, 'acier', 0.52, 0.56, F + 0.6, TOP + 0.3, z - 0.03, z + 0.03);
    // plateformes, garde-corps, échelles, volant
    for (const e of [-1, 1]) {
      const a = Math.min(e * L, e * P), b = Math.max(e * L, e * P), xo = e * (P - 0.05);
      S(g, 'grilleSol', a, b, 1.15, 1.22, -1.2, 1.2);
      for (const s of [-1, 1]) {
        for (const x of [e * (L + 0.1), xo]) B(g, 'acier', x - 0.03, x + 0.03, 1.22, 2.3, s * 1.15 - 0.03, s * 1.15 + 0.03);
        for (const y of [1.75, 2.27]) S(g, 'acier', a, b, y - 0.03, y + 0.03, s * 1.15 - 0.03, s * 1.15 + 0.03);
        for (const y of [1.75, 2.27]) S(g, 'acier', xo - 0.03, xo + 0.03, y - 0.03, y + 0.03, ...side(s, 0.45, 0.7));
      }
      const xl = e * (L + 0.06);
      for (const z of [-0.3, 0.3]) B(g, 'acier', xl - 0.03, xl + 0.03, 1.22, TOP + 0.4, z - 0.03, z + 0.03);
      for (let y = 1.5; y < TOP + 0.35; y += 0.3) S(g, 'acier', xl - 0.03, xl + 0.03, y - 0.025, y + 0.025, -0.3, 0.3);
      CX(g, 'jaune', 0.38, Math.min(e * L, e * (L + 0.04)), Math.max(e * L, e * (L + 0.04)), 2.1, 0.75, { seg: 10 });
      buffers(g, e * P, e);
    }
    seat(-3.0, F + 0.6, 0, 0);
    B(g, 'phare', -2.6, -2.3, TOP - 0.1, TOP - 0.04, -0.15, 0.15);
    return finish(g, { name: 'tremie', couple: [P + 0.38, -P - 0.38] });
  }

  // Wagon couvert à guérite : planches rousses rivetées, porte ouverte, guérite du serre-frein
  // sur le toit au bout +X, avec son échelle et un siège qui regarde par-dessus le toit
  function guerite() {
    const g = begin(), L = 3.8, F = 1.15, IZ = 1.25 - WT, RT = 3.3, HX = 2.7, HB = RT + 0.38, HT = RT + 2.1;
    S(g, 'noir', -3.95, 3.95, 0.75, 1.05, -1.0, 1.0);
    for (const x of [-2.2, 2.2]) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x); }
    S(g, 'brunClair', -L, L, 1.05, F, -1.25, 1.25);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      const holes = [[-3.4, -2.6, 2.4, 2.9, 'persienne']];
      if (s > 0) holes.push([-0.8, 0.8, F, 2.95]);
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.25, dir: s, out: 'brunClair', inn: 'brunInt', holes });
      const zz = side(s, 1.25, 0.04);
      for (const x of [-3.75, -2.4, -0.9, 0.9, 2.4, 3.75]) B(g, 'brunFonce', x - 0.06, x + 0.06, F, RT, ...zz);
      B(g, 'brunFonce', -L, L, F, F + 0.1, ...zz); B(g, 'brunFonce', -L, L, RT - 0.1, RT, ...zz);
      const [d0, d1] = s > 0 ? [0.85, 2.35] : [-0.75, 0.75], dz = side(s, 1.29, 0.05), ez = side(s, 1.34, 0.02);
      B(g, 'brunClair', d0, d1, F + 0.05, 2.95, ...dz);
      brace(g, 'brunFonce', d0 + 0.08, F + 0.12, d1 - 0.08, 2.85, ...ez, 0.07);
      B(g, 'acier', d0 + 0.2, d0 + 0.25, 1.8, 2.3, ...ez);
      S(g, 'bois', -0.8, 0.8, 0.5, 0.56, ...side(s, 1.25, 0.18));
    }
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: RT, at: e * L, dir: e, out: 'brunClair', inn: 'brunInt' });
      buffers(g, e * 3.95, e);
    }
    cut(CX(g, 'toitGris', 1.44, -3.95, HX, RT, 0, { seg: 14, sy: 0.25 }));
    cut(S(g, 'toitGris', HX, 3.95, RT, HB, -1.35, 1.35));
    solid(-3.95, HX, RT, RT + 0.36, -1.44, 1.44);
    cut(B(g, 'brunInt', -L + WT, L - WT, RT - 0.05, RT, -IZ, IZ));
    // guérite
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: HX, a1: L, y0: HB, y1: HT, at: s * 0.9, dir: s, out: 'brunClair', inn: 'brunInt', holes: [[HX + 0.2, HX + 0.75, RT + 1.2, RT + 1.75, 'vitreBrunClair']] });
    wall(g, { axis: 'z', a0: -0.82, a1: 0.82, y0: HB, y1: HT, at: L, dir: 1, out: 'brunClair', inn: 'brunInt', holes: [[-0.35, 0.35, HB, HT - 0.2]] });
    wall(g, { axis: 'z', a0: -0.82, a1: 0.82, y0: HB, y1: HT, at: HX, dir: -1, out: 'brunClair', inn: 'brunInt', holes: [[-0.5, 0.5, RT + 1.2, RT + 1.75, 'vitreBrunClair']] });
    cut(S(g, 'toitGris', HX - 0.12, L + 0.15, HT, HT + 0.1, -1.02, 1.02));
    cut(B(g, 'brunInt', HX + WT, L - WT, HT - 0.04, HT, -0.82, 0.82));
    S(g, 'bois', HX + 0.1, HX + 0.5, HB, HB + 0.45, -0.4, 0.4);
    seat(HX + 0.3, HB + 0.45, 0, Math.PI);
    CY(g, 'acier', 0.04, HB, HB + 0.9, L - 0.3, 0.55);
    CX(g, 'acier', 0.2, L - 0.35, L - 0.25, HB + 0.9, 0.55, { seg: 8 });
    // échelle extérieure et marchepied du bout
    S(g, 'bois', L, L + 0.35, F - 0.05, F, -0.5, 0.5);
    for (const z of [-0.3, 0.3]) B(g, 'acier', L + 0.06, L + 0.11, F, HB + 0.4, z - 0.03, z + 0.03);
    for (let y = F + 0.3; y < HB; y += 0.3) S(g, 'acier', L + 0.06, L + 0.11, y - 0.025, y + 0.025, -0.3, 0.3);
    // chargement
    for (const [x, z] of [[-3.1, -0.7], [-3.1, 0.1], [-2.4, -0.7]]) S(g, 'toile', x - 0.3, x + 0.3, F, F + 0.45, z - 0.35, z + 0.35);
    for (const x of [2.4, 3.1]) CY(g, 'bois', 0.33, F, F + 0.85, x, -0.75, 10);
    S(g, 'bois', 2.1, 3.4, F, F + 0.7, 0.4, IZ);
    seat(-3.1, F + 0.45, 0.1, 0);
    return finish(g, { name: 'guerite', couple: [4.33, -4.33] });
  }
  const couvertGs = variant(couvert, 'couvertGs', { brun: 'rougeGs', brunInt: 'brunInt' });

  // Wagon à ranchers chargé de trois gros tubes creux (on peut s'y glisser), sangles rouges
  function ranchers() {
    const g = begin(), L = 5.6, F = 1.15, R = 0.62, X = 5.4;
    S(g, 'brunRouge', -L, L, 0.8, F, -1.2, 1.2);
    B(g, 'bois', -L + 0.1, L - 0.1, F, F + 0.02, -1.15, 1.15);
    for (const x of [-3.6, 3.6]) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x, 'brunRouge'); }
    for (let x = -5.2; x <= 5.21; x += 1.3) for (const s of [-1, 1]) S(g, 'brunRouge', x - 0.07, x + 0.07, F, F + 2.35, ...side(s, 1.24, 0.12));
    for (const [y, z] of [[F + R, -R], [F + R, R], [F + R + 1.07, 0]]) {
      TX(g, 'tube', R, -X, X, y).position.z = z;
      TX(g, 'tubeInt', R - 0.06, -X, X, y, false, true).position.z = z;
      for (const x of [-X, X]) RING(g, 'tube', R - 0.06, R, x, y, z);
      solid(-X, X, y - R, y - R + 0.06, z - R * 0.7, z + R * 0.7);
      solid(-X, X, y + R - 0.06, y + R, z - R * 0.7, z + R * 0.7);
      for (const s of [-1, 1]) solid(-X, X, y - R * 0.7, y + R * 0.7, ...side(s, R - 0.06, 0.06).map((v) => v + z));
    }
    for (const x of [-2.6, 2.6]) {
      for (const s of [-1, 1]) B(g, 'rougeVif', x - 0.06, x + 0.06, F, F + 2.36, ...side(s, 1.2, 0.03));
      B(g, 'rougeVif', x - 0.06, x + 0.06, F + 2.33, F + 2.38, -1.2, 1.2);
    }
    for (const e of [-1, 1]) buffers(g, e * L, e);
    return finish(g, { name: 'ranchers', couple: [L + 0.38, -L - 0.38] });
  }

  // ---- Wagons militaires (sans insignes) ----
  // Wagon d'infanterie blindé : flancs à portes ouvertes et créneaux, haut en pente, garde-corps sur le toit
  function infanterie() {
    const g = begin(), L = 5.0, F = 1.25, RT = 3.5, SW = 3.05, IZ = 1.25 - WT;
    S(g, 'noir', -L, L, 0.6, 1.0, -0.9, 0.9);
    for (const x of [-3.3, 3.3]) bogie(g, x, 0.42, 'roueGrise', 'noir', 0.6);
    skirt(g, -L, L, 0.35, 1.25, 'camoTrois');
    S(g, 'camoTrois', -L, L, 1.0, F, -1.28, 1.28);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: SW, at: s * 1.25, dir: s, out: 'camoTrois', inn: 'camoInt',
        holes: [[-0.6, 0.6, F, 2.9], [-3.8, -2.6, 2.4, 2.6, 'fenteTrois'], [1.6, 2.8, 2.4, 2.6, 'fenteTrois'], [3.4, 4.4, 2.4, 2.6, 'fenteTrois']] });
      for (const [a, b] of [[-1.45, -0.65], [0.65, 1.45]]) B(g, 'camoTrois', a, b, F + 0.05, 2.85, ...side(s, 1.28, 0.06));
      const m = B(g, 'camoTrois', -L, L, SW - 0.05, RT + 0.05, ...side(s, 1.06, 0.1)); m.rotation.x = -s * 0.45;
      solid(-L, L, SW, RT, ...side(s, 1.0, 0.25));
    }
    for (const e of [-1, 1]) wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: RT, at: e * L, dir: e, out: 'camoTrois', inn: 'camoInt', holes: [[-0.7, 0.7, 2.4, 2.6, 'fenteTrois']] });
    steps(g, -0.55, 0.55, F, 1.13);
    // toit à trappe, tourelle d'observation, garde-corps
    for (const [a, b] of [[-L, 2.6], [3.2, L]]) cut(S(g, 'camoTrois', a, b, RT, RT + 0.1, -1.08, 1.08));
    for (const s of [-1, 1]) cut(S(g, 'camoTrois', 2.6, 3.2, RT, RT + 0.1, ...side(s, 0.3, 0.78)));
    for (const [a, b] of [[-L + WT, 2.6], [3.2, L - WT]]) cut(B(g, 'camoInt', a, b, RT - 0.04, RT, -1.0, 1.0));
    cut(S(g, 'camoTrois', -0.9, 0.9, RT + 0.1, RT + 0.55, -0.7, 0.7));
    for (let y = F + 0.3; y < RT; y += 0.3) S(g, 'acier', 2.86, 2.9, y - 0.025, y + 0.025, -0.25, 0.25);
    for (const z of [-0.25, 0.25]) B(g, 'acier', 2.86, 2.9, F, RT + 0.1, z - 0.03, z + 0.03);
    for (const s of [-1, 1]) {
      for (let x = -4.6; x <= 4.61; x += 1.15) cut(B(g, 'acier', x - 0.03, x + 0.03, RT + 0.1, RT + 1.0, s * 1.0 - 0.03, s * 1.0 + 0.03));
      cut(S(g, 'acier', -4.63, 4.63, RT + 0.97, RT + 1.03, s * 1.0 - 0.03, s * 1.0 + 0.03));
    }
    // bancs le long des parois
    for (const s of [-1, 1]) for (const [a, b] of [[-4.6, -0.9], [0.9, 2.5]]) {
      S(g, 'bois', a, b, F + 0.45, F + 0.52, ...side(s, 0.75, 0.42));
      for (let x = a + 0.4; x < b; x += 0.9) seat(x, F + 0.52, s * 0.96, -s * Math.PI / 2);
    }
    S(g, 'camoInt', 3.4, 4.6, F, F + 0.9, -IZ, -0.6);
    B(g, 'phare', -2.6, -2.3, RT - 0.1, RT - 0.04, -0.15, 0.15);
    for (const e of [-1, 1]) buffers(g, e * L, e);
    return finish(g, { name: 'infanterie', couple: [L + 0.38, -L - 0.38] });
  }
  // tombereau gris à bords bas, base des wagons de transport militaire
  function tombereau(g, L, H) {
    const F = 1.15, IZ = 1.25 - WT;
    S(g, 'noir', -L, L, 0.75, 1.05, -1.0, 1.0);
    for (const x of [-(L - 1.6), L - 1.6]) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x); }
    S(g, 'grisMilitaire', -L, L, 1.05, F, -1.25, 1.25);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: F + H, at: s * 1.25, dir: s, out: 'grisMilitaire', inn: 'grisMilitaire', holes: [[-0.5, 0.5, F, F + H]] });
    for (const e of [-1, 1]) { wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: F + H, at: e * L, dir: e, out: 'grisMilitaire', inn: 'grisMilitaire' }); buffers(g, e * L, e); }
    steps(g, -0.45, 0.45, F, 1.13);
    return F;
  }
  // Tombereau à canon antiaérien : affût qui tourne, bouclier, siège du tireur, caisses de munitions
  function tombereauFlak() {
    const g = begin(), L = 4.0, F = tombereau(g, L, 0.9);
    CY(g, 'grisMilitaire', 0.45, F, F + 0.5, 0.6, 0, 8);
    const t = turret(g, 0.6);
    CY(t, 'grisMilitaire', 0.8, F + 0.5, F + 0.6, 0, 0, 10);
    B(t, 'grisMilitaire', -0.25, 0.25, F + 0.6, F + 1.4, -0.4, 0.4);
    const gun = new T.Group(); gun.position.set(0, F + 1.25, 0); gun.rotation.z = 0.45; t.add(gun);
    CX(gun, 'grisMilitaire', 0.1, -0.5, 2.6, 0, 0);
    CX(gun, 'grisMilitaire', 0.18, -0.6, 0.4, 0, 0);
    B(t, 'grisMilitaire', 0.45, 0.52, F + 0.8, F + 1.75, -0.7, 0.7);
    S(g, 'grisMilitaire', -0.4, 0.0, F, F + 0.95, -0.55, -0.15);
    seat(-0.2, F + 0.95, -0.35, 0);
    for (const [x, z] of [[-3.2, -0.6], [-3.2, 0.3], [-2.5, -0.6], [3.2, 0.6]]) S(g, 'bois', x - 0.3, x + 0.3, F, F + 0.4, z - 0.35, z + 0.35);
    return finish(g, { name: 'tombereauFlak', couple: [L + 0.38, -L - 0.38] });
  }
  // Tombereau chargé d'un char camouflé : caisse creuse, trappe ouverte, siège du pilote ; tourelle qui tourne
  function tombereauChar() {
    const g = begin(), L = 4.0, F = tombereau(g, L, 0.7), HB = F + 0.85, HT = HB + 0.75;
    for (const s of [-1, 1]) {
      S(g, 'noir', -2.7, 2.7, F, F + 0.85, ...side(s, 0.65, 0.5));
      for (let x = -2.2; x <= 2.21; x += 0.88) B(g, 'roueGrise', x - 0.3, x + 0.3, F + 0.03, F + 0.63, ...side(s, 1.15, 0.03), false);
    }
    S(g, 'camo', -2.7, 2.7, F + 0.75, HB, -1.15, 1.15);
    for (const s of [-1, 1]) wall(g, { axis: 'x', a0: -2.7, a1: 2.7, y0: HB, y1: HT, at: s * 1.15, dir: s, out: 'camo', inn: 'camoInt' });
    for (const e of [-1, 1]) wall(g, { axis: 'z', a0: -1.07, a1: 1.07, y0: HB, y1: HT, at: e * 2.7, dir: e, out: 'camo', inn: 'camoInt' });
    brace(g, 'camo', 2.7, HB, 3.1, F + 0.4, -1.1, 1.1, 0.1);
    for (const [a, b] of [[-2.7, -0.9], [0.9, 1.4], [2.0, 2.7]]) cut(S(g, 'camo', a, b, HT, HT + 0.08, -1.15, 1.15));
    for (const s of [-1, 1]) { cut(S(g, 'camo', -0.9, 0.9, HT, HT + 0.08, ...side(s, 0.75, 0.4))); cut(S(g, 'camo', 1.4, 2.0, HT, HT + 0.08, ...side(s, 0.35, 0.8))); }
    S(g, 'camoInt', 1.5, 1.9, HB, HB + 0.35, -0.2, 0.2);
    seat(1.7, HB + 0.35, 0, 0);
    const t = turret(g, 0);
    CY(t, 'camo', 0.75, HT + 0.08, HT + 0.2, 0, 0, 10);
    for (const s of [-1, 1]) B(t, 'camo', -0.75, 0.75, HT + 0.2, HT + 0.85, ...side(s, 0.55, 0.12));
    B(t, 'camo', -0.75, -0.65, HT + 0.2, HT + 0.85, -0.55, 0.55);
    B(t, 'camo', 0.65, 0.75, HT + 0.2, HT + 0.85, -0.55, 0.55);
    cut(B(t, 'camo', -0.75, 0.75, HT + 0.85, HT + 0.93, -0.67, 0.67));
    CX(t, 'camoInt', 0.08, 0.75, 2.4, HT + 0.5, 0);
    B(t, 'camo', 0.75, 0.95, HT + 0.32, HT + 0.7, -0.25, 0.25);
    S(g, 'camoInt', -0.35, 0.05, HB, HB + 0.4, -0.2, 0.2);
    seat(-0.15, HB + 0.4, 0, 0);
    return finish(g, { name: 'tombereauChar', couple: [L + 0.38, -L - 0.38] });
  }
  // Wagon plat chargé d'un avion de chasse à hélice (ailes démontées rangées le long), caisses
  function platAvion() {
    const g = begin(), L = 5.0, F = tombereau(g, L, 0.3), Y = F + 1.15;
    for (const x of [-2.4, 0.6]) S(g, 'bois', x - 0.25, x + 0.25, F, Y - 0.35, -0.45, 0.45);
    CXT(g, 'avion', 0.15, 0.45, -4.4, -1.8, Y);
    CX(g, 'avion', 0.5, -1.8, 1.6, Y, 0, { seg: 12 });
    CXT(g, 'avion', 0.5, 0.42, 1.6, 2.6, Y);
    CXT(g, 'rougeVif', 0.4, 0.05, 2.6, 3.05, Y, 0, 10);
    const prop = new T.Group(); prop.position.set(2.75, Y, 0); g.add(prop);
    for (const r of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) { const b = B(prop, 'noir', -0.04, 0.04, 0, 1.15, -0.07, 0.07); b.position.set(0, Math.cos(r) * 0.55, Math.sin(r) * 0.55); b.rotation.x = -r; }
    B(g, 'avion', -4.4, -3.7, Y + 0.1, Y + 1.2, -0.04, 0.04);
    B(g, 'avion', -4.4, -3.8, Y - 0.04, Y + 0.04, -1.1, 1.1);
    for (const s of [-1, 1]) B(g, 'avion', -0.6, 1.2, Y - 0.35, Y - 0.25, ...side(s, 0.45, 0.35)); // emplantures d'ailes
    // poste de pilotage creux, verrière transparente
    S(g, 'camoInt', -0.6, 0.4, Y - 0.1, Y + 0.05, -0.32, 0.32);
    seat(-0.1, Y + 0.05, 0, 0);
    for (const s of [-1, 1]) B(g, 'vitreAvion', -0.9, 0.5, Y + 0.48, Y + 1.0, ...side(s, 0.34, 0.02), false);
    B(g, 'vitreAvion', -0.9, 0.5, Y + 1.0, Y + 1.02, -0.36, 0.36, false);
    B(g, 'vitreAvion', 0.5, 0.52, Y + 0.48, Y + 1.0, -0.36, 0.36, false);
    // ailes rangées debout le long du fuselage
    for (const s of [-1, 1]) {
      B(g, 'avion', -2.2, 1.8, F + 0.3, F + 1.55, ...side(s, 0.98, 0.08));
      S(g, 'bois', -2.0, 1.6, F, F + 0.3, ...side(s, 0.9, 0.25));
    }
    for (const [x, z, h] of [[3.7, -0.6, 0.5], [3.7, 0.5, 0.5], [4.4, 0, 0.7], [-4.6, 0.6, 0.45]]) S(g, 'bois', x - 0.3, x + 0.3, F, F + h, z - 0.35, z + 0.35);
    seat(4.4, F + 0.7, 0, Math.PI);
    return finish(g, { name: 'platAvion', couple: [L + 0.38, -L - 0.38] });
  }
  // Wagon à deux tourelles : casemate sable, bouts en pente, tourelles qui tournent dans des cages
  function wagonTourelles() {
    const g = begin(), L = 6.0, F = 1.25, RT = 3.2, CB = 2.0, CT = 4.1, IZ = 1.25 - WT;
    S(g, 'noir', -L, L, 0.6, 1.0, -0.9, 0.9);
    for (const x of [-4.3, 4.3]) bogie(g, x, 0.42, 'roueGrise', 'noir', 0.6);
    skirt(g, -L, L, 0.35, 1.25, 'sable');
    S(g, 'sable', -L, L, 1.0, F, -1.28, 1.28);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.25, dir: s, out: 'sable', inn: 'camoInt',
        holes: [[-1.6, -0.9, F, 2.8], [-4.8, -3.2, 2.4, 2.6, 'fenteSableClair'], [3.2, 4.8, 2.4, 2.6, 'fenteSableClair']] });
      wall(g, { axis: 'x', a0: -CB, a1: CB, y0: RT, y1: CT, at: s * 1.05, dir: s, out: 'sable', inn: 'camoInt', cut: true, holes: [[0.4, 1.4, 3.5, 3.7, 'fenteSableClair']] });
      cut(S(g, 'sable', -CB, CB, RT, RT + 0.08, ...side(s, 1.05, 0.2)));
    }
    steps(g, -1.55, -0.95, F, 1.13);
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: 2.4, at: e * L, dir: e, out: 'sable', inn: 'camoInt' });
      brace(g, 'sable', e * L, 2.35, e * (L - 0.8), RT + 0.05, -1.25, 1.25, 0.12);
      solid(Math.min(e * L, e * (L - 0.8)), Math.max(e * L, e * (L - 0.8)), 2.4, RT, -1.25, 1.25);
      wall(g, { axis: 'z', a0: -0.97, a1: 0.97, y0: RT, y1: CT, at: e * CB, dir: e, out: 'sable', inn: 'camoInt', cut: true });
      // toit autour de l'ouverture de la tourelle
      const xc = e * 4.0, a = Math.min(e * CB, e * (L - 0.8)), b = Math.max(e * CB, e * (L - 0.8));
      for (const [p0, p1] of [[a, Math.min(xc - 0.7, xc + 0.7)], [Math.max(xc - 0.7, xc + 0.7), b]]) cut(S(g, 'sable', p0, p1, RT, RT + 0.1, -1.25, 1.25));
      for (const s of [-1, 1]) cut(S(g, 'sable', xc - 0.7, xc + 0.7, RT, RT + 0.1, ...side(s, 0.7, 0.55)));
      const t = turret(g, xc);
      if (e < 0) t.rotation.y = Math.PI;
      CY(t, 'sable', 0.85, RT + 0.1, RT + 0.22, 0, 0, 12);
      B(t, 'sable', -0.7, 0.7, RT + 0.22, RT + 0.95, -0.65, 0.65);
      cut(CY(t, 'sable', 0.25, RT + 0.95, RT + 1.15, -0.3, 0, 8));
      B(t, 'sable', 0.7, 0.9, RT + 0.35, RT + 0.8, -0.3, 0.3);
      CX(t, 'sable', 0.08, 0.9, 3.0, RT + 0.58, 0);
      CX(t, 'sable', 0.11, 2.75, 3.0, RT + 0.58, 0);
      // cage contre les grenades
      for (let k = 0; k < 14; k++) {
        const ang = (k / 14) * Math.PI * 2, cx = xc + Math.cos(ang) * 1.15, cz = Math.sin(ang) * 1.15;
        if (Math.abs(cz) < 1.2) B(g, 'acier', cx - 0.03, cx + 0.03, RT + 0.1, RT + 1.05, cz - 0.03, cz + 0.03);
      }
      const torus = new T.Mesh(new T.TorusGeometry(1.15, 0.035, 4, 20), mat('acier'));
      torus.rotation.x = Math.PI / 2; torus.position.set(xc, RT + 1.05, 0); g.add(torus);
      S(g, 'camoInt', xc - 0.25, xc + 0.25, F, RT - 0.6, -0.25, 0.25);
      seat(xc, RT - 0.6, 0, e > 0 ? 0 : Math.PI);
    }
    cut(S(g, 'sable', -CB - 0.05, CB + 0.05, CT, CT + 0.1, -1.1, 1.1));
    cut(CY(g, 'sable', 0.3, CT + 0.1, CT + 0.35, 0.3, 0, 8));
    cut(B(g, 'camoInt', -CB + WT, CB - WT, CT - 0.04, CT, -0.97, 0.97));
    for (const s of [-1, 1]) {
      S(g, 'bois', -CB + 0.2, -1.7, F + 0.45, F + 0.52, ...side(s, 0.75, 0.42));
      seat(-1.95, F + 0.52, s * 0.96, -s * Math.PI / 2);
      S(g, 'camoInt', 0.4, CB - 0.1, F, F + 0.9, ...side(s, 0.75, 0.42));
      for (let x = 0.55; x < CB - 0.1; x += 0.3) CY(g, 'laiton', 0.08, F + 0.9, F + 1.35, x, s * 0.96, 6);
    }
    B(g, 'phare', -0.15, 0.15, CT - 0.1, CT - 0.04, -0.15, 0.15);
    for (const e of [-1, 1]) buffers(g, e * L, e);
    return finish(g, { name: 'wagonTourelles', couple: [L + 0.38, -L - 0.38] });
  }
  // Wagon DCA en bois camouflé : parapet en planches, cabine à toit bombé, affût quadruple qui tourne
  function flakBois() {
    const g = begin(), L = 4.4, F = 1.25, PT = 2.4, C0 = -0.6, C1 = 2.9, CR = 3.6, IZ = 1.25 - WT;
    S(g, 'noir', -L, L, 0.6, 1.0, -0.9, 0.9);
    for (const x of [-2.6, 2.6]) { W(g, 'roueGrise', 0.5, x); axleBoxes(g, x); }
    for (const s of [-1, 1]) S(g, 'camoBois', -L, L, 0.45, F, ...side(s, 1.13, 0.12));
    S(g, 'camoBois', -L, L, 1.0, F, -1.28, 1.28);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: PT, at: s * 1.25, dir: s, out: 'camoBois', inn: 'camoBois', holes: [[3.3, 3.9, F, 2.3]] });
      wall(g, { axis: 'x', a0: C0, a1: C1, y0: PT, y1: CR, at: s * 1.1, dir: s, out: 'camoBois', inn: 'boiserie', holes: [[0.0, 0.6, 2.7, 3.2, 'vitreBois'], [1.6, 2.3, 2.7, 3.2]] });
      S(g, 'camoBois', C0, C1, PT - 0.05, PT + 0.05, ...side(s, 1.1, 0.15));
    }
    steps(g, 3.35, 3.85, F, 1.13);
    for (const e of [-1, 1]) wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: PT, at: e * L, dir: e, out: 'camoBois', inn: 'camoBois' });
    wall(g, { axis: 'z', a0: -1.02, a1: 1.02, y0: F, y1: CR, at: C0, dir: -1, out: 'camoBois', inn: 'boiserie', holes: [[-0.4, 0.4, F, 3.0], [0.55, 0.9, 2.7, 3.2, 'vitreBois']] });
    wall(g, { axis: 'z', a0: -1.02, a1: 1.02, y0: F, y1: CR, at: C1, dir: 1, out: 'camoBois', inn: 'boiserie', holes: [[-0.4, 0.4, F, 3.0]] });
    cut(CX(g, 'camoBois', 1.25, C0 - 0.12, C1 + 0.12, CR, 0, { seg: 14, sy: 0.35 }));
    solid(C0, C1, CR, CR + 0.44, -1.25, 1.25);
    cut(B(g, 'boiserie', C0 + WT, C1 - WT, CR - 0.04, CR, -1.02, 1.02));
    B(g, 'acier', 1.6, 2.4, 2.98, 3.02, -1.3, -1.0); // mitrailleuse à la fenêtre
    // dans la cabine : table, bancs, radio
    S(g, 'bois', 0.4, 1.4, F + 0.75, F + 0.8, 0.3, 1.0);
    for (const [x, yaw] of [[0.1, 0], [1.7, Math.PI]]) { S(g, 'bois', x - 0.15, x + 0.15, F, F + 0.45, 0.3, 1.0); seat(x, F + 0.45, 0.65, yaw); }
    S(g, 'camoInt', 2.2, C1 - WT, F, F + 1.1, -1.0, -0.4);
    B(g, 'phare', 1.0, 1.3, CR - 0.1, CR - 0.04, -0.15, 0.15);
    // affût quadruple
    CY(g, 'camoInt', 0.45, F, F + 0.5, -2.6, 0, 10);
    const t = turret(g, -2.6);
    t.rotation.y = Math.PI;
    CY(t, 'camoInt', 0.85, F + 0.5, F + 0.6, 0, 0, 12);
    B(t, 'camoInt', -0.2, 0.2, F + 0.6, F + 1.5, -0.55, 0.55);
    const guns = new T.Group(); guns.position.set(0, F + 1.3, 0); guns.rotation.z = 0.6; t.add(guns);
    for (const [y, z] of [[0.18, -0.32], [-0.18, -0.32], [0.18, 0.32], [-0.18, 0.32]]) CX(guns, 'camoInt', 0.06, 0, 2.2, y, z);
    B(guns, 'camoInt', -0.3, 0.4, -0.3, 0.3, -0.5, 0.5);
    for (const z of [-0.55, 0.55]) { S(g, 'camoInt', -2.25, -1.9, F, F + 1.1, z - 0.17, z + 0.17); seat(-2.07, F + 1.1, z, Math.PI); }
    for (const e of [-1, 1]) buffers(g, e * L, e);
    return finish(g, { name: 'flakBois', couple: [L + 0.38, -L - 0.38] });
  }
  // Draisine blindée : caisse en trapèze, tourelle qui tourne, deux postes de conduite à créneaux
  function draisine() {
    const g = begin(), L = 4.4, F = 1.25, SW = 2.35, RT = 3.25, IZ = 1.25 - WT;
    S(g, 'noir', -L, L, 0.6, 1.0, -0.8, 0.8);
    for (const x of [-2.0, 2.0]) W(g, 'roueGrise', 0.55, x);
    skirt(g, -L, L, 0.35, 1.3, 'sable');
    S(g, 'sable', -L, L, 1.0, F, -1.28, 1.28);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: SW, at: s * 1.25, dir: s, out: 'sable', inn: 'camoInt',
        holes: [[1.0, 1.7, F, 2.3], [-3.6, -2.6, 1.95, 2.1, 'fenteSableClair'], [2.6, 3.6, 1.95, 2.1, 'fenteSableClair']] });
      const m = B(g, 'sable', -L + 0.6, L - 0.6, SW - 0.05, RT + 0.05, ...side(s, 1.06, 0.1)); m.rotation.x = -s * 0.42;
      solid(-L, L, SW, RT, ...side(s, 1.0, 0.25));
    }
    steps(g, 1.05, 1.65, F, 1.13);
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: SW, at: e * L, dir: e, out: 'sable', inn: 'camoInt', holes: [[-0.6, 0.6, 1.95, 2.15, 'fenteSableClair']] });
      brace(g, 'sable', e * L, SW - 0.05, e * (L - 0.6), RT + 0.05, -1.1, 1.1, 0.12);
      solid(Math.min(e * L, e * (L - 0.6)), Math.max(e * L, e * (L - 0.6)), SW, RT, -1.1, 1.1);
      S(g, 'camoInt', e * (L - 1.0) - 0.22, e * (L - 1.0) + 0.22, F, F + 0.5, -0.25, 0.25);
      seat(e * (L - 1.0), F + 0.5, 0, e > 0 ? 0 : Math.PI);
      S(g, 'camoInt', e * (L - 0.35) - 0.12, e * (L - 0.35) + 0.12, F, F + 0.9, -0.5, 0.5);
      buffers(g, e * L, e);
    }
    CX(g, 'camoInt', 0.05, L, L + 0.45, 2.02, 0.75);
    // toit percé pour la tourelle
    for (const [a, b] of [[-(L - 0.6), -0.7], [0.7, L - 0.6]]) cut(S(g, 'sable', a, b, RT, RT + 0.1, -1.0, 1.0));
    for (const s of [-1, 1]) cut(S(g, 'sable', -0.7, 0.7, RT, RT + 0.1, ...side(s, 0.7, 0.3)));
    for (const [a, b] of [[-L + WT, -0.7], [0.7, L - WT]]) cut(B(g, 'camoInt', a, b, RT - 0.04, RT, -1.0, 1.0));
    const t = turret(g, 0);
    CY(t, 'sable', 0.82, RT + 0.1, RT + 0.22, 0, 0, 12);
    B(t, 'sable', -0.7, 0.7, RT + 0.22, RT + 0.9, -0.62, 0.62);
    cut(CY(t, 'sable', 0.3, RT + 0.9, RT + 1.15, -0.25, 0, 10));
    B(t, 'sable', 0.7, 0.9, RT + 0.35, RT + 0.75, -0.28, 0.28);
    CX(t, 'sable', 0.11, 0.9, 1.85, RT + 0.55, 0);
    CX(t, 'sable', 0.15, 1.65, 1.9, RT + 0.55, 0);
    B(t, 'acier', -0.5, -0.47, RT + 0.9, RT + 2.0, 0.4, 0.43);
    S(g, 'camoInt', -0.25, 0.25, F, RT - 0.6, -0.25, 0.25);
    seat(0, RT - 0.6, 0, 0);
    return finish(g, { name: 'draisine', couple: [L + 0.38, -L - 0.38] });
  }

  function begin() { ctx = { solids: [], seats: [], turrets: [] }; return new T.Group(); }
  // centre le véhicule en X et ramène les données dans son repère
  // Petite locomotive de conte (020 T) : cheminée haute, châssis et roues rouges, cabine à hublots
  function chibi() {
    const g = begin(), F = 1.25, IZ = 1.2 - WT;
    S(g, 'rougeVif', -2.6, 2.6, 0.5, 1.15, -0.7, 0.7);
    for (const x of [-0.8, 0.8]) W(g, 'roueRouge', 0.55, x);
    rod(g, -0.8, 0.8, 0.55, 0.55);
    S(g, 'peinture', -2.6, 2.6, 1.15, F, -1.2, 1.2);
    for (const e of [-1, 1]) S(g, 'rougeVif', e > 0 ? 2.6 : -2.8, e > 0 ? 2.8 : -2.6, 0.5, 1.3, -1.2, 1.2);
    CX(g, 'peinture', 0.72, -0.6, 2.2, 2.0);
    for (const x of [0.2, 1.2]) CX(g, 'laiton', 0.74, x, x + 0.07, 2.0);
    CX(g, 'peinture', 0.76, 2.2, 2.6, 2.0);
    CX(g, 'laiton', 0.5, 2.6, 2.65, 2.0);
    B(g, 'peinture', 2.2, 2.6, F, 1.5, -0.5, 0.5);
    solid(-0.6, 2.65, F, 2.76, -0.76, 0.76);
    CY(g, 'peinture', 0.16, 2.7, 4.0, 2.35, 0, 8);
    CY(g, 'peinture', 0.25, 3.98, 4.14, 2.35, 0, 8);
    CY(g, 'laiton', 0.17, 3.3, 3.38, 2.35, 0, 8);
    CY(g, 'peinture', 0.3, 2.7, 3.15, 1.0, 0, 10, 0.2);
    CY(g, 'laiton', 0.14, 3.15, 3.25, 1.0, 0, 8);
    B(g, 'peinture', 2.45, 2.7, 2.8, 3.15, -0.13, 0.13);
    CX(g, 'noir', 0.1, 2.7, 2.78, 2.98, 0, { cap: 'phare' });
    for (const s of [-1, 1]) {
      CX(g, 'peinture', 0.28, 1.6, 2.4, 0.9, s * 0.95);
      S(g, 'peinture', -0.6, 1.6, F, 1.9, ...side(s, 0.8, 0.4));
      lamp(g, 2.8, 2.9, 1.5, s * 0.75);
    }
    B(g, 'plancher', -2.6 + WT, -0.6 - WT, F, F + 0.01, -IZ, IZ);
    for (const s of [-1, 1]) {
      wall(g, { axis: 'x', a0: -2.6, a1: -0.6, y0: F, y1: 3.3, at: s * 1.2, dir: s, out: 'peinture', inn: 'cabine',
        holes: [[-2.5, -2.0, F, 2.9], [-1.6, -0.9, 2.3, 2.9, 'vitreNoir']] });
      S(g, 'peinture', -1.9, -1.5, F, F + 0.6, ...side(s, 0.6, 0.42));
      seat(-1.7, F + 0.6, s * 0.81, s * 0.9);
    }
    wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: 3.3, at: -0.6, dir: 1, out: 'peinture', inn: 'cabine',
      holes: [[-0.95, -0.5, 2.6, 3.05, 'hublotNoir'], [0.5, 0.95, 2.6, 3.05, 'hublotNoir']] });
    wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: 3.3, at: -2.6, dir: -1, out: 'peinture', inn: 'cabine',
      holes: [[-0.9, -0.35, 2.4, 2.95, 'vitreNoir'], [0.35, 0.9, 2.4, 2.95, 'vitreNoir']] });
    cut(S(g, 'peinture', -2.8, -0.45, 3.3, 3.4, -1.32, 1.32));
    cut(B(g, 'peinture', -2.4, -0.8, 3.4, 3.48, -0.8, 0.8));
    cut(B(g, 'cabine', -2.6 + WT, -0.6 - WT, 3.26, 3.3, -IZ, IZ));
    backhead(g, -0.68, F, 0.65);
    steps(g, -2.45, -2.05, F, 1.08);
    buffers(g, 2.8, 1);
    buffers(g, -2.8, -1);
    return finish(g, { name: 'chibi', smoke: [2.35, 4.2, 0], couple: [3.18, -3.18] });
  }
  // Voiture de conte : bleu marine en bas, crème en haut, filet doré, lanterneau argenté, plateformes ouvertes
  function voitureConte() {
    const g = begin(), L = 3.6, F = 1.15, RT = 3.15, IZ = 1.2 - WT, P = L + 0.6;
    S(g, 'noir', -P, P, 0.75, 1.05, -0.95, 0.95);
    for (const x of [-2.3, 2.3]) { W(g, 'roueDisque', 0.5, x); axleBoxes(g, x); }
    S(g, 'bleuMarine', -L, L, 1.05, F, -1.2, 1.2);
    B(g, 'plancher', -L + WT, L - WT, F, F + 0.01, -IZ, IZ);
    const wins = [-2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7];
    for (const s of [-1, 1]) {
      const holes = wins.map((x) => [x - 0.3, x + 0.3, 2.0, 2.75, 'vitreConte']);
      wall(g, { axis: 'x', a0: -L, a1: L, y0: F, y1: RT, at: s * 1.2, dir: s, out: 'bleuMarine', inn: 'boiserie', holes });
      overlay(g, 'blancCreme', -L, L, 1.95, RT, holes, s, 1.2);
      B(g, 'or', -L, L, 1.76, 1.8, ...side(s, 1.2, 0.012));
      const d = B(g, 'or', -0.12, 0.12, 1.36, 1.6, ...side(s, 1.2, 0.012)); d.rotation.z = Math.PI / 4;
    }
    for (const e of [-1, 1]) {
      wall(g, { axis: 'z', a0: -IZ, a1: IZ, y0: F, y1: RT, at: e * L, dir: e, out: 'blancCreme', inn: 'boiserie', holes: [[-0.4, 0.4, F, 2.85]] });
      const a = Math.min(e * L, e * P), b = Math.max(e * L, e * P), xo = e * (P - 0.04);
      S(g, 'noir', a, b, 0.95, 1.08, -1.15, 1.15);
      for (const s of [-1, 1]) {
        B(g, 'acier', xo - 0.03, xo + 0.03, 1.08, 2.05, s * 1.1 - 0.03, s * 1.1 + 0.03);
        S(g, 'acier', xo - 0.03, xo + 0.03, 2.0, 2.06, ...side(s, 0.45, 0.68));
        S(g, 'noir', a + 0.05, b - 0.05, 0.4, 0.46, ...side(s, 1.0, 0.3));
      }
      cut(S(g, 'aluToit', a, b, RT - 0.05, RT + 0.05, -1.25, 1.25)); // auvent
      buffers(g, e * P, e);
    }
    cut(CX(g, 'aluToit', 1.32, -L - 0.05, L + 0.05, RT, 0, { seg: 14, sy: 0.25 }));
    cut(B(g, 'aluToit', -L + 0.3, L - 0.3, RT + 0.28, RT + 0.52, -0.45, 0.45));
    solid(-L, L, RT, RT + 0.5, -1.32, 1.32);
    cut(B(g, 'plafond', -L + WT, L - WT, RT - 0.04, RT, -IZ, IZ));
    for (const x of [-1.8, 0, 1.8]) cut(B(g, 'phare', x - 0.1, x + 0.1, RT - 0.1, RT - 0.04, -0.1, 0.1));
    const bench = (x0, x1, dir) => {
      for (const s of [-1, 1]) {
        S(g, 'banc', x0, x1, F + 0.4, F + 0.48, ...side(s, 0.36, IZ - 0.36));
        B(g, 'boiserie', (dir > 0 ? x1 : x0) - 0.03, (dir > 0 ? x1 : x0) + 0.03, F, F + 0.4, ...side(s, 0.36, IZ - 0.36));
        seat((x0 + x1) / 2, F + 0.48, s * (0.36 + IZ) / 2, dir > 0 ? 0 : Math.PI);
      }
    };
    for (const xb of [-1.35, 1.35]) {
      for (const s of [-1, 1]) S(g, 'banc', xb - 0.05, xb + 0.05, F, F + 1.1, ...side(s, 0.36, IZ - 0.36));
      bench(xb + 0.05, xb + 0.5, 1);
      bench(xb - 0.5, xb - 0.05, -1);
    }
    bench(-L + WT, -L + WT + 0.45, 1);
    bench(L - WT - 0.45, L - WT, -1);
    return finish(g, { name: 'voitureConte', couple: [P + 0.38, -P - 0.38] });
  }

  // Regroupe toutes les pièces fixes d'un véhicule en une seule forme par matériau.
  // Un véhicule passe de 100 à 280 pièces à une vingtaine : beaucoup moins d'appels de dessin.
  // Les roues, les bielles et les tourelles (et tout ce qu'elles portent) restent à part pour bouger.
  function mergeStatic(inner) {
    inner.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(inner.matrixWorld).invert(), rel = new T.Matrix4();
    const moving = new Set(ctx.turrets);
    const isMoving = (o) => { for (let p = o; p && p !== inner; p = p.parent) if (moving.has(p) || p.userData.rod || (p !== o && p.userData.wheel)) return true; return false; };
    const buckets = [0, 1].map(() => ({ pos: [], nor: [], uv: [], tex: [], wh: [], cut: [] })), done = [], axis = new T.Vector3(), ctr = new T.Vector3();
    inner.traverse((o) => {
      if (!o.isMesh || isMoving(o)) return;
      rel.multiplyMatrices(inv, o.matrixWorld);
      let wh = [0, 0, 0];
      if (o.userData.wheel) {
        // roue : son axe doit être parallèle à z dans le véhicule, sinon elle reste à part
        axis.set(0, 0, 1).transformDirection(rel);
        if (Math.abs(Math.abs(axis.z) - 1) > 1e-3) return;
        ctr.set(0, 0, 0).applyMatrix4(rel);
        wh = [ctr.x, ctr.y, Math.sign(axis.z) / o.userData.wheel];
      }
      let geo = o.geometry.clone().applyMatrix4(rel);
      if (geo.index) { const ni = geo.toNonIndexed(); geo.dispose(); geo = ni; }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const n = geo.attributes.position.count;
      const groups = geo.groups.length ? geo.groups : [{ start: 0, count: n, materialIndex: 0 }];
      const P = geo.attributes.position.array, N = geo.attributes.normal.array, Uv = geo.attributes.uv.array, cutF = o.userData.cut ? 1 : 0;
      for (const gr of groups) {
        const m = mats[gr.materialIndex] || mats[0], b = buckets[m.transparent ? 1 : 0], L = layer(m.map), E = lueur(m);
        const end = Math.min(n, gr.start + gr.count);
        // tout en faces avant : une face double devient deux faces, une face arrière est retournée
        const ways = m.side === T.DoubleSide ? [1, -1] : m.side === T.BackSide ? [-1] : [1];
        for (let t = gr.start; t + 2 < end; t += 3) {
          for (const w of ways) {
            for (const i of w > 0 ? [t, t + 1, t + 2] : [t, t + 2, t + 1]) {
              b.pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
              b.nor.push(w * N[i * 3], w * N[i * 3 + 1], w * N[i * 3 + 2]);
              b.uv.push(Uv[i * 2], Uv[i * 2 + 1]);
              b.tex.push(L, E);
              b.wh.push(wh[0], wh[1], wh[2]);
              b.cut.push(cutF);
            }
          }
        }
      }
      geo.dispose();
      done.push(o);
    });
    for (const o of done) { o.parent.remove(o); if (!o.userData.shared) o.geometry.dispose(); }
    const U = { dist: { value: 0 }, cut: { value: 0 } };
    buckets.forEach((b, k) => {
      if (!b.pos.length) return;
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('aTex', new T.Float32BufferAttribute(b.tex, 2));
      geo.setAttribute('aWheel', new T.Float32BufferAttribute(b.wh, 3));
      geo.setAttribute('aCut', new T.Float32BufferAttribute(b.cut, 1));
      geo.computeBoundingBox(); geo.computeBoundingSphere(); // le rayon de la souris teste d'abord la boîte
      const mesh = new T.Mesh(geo, vehicleMat(U, k === 1));
      mesh.userData.U = U;
      mesh.userData.ownMat = true;
      inner.add(mesh);
    });
  }
  function finish(inner, info) {
    mergeStatic(inner);
    const box = new T.Box3().setFromObject(inner);
    const dx = -(box.min.x + box.max.x) / 2;
    inner.position.x = dx;
    const outer = new T.Group();
    outer.name = info.name;
    outer.add(inner);
    const r2 = (v) => Math.round(v * 1000) / 1000;
    outer.userData = {
      name: info.name,
      length: box.max.x - box.min.x,
      height: box.max.y,
      width: box.max.z - box.min.z,
      solids: ctx.solids.map(([x0, x1, y0, y1, z0, z1]) => [x0 + dx, x1 + dx, y0, y1, z0, z1].map(r2)),
      seats: ctx.seats.map((s) => ({ x: r2(s.x + dx), y: r2(s.y), z: r2(s.z), yaw: r2(s.yaw) })),
      couple: { front: r2(info.couple[0] + dx), rear: r2(info.couple[1] + dx) },
      drawbar: !!info.drawbar, // attelé serré au véhicule de devant (tender)
      turrets: ctx.turrets, // tourelles : tourner leur rotation.y pour viser
      smoke: info.smoke ? new T.Vector3(info.smoke[0] + dx, info.smoke[1], info.smoke[2]) : null,
    };
    ctx = null;
    return outer;
  }

  const BUILDERS = {
    carenee, tender, t030, loco19, tender19, v2, tenderV2, american, tenderUS, p231, tender231, locotracteur, blindee, tenderBlinde,
    a3, a1, tenderCouloir, petite, tenderPetit, panzerlok, tenderPanzer,
    citerne, voiture, couvert, fourgon, betail, conteneur, lits, restaurant, fourgonLuxe, wagonCanon, wagonDCA,
    voitureVerte, couvertSable, fourgonSable, fusee, bache,
    draisine, voitureY, voitureEilzug, voitureDzug, fourgonDzug, fourgonVert, tremie, guerite, couvertGs, ranchers,
    infanterie, tombereauFlak, tombereauChar, platAvion, wagonTourelles, flakBois, chibi, voitureConte,
  };
  function build(name) {
    const f = BUILDERS[name];
    if (!f) throw new Error('modèle inconnu : ' + name);
    return f();
  }
  // fait tourner les roues et bouger les bielles pour une distance parcourue (en blocs)
  function roll(g, dist) {
    const u = g.userData;
    if (!u._w) {
      u._w = []; u._r = [];
      u._u = [];
      g.traverse((o) => { if (o.userData.wheel) u._w.push(o); if (o.userData.rod) u._r.push(o); if (o.userData.U && !u._u.includes(o.userData.U)) u._u.push(o.userData.U); });
    }
    for (const U of u._u) U.dist.value = dist;
    for (const w of u._w) w.rotation.z = -dist / w.userData.wheel;
    for (const r of u._r) {
      const d = r.userData.rod, a = -dist / d.wheel;
      r.position.x = d.x + d.crank * Math.cos(a);
      r.position.y = d.y + d.crank * Math.sin(a);
    }
  }
  // cache ou montre les toits et plafonds (vue en coupe)
  function setCut(g, on) { g.traverse((o) => { if (o.userData.cut) o.visible = !on; if (o.userData.U) o.userData.U.cut.value = on ? 1 : 0; }); }
  // libère les formes d'un véhicule retiré de la scène (les matériaux sont partagés)
  function dispose(g) { g.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); if (o.userData.ownMat) o.material.dispose(); }); }
  // range des véhicules à la suite (le premier devant, vers +X), attelage contre attelage ; renvoie la longueur
  function couple(list, gap = 0.04) {
    let x = 0;
    list.forEach((v, i) => {
      const c = v.userData.couple;
      v.position.x = i === 0 ? 0 : x - c.front - (v.userData.drawbar ? 0 : gap);
      x = v.position.x + c.rear;
    });
    const front = list[0].position.x + list[0].userData.length / 2;
    const last = list[list.length - 1], rear = last.position.x - last.userData.length / 2;
    const mid = (front + rear) / 2;
    for (const v of list) v.position.x -= mid;
    return front - rear;
  }

  // ajoute une texture pixel (px(x, y, [r, g, b], bruit) sur 16 × 16)
  function define(name, draw) { DEFS[name] = draw; }


  // ---------- Dans le jeu : chaque modèle est fait une fois, puis copié pour chaque voiture ----------
  // (la copie garde les formes du modèle ; seul le matériau est à elle : ses roues tournent à part)
  const templates = new Map();
  const _inv = new T.Matrix4(), _rel = new T.Matrix4(), _bb = new T.Box3();
  function template(name) {
    let g = templates.get(name);
    if (g) return g;
    g = build(name);
    g.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      o.castShadow = !m.transparent;
      o.receiveShadow = true;
    });
    g.updateMatrixWorld(true);
    // tourelles : leur place, le haut (le tireur passe la tête au-dessus), le bout du canon (dans
    // le repère de la tourelle) et leur sens au repos
    g.userData.guns = g.userData.turrets.map((t) => {
      _inv.copy(t.matrixWorld).invert();
      const box = new T.Box3();
      let mx = -Infinity, my = 0;
      t.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        _bb.copy(o.geometry.boundingBox).applyMatrix4(_rel.multiplyMatrices(_inv, o.matrixWorld));
        box.union(_bb);
        if (_bb.max.x > mx) { mx = _bb.max.x; my = (_bb.min.y + _bb.max.y) / 2; }
      });
      const top = new T.Box3().setFromObject(t).max.y, p = new T.Vector3().setFromMatrixPosition(t.matrixWorld);
      return { x: p.x, z: p.z, top, muzzle: [mx, my, 0], rest: t.rotation.y };
    });
    templates.set(name, g);
    return g;
  }
  function instance(name) {
    const tpl = template(name), ud = tpl.userData;
    tpl.userData = {}; // (clone recopie userData en JSON : pas les tourelles)
    const g = tpl.clone(true);
    tpl.userData = ud;
    const a = [], b = [];
    tpl.traverse((o) => a.push(o));
    g.traverse((o) => b.push(o));
    const U = { dist: { value: 0 }, cut: { value: 0 } };
    b.forEach((o, i) => { if (o.userData.ownMat) { o.material = vehicleMat(U, a[i].material.transparent); o.userData.U = U; } });
    const { _w, _r, _u, ...rest } = ud;
    g.userData = { ...rest, turrets: ud.turrets.map((t) => b[a.indexOf(t)]) };
    return g;
  }
  // libère ce qui est à la copie (son matériau)
  function release(g) { g.traverse((o) => { if (o.userData.ownMat) o.material.dispose(); }); }
  return { build, instance, template, release, define, roll, setCut, couple, models: Object.keys(BUILDERS), GAUGE, HALF_WIDTH: Z };
})();
