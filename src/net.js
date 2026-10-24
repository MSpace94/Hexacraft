// Multijoueur en ligne. L'hôte joue son monde et sert de serveur : il simule l'eau et les
// Hexacarts, vérifie et retransmet les modifications de blocs, le chat, les positions.
// Les clients reçoivent le monde à leur arrivée, puis seulement les changements.
//
// Transport : WebSocket géré par le processus principal (app/net.cjs), ou connexion directe
// par code d'invitation (WebRTC, voir rtc.js). Messages JSON dans les deux cas.
//   client -> hôte : hello, pos, blocks, chat, cart, ahit (animal frappé), aegg (œuf d'apparition), phit (joueur frappé),
//                    bopen / bset / bclose (coffres et fours), smerge (double colle), rope / ropedel (cordes), vc (voix), vtrade (échange avec un villageois), vgift (cadeau à un villageois), pong
//   hôte -> client : welcome, reject, blocks, ps (joueurs), carts, ans (animaux), adrop, hurt,
//                    pfx (joueur touché), box, bdrop, vc (voix), vsay (un villageois parle), vrep (avis des
//                    villageois proches sur ce joueur), time, chat, sys,
//                    join, leave, list, ping, bye
import * as THREE from 'three';
import { buildCharacter, crouchPose, setHat } from './character.js?v=1.1.5-alpha-mvm2b95g';
import { BLOCKS, AIR, isRail, ITEMS, ROPE as ROPE_ITEM } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { DROP_IDS, SPECIES } from './animals.js?v=1.1.5-alpha-mvm2b95g';
import { hexToWorld, circleHexOverlap } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { RADIUS, HEIGHT } from './player.js?v=1.1.5-alpha-mvm2b95g';
import { createInvite, answerInvite, hostShortCode, joinShortCode } from './rtc.js?v=1.1.5-alpha-mvm2b95g';
import { H, Y_MIN } from './mesher.js?v=1.1.5-alpha-mvm2b95g';
import { COLORS } from './account.js?v=1.1.5-alpha-mvm2b95g';
import { RANGE as VOICE_RANGE } from './voice.js?v=1.1.5-alpha-mvm2b95g';
import { skinUrl } from './skins.js?v=1.1.5-alpha-mvm2b95g';
import { PHRASE_KEYS } from './villagetalk.js?v=1.1.5-alpha-mvm2b95g';
import { cleanEnd, ROPE_MAX } from './ropes.js?v=1.1.5-alpha-mvm2b95g';

// Nom de fichier de skin reçu (vérifié ensuite contre notre liste, voir skins.js)
const skinName = (s) => (typeof s === 'string' && s.length <= 48 ? s : '');

// Couleur du pseudo (compte en ligne, voir account.js) : numéro reçu, vérifié
const colorIndex = (c) => (Number.isInteger(c) && c >= 0 && c < COLORS.length ? c : 0);

export const GAME_VERSION = '1.1.4-alpha';
export const PROTOCOL = 1;
export const DEFAULT_PORT = 25580;
export const MAX_PLAYERS = 10;
export const NAME_RE = /^[\p{L}\p{N}_-]{2,16}$/u;

// Commandes du chat (pour /help) : [syntaxe, explication, où : 'all' | 'mp' (en ligne) | 'host']
export const COMMANDS = [
  ['/help', 'cette liste des commandes'],
  ['/gamemode survie | creatif', 'change de mode de jeu (/gm aussi ; en ligne : l\'hôte seulement, pour lui seul)'],
  ['/tp x y z | x z | spawn', 'téléportation (~ = position actuelle, ~ ~5 ~ : 5 blocs plus haut)'],
  ['/tp pseudo', 'à côté d\'un autre joueur', 'mp'],
  ['/time jour | nuit [éternel]', 'met le jour (midi) ou la nuit (minuit) ; avec « éternel », l\'heure ne bouge plus. /time normal : le temps repart (hôte seulement en ligne)'],
  ['/intro', 'revoir la cinématique d\'arrivée (le vaisseau qui s\'écrase sur la planète ; elle se coupe dans les options)'],
  ['/intromulti', 'revoir la cinématique des joueurs qui rejoignent une partie : leur capsule s\'écrase dans l\'eau près du point d\'apparition (les autres joueurs la voient tomber)'],
  ['/capsule', 'développement : seulement l\'écrasement de la capsule (sans la cinématique spatiale), pour le revoir. Elle reste dans le monde, en blocs'],
  ['/vaisseau', 'fait apparaître devant toi le HEXA-7 (le vaisseau de la cinématique), intact, en objet physique'],
  ['/afk', 'le monde continue de tourner quand tu quittes le jeu (menu, autre fenêtre, fenêtre réduite) ; /afk à nouveau pour l\'arrêter (en solo)'],
  ['/place <structure> [x y z]', 'pose une structure (~ = position actuelle) : village (habité), maison, mairie, puits, mine, potager, ou une structure enregistrée avec le bloc de structure (hôte seulement en ligne)'],
  ['/weather <niveau>', 'centre de pression ici, de -5 à 5 : dépression (> 0 : nuages, pluie, orages, tornades) ou anticyclone (< 0 : beau temps). Il se forme peu à peu et dérive avec le vent'],
  ['/weather tornade', 'tempête en quelques secondes, et une tornade qui arrive'],
  ['/weather', 'le temps qu\'il fait ici'],
  ['/weather reset', 'retire les centres de pression'],
  ['/voie x1 z1 x2 z2 [double] [y]', 'trace une voie de train entre deux points (~ = position actuelle) : ligne droite, et un grand virage si l\'arrivée est décalée ; « double » : deux voies côte à côte. Le passage est dégagé (hôte seulement en ligne)'],
  ['/list', 'joueurs connectés', 'mp'],
  ['/pvp on | off', 'les joueurs peuvent se frapper (en survie) ou non', 'host'],
  ['/kick <pseudo> [raison]', 'expulse un joueur', 'host'],
];
// Lignes de /help : en ligne ou non, hôte ou non
export function helpLines(online, host) {
  return ['Commandes :', ...COMMANDS.filter(([, , w = 'all']) => w === 'all' || (online && (w === 'mp' || (w === 'host' && host))))
    .map(([c, d]) => `  ${c} : ${d}`)];
}

const native = window.hexaNative?.net;
const SEND_RATE = 1 / 20;      // positions et chariots : 20 fois par seconde
const HELLO_TIMEOUT = 10000;
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const int = (v) => Number.isInteger(v);
// Plan d'une capsule qui s'écrase (voir planPod dans crash.js), vérifié ; null s'il est mauvais
function podPlan(m) {
  const p = {};
  for (const k of ['sx', 'sy', 'sz', 'tx', 'ty', 'tz', 'dx', 'dz', 'L', 'F']) { if (!num(m[k]) || Math.abs(m[k]) > 1e7) return null; p[k] = m[k]; }
  if (!int(m.rot) || m.rot < 0 || m.rot > 5 || p.F < 1 || p.F > 10 || p.L < 0 || p.L > 40 || p.ty < 1 || p.ty > H - 4) return null;
  p.rot = m.rot;
  p.wet = m.wet ? 1 : 0;
  return p;
}

// ---------- Joueur distant (affichage) ----------
// Icône de haut-parleur (joueur qui parle au chat vocal), partagée par tous les joueurs
let speakerTex = null;
function speakerIcon() {
  if (!speakerTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(12, 25); g.lineTo(22, 25); g.lineTo(33, 14); g.lineTo(33, 50); g.lineTo(22, 39); g.lineTo(12, 39); g.closePath(); g.fill();
    g.strokeStyle = '#7CFC7C'; g.lineWidth = 4; g.lineCap = 'round';
    for (const r of [9, 17]) { g.beginPath(); g.arc(34, 32, r, -0.8, 0.8); g.stroke(); }
    speakerTex = new THREE.CanvasTexture(c);
    speakerTex.colorSpace = THREE.SRGBColorSpace;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: speakerTex, depthWrite: false, fog: false }));
  sp.scale.set(0.28, 0.28, 1);
  sp.renderOrder = 10;
  return sp;
}

// Tag de clan reçu (« TAG:couleur »), vérifié ; ou null
const clanOf = (v) => { const m = /^([A-Z0-9]{2,4}):(\d{1,2})$/.exec(String(v || '')); return m && +m[2] < 12 ? { tag: m[1], color: +m[2] } : null; };
const CLAN_HEX = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#d35490', '#ecf0f1', '#7f8c8d', '#2c3e50', '#17181c'];
class RemotePlayer {
  constructor(scene, pid, name, col = 0, skin = '', clan = '') {
    this.clan = clanOf(clan);
    this.pid = pid;
    this.name = name;
    this.scene = scene;
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.tYaw = 0; this.tPitch = 0;
    this.cart = null;
    this.held = 0;
    this.walkPhase = 0;
    this.speed = 0;
    this.placed = false;
    this.sneak = false;
    this.crouch = 0;
    this.hurtT = 0; // touché (PvP) : rouge un instant
    this.model = new THREE.Group();
    this.model.visible = false;
    this.tag = this.nameTag(name, colorIndex(col), this.clan);
    this.model.add(this.tag);
    this.voiceIcon = speakerIcon();
    this.voiceIcon.visible = false;
    this.model.add(this.voiceIcon);
    scene.add(this.model);
    this.skin = skin;
    this.build();
  }

  // Corps du joueur (refait quand on change le style des personnages : hexagones ou pavés)
  build() {
    const token = (this.buildToken = (this.buildToken || 0) + 1);
    buildCharacter(skinUrl(skinName(this.skin))).then((c) => {
      if (this.removed || token !== this.buildToken) return;
      if (this.body) this.model.remove(this.body);
      c.traverse((o) => { if (o.isMesh) o.userData.body = true; }); // (son corps, pas l'objet tenu)
      this.model.add(c);
      this.body = c;
      this.parts = c.userData.parts;
      setHat(this.parts, this.hat || 0);
    });
  }
  // Chapeau porté (id de l'objet, ou 0)
  wear(id) {
    id = Number.isInteger(id) ? id : 0;
    if (id === (this.hat || 0)) return;
    this.hat = id;
    setHat(this.parts, id);
  }

  nameTag(name, col = 0, clan = null) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = 'bold 40px system-ui, sans-serif';
    const pre = clan ? '[' + clan.tag + '] ' : '', pw = pre ? ctx.measureText(pre).width : 0;
    const w = Math.ceil(pw + ctx.measureText(name).width) + 24;
    c.width = w; c.height = 56;
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, 56);
    ctx.textBaseline = 'middle';
    if (pre) { ctx.fillStyle = CLAN_HEX[clan.color]; ctx.fillText(pre, 12, 30); }
    ctx.fillStyle = COLORS[col][1];
    ctx.fillText(name, 12 + pw, 30);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false }));
    sprite.scale.set(0.3 * w / 56, 0.3, 1);
    sprite.position.y = HEIGHT + 0.35;
    sprite.renderOrder = 10;
    return sprite;
  }

  set(x, y, z, yaw, pitch) {
    this.target.set(x, y, z);
    this.tYaw = yaw;
    this.tPitch = pitch;
    if (!this.placed) { this.pos.copy(this.target); this.yaw = yaw; this.pitch = pitch; this.placed = true; }
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 12);
    const ox = this.pos.x, oz = this.pos.z;
    if (this.cart?.isTrain) this.cart.owner.seatOf(this.cart, this.pos, this.seat | 0);
    else if (this.cart) this.pos.set(this.cart.pos.x, this.cart.pos.y - 0.4, this.cart.pos.z);
    else {
      this.pos.lerp(this.target, k);
      if (this.pos.distanceToSquared(this.target) > 64) this.pos.copy(this.target);
    }
    let dy = this.tYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * k;
    this.pitch += (this.tPitch - this.pitch) * k;
    const hs = dt > 0 ? Math.hypot(this.pos.x - ox, this.pos.z - oz) / dt : 0;
    this.speed += (hs - this.speed) * Math.min(1, dt * 10);

    const m = this.model;
    m.visible = this.placed;
    m.position.copy(this.pos);
    m.rotation.y = this.yaw;
    this.crouch += ((this.sneak && !this.cart ? 1 : 0) - this.crouch) * Math.min(1, dt * 14);
    this.tag.position.y = HEIGHT + 0.35 - 0.3 * this.crouch;
    // il parle (chat vocal) : haut-parleur au-dessus du pseudo
    this.voiceIcon.visible = !!RemotePlayer.voice?.speaking(this.pid);
    if (this.voiceIcon.visible) this.voiceIcon.position.y = this.tag.position.y + 0.32;
    // touché : rouge un instant
    if (this.hurtT > 0) this.hurtT -= dt;
    const red = this.hurtT > 0;
    if (red !== this.red) {
      this.red = red;
      m.traverse((o) => { if (o.isMesh && o.userData.body) o.material.color.setRGB(1, red ? 0.45 : 1, red ? 0.45 : 1); });
    }
    const p = this.parts;
    if (!p) return;
    p.head.rotation.x = this.pitch * 0.8;
    crouchPose(p, this.crouch);
    if (this.cart) {
      p.legL.rotation.x = p.legR.rotation.x = 1.45;
      p.armL.rotation.x = p.armR.rotation.x = 0.5;
      return;
    }
    this.walkPhase += this.speed * dt * 2.2;
    const amp = Math.min(1, this.speed / 4.3) * 0.7;
    const sw = Math.sin(this.walkPhase) * amp;
    p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
    p.armL.rotation.x = -sw; p.armR.rotation.x = sw;
    // objet tenu (bras un peu levé)
    RemotePlayer.items?.attach(p.armR, this.held || 0);
    if (this.held) p.armR.rotation.x = sw * 0.4 - 0.35;
  }

  dispose() {
    this.removed = true;
    this.scene.remove(this.model);
  }
}

// Joueur distant vu par la simulation de l'hôte (pousse les chariots, peut en conduire un)
function makeProxy(pid) {
  return {
    pid, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
    riding: null, fly: false, firstPerson: false,
    input: { forward: false }, look: new THREE.Vector3(0, 0, -1), lastPos: 0,
  };
}

// ---------- Session ----------
export class Net {
  constructor(game) {
    this.game = game;
    RemotePlayer.items = game.items;
    RemotePlayer.voice = game.voice;
    this.voiceCount = new Map(); // cid -> [seconde, messages de voix reçus] (hôte : anti-abus)
    if (game.voice) game.voice.send = (list) => this.sendVoice(list);          // voir main.js : monde, joueur, chariots, chat, écrans…
    this.mode = 'off';         // 'off' | 'host' | 'client'
    this.remotes = new Map();  // pid -> RemotePlayer
    this.list = [];            // liste des joueurs (touche Tab) : [pid, nom, ping]
    this.outBlocks = [];
    this.sendClock = 0;
    this.slowClock = 0;
    this.timeClock = 0;
    this.pvp = true;            // les joueurs peuvent se frapper (voir /pvp)
    this.lastHurt = new Map();  // pid -> instant du dernier coup reçu (hôte)
    this.boxWatch = new Map();  // coffre / four ouvert -> clients qui le regardent (hôte)
    this.boxClock = 0;
    if (native) native.onEvent((ev) => this.onEvent(ev));
  }

  // (navigateur : pas de serveur à une adresse, mais la connexion directe par code marche)
  get available() { return !!native || typeof RTCPeerConnection !== 'undefined'; }
  get direct() { return !!native; } // (serveur à une adresse IP : seulement dans l'application)
  get active() { return this.mode !== 'off'; }
  get isHost() { return this.mode === 'host'; }
  get isClient() { return this.mode === 'client'; }
  get moving() { for (const r of this.remotes.values()) if (r.speed > 0.05 || r.cart) return true; return false; }

  // ================= Hôte =================
  async host({ port, password, upnp }) {
    if (!this.available) return { ok: false, error: 'Ce navigateur ne permet pas le multijoueur' };
    // (navigateur : pas de serveur à une adresse, les amis viennent par code ; voir rtc.js)
    const res = native ? await native.host(port) : { ok: true, port: 0, web: true, addresses: [] };
    if (!res.ok) return res;
    this.mode = 'host';
    this.port = res.port;
    this.password = password || '';
    this.clients = new Map(); // cid -> { cid, pid, name, joined, proxy, ping }
    this.links = new Map();   // cid -> liaison directe (joueurs venus par code d'invitation)
    this.nextLink = 100000;
    this.myPid = 0;
    this.list = [[0, this.game.name(), 0]];
    this.outBlocks = [];
    this.lastCartCount = -1;
    this.game.world.onBlockSet = (q, r, y, id) => this.outBlocks.push([q, r, y, id]);
    this.lastTntCount = -1;
    this.game.tnt.onExplode = (x, y, z, big) => this.broadcastJoined({ t: 'boom', x, y, z, b: big });
    const structs = this.game.structs;
    this.game.ropes.onChange = () => this.broadcastJoined({ t: 'ropes', l: this.game.ropes.serialize() });
    structs.onChange = (s, del) => this.broadcastJoined(del ? { t: 'sdef', id: s.id, del: 1 } : { t: 'sdef', ...structs.def(s) });
    // code court : les amis rejoignent par internet sans rien régler (voir rtc.js)
    const [up, short] = await Promise.all([
      upnp && native ? native.upnp(res.port) : null,
      hostShortCode((link) => { if (this.mode === 'host') this.addLink(link); else link.close(); }).catch((err) => ({ error: err.message })),
    ]);
    if (up) res.upnp = up;
    if (this.mode !== 'host') { short.close?.(); return res; }
    this.short = short.code ? short : null;
    res.shortCode = short.code || null;
    res.shortError = short.error || null;
    return res;
  }

  // Nouvel ami arrivé par connexion directe (code court ou code d'invitation)
  addLink(link) {
    const cid = this.nextLink++;
    this.links.set(cid, link);
    link.onmessage = (data) => this.hostEvent({ kind: 'msg', cid, data });
    link.onclose = () => { this.links.delete(cid); if (this.mode === 'host') this.hostEvent({ kind: 'close', cid }); };
    this.hostEvent({ kind: 'open', cid });
    return cid;
  }

  stopHost(reason = 'L\'hôte a fermé la partie') {
    if (this.mode !== 'host') return;
    this.broadcast({ t: 'bye', reason });
    this.saveAllPlayers();
    for (const c of this.clients.values()) if (c.proxy.riding) this.game.carts.dismount(c.proxy);
    native?.stop();
    this.short?.close();
    this.short = null;
    for (const link of this.links.values()) { link.onclose = null; setTimeout(() => link.close(), 300); }
    this.links.clear();
    this.reset();
  }

  raw(cid, text) {
    const link = this.links.get(cid);
    if (link) link.send(text); else native?.send(cid, text);
  }
  sendTo(cid, msg) { this.raw(cid, JSON.stringify(msg)); }
  broadcast(msg, except = 0) {
    const text = JSON.stringify(msg);
    native?.send(0, text, except);
    for (const [cid, link] of this.links) if (cid !== except) link.send(text);
  }
  // coupe la connexion d'un client (après lui avoir laissé le temps de recevoir le dernier message)
  drop(cid, reason) {
    const link = this.links.get(cid);
    if (link) setTimeout(() => link.close(), 500);
    else native?.kick(cid, reason);
  }

  // Code d'invitation (connexion directe, sans box à régler) : { code, accept(réponse) }
  async invite() {
    if (this.mode !== 'host') throw new Error('Le serveur n\'est pas ouvert');
    const inv = await createInvite();
    return {
      code: inv.code,
      cancel: inv.cancel,
      accept: async (answer) => {
        const link = await inv.accept(answer);
        if (this.mode !== 'host') { link.close(); throw new Error('Le serveur a été fermé'); }
        return this.addLink(link);
      },
    };
  }
  // envoie aux clients arrivés dans la partie (pas à ceux qui se connectent encore)
  broadcastJoined(msg, except = 0) {
    const text = JSON.stringify(msg);
    for (const c of this.clients.values()) if (c.joined && c.cid !== except) this.raw(c.cid, text);
  }

  kick(cid, reason) {
    this.sendTo(cid, { t: 'bye', reason });
    this.drop(cid, reason);
  }

  // Positions des joueurs distants gardées dans la sauvegarde (on revient là où on était)
  playerStore() {
    const cur = this.game.current();
    if (!cur) return {};
    return (cur.players ||= {});
  }
  savePlayer(c) {
    const p = c.proxy.pos;
    this.playerStore()[c.name.toLowerCase()] = { x: p.x, y: p.y, z: p.z, yaw: c.proxy.yaw, pitch: c.proxy.pitch };
  }
  saveAllPlayers() {
    if (this.mode !== 'host') return;
    for (const c of this.clients.values()) if (c.joined) this.savePlayer(c);
  }

  hostEvent(ev) {
    if (ev.kind === 'open') {
      const c = { cid: ev.cid, pid: ev.cid, joined: false, proxy: makeProxy(ev.cid), ping: 0 };
      Object.defineProperty(c.proxy, 'pseudo', { get: () => c.name }); // (les militaires suivent leur chef)
      this.clients.set(ev.cid, c);
      c.timer = setTimeout(() => { if (!c.joined) this.drop(ev.cid, 'Délai dépassé'); }, HELLO_TIMEOUT);
      return;
    }
    const c = this.clients.get(ev.cid);
    if (!c) return;
    if (ev.kind === 'close') {
      clearTimeout(c.timer);
      this.clients.delete(ev.cid);
      if (!c.joined) return;
      this.savePlayer(c);
      if (c.proxy.riding) this.game.carts.dismount(c.proxy);
      this.game.structs.drop('c' + ev.cid);
      this.remotes.get(c.pid)?.dispose();
      this.remotes.delete(c.pid);
      this.broadcastJoined({ t: 'leave', pid: c.pid });
      for (const k of [...this.boxWatch.keys()]) this.watchBox(k, c.cid, false);
      if (!c.kicked) this.announce(`${c.name} a quitté la partie`);
      this.refreshList();
      return;
    }
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (!c.joined) { if (m.t === 'hello') this.onHello(c, m); return; }
    this.onClientMessage(c, m);
  }

  onHello(c, m) {
    const reject = (reason) => { this.sendTo(c.cid, { t: 'reject', reason }); this.drop(c.cid, reason); };
    if (m.proto !== PROTOCOL || m.version !== GAME_VERSION) {
      reject(`Version différente : le serveur est en ${GAME_VERSION}, tu es en ${m.version || '?'}`);
      return;
    }
    const name = String(m.name || '');
    if (!NAME_RE.test(name)) { reject('Pseudo invalide'); return; }
    const taken = name.toLowerCase() === this.game.name().toLowerCase()
      || [...this.clients.values()].some((o) => o.joined && o.name.toLowerCase() === name.toLowerCase());
    if (taken) { reject(`Le pseudo « ${name} » est déjà utilisé sur ce serveur`); return; }
    if (this.password && m.pass !== this.password) { reject('Mot de passe incorrect'); return; }
    const joinedCount = [...this.clients.values()].filter((o) => o.joined).length;
    if (joinedCount + 1 >= MAX_PLAYERS) { reject(`Serveur plein (${MAX_PLAYERS} joueurs maximum)`); return; }

    clearTimeout(c.timer);
    c.name = name;
    c.col = colorIndex(m.col);
    c.skin = skinName(m.sk);
    c.clan = clanOf(m.cl) ? m.cl : '';
    c.joined = true;
    // le monde tel qu'il est maintenant, et la dernière position de ce joueur (sinon : point d'apparition)
    const world = this.game.snapshot();
    const stored = this.playerStore()[name.toLowerCase()];
    world.player = stored ? { ...stored, slot: 0 } : { slot: 0 };
    world.world.carts = [];
    world.world.waypoints = this.game.getWaypoints?.() || []; // (repères de la carte)
    const players = [[0, this.game.name(), this.game.color?.() | 0, this.game.skin?.() || '', this.game.clan?.() || ''], ...[...this.clients.values()].filter((o) => o.joined && o !== c).map((o) => [o.pid, o.name, o.col | 0, o.skin || '', o.clan || ''])];
    this.sendTo(c.cid, { t: 'welcome', pid: c.pid, host: this.game.name(), world, time: this.game.getTime(), days: this.game.getDays(), players, carts: this.game.carts.state((p) => this.pidOf(p)), structs: this.game.structs.list.map((s) => this.game.structs.def(s)), ropes: this.game.ropes.serialize(), cartons: this.game.cartons?.state() || [], trk: this.game.tracks?.serialize(), trs: this.game.trains?.state((p) => this.pidOf(p)) || [] });
    if (stored) c.proxy.pos.set(stored.x, stored.y, stored.z);
    this.remotes.set(c.pid, new RemotePlayer(this.game.scene, c.pid, name, c.col, c.skin, c.clan));
    this.broadcastJoined({ t: 'join', pid: c.pid, name, col: c.col, sk: c.skin, cl: c.clan }, c.cid);
    this.announce(`${name} a rejoint la partie`);
    this.refreshList();
  }

  onClientMessage(c, m) {
    const { world, carts } = this.game;
    switch (m.t) {
      case 'pos': {
        if (![m.x, m.y, m.z, m.yaw, m.pitch].every(num)) return;
        const p = c.proxy, now = performance.now();
        const dt = Math.max(0.02, (now - (p.lastPos || now - 50)) / 1000);
        if (!p.riding) {
          p.vel.set((m.x - p.pos.x) / dt, (m.y - p.pos.y) / dt, (m.z - p.pos.z) / dt);
          p.pos.set(m.x, m.y, m.z);
        }
        p.lastPos = now;
        p.yaw = m.yaw; p.pitch = m.pitch;
        p.input.forward = !!m.f;
        p.input.back = !!m.b;
        p.held = int(m.h) ? m.h : 0;
        p.sneak = m.s === 1;
        p.hat = int(m.w) ? m.w : 0;
        const rpH = this.remotes.get(c.pid);
        if (rpH) { rpH.held = p.held; rpH.sneak = p.sneak; rpH.wear(p.hat); }
        p.look.set(-Math.sin(m.yaw) * Math.cos(m.pitch), Math.sin(m.pitch), -Math.cos(m.yaw) * Math.cos(m.pitch));
        if (!p.riding) this.remotes.get(c.pid)?.set(m.x, m.y, m.z, m.yaw, m.pitch);
        break;
      }
      case 'blocks': {
        if (!Array.isArray(m.l)) return;
        const fix = [];
        for (const e of m.l.slice(0, 256)) {
          if (!Array.isArray(e) || !e.slice(0, 4).every(int)) continue;
          const [q, r, y, id] = e;
          if (y < Y_MIN || y >= H || (id !== AIR && !BLOCKS[id])) continue;
          const cur = world.getBlock(q, r, y);
          if (cur === id) continue;
          // on ne casse pas la bedrock, même en trichant (sauf dans un monde en créatif)
          if (BLOCKS[cur]?.unbreakable && !(cur === 4 && id === AIR && this.game.creative?.())) { fix.push([q, r, y, cur]); continue; }
          // coffre / four cassé : son contenu revient à ce joueur
          if (BLOCKS[cur]?.container && BLOCKS[id]?.container !== BLOCKS[cur].container) {
            const items = this.game.containers.take(q, r, y);
            if (items.length) this.sendTo(c.cid, { t: 'bdrop', l: items });
          }
          world.setBlock(q, r, y, id);
        }
        if (fix.length) this.sendTo(c.cid, { t: 'blocks', l: fix });
        break;
      }
      case 'chat':
        this.handleChat(c, String(m.text || ''));
        break;
      case 'cart': {
        if (m.a === 'spawn' && [m.q, m.r, m.y].every(int) && num(m.yaw)) {
          if (isRail(world.getBlock(m.q, m.r, m.y))) carts.spawn(m.q, m.r, m.y, m.yaw);
        } else if (m.a === 'remove') {
          const cart = carts.byId(m.id);
          if (cart) carts.remove(cart);
        } else if (m.a === 'mount') {
          const cart = carts.byId(m.id);
          if (cart && !cart.rider && !c.proxy.riding) carts.mount(cart, c.proxy);
        } else if (m.a === 'dismount') {
          if (c.proxy.riding) carts.dismount(c.proxy);
        }
        break;
      }
      case 'pong':
        if (num(m.s)) c.ping = Math.round(performance.now() - m.s);
        break;
      case 'ahit': {
        // un joueur frappe un animal : l'hôte décide ; ce qu'il laisse va au joueur
        const a = this.game.animals.byId(m.id);
        if (!a || !num(m.d) || a.pos.distanceTo(c.proxy.pos) > 8) return;
        const drop = this.game.animals.hit(a, Math.max(1, Math.min(9, m.d)), c.proxy.pos.x, c.proxy.pos.z, c.name);
        if (drop) this.sendTo(c.cid, { t: 'adrop', i: drop[0], n: drop[1] });
        if (drop && a.meat) this.sendTo(c.cid, { t: 'adrop', i: a.meat[0], n: a.meat[1] });
        break;
      }
      case 'vtrade': {
        // un joueur a conclu un échange avec un villageois (près de lui)
        const a = this.game.animals.byId(m.id);
        if (a && a.pos.distanceTo(c.proxy.pos) < 8) this.game.animals.talk.traded(a, c.name);
        break;
      }
      case 'vrecruit': {
        // un joueur recrute un villageois comme militaire (près de lui ; il a payé de son côté)
        const a = this.game.animals.byId(m.id);
        if (a && typeof m.j === 'string' && a.pos.distanceTo(c.proxy.pos) < 8) this.game.animals.recruit(a, m.j, c.name);
        break;
      }
      case 'vorder': {
        // ordre d'un joueur à un militaire (près de lui)
        const a = this.game.animals.byId(m.id);
        if (a && ['follow', 'stay', 'civil'].includes(m.o) && a.pos.distanceTo(c.proxy.pos) < 8) this.game.animals.command(a, m.o);
        break;
      }
      case 'vgift': {
        // un joueur offre un objet à un villageois (près de lui)
        const a = this.game.animals.byId(m.id);
        if (a && int(m.i) && int(m.n) && a.pos.distanceTo(c.proxy.pos) < 8) this.game.receiveGift(a, c.name, m.i, Math.min(64, m.n));
        break;
      }
      case 'wpadd':
        // repère posé par un joueur (nom vérifié), puis renvoyé à tous
        if (![m.x, m.z].every(num) || typeof m.n !== 'string' || !m.n.trim()) return;
        this.game.addWaypoint(m.x, m.z, m.n.trim().slice(0, 24), c.name);
        break;
      case 'wpdel':
        if (int(m.id)) this.game.removeWaypoint(m.id);
        break;
      case 'tr': {
        // un invité et les trains : poser, casser, monter dans la cabine, aiguillage, virage
        const { trains, tracks } = this.game;
        if (!trains) return;
        const near = (x, y, z, d = 12) => Math.hypot(x - c.proxy.pos.x, y - c.proxy.pos.y, z - c.proxy.pos.z) < d;
        if (['loco', 'wagon', 'flat', 'hopper', 'passenger', 'layer', 'tail', 'flat2', 'tender', 'covered', 'armored', 'mine'].includes(m.a) && [m.q, m.r, m.y].every(int)) {
          const w = hexToWorld(m.q, m.r);
          if (!near(w.x, m.y, w.z, 14)) return;
          const err = m.a === 'loco' ? trains.spawnLoco(m.q, m.r, m.y, num(m.yaw) ? m.yaw : 0, typeof m.st === 'string' ? m.st : '') : trains.addWagon(m.q, m.r, m.y, m.a);
          if (err) this.sendTo(c.cid, { t: 'err', text: err });
          else this.sendTo(c.cid, { t: 'trok', a: m.a }); // (l'invité retire l'objet de son inventaire)
        } else if (m.a === 'remove' && int(m.id)) {
          const car = trains.byId(m.id);
          if (!car || !near(car.pos.x, car.pos.y, car.pos.z, 16)) return;
          const back = trains.removeCar(car);
          if (back.length) this.sendTo(c.cid, { t: 'bdrop', l: back });
        } else if (m.a === 'couple' && int(m.id)) {
          // atteler / dételer (clic molette sur une voiture)
          const car = trains.byId(m.id);
          if (car && near(car.pos.x, car.pos.y, car.pos.z, 16)) { const msg = trains.couple(car); if (msg) this.sendTo(c.cid, { t: 'err', text: msg }); }
        } else if (m.a === 'fire' && int(m.id) && Array.isArray(m.d) && m.d.length === 3 && m.d.every(num)) {
          // tir du wagon blindé : seulement son tireur (l'obus est pris chez l'invité)
          const car = trains.byId(m.id);
          if (car && car.kind === 'armored' && car.rider === c.proxy) trains.fire(car, new THREE.Vector3(...m.d));
        } else if (m.a === 'mount' && int(m.id)) {
          const car = trains.byId(m.id);
          // (cabine de la locomotive, ou une place du wagon passagers)
          if (car && !c.proxy.riding && near(car.pos.x, car.pos.y, car.pos.z, 16)) trains.mount(car, c.proxy, int(m.seat) ? m.seat : -1);
        } else if (m.a === 'comp' && int(m.id) && (m.slot === 'engine' || int(m.slot)) && int(m.item)) {
          // un composant posé (ou enlevé : item 0) dans la locomotive ; l'ancien revient à l'invité
          const car = trains.byId(m.id);
          if (!car || car.kind !== 'loco' || !near(car.pos.x, car.pos.y, car.pos.z, 16)) return;
          const old = trains.setComp(car, m.slot, m.item);
          if (old > 0) this.sendTo(c.cid, { t: 'bdrop', l: [{ id: old, n: 1 }] });
        } else if (m.a === 'route' && int(m.id) && Array.isArray(m.keys)) {
          const car = trains.byId(m.id);
          if (car && car.kind === 'loco' && near(car.pos.x, car.pos.y, car.pos.z, 16)) trains.setRoute(car, m.keys.filter((k) => typeof k === 'string').slice(0, 64));
        } else if (m.a === 'limit' && [m.q, m.r, m.y].every(int)) {
          const w = hexToWorld(m.q, m.r);
          if (near(w.x, m.y, w.z, 14)) tracks?.nextLimit(m.q + ',' + m.r + ',' + m.y);
        } else if (m.a === 'auto' && int(m.id)) {
          // pilote automatique : seulement le conducteur de cette locomotive
          const car = trains.byId(m.id);
          if (car && car.rider === c.proxy) trains.setAuto(car);
        } else if (m.a === 'fuel' && int(m.id) && int(m.item)) {
          const car = trains.byId(m.id);
          if (car && near(car.pos.x, car.pos.y, car.pos.z, 16)) trains.refuel(car, m.item, 1);
        } else if (m.a === 'name' && [m.q, m.r, m.y].every(int) && typeof m.name === 'string') {
          // le nom d'une gare
          const w = hexToWorld(m.q, m.r);
          if (near(w.x, m.y, w.z, 14) && m.name.trim()) tracks?.rename(m.q + ',' + m.r + ',' + m.y, m.name.trim().slice(0, 32));
        } else if (m.a === 'switch' && typeof m.k === 'string') {
          const n = tracks?.nodes.get(m.k);
          if (n && near(n.pos.x, n.pos.y, n.pos.z, 12)) tracks.toggle(n);
        } else if (m.a === 'curve' && typeof m.k === 'string' && [m.q, m.r, m.y, m.axis].every(int) && Math.abs(m.as) === 1 && Math.abs(m.bs) === 1) {
          // le virage d'un invité : l'hôte vérifie, pose le rail d'arrivée s'il n'est pas encore là
          tracks.update();
          const a = tracks.nodes.get(m.k);
          if (!a || m.axis < 0 || m.axis > 2 || tracks.full(a, m.as)) return;
          const res = tracks.check(a, m.as, m.q, m.r, m.y, m.axis, m.bs);
          if (typeof res === 'string') { this.sendTo(c.cid, { t: 'err', text: res }); return; }
          const id = world.getBlock(m.q, m.r, m.y);
          if (!(id >= 456 && id <= 474 && [456, 473, 474].includes(id))) {
            if (id !== AIR) return;
            world.setBlock(m.q, m.r, m.y, [456, 473, 474][m.axis]);
          }
          tracks.update();
          tracks.addCurve(a, m.as, m.q + ',' + m.r + ',' + m.y, m.bs);
        }
        break;
      }
      case 'ctnspawn': {
        // un invité jette des objets : le carton apparaît chez l'hôte (près de lui)
        if (![m.x, m.y, m.z, m.vx, m.vy, m.vz].every(num) || !Array.isArray(m.items)) return;
        if (Math.hypot(m.x - c.proxy.pos.x, m.y - c.proxy.pos.y, m.z - c.proxy.pos.z) > 10) return;
        const items = m.items.slice(0, 40).filter((s) => s && int(s.id) && (BLOCKS[s.id] || ITEMS[s.id]) && int(s.n) && s.n > 0 && s.n <= 4096).map((s) => (int(s.w) && s.w > 0 ? { id: s.id, n: s.n, w: s.w } : { id: s.id, n: s.n }));
        if (items.length) this.game.cartons?.spawn(new THREE.Vector3(m.x, m.y, m.z), items, new THREE.Vector3(m.vx, m.vy, m.vz).clampLength(0, 20), int(m.d) ? 1.5 : 0);
        break;
      }
      case 'ctntake': {
        // un invité ramasse un carton : il disparaît, son contenu part chez lui
        const ct = int(m.id) && this.game.cartons?.byId(m.id);
        if (!ct || ct.pos.distanceTo(c.proxy.pos) > 7) return;
        this.game.cartons.remove(ct);
        this.sendTo(c.cid, { t: 'ctngive', l: ct.items });
        break;
      }
      case 'aegg': {
        // un joueur utilise un œuf d'apparition (près de lui)
        if (!SPECIES[m.k] || !Object.values(ITEMS).some((it) => it.egg === m.k) || ![m.x, m.y, m.z].every(num)) return;
        if (Math.hypot(m.x - c.proxy.pos.x, m.y - c.proxy.pos.y, m.z - c.proxy.pos.z) > 9) return;
        this.game.animals.spawnAt(m.k, m.x, m.y, m.z);
        break;
      }
      case 'bopen': {
        // un joueur ouvre un coffre / four : on lui envoie son contenu, puis ses changements
        const box = this.game.containers.byKey(m.k);
        if (!box) return;
        this.watchBox(m.k, c.cid, true);
        this.sendTo(c.cid, { t: 'box', k: m.k, c: this.game.containers.data(box) });
        break;
      }
      case 'bset': {
        const box = this.game.containers.byKey(m.k);
        if (!box || !this.boxWatch.get(m.k)?.has(c.cid)) return;
        if (!this.game.containers.apply(box, m.c, false)) return;
        this.pushBox(m.k, c.cid);
        this.game.boxUpdated(box);
        break;
      }
      case 'bclose':
        this.watchBox(m.k, c.cid, false);
        break;
      case 'vc': {
        // voix : aux joueurs assez proches (et à nous), pas plus de ~25 messages par seconde
        if (!Array.isArray(m.d) || m.d.length > 6 || m.d.some((b) => typeof b !== 'string' || b.length > 600)) return;
        const sec = Math.floor(performance.now() / 1000), vc = this.voiceCount.get(c.cid) || [sec, 0];
        if (vc[0] !== sec) { vc[0] = sec; vc[1] = 0; }
        this.voiceCount.set(c.cid, vc);
        if (++vc[1] > 30) return;
        this.relayVoice(c.pid, c.proxy.pos, m.d);
        break;
      }
      case 'pod': { // un joueur arrive en capsule : les autres la voient, l'hôte la pose en blocs
        const p = podPlan(m);
        if (!p) return;
        this.broadcastJoined({ t: 'pod', ...p }, c.cid);
        this.game.podCrash?.(p);
        break;
      }
      case 'phit':
        if (int(m.pid) && num(m.d)) this.pvpHit(c.pid, m.pid, Math.max(1, Math.min(9, m.d)));
        break;
      case 'ignite':
        if ([m.q, m.r, m.y].every(int)) this.game.tnt.ignite(m.q, m.r, m.y, undefined, this.game.listener);
        break;
      case 'sasm': {
        // assembler des blocs collés par ce joueur
        if (!Array.isArray(m.cells)) return;
        const cells = m.cells.slice(0, 4096).filter((e) => Array.isArray(e) && e.length === 3 && e.every(int));
        if (cells.length) this.game.structs.assemble(cells);
        break;
      }
      case 'sgrab': {
        const st = this.game.structs.byId(m.id);
        const v3 = (a) => (Array.isArray(a) && a.length === 3 && a.every(num) ? new THREE.Vector3(...a) : null);
        const p = v3(m.p), tp = v3(m.tp);
        if (st && p && tp) this.game.structs.hold('c' + c.cid, st, p, tp);
        break;
      }
      case 'shold':
        if (Array.isArray(m.tp) && m.tp.length === 3 && m.tp.every(num)) this.game.structs.holdTarget('c' + c.cid, new THREE.Vector3(...m.tp));
        break;
      case 'signite': { // le client allume une TNT d'un objet physique
        const st = this.game.structs.byId(m.id);
        if (st && typeof m.k === 'string') this.game.structs.igniteTnt(st, m.k);
        break;
      }
      case 'sturn': { // le client fait tourner l'objet qu'il tient
        const a = Array.isArray(m.a) && m.a.length === 3 && m.a.every(num) ? new THREE.Vector3(...m.a) : null;
        if (a && a.lengthSq() > 1e-6 && num(m.g)) this.game.structs.holdTurn('c' + c.cid, a.normalize(), Math.max(-Math.PI, Math.min(Math.PI, m.g)));
        else if (m.a === null) this.game.structs.holdTurn('c' + c.cid, null, 0);
        break;
      }
      case 'sdrop': {
        let v = null;
        if (Array.isArray(m.v) && m.v.length === 3 && m.v.every(num)) { v = new THREE.Vector3(...m.v); if (v.length() > 20) v.setLength(20); }
        this.game.structs.drop('c' + c.cid, v);
        break;
      }
      case 'rope': {
        // corde tendue par un joueur (bouts vérifiés, près de lui)
        const a = cleanEnd(m.a), b = cleanEnd(m.b), ropes = this.game.ropes;
        if (!a || !b) return;
        const pa = ropes.point(a, new THREE.Vector3()), pb = ropes.point(b, new THREE.Vector3());
        if (!pa || !pb || pa.distanceTo(pb) > ROPE_MAX || pb.distanceTo(c.proxy.pos) > 10) return;
        if (!ropes.add(a, b)) this.sendTo(c.cid, { t: 'err', text: 'Impossible de tendre la corde ici' });
        break;
      }
      case 'ropedel': {
        // cordes retirées par un joueur : elles lui sont rendues
        const e = cleanEnd({ s: m.s, p: [0, 0, 0], c: m.c }), ropes = this.game.ropes;
        if (!e) return;
        const list = ropes.at(e.s, e.c);
        for (const r of list) ropes.remove(r);
        if (list.length) this.sendTo(c.cid, { t: 'bdrop', l: [{ id: ROPE_ITEM, n: list.length }] });
        break;
      }
      case 'smerge': {
        // double colle : deux objets n'en font plus qu'un
        const st = this.game.structs, why = st.merge(st.byId(m.a), st.byId(m.b));
        if (why) this.sendTo(c.cid, { t: 'err', text: why });
        break;
      }
      case 'sdis': {
        const s = this.game.structs.byId(m.id);
        if (s && !this.game.structs.disassemble(s)) this.sendTo(c.cid, { t: 'err', text: 'Pas assez de place pour reposer l\'objet ici' });
        break;
      }
      case 'sset': {
        const s = this.game.structs.byId(m.id);
        if (!s || ![m.q, m.r, m.y, m.b].every(int)) return;
        if (m.b !== AIR && !BLOCKS[m.b]) return;
        const cur = s.blocks.get(m.q + ',' + m.r + ',' + m.y);
        if (m.b === AIR && BLOCKS[cur]?.unbreakable) return;
        if (m.b === AIR && BLOCKS[cur]?.container) {
          const items = this.game.containers.takeKey('S' + s.id + ':' + m.q + ',' + m.r + ',' + m.y);
          if (items.length) this.sendTo(c.cid, { t: 'bdrop', l: items });
        }
        this.game.structs.setBlock(s, m.q, m.r, m.y, m.b);
        break;
      }
    }
  }

  pidOf(p) {
    if (p === this.game.player) return this.myPid;
    return p && p.pid !== undefined ? p.pid : -1;
  }

  announce(text) {
    this.broadcastJoined({ t: 'sys', text });
    this.game.chat(text, 'sys');
  }

  refreshList() {
    this.list = [[0, this.game.name(), 0], ...[...this.clients.values()].filter((c) => c.joined).map((c) => [c.pid, c.name, c.ping])];
    this.broadcastJoined({ t: 'list', l: this.list });
    this.game.playersChanged();
  }

  // Chat et commandes. from = client (ou null pour l'hôte lui-même)
  handleChat(from, text) {
    text = text.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200);
    if (!text) return;
    const reply = (msg, kind = 'sys') => {
      if (from) this.sendTo(from.cid, { t: kind === 'err' ? 'err' : 'sys', text: msg });
      else this.game.chat(msg, kind);
    };
    if (text.startsWith('/')) {
      const [cmd, ...args] = text.slice(1).split(/\s+/);
      switch (cmd.toLowerCase()) {
        case 'help': case 'aide':
          for (const line of helpLines(true, !from)) reply(line);
          return;
        case 'weather': case 'meteo': case 'météo': {
          // seul l'hôte change le temps (il le partage avec tout le monde)
          if (from && args.length) { reply('Seul l\'hôte peut changer la météo', 'err'); return; }
          const p = from ? from.proxy : this.game.player;
          for (const line of this.game.weatherCommand(args, p.pos)) reply(line.text, line.kind);
          return;
        }
        case 'pvp': {
          if (from) { reply('Seul l\'hôte peut changer le PvP', 'err'); return; }
          const a = (args[0] || '').toLowerCase();
          if (a === 'on' || a === 'off') {
            this.pvp = a === 'on';
            this.announce(this.pvp ? 'PvP activé : les joueurs en survie peuvent se frapper' : 'PvP désactivé');
          } else reply(`PvP : ${this.pvp ? 'activé' : 'désactivé'} (/pvp on ou /pvp off)`);
          return;
        }
        case 'list': case 'liste':
          reply(`Joueurs (${this.list.length}) : ${this.list.map((p) => p[1]).join(', ')}`);
          return;
        case 'kick': {
          if (from) { reply('Seul l\'hôte peut expulser un joueur', 'err'); return; }
          const who = [...this.clients.values()].find((c) => c.joined && c.name.toLowerCase() === (args[0] || '').toLowerCase());
          if (!who) { reply(`Joueur introuvable : ${args[0] || '?'}`, 'err'); return; }
          const reason = args.slice(1).join(' ') || 'Expulsé par l\'hôte';
          who.kicked = true;
          this.kick(who.cid, reason);
          this.announce(`${who.name} a été expulsé (${reason})`);
          return;
        }
        default:
          reply(`Commande inconnue : /${cmd} (tape /help)`, 'err');
          return;
      }
    }
    const name = from ? from.name : this.game.name();
    this.broadcastJoined({ t: 'chat', name, text });
    this.game.chat(`<${name}> ${text}`, 'chat');
  }

  // Coffres et fours (hôte) : qui regarde quoi
  watchBox(k, cid, on) {
    if (typeof k !== 'string') return;
    let set = this.boxWatch.get(k);
    if (on) { if (!set) this.boxWatch.set(k, (set = new Set())); set.add(cid); return; }
    if (set) { set.delete(cid); if (!set.size) this.boxWatch.delete(k); }
  }

  // Envoie le contenu du coffre / four k à ceux qui le regardent (sauf except)
  pushBox(k, except = null) {
    const set = this.boxWatch.get(k);
    if (!set) return;
    const box = this.game.containers.map.get(k);
    if (!box) return;
    const msg = { t: 'box', k, c: this.game.containers.data(box) };
    for (const cid of set) if (cid !== except) this.sendTo(cid, msg);
  }

  // Ce joueur ouvre / modifie / ferme un coffre ou four (k : sa clé)
  boxOpen(k) { if (this.isClient) this.csend({ t: 'bopen', k }); }
  boxChanged(k, data) {
    if (this.isClient) this.csend({ t: 'bset', k, c: data });
    else if (this.isHost) this.pushBox(k);
  }
  boxClose(k) { if (this.isClient) this.csend({ t: 'bclose', k }); }

  // PvP (hôte) : le joueur from frappe le joueur to (pid 0 : l'hôte) de dmg points
  pvpHit(from, to, dmg) {
    if (!this.pvp || from === to) return;
    const posOf = (pid) => (pid === 0 ? this.game.player.pos : this.clientOf(pid)?.proxy.pos);
    const a = posOf(from), b = posOf(to);
    if (!a || !b || a.distanceTo(b) > 7) return;
    const now = performance.now();
    if (now - (this.lastHurt.get(to) || 0) < 400) return; // (un coup à la fois)
    this.lastHurt.set(to, now);
    const by = from === 0 ? this.game.name() : this.clientOf(from)?.name || '?';
    if (to === 0) this.game.hurtSelf(dmg, a.x, a.z, by);
    else this.sendTo(this.clientOf(to).cid, { t: 'hurt', d: dmg, x: a.x, z: a.z, by });
    // tout le monde voit le joueur touché devenir rouge
    this.broadcastJoined({ t: 'pfx', pid: to });
    const rp = this.remotes.get(to);
    if (rp) rp.hurtT = 0.35;
  }

  // Un zombie mord un joueur distant (hôte) : il le subit chez lui (s'il est en survie), et
  // tout le monde le voit devenir rouge
  mobHit(proxy, dmg, x, z) {
    for (const c of this.clients.values()) {
      if (!c.joined || c.proxy !== proxy) continue;
      this.sendTo(c.cid, { t: 'hurt', d: dmg, x, z, by: 'un zombie' });
      this.broadcastJoined({ t: 'pfx', pid: c.pid });
      const rp = this.remotes.get(c.pid);
      if (rp) rp.hurtT = 0.35;
    }
  }

  // Les autres joueurs sont redessinés dans le style choisi (hexagones ou pavés)
  restyle() { for (const rp of this.remotes.values()) rp.build(); }

  clientOf(pid) {
    for (const c of this.clients.values()) if (c.joined && c.pid === pid) return c;
    return null;
  }

  // Coup porté par ce joueur au joueur distant pid
  attackPlayer(pid, dmg) {
    if (this.isClient) this.csend({ t: 'phit', pid, d: dmg });
    else if (this.isHost) this.pvpHit(0, pid, dmg);
  }

  hostTick(dt) {
    const { carts, player } = this.game;
    if (this.outBlocks.length) {
      this.broadcastJoined({ t: 'blocks', l: this.outBlocks });
      this.outBlocks = [];
    }
    // joueurs distants affichés chez l'hôte
    for (const c of this.clients.values()) {
      if (!c.joined) continue;
      const rp = this.remotes.get(c.pid);
      if (!rp) continue;
      rp.cart = c.proxy.riding;
      if (c.proxy.riding) { rp.tYaw = c.proxy.yaw; rp.tPitch = c.proxy.pitch; }
    }
    this.sendClock += dt;
    if (this.sendClock >= SEND_RATE) {
      this.sendClock = 0;
      const r = (v) => Math.round(v * 1000) / 1000;
      const entry = (pid, p, yaw, pitch, held) => [pid, r(p.pos.x), r(p.pos.y), r(p.pos.z), r(yaw), r(pitch), p.riding ? (p.riding.isTrain ? -10 - (p.riding.id * 8 + (p.seat | 0)) : p.riding.id) : -1, held | 0, p.sneak ? 1 : 0, p.hat | 0];
      const ps = [entry(0, player, player.yaw, player.pitch, this.game.held())];
      for (const c of this.clients.values()) if (c.joined) ps.push(entry(c.pid, c.proxy, c.proxy.yaw, c.proxy.pitch, c.proxy.held));
      this.broadcastJoined({ t: 'ps', l: ps });
      if (carts.carts.length || this.lastCartCount) {
        this.broadcastJoined({ t: 'carts', l: carts.state((p) => this.pidOf(p)) });
        this.lastCartCount = carts.carts.length;
      }
      const trains = this.game.trains;
      if (trains && (trains.trains.length || this.lastTrainCount)) {
        this.broadcastJoined({ t: 'trs', l: trains.state((p) => this.pidOf(p)) });
        this.lastTrainCount = trains.trains.length;
      }
      const sps = this.game.structs.positions();
      if (sps.length) this.broadcastJoined({ t: 'sps', l: sps });
      const tnt = this.game.tnt;
      if (tnt.list.length || this.lastTntCount) {
        this.broadcastJoined({ t: 'tnts', l: tnt.state() });
        this.lastTntCount = tnt.list.length;
      }
      // animaux : 10 fois par seconde suffisent (les clients lissent le mouvement)
      this.animalTick = !this.animalTick;
      const animals = this.game.animals;
      // cartons : 10 fois par seconde aussi
      const cartons = this.game.cartons;
      if (this.animalTick && cartons && (cartons.list.length || this.lastCartonCount)) {
        this.broadcastJoined({ t: 'ctns', l: cartons.state() });
        this.lastCartonCount = cartons.list.length;
      }
      if (this.animalTick && (animals.list.length || this.lastAnimalCount)) {
        this.broadcastJoined({ t: 'ans', l: animals.state() });
        this.lastAnimalCount = animals.list.length;
      }
    }
    this.boxClock += dt;
    if (this.boxClock >= 0.25) {
      this.boxClock = 0;
      for (const k of this.boxWatch.keys()) if (this.game.containers.map.get(k)?.type === 'furnace') this.pushBox(k);
    }
    // avis des villageois proches sur chaque joueur (envoyé seulement s'il a changé)
    this.repClock = (this.repClock || 0) + dt;
    if (this.repClock >= 1) {
      this.repClock = 0;
      for (const c of this.clients.values()) {
        if (!c.joined) continue;
        const rep = JSON.stringify(this.game.animals.talk.report(c.proxy, c.name));
        if (rep !== c.lastRep) { c.lastRep = rep; this.raw(c.cid, `{"t":"vrep","l":${rep}}`); }
      }
    }
    this.timeClock += dt;
    if (this.timeClock >= 1) { this.timeClock = 0; this.broadcastJoined({ t: 'time', v: this.game.getTime(), d: this.game.getDays(), w: this.game.getPressures(), pvp: this.pvp ? 1 : 0 }); }
    this.slowClock += dt;
    if (this.slowClock >= 2) {
      this.slowClock = 0;
      this.broadcastJoined({ t: 'ping', s: performance.now() });
      this.refreshList();
    }
  }

  // ================= Client =================
  async join(address, password) {
    if (!native) return { ok: false, error: 'Dans le navigateur, on rejoint avec le code de l\'hôte (HX-…) : une adresse IP ne marche que dans l\'application' };
    const m = /^\s*([^\s:]+)(?::(\d+))?\s*$/.exec(address || '');
    if (!m) return { ok: false, error: 'Adresse invalide (exemple : 192.168.1.20 ou 88.12.34.56:25580)' };
    const port = m[2] ? Number(m[2]) : DEFAULT_PORT;
    this.leave();
    this.mode = 'connecting';
    this.byeReason = null;
    const res = await native.connect(`ws://${m[1]}:${port}`);
    if (!res.ok) { this.mode = 'off'; return res; }
    return new Promise((resolve) => {
      this.pendingJoin = resolve;
      this.joinTimer = setTimeout(() => this.finishJoin({ ok: false, error: 'Le serveur ne répond pas' }), HELLO_TIMEOUT);
      native.csend(JSON.stringify({ t: 'hello', proto: PROTOCOL, version: GAME_VERSION, name: this.game.name(), col: this.game.color?.() | 0, sk: this.game.skin?.() || '', cl: this.game.clan?.() || '', pass: password || '' }));
    });
  }

  // Rejoindre avec le code court de l'hôte (HX-4K7P2Q) : comme join(), renvoie { ok, error }
  async joinShort(code, password) {
    this.leave();
    this.mode = 'connecting';
    this.byeReason = null;
    let att;
    try {
      att = await joinShortCode(code);
    } catch (err) {
      this.mode = 'off';
      return { ok: false, error: err.message };
    }
    this.pendingAnswer = att; // (annulable comme une connexion par code d'invitation)
    let link;
    try {
      link = await att.link;
    } catch (err) {
      if (this.pendingAnswer === att) { this.pendingAnswer = null; this.mode = 'off'; }
      return { ok: false, error: err.message };
    }
    if (this.pendingAnswer !== att) { link.close(); return { ok: false, error: 'Annulé' }; }
    this.pendingAnswer = null;
    this.link = link;
    link.onmessage = (data) => this.onEvent({ kind: 'cmsg', data });
    link.onclose = () => { if (this.link === link) { this.link = null; this.onEvent({ kind: 'cclose', reason: '' }); } };
    return new Promise((resolve) => {
      this.pendingJoin = resolve;
      this.joinTimer = setTimeout(() => this.finishJoin({ ok: false, error: 'Le serveur ne répond pas' }), HELLO_TIMEOUT);
      this.csend({ t: 'hello', proto: PROTOCOL, version: GAME_VERSION, name: this.game.name(), col: this.game.color?.() | 0, sk: this.game.skin?.() || '', cl: this.game.clan?.() || '', pass: password || '' });
    });
  }

  // Rejoindre avec un code d'invitation. Renvoie tout de suite le code réponse à donner à
  // l'hôte ; done se termine quand on est dans la partie (ou en cas d'échec).
  async joinWithCode(inviteCode, password) {
    this.leave();
    this.mode = 'connecting';
    this.byeReason = null;
    let ans;
    try {
      ans = await answerInvite(inviteCode);
    } catch (err) {
      this.mode = 'off';
      return { ok: false, error: err.message };
    }
    this.pendingAnswer = ans;
    const done = ans.link.then((link) => {
      if (this.pendingAnswer !== ans) { link.close(); return { ok: false, error: 'Annulé' }; }
      this.pendingAnswer = null;
      this.link = link;
      link.onmessage = (data) => this.onEvent({ kind: 'cmsg', data });
      link.onclose = () => { if (this.link === link) { this.link = null; this.onEvent({ kind: 'cclose', reason: '' }); } };
      return new Promise((resolve) => {
        this.pendingJoin = resolve;
        this.joinTimer = setTimeout(() => this.finishJoin({ ok: false, error: 'Le serveur ne répond pas' }), HELLO_TIMEOUT);
        this.csend({ t: 'hello', proto: PROTOCOL, version: GAME_VERSION, name: this.game.name(), col: this.game.color?.() | 0, sk: this.game.skin?.() || '', cl: this.game.clan?.() || '', pass: password || '' });
      });
    }, (err) => {
      if (this.pendingAnswer === ans) { this.pendingAnswer = null; this.mode = 'off'; }
      return { ok: false, error: err.message === 'timeout' ? 'L\'hôte n\'a pas collé ta réponse à temps (3 min). Recommencez avec un nouveau code.' : err.message };
    });
    return { ok: true, answer: ans.code, done };
  }

  cancelCodeJoin() {
    if (!this.pendingAnswer) return;
    this.pendingAnswer.cancel();
    this.pendingAnswer = null;
    if (this.mode === 'connecting') this.mode = 'off';
  }

  finishJoin(result) {
    clearTimeout(this.joinTimer);
    const done = this.pendingJoin;
    this.pendingJoin = null;
    if (!result.ok) { this.closeClientLink(); this.mode = 'off'; }
    if (done) done(result);
  }

  csend(msg) {
    const text = JSON.stringify(msg);
    if (this.link) this.link.send(text); else native?.csend(text);
  }

  closeClientLink() {
    if (this.link) {
      const link = this.link;
      this.link = null;
      link.onclose = null;
      setTimeout(() => link.close(), 200);
    } else {
      native?.disconnect();
    }
  }

  clientMessage(m) {
    const { world, carts } = this.game;
    switch (m.t) {
      case 'welcome': {
        this.mode = 'client';
        this.myPid = m.pid;
        this.hostName = m.host;
        this.outBlocks = [];
        for (const [pid, name, col, sk, cl] of m.players || []) this.remotes.set(pid, new RemotePlayer(this.game.scene, pid, name, col, sk, cl));
        world.onBlockSet = (q, r, y, id) => { if (!this.applying) this.outBlocks.push([q, r, y, id]); };
        this.game.tnt.remote = true;
        this.game.structs.remote = true;
        this.game.joined(m);
        carts.remote = true;
        carts.applyState(m.carts || []);
        if (this.game.cartons) { this.game.cartons.remote = true; this.game.cartons.applyState(m.cartons || []); }
        if (this.game.trains) { this.game.trains.remote = true; if (m.trk) this.game.tracks.load(m.trk); this.game.trains.applyState(m.trs || [], m.pid, this.game.player); }
        this.finishJoin({ ok: true });
        break;
      }
      case 'reject':
        this.byeReason = m.reason;
        this.finishJoin({ ok: false, error: m.reason });
        break;
      case 'bye':
        this.byeReason = m.reason;
        break;
      case 'blocks':
        if (!Array.isArray(m.l)) return;
        this.applying = true;
        for (const e of m.l) if (Array.isArray(e) && e.length === 4) world.setBlock(e[0], e[1], e[2], e[3]);
        this.applying = false;
        break;
      case 'ps':
        for (const e of m.l || []) {
          const [pid, x, y, z, yaw, pitch, cartId, held, sneak, hat] = e;
          if (pid === this.myPid) continue;
          const rp = this.remotes.get(pid);
          if (!rp) continue;
          rp.set(x, y, z, yaw, pitch);
          rp.held = int(held) ? held : 0;
          rp.sneak = sneak === 1;
          rp.wear(hat);
          // (une voiture de train : -10 - (numéro × 8 + place))
          rp.seat = cartId <= -10 ? (-10 - cartId) % 8 : 0;
          rp.cart = cartId >= 0 ? carts.byId(cartId) : cartId <= -10 ? this.game.trains?.byId(Math.floor((-10 - cartId) / 8)) || null : null;
        }
        break;
      case 'carts':
        carts.applyState(m.l || []);
        this.checkRide();
        break;
      case 'sdef':
        if (int(m.id)) this.game.structs.applyDef(m);
        break;
      case 'sps':
        if (Array.isArray(m.l)) this.game.structs.applyPositions(m.l.filter((e) => Array.isArray(e) && e.length >= 4));
        break;
      case 'box':
        if (typeof m.k === 'string') this.game.boxReceived(m.k, m.c);
        break;
      case 'bdrop':
        if (Array.isArray(m.l)) for (const s of m.l.slice(0, 40)) if (s && int(s.id) && int(s.n) && s.n > 0) this.game.give(s.id, s.n, s.w);
        break;
      case 'hurt':
        if (num(m.d) && num(m.x) && num(m.z)) this.game.hurtSelf(Math.max(1, Math.min(9, m.d)), m.x, m.z, String(m.by || ''));
        break;
      case 'pfx': {
        const rp = this.remotes.get(m.pid);
        if (rp) rp.hurtT = 0.35;
        break;
      }
      case 'wps':
        this.game.setWaypoints(m.l);
        break;
      case 'vsay': {
        const a = this.game.animals.byId(m.id), k = PHRASE_KEYS[m.k];
        if (a && k) this.game.villagerVoice(a, k);
        break;
      }
      case 'ropes':
        this.game.ropes.load(m.l);
        break;
      case 'vrep':
        if (Array.isArray(m.l)) this.game.animals.talk.applyReport(m.l.slice(0, 400));
        break;
      case 'ans':
        if (Array.isArray(m.l)) this.game.animals.applyState(m.l);
        break;
      case 'adrop':
        if (DROP_IDS.has(m.i) && int(m.n) && m.n > 0 && m.n <= 8) this.game.give(m.i, m.n);
        break;
      case 'tnts':
        this.game.tnt.applyState(m.l || [], this.game.listener);
        break;
      case 'trs':
        if (Array.isArray(m.l)) this.game.trains?.applyState(m.l.slice(0, 200), this.myPid, this.game.player);
        break;
      case 'trk':
        if (m.d) this.game.tracks?.load(m.d);
        break;
      case 'trok':
        this.game.trainPlaced?.(m.a);
        break;
      case 'ctns':
        if (Array.isArray(m.l)) this.game.cartons?.applyState(m.l.slice(0, 2000));
        break;
      case 'ctngive':
        if (Array.isArray(m.l)) this.game.cartonGive?.(m.l.slice(0, 64).filter((s) => s && int(s.id) && int(s.n) && s.n > 0));
        break;
      case 'pod': {
        const p = podPlan(m);
        if (p) this.game.podCrash?.(p);
        break;
      }
      case 'boom':
        if ([m.x, m.y, m.z].every(num)) this.game.tnt.boomEffects(m.x, m.y + 0.5, m.z, { player: this.game.player }, Math.max(0, Math.min(3, m.b | 0)));
        break;
      case 'time':
        if (num(m.v)) this.game.setTime(m.v);
        if (int(m.d)) this.game.setDays(m.d);
        if (m.w) this.game.setPressures(m.w); // (centres de pression de /weather)
        if (m.pvp !== undefined) this.pvp = m.pvp === 1;
        break;
      case 'chat':
        this.game.chat(`<${m.name}> ${m.text}`, 'chat');
        break;
      case 'sys':
        this.game.chat(m.text, 'sys');
        break;
      case 'err':
        this.game.chat(m.text, 'err');
        break;
      case 'join':
        if (!this.remotes.has(m.pid)) this.remotes.set(m.pid, new RemotePlayer(this.game.scene, m.pid, m.name, m.col, m.sk, m.cl));
        break;
      case 'vc':
        if (int(m.p) && this.remotes.has(m.p)) this.game.voice?.receive(m.p, m.d);
        break;
      case 'leave':
        this.remotes.get(m.pid)?.dispose();
        this.remotes.delete(m.pid);
        break;
      case 'list':
        this.list = m.l || [];
        this.game.playersChanged();
        break;
      case 'ping':
        this.csend({ t: 'pong', s: m.s });
        break;
    }
  }

  // Le chariot dans lequel on est assis : l'hôte a-t-il confirmé (ou l'a-t-il retiré) ?
  checkRide() {
    const { player, carts } = this.game;
    const cart = player.riding;
    if (!cart || cart.isTrain) return; // (la cabine d'un train : voir trains.applyState)
    const gone = !carts.carts.includes(cart);
    const other = cart.riderPid !== this.myPid && performance.now() - (this.rideSince || 0) > 1500;
    if (gone || other) {
      if (!gone) carts.dismount(player);
      else player.riding = null;
    }
  }

  clientTick(dt, input) {
    const { player } = this.game;
    if (this.outBlocks.length) {
      this.csend({ t: 'blocks', l: this.outBlocks });
      this.outBlocks = [];
    }
    this.sendClock += dt;
    if (this.sendClock >= SEND_RATE) {
      this.sendClock = 0;
      const r = (v) => Math.round(v * 1000) / 1000;
      this.csend({ t: 'pos', x: r(player.pos.x), y: r(player.pos.y), z: r(player.pos.z), yaw: r(player.yaw), pitch: r(player.pitch), f: input.forward ? 1 : 0, b: input.back ? 1 : 0, h: this.game.held() | 0, s: player.sneak ? 1 : 0, w: player.hat | 0 });
    }
  }

  // Actions sur les chariots, envoyées à l'hôte (qui les simule)
  cartAction(a, data = {}) {
    const { player, carts } = this.game;
    if (a === 'mount') {
      const cart = data.cart;
      if (!cart || player.riding || (cart.riderPid ?? -1) >= 0) return;
      this.csend({ t: 'cart', a, id: cart.id });
      cart.rider = player;
      player.riding = cart;
      player.fly = false;
      this.rideSince = performance.now();
      return;
    }
    if (a === 'dismount') {
      if (!player.riding) return;
      this.csend({ t: 'cart', a });
      carts.dismount(player);
      return;
    }
    if (a === 'remove') { this.csend({ t: 'cart', a, id: data.cart.id }); return; }
    if (a === 'spawn') this.csend({ t: 'cart', a, q: data.q, r: data.r, y: data.y, yaw: data.yaw });
  }

  // ================= Commun =================
  onEvent(ev) {
    if (this.mode === 'host') { this.hostEvent(ev); return; }
    if (ev.kind === 'cmsg') {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m && typeof m.t === 'string') this.clientMessage(m);
      return;
    }
    if (ev.kind === 'cclose') {
      const reason = this.byeReason || ev.reason || 'Connexion perdue avec le serveur';
      if (this.pendingJoin) { this.finishJoin({ ok: false, error: reason }); return; }
      if (this.mode === 'client') {
        this.reset();
        this.game.disconnected(reason);
      }
    }
  }

  sendChat(text) {
    if (this.mode === 'host') this.handleChat(null, text);
    else if (this.mode === 'client') {
      text = text.trim().slice(0, 200);
      if (text) this.csend({ t: 'chat', text });
    }
  }

  // Appelé à chaque image pendant une partie en ligne
  update(dt, input) {
    if (this.mode === 'host') this.hostTick(dt);
    else if (this.mode === 'client') this.clientTick(dt, input);
    for (const rp of this.remotes.values()) rp.update(dt);
  }

  // Hôte : pseudo du joueur distant de ce proxy
  proxyName(p) {
    for (const c of this.clients.values()) if (c.proxy === p) return c.name;
    return '';
  }

  // Hôte : un villageois parle, tout le monde l'entend
  villagerSaid(a, k) {
    if (this.mode === 'host') this.broadcastJoined({ t: 'vsay', id: a.id, k: PHRASE_KEYS.indexOf(k) });
  }

  // Joueurs distants pour la simulation des chariots (hôte)
  proxies() {
    if (this.mode !== 'host') return [];
    return [...this.clients.values()].filter((c) => c.joined).map((c) => c.proxy);
  }

  // Un joueur distant occupe-t-il cette case ? (on ne pose pas de bloc dans quelqu'un)
  occupies(q, r, y) {
    const c = hexToWorld(q, r);
    for (const rp of this.remotes.values()) {
      const p = rp.pos;
      if (y + 1 <= p.y || y >= p.y + HEIGHT) continue;
      if (circleHexOverlap(p.x - c.x, p.z - c.z, RADIUS - 0.01)) return true;
    }
    return false;
  }

  // Notre voix (chat vocal) : à l'hôte, ou (hôte) aux joueurs proches
  sendVoice(list) {
    if (this.mode === 'client') this.csend({ t: 'vc', d: list });
    else if (this.mode === 'host') this.relayVoice(0, this.game.player.pos, list);
  }

  // Hôte : voix du joueur pid (à la position from) aux joueurs à portée
  relayVoice(pid, from, list) {
    const far = (VOICE_RANGE + 4) ** 2;
    let text = null;
    for (const c of this.clients.values()) {
      if (!c.joined || c.pid === pid || c.proxy.pos.distanceToSquared(from) > far) continue;
      text ||= JSON.stringify({ t: 'vc', p: pid, d: list });
      this.raw(c.cid, text);
    }
    if (pid !== 0 && this.game.player.pos.distanceToSquared(from) <= far) this.game.voice?.receive(pid, list);
  }

  leave() {
    if (this.mode === 'host') this.stopHost();
    else if (this.mode === 'client' || this.mode === 'connecting') {
      this.cancelCodeJoin();
      this.closeClientLink();
      this.reset();
    }
  }

  reset() {
    this.mode = 'off';
    this.game.voice?.reset();
    this.voiceCount.clear();
    for (const rp of this.remotes.values()) rp.dispose();
    this.remotes.clear();
    this.clients = new Map();
    this.list = [];
    this.outBlocks = [];
    this.game.world.onBlockSet = null;
    this.game.world.simulateWater = true;
    this.game.carts.remote = false;
    if (this.game.cartons) this.game.cartons.remote = false;
    if (this.game.trains) this.game.trains.remote = false;
    this.game.tnt.remote = false;
    this.game.tnt.onExplode = null;
    this.game.structs.remote = false;
    this.game.structs.onChange = null;
    this.game.animals.remote = false;
    this.boxWatch.clear();
    this.lastHurt.clear();
    this.pvp = true;
    this.game.playersChanged();
  }
}
