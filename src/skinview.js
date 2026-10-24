// Aperçu 3D du personnage (écran titre) : il tourne doucement, suit la souris des yeux, et se
// fait tourner en le glissant à la souris.
import * as THREE from 'three';
import { buildCharacter } from './character.js?v=1.1.5-alpha-mvm2b95g';

export class SkinView {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    this.camera.position.set(0, 1.05, 4.4);
    this.camera.lookAt(0, 0.92, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 3, 4);
    this.scene.add(sun);
    this.turn = new THREE.Group();
    this.scene.add(this.turn);
    this.yaw = -0.45;
    this.spin = 0;          // vitesse donnée en lâchant le glisser
    this.drag = null;
    this.look = { x: 0, y: 0 };
    this.running = false;
    this.url = null;
    this.clock = new THREE.Clock();

    canvas.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, t: performance.now() }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, now = performance.now();
      this.yaw += dx * 0.012;
      this.spin = (dx * 0.012) / Math.max(0.008, (now - this.drag.t) / 1000);
      this.drag = { x: e.clientX, t: now };
    });
    const up = () => { this.drag = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.look.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 500));
      this.look.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.2)) / 400));
    });
  }

  // style : 'hex' (comme dans le jeu) ou 'box' (pavés, style Minecraft)
  async setSkin(url, style = this.style || 'hex') {
    if (url === this.url && style === this.style) return;
    this.url = url;
    this.style = style;
    const c = await buildCharacter(url, style);
    if (url !== this.url || style !== this.style) return; // (une autre skin a été choisie entre-temps)
    this.turn.clear();
    this.turn.add(c);
    this.parts = c.userData.parts;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.frame(Math.min(this.clock.getDelta(), 0.1));
    };
    loop();
  }

  stop() { this.running = false; }

  frame(dt) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    const p = this.parts, t = performance.now() / 1000;
    // élan après un glisser, puis il revient vers nous en se balançant doucement
    if (!this.drag) {
      this.spin *= Math.exp(-dt * 3);
      this.yaw += this.spin * dt;
      if (Math.abs(this.spin) < 0.5) {
        let d = 0.3 * Math.sin(t * 0.5) - 0.2 - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * Math.min(1, dt * 1.5);
      }
    }
    this.turn.rotation.y = this.yaw + Math.PI; // (le personnage regarde -Z : on le tourne vers la caméra)
    if (p) {
      // respiration, bras qui se balancent un peu, tête qui suit la souris
      p.armR.rotation.x = Math.sin(t * 1.3) * 0.06;
      p.armL.rotation.x = -Math.sin(t * 1.3) * 0.06;
      p.armR.rotation.z = 0.05 + Math.sin(t * 0.9) * 0.03;
      p.armL.rotation.z = -0.05 - Math.sin(t * 0.9) * 0.03;
      const face = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw)); // (le corps tourne : la tête compense)
      const want = Math.max(-0.9, Math.min(0.9, this.look.x * 0.9 - face));
      p.head.rotation.y += (want - p.head.rotation.y) * Math.min(1, dt * 8);
      p.head.rotation.x += (-this.look.y * 0.5 - p.head.rotation.x) * Math.min(1, dt * 8);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
