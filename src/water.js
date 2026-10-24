// Eau : un shader léger, sans texture ni passe de rendu supplémentaire.
//  - vagues : quelques ondes sinusoïdales calculées sur la carte graphique ; en pleine mer, de
//    vraies vagues (waves.js) qui suivent le vent et la météo, avec de l'écume sur les crêtes
//  - reflet du ciel selon l'angle de vue (Fresnel : plus on regarde en rasant, plus ça reflète)
//  - reflet brillant du soleil ou de la lune (spéculaire)
//  - profondeur calculée à la construction du chunk (attribut "depth") :
//    eau claire et transparente au bord, sombre et opaque au large, écume sur les rives
import * as THREE from 'three';
import { WAVE_GLSL, MAX_TORNADOES } from './waves.js?v=1.1.5-alpha-mvm2b95g';

export function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uAmbient: { value: new THREE.Color(0.5, 0.5, 0.5) },
        uSkyTop: { value: new THREE.Color() },
        uSkyHorizon: { value: new THREE.Color() },
        uWaveAmp: { value: 0.05 },
        uWaveDir: { value: new THREE.Vector2(1, 0) },
        uChaos: { value: 0 },
        uTor: { value: Array.from({ length: MAX_TORNADOES }, () => new THREE.Vector3()) }, // x, z, force
      },
    ]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute float depth;
      attribute vec2 flow;
      attribute float ice;
      uniform float uTime;
      varying float vIce;
      varying vec3 vWorld;
      varying float vDepth;
      varying float vTop;
      varying vec2 vFlow;
      varying float vSea;
      varying float vCrest;
      ${WAVE_GLSL}
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vTop = normal.y;
        vFlow = flow;
        vIce = ice;
        // légère houle sur la surface. Elle s'applique à TOUS les sommets de surface (dessus
        // ET haut des côtés, reconnus à leur hauteur non entière) : la surface et les côtés
        // bougent ensemble, sans fente entre eux. Le fond (hauteur entière) ne bouge pas.
        vSea = 0.0;
        vCrest = 0.0;
        if (fract(position.y) > 0.001) {
          world.y += (sin(world.x * 0.9 + uTime * 1.3) + sin(world.z * 1.1 - uTime * 1.1)) * 0.025 - 0.05;
          // vagues de pleine mer (en eau profonde). Au loin (terrain simplifié, sommets
          // espacés) la surface reste plate : seule la lumière montre les vagues.
          vSea = seaFactor(depth);
          vec2 gr;
          float wh = (seaWave(world.xz, gr) + torWater(world.xz)) * vSea;
          world.y += wh * (1.0 - smoothstep(70.0, 130.0, distance(world.xz, cameraPosition.xz)));
          vCrest = wh / max(uWaveAmp, 0.02);
        }
        vWorld = world.xyz;
        vDepth = depth;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDir, uSunColor, uAmbient, uSkyTop, uSkyHorizon;
      varying vec3 vWorld;
      varying float vDepth;
      varying float vTop;
      varying vec2 vFlow;
      varying float vIce;
      varying float vSea;
      varying float vCrest;
      ${WAVE_GLSL}

      // pente de la surface : somme de 5 ondes (direction, fréquence, vitesse, amplitude)
      vec2 wave(vec2 p, vec2 d, float f, float s, float a) {
        return d * (f * a * cos(dot(d, p) * f + uTime * s));
      }

      void main() {
        // le motif des vagues glisse dans le sens du courant
        float flowing = min(length(vFlow) * 3.0, 1.0);
        vec2 p = vWorld.xz - vFlow * uTime * 2.5;
        vec2 g = wave(p, vec2(0.80, 0.60), 0.9, 1.2, 0.10)
               + wave(p, vec2(-0.55, 0.83), 1.7, 1.6, 0.06)
               + wave(p, vec2(0.28, -0.96), 3.1, 2.3, 0.035)
               + wave(p, vec2(-0.92, -0.38), 5.3, 3.1, 0.02)
               + wave(p, vec2(0.70, -0.71), 8.9, 4.2, 0.012);
        // pente des vagues de pleine mer (la même formule que leur hauteur)
        if (vSea > 0.001 && vTop > 0.5) {
          vec2 gr; seaWave(vWorld.xz, gr); g += gr * vSea;
          // pente de l'eau soulevée par une tornade (différences finies : seulement près d'elle)
          if (torNear(vWorld.xz) > 0.01) {
            const float e = 0.35;
            g += vec2(torWater(vWorld.xz + vec2(e, 0.0)) - torWater(vWorld.xz - vec2(e, 0.0)),
                      torWater(vWorld.xz + vec2(0.0, e)) - torWater(vWorld.xz - vec2(0.0, e))) / (2.0 * e) * vSea;
          }
        }
        vec3 n = vTop > 0.5 ? normalize(vec3(-g.x, 1.0, -g.y)) : normalize(vec3(-g.x * 0.3, 0.0, 1.0));

        vec3 v = normalize(cameraPosition - vWorld);
        if (dot(n, v) < 0.0 && vTop > 0.5) n = -n;         // vue depuis le dessous
        float ndv = max(dot(n, v), 0.0);
        float fresnel = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);

        // couleur de l'eau : claire au bord, profonde au large
        float deep = 1.0 - exp(-vDepth * 0.55);
        // (eau glaciale : bleu ciel, plus claire même au large)
        vec3 shallowCol = mix(vec3(0.10, 0.42, 0.45), vec3(0.55, 0.86, 0.98), vIce);
        vec3 deepCol = mix(vec3(0.01, 0.07, 0.16), vec3(0.16, 0.45, 0.68), vIce);
        vec3 body = mix(shallowCol, deepCol, deep) * uAmbient;

        // reflet du ciel
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.6, r.y));
        vec3 col = mix(body, sky, fresnel);

        // reflet du soleil / de la lune
        vec3 hv = normalize(uSunDir + v);
        float spec = pow(max(dot(n, hv), 0.0), 220.0) * 3.0 + pow(max(dot(n, hv), 0.0), 40.0) * 0.15;
        col += uSunColor * spec * step(0.0, uSunDir.y);

        // écume près des rives
        float foamLine = sin(dot(p, vec2(1.7, 2.3)) + uTime * 1.5) * 0.08;
        float foam = (1.0 - smoothstep(0.0, 0.45, vDepth + foamLine)) * 0.55;
        col = mix(col, uAmbient * 1.3, foam);
        // moutons d'écume sur les crêtes quand la mer est forte
        // (seulement sur les plus hautes crêtes, en taches irrégulières qui se défont)
        float caps = smoothstep(0.75, 1.15, vCrest) * smoothstep(0.35, 0.9, uWaveAmp) * vSea;
        caps *= clamp(sin(dot(vWorld.xz, vec2(0.83, 0.57)) * 1.7 + uTime * 0.9) * sin(dot(vWorld.xz, vec2(-0.41, 0.91)) * 2.3 - uTime * 0.6) + 0.25, 0.0, 1.0);
        caps *= 0.55;
        // sous une tornade : l'eau blanchit d'écume et d'embruns
        caps = max(caps, torFoam(vWorld.xz) * vSea * 0.85);
        col = mix(col, uAmbient * 1.2, caps);
        foam = max(foam, caps * 0.8);

        // eau qui coule : un peu d'écume en surface ; chutes d'eau : stries qui descendent
        col = mix(col, uAmbient * 1.2, flowing * 0.12 * (0.5 + 0.5 * sin(dot(p, vec2(3.0, 2.0)) * 2.0)));
        if (vTop < 0.5) {
          float streak = 0.5 + 0.5 * sin(vWorld.y * 3.0 + uTime * 9.0 + (vWorld.x + vWorld.z) * 7.0);
          col = mix(body * 1.6, uAmbient * 1.1, streak * 0.35);
          deep = 0.6;
        }

        float alpha = clamp(mix(0.45, 0.93, deep) + fresnel * 0.4 + foam, 0.0, 0.97);
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
