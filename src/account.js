// Comptes en ligne : pseudo, niveau (XP), succès, codes cadeaux et couleur du
// pseudo. Les comptes et ce qu'ils ont gagné sont gardés par Supabase (voir online-config.js
// et supabase/schema.sql) : le jeu lui parle directement (API REST), sans bibliothèque.
// Ce qui compte (succès déjà obtenus, codes déjà utilisés, niveau requis pour
// une couleur) est vérifié par la base elle-même. Les objets gagnés attendent dans la « boîte
// à récompenses » du compte (sur ce PC) et se récupèrent dans un monde en survie.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './online-config.js?v=1.1.5-alpha-mvm2b95g';

const SESSION_KEY = 'hexacraft.account';
const PSEUDO_RE = /^[A-Za-z0-9_-]{3,16}$/;
// compte sans e-mail : une adresse interne (jamais utilisée pour envoyer quoi que ce soit)
const PSEUDO_DOMAIN = 'pseudo.hexacraft.invalid';
const pseudoEmail = (p) => p.toLowerCase() + '@' + PSEUDO_DOMAIN;
const RESET_KEY = 'hexacraft.resetreq';

// Niveau selon l'XP : 1 + racine(xp / 40) (40 XP pour le niveau 2, 160 pour le 3, 360 pour le 4…)
export const levelOf = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 40));
export const xpFor = (level) => 40 * (level - 1) ** 2;

// Couleurs du pseudo (au-dessus de la tête en multijoueur) : [nom, couleur, niveau requis]
// (même liste dans supabase/schema.sql, fonction set_color)
export const COLORS = [
  ['Blanc', '#ffffff', 1], ['Jaune', '#ffe45c', 2], ['Vert', '#6fe36f', 3], ['Bleu ciel', '#6cc8ff', 4],
  ['Orange', '#ffa040', 5], ['Rose', '#ff8fd0', 6], ['Violet', '#b98cff', 8], ['Rouge', '#ff5a5a', 10],
  ['Or', '#ffc400', 12],
];

// Succès : id (même liste dans supabase/schema.sql, avec l'XP), catégorie, nom, description, XP.
// have : objets à avoir dans l'inventaire en survie (un seul suffit). Les autres sont débloqués
// par le jeu (voir account.unlock dans main.js). L'XP suit l'effort : une TNT 1000, c'est
// 405 TNT (1 620 sable, 2 025 charbon), elle rapporte donc bien plus qu'une bûche.
// Les succès qui comptent (échanges, zombies, distances, biomes...) gardent leurs compteurs
// sur ce PC, par compte (voir stat / bump / note).
export const ACH_CATS = ['Premiers pas', 'Fabrication', 'Métaux', 'Explosifs', 'Ingénierie', 'Aventure', 'Villages', 'Objets physiques', 'Voyages', 'Exploits', 'Trains'];
export const ACHIEVEMENTS = [
  // Premiers pas
  { id: 'bois', cat: 0, name: 'Bûcheron', desc: 'Récolter une bûche', xp: 10, have: [5, 97, 152] },
  { id: 'table', cat: 0, name: 'Artisan', desc: 'Fabriquer une table de craft', xp: 15, have: [31] },
  { id: 'pousse', cat: 0, name: 'Jardinier', desc: 'Obtenir une pousse d\'arbre', xp: 15, have: [75, 145, 156] },
  { id: 'charbon', cat: 0, name: 'Gueule noire', desc: 'Obtenir du charbon', xp: 15, have: [104] },
  { id: 'torche', cat: 0, name: 'Porteur de lumière', desc: 'Fabriquer des torches', xp: 15, have: [23] },
  { id: 'chasse', cat: 0, name: 'Chasseur', desc: 'Obtenir une côtelette de porc', xp: 20, have: [163] },
  { id: 'manger', cat: 0, name: 'Bon appétit', desc: 'Manger pour reprendre des forces', xp: 15 },
  { id: 'mort', cat: 0, name: 'Ce n\'était qu\'un rêve', desc: 'Perdre connaissance en survie', xp: 10 },
  { id: 'tutoriel', cat: 0, name: 'Diplômé', desc: 'Terminer la formation de la station Hexa-Zéro', xp: 60 },
  // Fabrication
  { id: 'pierre', cat: 1, name: 'Âge de pierre', desc: 'Fabriquer une pioche en pierre', xp: 30, have: [116] },
  { id: 'four', cat: 1, name: 'Fondeur', desc: 'Fabriquer un four', xp: 25, have: [42] },
  { id: 'coffre', cat: 1, name: 'Prévoyant', desc: 'Fabriquer un coffre', xp: 25, have: [54] },
  { id: 'cuisine', cat: 1, name: 'Chef', desc: 'Cuire une côtelette de porc', xp: 30, have: [164] },
  { id: 'verre', cat: 1, name: 'Souffleur de verre', desc: 'Cuire du sable pour faire du verre', xp: 35, have: [40] },
  { id: 'laine', cat: 1, name: 'Tondeur', desc: 'Obtenir de la laine', xp: 30, have: [194, 195] },
  // Métaux
  { id: 'fer', cat: 2, name: 'Âge du fer', desc: 'Obtenir un lingot de fer', xp: 60, have: [122] },
  { id: 'fer_pioche', cat: 2, name: 'Pioche de fer', desc: 'Fabriquer une pioche en fer', xp: 80, have: [125] },
  { id: 'acier', cat: 2, name: 'Métallurgiste', desc: 'Fabriquer de l\'acier', xp: 90, have: [245, 246, 247] },
  { id: 'voltite', cat: 2, name: 'Électricien', desc: 'Miner de la voltite', xp: 100, have: [123] },
  { id: 'platine', cat: 2, name: 'Platine', desc: 'Obtenir un lingot de platine', xp: 200, have: [130] },
  { id: 'tungstene', cat: 2, name: 'Au fond du monde', desc: 'Obtenir un lingot de tungstène', xp: 350, have: [131] },
  { id: 'forgeron', cat: 2, name: 'Maître forgeron', desc: 'Fabriquer une pioche en tungstène', xp: 500, have: [139] },
  { id: 'fluorite', cat: 2, name: 'Éclat bleuté', desc: 'Obtenir un lingot de fluorite', xp: 200, have: [644] },
  { id: 'cramoisite', cat: 2, name: 'Cœur des abysses', desc: 'Obtenir un lingot de cramoisite', xp: 700, have: [645] },
  // Explosifs
  { id: 'tnt', cat: 3, name: 'Artificier', desc: 'Fabriquer une TNT', xp: 30, have: [26] },
  { id: 'grosse_tnt', cat: 3, name: 'Gros calibre', desc: 'Fabriquer une grosse TNT (9 TNT)', xp: 100, have: [27] },
  { id: 'tnt200', cat: 3, name: 'Charge lourde', desc: 'Fabriquer une TNT 200 (81 TNT)', xp: 300, have: [41] },
  { id: 'demolition', cat: 3, name: 'Démolisseur', desc: 'Allumer une TNT 1000 en survie (405 TNT)', xp: 750 },
  // Ingénierie
  { id: 'colle', cat: 4, name: 'Ça colle !', desc: 'Fabriquer de la super colle', xp: 60, have: [101, 209] },
  { id: 'helice', cat: 4, name: 'Mécanicien', desc: 'Fabriquer une hélice', xp: 120, have: [198] },
  { id: 'main_grav', cat: 4, name: 'Force invisible', desc: 'Fabriquer la main gravitationnelle', xp: 250, have: [102] },
  { id: 'passager', cat: 4, name: 'Passager', desc: 'Monter dans un Hexacart', xp: 20 },
  // Aventure
  { id: 'commerce', cat: 5, name: 'Marchand', desc: 'Faire un échange avec un villageois', xp: 50 },
  { id: 'profondeurs', cat: 5, name: 'Spéléologue', desc: 'Descendre sous la couche 12 en survie', xp: 60 },
  { id: 'abysses', cat: 5, name: 'Abysses', desc: 'Descendre sous la couche -60 en survie', xp: 300 },
  { id: 'sommet', cat: 5, name: 'Sur le toit du monde', desc: 'Atteindre la couche 150 en survie', xp: 80 },
  { id: 'explorateur', cat: 5, name: 'Explorateur', desc: 'S\'éloigner de 2000 blocs du centre du monde en survie', xp: 150 },
  { id: 'multi', cat: 5, name: 'Pas tout seul', desc: 'Jouer en multijoueur', xp: 40 },
  { id: 'zombie', cat: 5, name: 'Chasseur de zombies', desc: 'Tuer un zombie', xp: 40 },
  { id: 'dodo', cat: 0, name: 'Bonne nuit', desc: 'Dormir dans un lit de villageois', xp: 20 },
  { id: 'cadeau', cat: 6, name: 'Généreux', desc: 'Offrir un cadeau à un villageois', xp: 30 },
  { id: 'pardon', cat: 6, name: 'Pardonné', desc: 'Se faire pardonner par un villageois qui avait peur de toi', xp: 60 },
  { id: 'mecene', cat: 6, name: 'Mécène', desc: 'Offrir d\'un coup un cadeau qui vaut au moins 5 lingots de fer', xp: 120 },
  { id: 'ami', cat: 6, name: 'Ami du village', desc: 'Être considéré comme un ami par un villageois', xp: 50 },
  { id: 'heros', cat: 6, name: 'Héros du village', desc: 'Être l\'ami de 10 villageois à la fois', xp: 400 },
  { id: 'marchand', cat: 6, name: 'Habitué', desc: 'Faire 50 échanges avec des villageois', xp: 250 },
  { id: 'boulanger', cat: 6, name: 'Pain frais', desc: 'Commercer avec un boulanger', xp: 40 },
  { id: 'naissance', cat: 6, name: 'Bienvenue au monde', desc: 'Assister à une naissance dans un village', xp: 40 },
  { id: 'grand_village', cat: 6, name: 'Métropole', desc: 'Visiter un village de 20 habitants', xp: 150 },
  { id: 'enceinte', cat: 6, name: 'Remparts', desc: 'Visiter un village entièrement entouré de son mur', xp: 120 },
  { id: 'client', cat: 6, name: 'Client', desc: 'Entrer dans une boutique de village', xp: 30 },
  { id: 'grange', cat: 6, name: 'Grenier', desc: 'Entrer dans la grange d\'un village', xp: 30 },
  { id: 'garde', cat: 6, name: 'Sous bonne garde', desc: 'Voir un garde tuer un zombie', xp: 60 },
  { id: 'defenseur', cat: 6, name: 'Défenseur', desc: 'Tuer 10 zombies près d\'un village', xp: 250 },
  { id: 'assemble', cat: 7, name: 'Assembleur', desc: 'Assembler un objet physique (super colle)', xp: 60 },
  { id: 'gros_objet', cat: 7, name: 'Grand œuvre', desc: 'Assembler un objet physique de 100 blocs', xp: 200 },
  { id: 'colosse', cat: 7, name: 'Colosse', desc: 'Assembler un objet physique de 1000 blocs', xp: 800 },
  { id: 'telekinesie', cat: 7, name: 'Télékinésie', desc: 'Attraper un objet avec la main gravitationnelle', xp: 80 },
  { id: 'corde', cat: 7, name: 'Bien amarré', desc: 'Tendre une corde', xp: 40 },
  { id: 'embarque', cat: 7, name: 'Embarquement', desc: 'Se tenir sur un objet physique en mouvement', xp: 40 },
  { id: 'pilote', cat: 7, name: 'Pilote', desc: 'Se tenir sur un objet physique à 30 blocs au-dessus du sol', xp: 150 },
  { id: 'bolide', cat: 7, name: 'Bolide', desc: 'Aller à 25 blocs par seconde sur un objet physique', xp: 200 },
  { id: 'long_courrier', cat: 7, name: 'Long-courrier', desc: 'Parcourir 5000 blocs sur des objets physiques', xp: 600 },
  { id: 'biomes_objet', cat: 7, name: 'Tour du monde volant', desc: 'Traverser les 13 biomes debout sur un objet physique', xp: 1000 },
  { id: 'volcan', cat: 8, name: 'Baptême du feu', desc: 'Marcher sur un volcan en survie', xp: 120 },
  { id: 'globe', cat: 8, name: 'Globe-trotteur', desc: 'Traverser à pied 5 biomes terrestres en survie', xp: 150 },
  { id: 'biomes_pied', cat: 8, name: 'Randonneur', desc: 'Traverser à pied les 9 biomes terrestres en survie', xp: 800 },
  { id: 'marathon', cat: 8, name: 'Marathonien', desc: 'Parcourir 20 000 blocs à pied en survie', xp: 700 },
  { id: 'tour_monde', cat: 8, name: 'Bout du monde', desc: 'S\'éloigner de 10 000 blocs du centre du monde en survie', xp: 900 },
  { id: 'survivant', cat: 9, name: 'Survivant', desc: 'Survivre 7 nuits d\'affilée en survie sans mourir', xp: 700 },
  { id: 'tueur', cat: 9, name: 'Fléau des morts', desc: 'Tuer 100 zombies', xp: 900 },
  { id: 'jours10', cat: 9, name: '10 jours', desc: 'Survivre 10 jours d\'affilée en survie sans mourir', xp: 100 },
  { id: 'jours100', cat: 9, name: '100 jours', desc: 'Survivre 100 jours d\'affilée en survie sans mourir', xp: 1000 },
  { id: 'jours250', cat: 9, name: '250 jours', desc: 'Survivre 250 jours d\'affilée en survie sans mourir', xp: 3000 },
  { id: 'jours500', cat: 9, name: '500 jours', desc: 'Survivre 500 jours d\'affilée en survie sans mourir', xp: 8000 },
  { id: 'jours1000', cat: 9, name: '1 000 jours', desc: 'Survivre 1 000 jours d\'affilée en survie sans mourir', xp: 20000 },
  { id: 'jours2500', cat: 9, name: '2 500 jours', desc: 'Survivre 2 500 jours d\'affilée en survie sans mourir', xp: 60000 },
  { id: 'jours10000', cat: 9, name: '10 000 jours', desc: 'Survivre 10 000 jours d\'affilée en survie sans mourir', xp: 300000 },
  { id: 'collection', cat: 9, name: 'Collectionneur', desc: 'Obtenir 40 succès', xp: 1000 },
  // Trains (voir trains.js, tracks.js)
  { id: 'cheminot', cat: 10, name: "Cheminot", desc: "Fabriquer des rails de train", xp: 20, have: [456] },
  { id: 'machiniste', cat: 10, name: "Machiniste", desc: "Fabriquer une locomotive", xp: 150, have: [457] },
  { id: 'en_voiture', cat: 10, name: "En voiture !", desc: "Conduire une locomotive", xp: 30 },
  { id: 'attelage', cat: 10, name: "Attelage", desc: "Atteler un wagon à une locomotive", xp: 30 },
  { id: 'convoi', cat: 10, name: "Convoi exceptionnel", desc: "Former un train de 11 wagons", xp: 300 },
  { id: 'km1', cat: 10, name: "Premier kilomètre", desc: "Parcourir 1 km en train", xp: 60 },
  { id: 'km10', cat: 10, name: "Grande ligne", desc: "Parcourir 10 km en train", xp: 250 },
  { id: 'km100', cat: 10, name: "Tour du réseau", desc: "Parcourir 100 km en train", xp: 1000 },
  { id: 'chef_gare', cat: 10, name: "Chef de gare", desc: "Poser une gare", xp: 40 },
  { id: 'reseau', cat: 10, name: "Réseau régional", desc: "Avoir 10 gares dans un même monde", xp: 300 },
  { id: 'terminus', cat: 10, name: "Terminus", desc: "Arriver en gare à bord d'un train en pilote automatique", xp: 50 },
  { id: 'pilote_auto', cat: 10, name: "Pilote automatique", desc: "Activer le pilote automatique", xp: 40 },
  { id: 'aiguilleur', cat: 10, name: "Aiguilleur", desc: "Basculer un aiguillage", xp: 30 },
  { id: 'poste_aiguillage', cat: 10, name: "Poste d'aiguillage", desc: "Commander un aiguillage avec du courant", xp: 120 },
  { id: 'grand_virage', cat: 10, name: "Grand virage", desc: "Poser un virage de 48 cases ou plus", xp: 60 },
  { id: 'rampe', cat: 10, name: "Ça monte !", desc: "Monter une pente en train", xp: 40 },
  { id: 'vitesse100', cat: 10, name: "100 km/h", desc: "Rouler à 100 km/h en train", xp: 100 },
  { id: 'vitesse200', cat: 10, name: "Grande vitesse", desc: "Rouler à 200 km/h en train", xp: 400 },
  { id: 'mecano', cat: 10, name: "Mécanicien ferroviaire", desc: "Poser un moteur dans une locomotive", xp: 80 },
  { id: 'fusion', cat: 10, name: "Énergie des étoiles", desc: "Poser le moteur à fusion plasma dans une locomotive", xp: 1500 },
  { id: 'tuning', cat: 10, name: "Locomotive préparée", desc: "Remplir les 8 emplacements de composants d'une locomotive", xp: 400 },
  { id: 'tremie', cat: 10, name: "Mineur sur rails", desc: "Remplir une trémie en roulant", xp: 60 },
  { id: 'poseur', cat: 10, name: "Poseur de voie", desc: "Poser 100 rails avec le wagon poseur", xp: 250 },
  { id: 'voyageur', cat: 10, name: "Transport en commun", desc: "Faire voyager un villageois d'une gare à une autre", xp: 150 },
  { id: 'compagnie', cat: 10, name: "Compagnie ferroviaire", desc: "Faire voyager 10 villageois", xp: 500 },
  { id: 'base_mobile', cat: 10, name: "Base mobile", desc: "Construire 50 blocs sur un wagon plat", xp: 120 },
  { id: 'train_nuit', cat: 10, name: "Train de nuit", desc: "Rouler en train la nuit, phares allumés", xp: 40 },
  { id: 'horaires', cat: 10, name: "Horaires", desc: "Programmer un itinéraire de 3 gares", xp: 120 },
  { id: 'detecteur', cat: 10, name: "Détecteur de passage", desc: "Allumer un circuit au passage d'un train", xp: 80 },
  { id: 'uniforme', cat: 10, name: "Uniforme", desc: "Porter la casquette de conducteur", xp: 30 },
  { id: 'plein', cat: 10, name: "Le plein", desc: "Remplir le réservoir d'une locomotive", xp: 60 },
  { id: 'accident', cat: 10, name: "Accident ferroviaire", desc: "Voir deux trains se percuter", xp: 50 },
  { id: 'marche_arriere', cat: 10, name: "Marche arrière", desc: "Conduire un train depuis le wagon de queue", xp: 60 },
  { id: 'deux_niveaux', cat: 10, name: "Deux niveaux", desc: "Monter à l'étage d'un wagon plat à étage", xp: 50 },
];

export class Account {
  constructor() {
    this.enabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
    this.base = SUPABASE_URL.replace(/\/+$/, '');
    this.session = null;   // { access, refresh, expires (ms), uid, email }
    this.profile = null;   // { pseudo, xp, color }
    this.unlocked = new Set();
    this.skins = new Set();   // skins réservées obtenues (fichiers, voir skins.js)
    this.pending = new Set(); // succès en cours d'envoi
    this.rewarded = new Map(); // objet reçu en récompense -> nombre qui ne compte pas pour les succès
    this.hold = false;         // récompenses en train d'arriver dans l'inventaire
    this.onChange = () => {};
    this.onUnlock = () => {};
    try { this.session = JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { this.session = null; }
  }

  get loggedIn() { return !!(this.enabled && this.session && this.profile); }
  get level() { return this.profile ? levelOf(this.profile.xp) : 1; }
  get color() { const c = COLORS[this.profile?.color | 0]; return this.loggedIn && c ? this.profile.color | 0 : 0; }

  saveSession() {
    try {
      if (this.session) localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* stockage indisponible : il faudra se reconnecter */ }
  }

  // ---------- Requêtes ----------
  async request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (auth) {
      await this.freshToken();
      if (!this.session) throw new Error('Tu n\'es plus connecté');
      headers.Authorization = 'Bearer ' + this.session.access;
    }
    let res;
    try {
      res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new Error('Pas de connexion au serveur des comptes');
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(errorText(data, res.status));
    return data;
  }
  rpc(name, args = {}) { return this.request('/rest/v1/rpc/' + name, { method: 'POST', body: args }); }

  // Jeton d'accès renouvelé un peu avant d'expirer
  async freshToken() {
    const s = this.session;
    if (!s || Date.now() < s.expires - 60000) return;
    try {
      const d = await this.request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh }, auth: false });
      this.setSession(d);
    } catch (e) {
      // jeton refusé : il faut se reconnecter (pas de réseau : on réessaiera)
      if (!/connexion au serveur/.test(e.message)) this.forget();
      throw e;
    }
  }
  setSession(d) {
    this.session = { access: d.access_token, refresh: d.refresh_token, expires: Date.now() + (d.expires_in || 3600) * 1000, uid: d.user?.id || this.session?.uid, email: d.user?.email || this.session?.email };
    this.saveSession();
  }
  forget() {
    this.session = null;
    this.profile = null;
    this.unlocked.clear();
    this.skins.clear();
    this.saveSession();
    this.onChange();
  }

  // ---------- Compte ----------
  // Au lancement : on reprend la session gardée (sans bloquer le jeu)
  async resume() {
    if (!this.enabled || !this.session) return;
    try { await this.load(); } catch { /* hors ligne : on réessaiera à l'ouverture de l'écran Compte */ }
  }

  async load() {
    // (is_admin : base mise à jour avec comptes_pseudo_classement.sql ; sinon, sans)
    let p;
    try { [p] = await this.request('/rest/v1/profiles?select=pseudo,xp,color,is_admin'); } catch { [p] = await this.request('/rest/v1/profiles?select=pseudo,xp,color'); }
    if (!p) throw new Error('Profil introuvable');
    this.profile = p;
    const list = await this.request('/rest/v1/achievements?select=ach');
    this.unlocked = new Set(list.map((a) => a.ach));
    try {
      const owned = await this.request('/rest/v1/owned_skins?select=skin');
      this.skins = new Set((Array.isArray(owned) ? owned : []).map((s) => s.skin));
    } catch { this.skins = new Set(); } // (base pas encore à jour : aucune skin réservée)
    try { await this.clanTag(); } catch { this.clan = null; } // (son tag de clan, montré en multijoueur)
    this.onChange();
  }

  // Compte avec un e-mail (pour retrouver son mot de passe par e-mail), ou avec un pseudo seul
  // (email vide : mot de passe oublié = une demande à un administrateur)
  async signUp(email, password, pseudo) {
    if (!PSEUDO_RE.test(pseudo)) throw new Error('Pseudo : 3 à 16 lettres, chiffres, _ ou - (sans accents ni espaces)');
    if (password.length < 6) throw new Error('Mot de passe : 6 caractères au moins');
    const free = await this.request('/rest/v1/rpc/pseudo_free', { method: 'POST', body: { p: pseudo }, auth: false });
    if (!free) throw new Error(`Le pseudo « ${pseudo} » est déjà pris`);
    if (!email) {
      await this.request('/rest/v1/rpc/signup_pseudo', { method: 'POST', body: { p: pseudo, pw: password }, auth: false });
      await this.logIn(pseudoEmail(pseudo), password);
      return 'ok';
    }
    if (!email.includes('@')) throw new Error('Adresse e-mail invalide (ou laisse la case vide pour un compte avec ton pseudo seul)');
    const d = await this.request('/auth/v1/signup', { method: 'POST', body: { email, password, data: { pseudo } }, auth: false });
    if (!d?.access_token) return 'confirm'; // confirmation par e-mail demandée par le projet
    this.setSession(d);
    await this.load();
    return 'ok';
  }

  // Sorte de compte d'un pseudo : 'pseudo' (sans e-mail), 'email', ou null (inconnu)
  async kindOf(pseudo) {
    return this.request('/rest/v1/rpc/pseudo_kind', { method: 'POST', body: { p: pseudo }, auth: false });
  }
  // Connexion avec l'adresse e-mail, ou avec le pseudo (compte sans e-mail)
  async logIn(id, password) {
    let email = id;
    if (!id.includes('@')) {
      const kind = await this.kindOf(id);
      if (!kind) throw new Error(`Aucun compte « ${id} »`);
      if (kind === 'email') throw new Error('Ce compte se connecte avec son adresse e-mail');
      email = pseudoEmail(id);
    }
    let d;
    try { d = await this.request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false }); } catch (e) {
      if (/incorrect/i.test(e.message) && !id.includes('@')) throw new Error('Mot de passe incorrect');
      throw e;
    }
    this.setSession(d);
    await this.load();
  }

  // Mot de passe oublié : un code est envoyé par e-mail (modèle « Reset Password » du projet
  // Supabase avec {{ .Token }}, voir supabase/LISEZMOI.md) ; on le tape dans le jeu avec le
  // nouveau mot de passe (pas de lien vers une page web).
  async recover(email) {
    await this.request('/auth/v1/recover', { method: 'POST', body: { email }, auth: false });
  }

  // code : le code à chiffres de l'e-mail, ou (si le modèle d'e-mail du projet n'a pas été
  // changé et qu'il contient un lien) le lien copié-collé : on en tire le jeton, sans l'ouvrir
  // Trois possibilités (le modèle d'e-mail de Supabase ne se change pas sans serveur d'e-mail à
  // soi : l'e-mail contient alors un lien) :
  //  - le code à chiffres de l'e-mail ;
  //  - le lien de l'e-mail, copié sans cliquer dessus : on en tire le jeton ;
  //  - l'adresse de la page (inaccessible) ouverte en cliquant le lien : localhost:3000/#access_token=…
  //    elle contient déjà la session de récupération.
  async resetPassword(email, code, password) {
    if (password.length < 6) throw new Error('Mot de passe : 6 caractères au moins');
    const link = /^(https?:\/\/|localhost)/i.test(code) ? (() => { try { return new URL(/^https?:/i.test(code) ? code : 'http://' + code); } catch { return null; } })() : null;
    const frag = new URLSearchParams(link?.hash.slice(1) || '');
    if (frag.get('error_code') || frag.get('error')) throw new Error('Ce lien a déjà servi ou a expiré : redemande un e-mail, puis copie le lien sans cliquer dessus');
    let d;
    if (frag.get('access_token')) {
      d = { access_token: frag.get('access_token'), refresh_token: frag.get('refresh_token'), expires_in: +frag.get('expires_in') || 3600 };
    } else {
      let body;
      const hash = link?.searchParams.get('token') || link?.searchParams.get('token_hash');
      if (hash) body = { type: 'recovery', token_hash: hash };
      else if (/^\d{6,10}$/.test(code)) body = { type: 'recovery', email, token: code };
      else throw new Error('Colle le lien de l\'e-mail (clic droit > Copier l\'adresse du lien) ou le code à chiffres');
      d = await this.request('/auth/v1/verify', { method: 'POST', body, auth: false });
      if (!d?.access_token) throw new Error('Code refusé');
    }
    this.setSession(d);
    const u = await this.request('/auth/v1/user', { method: 'PUT', body: { password } });
    if (u?.id) { this.session.uid = u.id; this.session.email = u.email || this.session.email; this.saveSession(); }
    await this.load();
  }

  // ---------- Mot de passe oublié, compte sans e-mail : une demande aux administrateurs ----------
  // Le jeton de la demande reste sur ce PC : le jeu demande ensuite où elle en est, et montre
  // le mot de passe provisoire quand un administrateur l'a acceptée
  get resetRequest() { try { return JSON.parse(localStorage.getItem(RESET_KEY)) || null; } catch { return null; } }
  set resetRequest(v) { try { if (v) localStorage.setItem(RESET_KEY, JSON.stringify(v)); else localStorage.removeItem(RESET_KEY); } catch { /* tant pis */ } }
  async requestReset(pseudo, note = '') {
    const token = await this.request('/rest/v1/rpc/request_reset', { method: 'POST', body: { p: pseudo, n: note }, auth: false });
    this.resetRequest = { pseudo, token };
    return token;
  }
  // { status : open, done, refused, unknown ; password : le mot de passe provisoire (une seule fois) }
  async resetStatus() {
    const r = this.resetRequest;
    if (!r) return null;
    const d = await this.request('/rest/v1/rpc/reset_status', { method: 'POST', body: { t: r.token }, auth: false });
    if (d?.status !== 'open') this.resetRequest = null;
    return d;
  }
  // Changer son mot de passe (connecté)
  async changePassword(password) {
    if (password.length < 6) throw new Error('Mot de passe : 6 caractères au moins');
    await this.request('/auth/v1/user', { method: 'PUT', body: { password } });
  }
  get isAdmin() { return !!this.profile?.is_admin; }
  adminRequests() { return this.rpc('admin_requests'); }
  adminReset(id, accept) { return this.rpc('admin_reset', { rid: id, accept }); }

  // ---------- Classement mondial des succès ----------
  leaderboard(n = 100) { return this.request('/rest/v1/rpc/leaderboard', { method: 'POST', body: { n }, auth: !!this.session }); }
  myRank() { return this.rpc('my_rank'); }

  // ---------- Présence (en ligne, monde ouvert en multijoueur : les amis le rejoignent sans code) ----------
  ping(code = null, world = null, locked = false) { return this.rpc('ping', { code: code || null, w: world || null, pass: !!locked }); }

  // ---------- Amis ----------
  friends() { return this.rpc('friends_list'); }
  friendRequests() { return this.rpc('friend_requests_list'); }
  friendAdd(p) { return this.rpc('friend_add', { p }); }
  friendAnswer(p, ok) { return this.rpc('friend_answer', { p, ok }); }
  friendRemove(p) { return this.rpc('friend_remove', { p }); }
  friendFavorite(p, fav) { return this.rpc('friend_favorite', { p, fav }); }

  // ---------- Clans ----------
  myClan() { return this.rpc('my_clan'); }
  clanCreate(name, tag, color, banner) { return this.rpc('clan_create', { n: name, t: tag, c: color, b: banner }); }
  clanUpdate(color, banner) { return this.rpc('clan_update', { c: color, b: banner }); }
  clanInvite(p) { return this.rpc('clan_invite', { p }); }
  clanJoin(id) { return this.rpc('clan_join', { cid: id }); }
  clanDecline(id) { return this.rpc('clan_decline', { cid: id }); }
  clanLeave() { return this.rpc('clan_leave'); }
  clanKick(p) { return this.rpc('clan_kick', { p }); }
  clanInvites() { return this.rpc('clan_invites_list'); }
  clanBoard(n = 100) { return this.request('/rest/v1/rpc/clan_board', { method: 'POST', body: { n }, auth: !!this.session }); }
  async clanTag() {
    const r = await this.rpc('my_clan_tag');
    this.clan = r && r.tag ? r : null;
    return this.clan;
  }

  // ---------- Classements par catégorie ----------
  statBoard(cat, n = 100) { return this.request('/rest/v1/rpc/stat_board', { method: 'POST', body: { cat, n }, auth: !!this.session }); }
  myStatRank(cat) { return this.rpc('my_stat_rank', { cat }); }

  // Statistiques des classements : ce qui a changé depuis le dernier envoi (gardé sur ce PC, par
  // compte), envoyé toutes les minutes (voir flushStats)
  get pstatKey() { return 'hexacraft.pstats.' + (this.session?.uid || ''); }
  get pstats() {
    if (!this._pstats || this._pstatUid !== this.session?.uid) {
      this._pstatUid = this.session?.uid;
      try { const o = JSON.parse(localStorage.getItem(this.pstatKey)); this._pstats = o && typeof o === 'object' ? o : {}; } catch { this._pstats = {}; }
    }
    return this._pstats;
  }
  savePstats() { try { localStorage.setItem(this.pstatKey, JSON.stringify(this.pstats)); } catch { /* tant pis */ } }
  // ajoute n au compteur k (play_time, placed, broken, train_m, walk_m)
  track(k, n = 1) {
    if (!this.loggedIn || !(n > 0)) return;
    const p = this.pstats;
    p[k] = (Number(p[k]) || 0) + n;
    this.savePstats();
  }
  // survie en cours (secondes depuis la dernière mort) ; plus longue voie ferrée (blocs)
  setSurvival(sec) { if (this.loggedIn) { this.pstats.survival_now = Math.max(0, Math.floor(sec)); this.savePstats(); } }
  railRecord(len) {
    if (!this.loggedIn) return;
    const p = this.pstats, best = Number(this.stats.railBest) || 0;
    if (len > best) { this.stats.railBest = Math.floor(len); this.saveStats(); p.rail_best = Math.floor(len); this.savePstats(); }
  }
  async flushStats() {
    if (!this.loggedIn || this.flushing) return;
    const p = this.pstats, d = {};
    for (const k of ['play_time', 'placed', 'broken', 'train_m', 'walk_m']) if (p[k] >= 1) d[k] = Math.floor(p[k]);
    if (p.survival_now !== undefined) d.survival_now = p.survival_now;
    if (p.rail_best) d.rail_best = p.rail_best;
    if (!Object.keys(d).length) return;
    this.flushing = true;
    try {
      await this.rpc('add_stats', { d });
      // (envoyé : on retire ce qui est parti, ce qui est arrivé entre-temps reste)
      for (const k of ['play_time', 'placed', 'broken', 'train_m', 'walk_m']) if (d[k]) p[k] = Math.max(0, (Number(p[k]) || 0) - d[k]);
      if (d.rail_best === p.rail_best) delete p.rail_best;
      this.savePstats();
    } catch { /* hors ligne, ou base pas encore à jour : on réessaiera */ }
    this.flushing = false;
  }

  async logOut() {
    try { await this.request('/auth/v1/logout', { method: 'POST' }); } catch { /* déjà déconnecté */ }
    this.forget();
  }

  // ---------- Récompenses ----------
  // Code cadeau : { items, xp, skins } (skins : fichiers des skins réservées débloquées, gardées
  // par la base pour ce compte seulement)
  async redeem(code) {
    const r = await this.rpc('redeem', { c: code.trim().toUpperCase() });
    const items = (Array.isArray(r?.items) ? r.items : []).filter((it) => Array.isArray(it) && Number.isInteger(it[0]) && Number.isInteger(it[1]) && it[1] > 0);
    const skins = (Array.isArray(r?.skins) ? r.skins : []).filter((s) => typeof s === 'string');
    this.addRewards(items);
    await this.load();
    return { items, xp: r?.xp | 0, skins };
  }

  async setColor(i) {
    await this.rpc('set_color', { c: i });
    this.profile.color = i;
    this.onChange();
  }

  // Succès obtenu (une seule fois par compte ; rien si on n'est pas connecté)
  // (blocked : main.js le règle ; vrai dans un monde passé en créatif, plus de succès)
  async unlock(id) {
    if (!this.loggedIn || this.unlocked.has(id) || this.pending.has(id) || this.blocked?.()) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.pending.add(id);
    try {
      const r = await this.rpc('unlock', { a: id });
      this.unlocked.add(id);
      if (r?.new) {
        this.profile.xp = r.xp;
        this.onUnlock(a);
        this.onChange();
      }
    } catch { /* hors ligne : on réessaiera la prochaine fois */ }
    this.pending.delete(id);
  }

  // Vérifie les succès « avoir tel objet » dans l'inventaire (cases de l'inventaire). Les objets
  // reçus en récompense ne comptent pas : seulement ce qu'on a en plus (voir rewarded)
  checkItems(slots) {
    if (!this.loggedIn || this.hold) return;
    const total = new Map();
    for (const s of slots) if (s) total.set(s.id, (total.get(s.id) || 0) + s.n);
    for (const [id, base] of this.rewarded) {
      const n = total.get(id) || 0;
      if (n < base) this.rewarded.set(id, n); // (utilisés : les prochains compteront)
      if (n <= base) total.delete(id);
    }
    for (const a of ACHIEVEMENTS) if (a.have && !this.unlocked.has(a.id) && a.have.some((i) => total.has(i))) this.unlock(a.id);
  }
  // Récompenses mises dans l'inventaire : cases de l'inventaire juste après
  rewardedIn(slots, ids) {
    for (const id of ids) this.rewarded.set(id, slots.reduce((n, s) => n + (s?.id === id ? s.n : 0), 0));
  }

  // ---------- Boîte à récompenses (sur ce PC, par compte) ----------
  // Compteurs des succès (sur ce PC, par compte) : nombres et ensembles (biomes visités...)
  get statKey() { return 'hexacraft.stats.' + (this.session?.uid || ''); }
  get stats() {
    if (!this._stats || this._statUid !== this.session?.uid) {
      this._statUid = this.session?.uid;
      try { const o = JSON.parse(localStorage.getItem(this.statKey)); this._stats = o && typeof o === 'object' ? o : {}; } catch { this._stats = {}; }
    }
    return this._stats;
  }
  saveStats() { try { localStorage.setItem(this.statKey, JSON.stringify(this.stats)); } catch { /* tant pis */ } }
  stat(k) { return Number(this.stats[k]) || 0; }
  // Ajoute n au compteur k (connecté seulement) ; renvoie la nouvelle valeur
  bump(k, n = 1) {
    if (!this.loggedIn) return 0;
    this.stats[k] = this.stat(k) + n;
    this.saveStats();
    return this.stats[k];
  }
  reset(k) { if (this.loggedIn && this.stats[k]) { this.stats[k] = 0; this.saveStats(); } }
  // Note la valeur v dans l'ensemble k ; renvoie sa taille
  note(k, v) {
    if (!this.loggedIn) return 0;
    const l = Array.isArray(this.stats[k]) ? this.stats[k] : (this.stats[k] = []);
    if (!l.includes(v)) { l.push(v); this.saveStats(); }
    return l.length;
  }
  noted(k) { return Array.isArray(this.stats[k]) ? this.stats[k] : []; }

  get rewardKey() { return 'hexacraft.rewards.' + (this.session?.uid || ''); }
  get rewards() {
    try { const l = JSON.parse(localStorage.getItem(this.rewardKey)); return Array.isArray(l) ? l : []; } catch { return []; }
  }
  set rewards(l) {
    try { localStorage.setItem(this.rewardKey, JSON.stringify(l)); } catch { /* tant pis */ }
  }
  addRewards(items) {
    const l = this.rewards;
    for (const [id, n] of items) {
      const s = l.find((x) => x[0] === id);
      if (s) s[1] += n; else l.push([id, n]);
    }
    this.rewards = l;
  }
}

// Message d'erreur lisible (Supabase répond en anglais)
function errorText(d, status) {
  const raw = String(d?.msg || d?.message || d?.error_description || d?.error || d?.hint || '');
  // (messages déjà en français, venus des fonctions de la base)
  if (/^(Pseudo inconnu|Ce compte a une adresse|Réservé aux|Demande introuvable|Ce pseudo est déjà pris|Pseudo :|Mot de passe :|Joueur introuvable|C'est toi|Vous êtes déjà amis|Trop d|Tu fais déjà partie|Nom du clan|Tag :|Ce nom de clan|Ce tag|Seul le chef|Ce joueur fait déjà|Clan complet|Invitation introuvable|Pour partir|Bannière invalide)/.test(raw)) return raw;
  const known = [
    [/invalid login credentials/i, 'Pseudo, e-mail ou mot de passe incorrect'],
    [/could not find the function/i, "Cette fonction n'est pas encore installée sur le serveur des comptes : lance les fichiers SQL du dossier supabase (voir LISEZMOI.md)"],
    [/email not confirmed/i, 'Confirme d\'abord ton adresse e-mail (lien reçu par e-mail)'],
    [/already registered|already been registered|user already exists/i, 'Un compte existe déjà avec cette adresse e-mail'],
    [/password should be at least/i, 'Mot de passe trop court'],
    [/unable to validate email|invalid email|email address .* is invalid/i, 'Adresse e-mail invalide'],
    [/rate limit|too many/i, 'Trop d\'essais : réessaie dans quelques minutes'],
    [/pseudo|database error saving new user/i, 'Ce pseudo est invalide ou déjà pris'],
    [/code_invalide/i, 'Code cadeau inconnu'],
    [/code_expire/i, 'Ce code cadeau a expiré'],
    [/code_epuise/i, 'Ce code cadeau a déjà été utilisé par trop de joueurs'],
    [/code_deja/i, 'Tu as déjà utilisé ce code'],
    [/niveau/i, 'Niveau trop bas pour cette couleur'],
    [/token has expired or is invalid|otp|link is invalid/i, 'Code ou lien faux ou expiré : redemande un e-mail (Mot de passe oublié)'],
    [/should be different from the old password/i, 'Choisis un mot de passe différent de l\'ancien'],
    [/jwt|token/i, 'Session expirée : reconnecte-toi'],
  ];
  for (const [re, text] of known) if (re.test(raw)) return text;
  return raw ? `Erreur du serveur : ${raw}` : `Erreur du serveur (${status})`;
}
