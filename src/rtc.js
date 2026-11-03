// Connexion directe entre deux PC par internet (WebRTC), sans box à régler ni programme à
// installer : l'hôte reçoit un code court (HX-…), son ami le tape (voir hostShortCode). Des
// serveurs STUN publics servent seulement à trouver un chemin entre les deux box : la partie
// elle-même passe directement d'un PC à l'autre.

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
const CHUNK = 16000;        // taille max d'un morceau de message
const FRAG = '\u0001';      // début d'un morceau : FRAG k/n SEP données
const SEP = '\u0002';

// ---------- Liaison : messages texte, découpés si trop gros ----------
export class Link {
  constructor(pc, dc) {
    this.pc = pc;
    this.dc = dc;
    this.queue = [];
    this.parts = null;
    this.onmessage = null;
    this.onclose = null;
    this.isClosed = false;
    dc.bufferedAmountLowThreshold = 1 << 20;
    dc.onbufferedamountlow = () => this.pump();
    dc.onmessage = (e) => this.receive(e.data);
    dc.onclose = () => this.close();
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.close();
    });
  }

  send(text) {
    if (this.isClosed) return;
    if (text.length <= CHUNK) this.queue.push(text);
    else {
      const n = Math.ceil(text.length / CHUNK);
      for (let k = 0; k < n; k++) this.queue.push(FRAG + k + '/' + n + SEP + text.slice(k * CHUNK, (k + 1) * CHUNK));
    }
    this.pump();
  }

  pump() {
    while (this.queue.length && this.dc.readyState === 'open' && this.dc.bufferedAmount < (4 << 20)) {
      this.dc.send(this.queue.shift());
    }
  }

  receive(data) {
    if (typeof data !== 'string') return;
    if (data[0] !== FRAG) { this.onmessage?.(data); return; }
    const sep = data.indexOf(SEP);
    const [k, n] = data.slice(1, sep).split('/').map(Number);
    if (k === 0) this.parts = [];
    if (!this.parts) return;
    this.parts.push(data.slice(sep + 1));
    if (k === n - 1) {
      const full = this.parts.join('');
      this.parts = null;
      this.onmessage?.(full);
    }
  }

  close() {
    if (this.isClosed) return;
    this.isClosed = true;
    try { this.dc.close(); } catch { /* ignoré */ }
    try { this.pc.close(); } catch { /* ignoré */ }
    this.onclose?.();
  }
}

function opened(dc, pc, ms) {
  return new Promise((resolve, reject) => {
    if (dc.readyState === 'open') { resolve(); return; }
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    dc.addEventListener('open', () => { clearTimeout(t); resolve(); });
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed') { clearTimeout(t); reject(new Error('failed')); }
    });
  });
}

export const CONNECT_ERROR = 'Connexion directe impossible entre vos deux réseaux (certaines connexions comme le partage 4G la bloquent). Essayez un VPN comme Radmin VPN.';

// ---------- Code court (mise en relation automatique) ----------
// L'hôte reçoit un code court (HX-4K7P2Q) ; l'ami le tape et c'est tout. Pour que les deux PC
// se trouvent, le jeu passe par le service public gratuit de PeerJS (0.peerjs.com) : il ne
// transmet que les descriptions de connexion (comme les codes d'invitation), la partie
// elle-même passe directement d'un PC à l'autre. Les chemins possibles sont envoyés au fur
// et à mesure, dans les deux sens : plus de délai à respecter pour coller un code.
const BROKER = 'wss://0.peerjs.com:443/peerjs?key=peerjs&version=1.5.4';
const SHORT_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // sans 0/O, 1/I/L
const SHORT_LEN = 6;
const ID_CHARS = 'abcdefghijkmnopqrstuvwxyz23456789';
const hostId = (code) => 'hexacraft-' + code.toLowerCase();
const rand = (n, chars) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => chars[b % chars.length]).join('');

// Lit un code tapé par le joueur (« hx-4k7p2q », « 4K7P 2Q »...) ; null s'il est invalide
export function parseShortCode(text) {
  const c = String(text || '').toUpperCase().replace(/^\s*HX/, '').replace(/[^0-9A-Z]/g, '');
  return c.length === SHORT_LEN && [...c].every((ch) => SHORT_CHARS.includes(ch)) ? c : null;
}

// Connexion au service de mise en relation sous le nom id
function openBroker(id) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BROKER + '&id=' + encodeURIComponent(id) + '&token=' + rand(10, ID_CHARS));
    const b = {
      onmessage: null, onclose: null, closed: false,
      send(type, dst, payload) { if (ws.readyState === 1) ws.send(JSON.stringify({ type, payload, dst })); },
      close() { b.closed = true; clearInterval(beat); try { ws.close(); } catch { /* ignoré */ } },
    };
    // sans nouvelles pendant une minute, le service ferme la connexion
    const beat = setInterval(() => { if (ws.readyState === 1) ws.send('{"type":"HEARTBEAT"}'); }, 5000);
    const timer = setTimeout(() => {
      b.close();
      reject(new Error('Le service de mise en relation ne répond pas (vérifie ta connexion internet)'));
    }, 10000);
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'OPEN') { clearTimeout(timer); resolve(b); return; }
      if (m.type === 'ID-TAKEN') { clearTimeout(timer); b.close(); reject(Object.assign(new Error('pris'), { taken: true })); return; }
      if (m.type === 'ERROR') { clearTimeout(timer); b.close(); reject(new Error('Service de mise en relation : ' + (m.payload?.msg || 'erreur'))); return; }
      b.onmessage?.(m);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      clearInterval(beat);
      clearTimeout(timer);
      if (b.closed) return;
      b.closed = true;
      reject(new Error('Impossible de joindre le service de mise en relation (vérifie ta connexion internet)'));
      b.onclose?.();
    };
  });
}

// Envoie chaque chemin trouvé à l'autre joueur ; ceux reçus avant sa description attendent
function trickle(pc, broker, dst, connectionId) {
  const waiting = [];
  pc.onicecandidate = (e) => {
    if (e.candidate && e.candidate.candidate) broker.send('CANDIDATE', dst, { candidate: e.candidate.toJSON(), type: 'data', connectionId });
  };
  return {
    add(c) {
      if (!c?.candidate) return;
      if (pc.remoteDescription) pc.addIceCandidate(c).catch(() => {});
      else waiting.push(c);
    },
    flush() { for (const c of waiting.splice(0)) pc.addIceCandidate(c).catch(() => {}); },
  };
}

// ---------- Hôte : ouvre un code court. onLink(link) à chaque ami connecté ----------
export async function hostShortCode(onLink) {
  let code, broker;
  for (let i = 0; !broker; i++) {
    code = rand(SHORT_LEN, SHORT_CHARS);
    try {
      broker = await openBroker(hostId(code));
    } catch (err) {
      if (!err.taken || i >= 4) throw err; // code déjà pris par une autre partie : on en tire un autre
    }
  }
  const peers = new Map(); // connectionId -> { pc, ice }
  broker.onmessage = async (m) => {
    const p = m.payload || {};
    if (m.type === 'OFFER' && typeof p.connectionId === 'string' && !peers.has(p.connectionId) && p.sdp?.type === 'offer') {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const ice = trickle(pc, broker, m.src, p.connectionId);
      peers.set(p.connectionId, { pc, ice });
      const forget = () => { if (peers.get(p.connectionId)?.pc === pc) peers.delete(p.connectionId); };
      pc.ondatachannel = (e) => {
        const dc = e.channel;
        opened(dc, pc, 30000).then(() => { forget(); onLink(new Link(pc, dc)); }, () => { forget(); pc.close(); });
      };
      // pas connecté au bout d'une minute : abandon
      setTimeout(() => { if (peers.get(p.connectionId)?.pc === pc) { forget(); pc.close(); } }, 60000);
      try {
        await pc.setRemoteDescription(p.sdp);
        ice.flush();
        await pc.setLocalDescription(await pc.createAnswer());
        broker.send('ANSWER', m.src, { sdp: pc.localDescription.toJSON(), type: 'data', connectionId: p.connectionId, browser: 'chrome' });
      } catch {
        forget();
        pc.close();
      }
    } else if (m.type === 'CANDIDATE') {
      peers.get(p.connectionId)?.ice.add(p.candidate);
    }
  };
  return {
    code: 'HX-' + code,
    close() {
      broker.close();
      for (const { pc } of peers.values()) pc.close();
      peers.clear();
    },
  };
}

// ---------- Ami : rejoint avec le code court. Renvoie { link: Promise<Link>, cancel } ----------
export async function joinShortCode(text) {
  const code = parseShortCode(text);
  if (!code) throw new Error('Code invalide : il ressemble à HX-4K7P2Q (6 lettres et chiffres après HX-)');
  const broker = await openBroker('hexacraft-c-' + rand(12, ID_CHARS));
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const dc = pc.createDataChannel('hexacraft', { ordered: true });
  const connectionId = 'dc_' + rand(10, ID_CHARS);
  const dst = hostId(code);
  const ice = trickle(pc, broker, dst, connectionId);
  let fail;
  const failed = new Promise((_, rej) => { fail = rej; });
  failed.catch(() => {});
  broker.onmessage = async (m) => {
    const p = m.payload || {};
    if (m.type === 'EXPIRE') {
      fail(new Error('Aucune partie ouverte avec ce code : vérifie le code, et que l\'hôte a bien ouvert son monde en multijoueur.'));
    } else if (p.connectionId !== connectionId) {
      // message d'une autre connexion : ignoré
    } else if (m.type === 'ANSWER' && p.sdp?.type === 'answer') {
      try { await pc.setRemoteDescription(p.sdp); ice.flush(); } catch { fail(new Error(CONNECT_ERROR)); }
    } else if (m.type === 'CANDIDATE') ice.add(p.candidate);
  };
  broker.onclose = () => { if (pc.connectionState !== 'connected') fail(new Error('Connexion au service de mise en relation perdue')); };
  await pc.setLocalDescription(await pc.createOffer());
  broker.send('OFFER', dst, {
    sdp: pc.localDescription.toJSON(), type: 'data', connectionId, label: connectionId, reliable: true, serialization: 'none', browser: 'chrome',
  });
  const link = (async () => {
    try {
      await Promise.race([opened(dc, pc, 40000), failed]);
    } catch (err) {
      pc.close();
      throw (err.message === 'timeout' || err.message === 'failed') ? new Error(CONNECT_ERROR) : err;
    } finally {
      broker.close(); // connectés (ou abandon) : la mise en relation n'est plus utile
    }
    return new Link(pc, dc);
  })();
  link.catch(() => {});
  return {
    link,
    cancel: () => { broker.close(); try { pc.close(); } catch { /* ignoré */ } fail(new Error('Annulé')); },
  };
}
