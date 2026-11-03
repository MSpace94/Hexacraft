// Chat vocal de proximité (multijoueur). Le micro est compressé en Opus (WebCodecs), envoyé à
// l'hôte par la connexion de la partie, et l'hôte le transmet aux joueurs assez proches
// (RANGE blocs). Chacun entend les autres en 3D : la voix vient de leur personnage et baisse avec
// la distance, jusqu'au silence à RANGE blocs.
// Modes : 0 désactivé, 1 appuyer pour parler (touche B), 2 toujours actif (on ne transmet que
// quand on parle : seuil de volume).
export const RANGE = 40;           // portée de la voix (blocs)
const RATE = 48000;
const FRAME = 960;                 // 20 ms par paquet Opus
const BATCH = 3;                   // paquets envoyés ensemble (60 ms)
const BITRATE = 24000;
const OPEN_LEVEL = 0.012;          // mode « toujours actif » : volume (RMS) à partir duquel on parle
const HANG = 0.35;                 // ... et on continue encore un peu après (s)
const LEAD = 0.12;                 // avance de lecture : absorbe les irrégularités du réseau (s)

export const VOICE_MODES = ['Désactivé', 'Appuyer pour parler (B)', 'Toujours actif'];

// Petit processeur audio : regroupe les échantillons du micro par paquets de FRAME
const WORKLET = `
class Grab extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(${FRAME}); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === ${FRAME}) { this.port.postMessage(this.buf.slice()); this.n = 0; }
    }
    return true;
  }
}
registerProcessor('hexa-grab', Grab);`;

const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const fromB64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };

export const voiceSupported = () => typeof AudioEncoder === 'function' && typeof AudioDecoder === 'function' && !!navigator.mediaDevices?.getUserMedia;

export class Voice {
  constructor() {
    this.mode = 0;
    this.volume = 1;
    this.ptt = false;        // touche B enfoncée
    this.talking = false;    // on transmet en ce moment
    this.ctx = null;
    this.mic = null;         // flux du micro
    this.encoder = null;
    this.out = [];           // paquets en attente d'envoi
    this.speakers = new Map(); // pid -> { decoder, panner, next, until }
    this.send = null;        // (paquets base64) => envoi à la partie
    this.error = '';
    this.loud = 0;           // dernier instant où le micro dépassait le seuil
    this.starting = null;
  }

  audio() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: RATE, latencyHint: 'interactive' });
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    if (this.gain) this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015);
  }

  // Micro allumé (en partie, mode activé) ; renvoie false si impossible
  async start() {
    if (this.mic || !this.mode) return !!this.mic;
    if (!voiceSupported()) { this.error = 'Chat vocal impossible ici (application uniquement)'; return false; }
    if (this.starting) return this.starting;
    this.starting = (async () => {
      try {
        const ctx = this.audio();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        if (!this.mode) { stream.getTracks().forEach((t) => t.stop()); return false; }
        if (!this.workletReady) {
          const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
          await ctx.audioWorklet.addModule(url);
          URL.revokeObjectURL(url);
          this.workletReady = true;
        }
        this.encoder = new AudioEncoder({
          output: (chunk) => {
            const u8 = new Uint8Array(chunk.byteLength);
            chunk.copyTo(u8);
            this.out.push(toB64(u8));
            if (this.out.length >= BATCH) this.flush();
          },
          error: () => { this.error = 'Erreur du codage de la voix'; },
        });
        this.encoder.configure({ codec: 'opus', sampleRate: RATE, numberOfChannels: 1, bitrate: BITRATE });
        this.src = ctx.createMediaStreamSource(stream);
        this.node = new AudioWorkletNode(ctx, 'hexa-grab');
        this.node.port.onmessage = (e) => this.onFrame(e.data);
        this.src.connect(this.node);
        // (le processeur doit être relié à une sortie pour tourner : sortie muette)
        this.mute = ctx.createGain();
        this.mute.gain.value = 0;
        this.node.connect(this.mute).connect(ctx.destination);
        this.mic = stream;
        this.ts = 0;
        this.error = '';
        return true;
      } catch (e) {
        this.error = e?.name === 'NotAllowedError' ? 'Micro refusé (paramètres de confidentialité de Windows)' : e?.name === 'NotFoundError' ? 'Aucun micro trouvé' : 'Micro indisponible';
        return false;
      } finally { this.starting = null; }
    })();
    return this.starting;
  }

  // Micro éteint (on quitte la partie, ou chat vocal désactivé) : Windows n'indique plus le micro
  stop() {
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    try { this.src?.disconnect(); this.node?.disconnect(); this.mute?.disconnect(); } catch { /* déjà fait */ }
    this.src = this.node = this.mute = null;
    try { if (this.encoder?.state === 'configured') this.encoder.close(); } catch { /* déjà fermé */ }
    this.encoder = null;
    this.out = [];
    this.talking = false;
  }

  // Tous les haut-parleurs retirés (fin de partie)
  reset() {
    this.stop();
    for (const pid of [...this.speakers.keys()]) this.drop(pid);
  }

  onFrame(buf) {
    if (!this.encoder || this.encoder.state !== 'configured') return;
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const now = performance.now() / 1000;
    if (Math.sqrt(sum / buf.length) > OPEN_LEVEL) this.loud = now;
    const talk = this.mode === 1 ? this.ptt : this.mode === 2 && now - this.loud < HANG;
    if (!talk) {
      if (this.talking) this.flush();
      this.talking = false;
      return;
    }
    this.talking = true;
    const data = new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: FRAME, numberOfChannels: 1, timestamp: this.ts, data: buf });
    this.ts += (FRAME / RATE) * 1e6;
    this.encoder.encode(data);
    data.close();
  }

  flush() {
    if (!this.out.length) return;
    const list = this.out;
    this.out = [];
    this.send?.(list);
  }

  // ---------- Écoute ----------
  speaker(pid) {
    let s = this.speakers.get(pid);
    if (s) return s;
    const ctx = this.audio();
    const panner = new PannerNode(ctx, {
      panningModel: 'HRTF', distanceModel: 'linear', refDistance: 3, maxDistance: RANGE, rolloffFactor: 1,
    });
    panner.connect(this.gain);
    s = { panner, next: 0, until: 0, ts: 0 };
    s.decoder = new AudioDecoder({
      output: (data) => this.play(s, data),
      error: () => { s.broken = true; },
    });
    s.decoder.configure({ codec: 'opus', sampleRate: RATE, numberOfChannels: 1 });
    this.speakers.set(pid, s);
    return s;
  }

  drop(pid) {
    const s = this.speakers.get(pid);
    if (!s) return;
    try { s.decoder.close(); } catch { /* déjà fermé */ }
    s.panner.disconnect();
    this.speakers.delete(pid);
  }

  // Voix reçue d'un joueur : liste de paquets Opus (base64)
  receive(pid, list) {
    if (!this.mode || !Array.isArray(list)) return;
    let s = this.speaker(pid);
    if (s.broken) { this.drop(pid); s = this.speaker(pid); }
    for (const b64 of list) {
      if (typeof b64 !== 'string' || b64.length > 600) continue;
      try {
        s.decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: s.ts, data: fromB64(b64) }));
        s.ts += (FRAME / RATE) * 1e6;
      } catch { /* paquet abîmé */ }
    }
    s.until = performance.now() + 300;
  }

  play(s, data) {
    const ctx = this.ctx, n = data.numberOfFrames;
    const buf = ctx.createBuffer(1, n, data.sampleRate);
    const ch = new Float32Array(n);
    data.copyTo(ch, { planeIndex: 0, format: 'f32-planar' });
    data.close();
    buf.copyToChannel(ch, 0);
    const now = ctx.currentTime;
    // trop de retard ou trop d'avance (coupure réseau) : on repart avec une petite avance
    if (s.next < now + 0.02 || s.next > now + 0.6) s.next = now + LEAD;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(s.panner);
    src.start(s.next);
    s.next += buf.duration;
  }

  // À chaque image : oreilles à la caméra, voix à la tête de chaque joueur
  update(camera, remotes) {
    if (!this.ctx || !this.speakers.size) return;
    const L = this.ctx.listener, p = camera.position, t = this.ctx.currentTime;
    const f = this.fwd || (this.fwd = { x: 0, y: 0, z: -1 });
    const e = camera.matrixWorld.elements;
    f.x = -e[8]; f.y = -e[9]; f.z = -e[10];
    if (L.positionX) {
      L.positionX.setValueAtTime(p.x, t); L.positionY.setValueAtTime(p.y, t); L.positionZ.setValueAtTime(p.z, t);
      L.forwardX.setValueAtTime(f.x, t); L.forwardY.setValueAtTime(f.y, t); L.forwardZ.setValueAtTime(f.z, t);
      L.upX.setValueAtTime(e[4], t); L.upY.setValueAtTime(e[5], t); L.upZ.setValueAtTime(e[6], t);
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(f.x, f.y, f.z, e[4], e[5], e[6]);
    }
    for (const [pid, s] of this.speakers) {
      const rp = remotes.get(pid);
      if (!rp) { this.drop(pid); continue; }
      s.panner.positionX.setValueAtTime(rp.pos.x, t);
      s.panner.positionY.setValueAtTime(rp.pos.y + 1.5, t);
      s.panner.positionZ.setValueAtTime(rp.pos.z, t);
    }
  }

  // Ce joueur parle-t-il en ce moment ? (icône au-dessus de sa tête)
  speaking(pid) {
    const s = this.speakers.get(pid);
    return !!s && performance.now() < s.until;
  }
}
