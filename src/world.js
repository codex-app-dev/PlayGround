import * as THREE from 'three';
import {
  TRACK_LENGTH, halfWidth, pathX, pathSlope, wallHeight, noise2, noise1,
  clamp, smoothstep
} from './track.js';

const TAU = Math.PI * 2;

function srgb(hex) {
  return new THREE.Color(hex).convertSRGBToLinear();
}

function makeGlowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,.72)');
  grad.addColorStop(0.48, 'rgba(255,255,255,.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const GLOW_TEX = makeGlowTexture();

function makeFloorTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#07050e';
  g.fillRect(0, 0, size, size);
  // subtle dusty noise
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * 0.06;
    g.fillStyle = `rgba(${120 + Math.random() * 80},${90 + Math.random() * 50},${160 + Math.random() * 60},${a})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  g.strokeStyle = 'rgba(46,242,255,.34)';
  g.lineWidth = 1;
  for (let y = 0; y <= size; y += 32) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(size, y); g.stroke();
  }
  g.strokeStyle = 'rgba(255,47,146,.15)';
  for (let x = 0; x <= size; x += 64) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size); g.stroke();
  }
  g.strokeStyle = 'rgba(46,242,255,.65)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 1); g.lineTo(size, 1); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ */
/* sky                                                                  */
/* ------------------------------------------------------------------ */

function buildSky() {
  const group = new THREE.Group();
  group.name = 'sky';
  const uniforms = {
    sunDir: { value: new THREE.Vector3(-0.16, 0.245, -0.955).normalize() },
    horizon: { value: new THREE.Color('#2a1547') },
    zenith: { value: new THREE.Color('#050411') },
    sunColor: { value: new THREE.Color('#ff7a52') },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 sunDir;
      uniform vec3 horizon;
      uniform vec3 zenith;
      uniform vec3 sunColor;

      float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 p){
        vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){s+=a*noise(p);p*=2.07;a*=.5;} return s; }

      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.15, 1.0);
        vec3 col = mix(horizon, zenith, smoothstep(-0.02, 0.72, h));
        col += vec3(.19,.05,.15) * smoothstep(.075, .0, abs(h - .02)) * .9;
        float sd = max(dot(d, sunDir), 0.0);
        float disc = smoothstep(.99915, .99965, sd);
        float halo = pow(sd, 14.0);
        float wide = pow(sd, 2.4);
        col += sunColor * (disc * 2.8 + halo * .58 + wide * .10);
        // streaky high cloud bands
        float band = fbm(vec3(d.x*3.2, d.y*12.0, d.z*3.2) + vec3(0.0, 0.0, 1.5));
        float cloud = smoothstep(.48,.72,band) * smoothstep(.02,.22,h) * smoothstep(.6,.18,h);
        col += vec3(.19,.055,.13) * cloud * .45;
        // dark haze at the horizon
        col = mix(col * .52, col, smoothstep(-.08,.045,h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3200, 48, 24), mat);
  dome.frustumCulled = false;
  group.add(dome);

  // stars
  const starCount = 1100;
  const pos = new Float32Array(starCount * 3);
  const col = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * TAU;
    const phi = Math.acos(0.08 + Math.random() * 0.9);
    const r = 2400;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const tint = Math.random();
    col[i * 3] = 0.55 + tint * 0.4;
    col[i * 3 + 1] = 0.68 + tint * 0.25;
    col[i * 3 + 2] = 0.9;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 2.5, sizeAttenuation: true, vertexColors: true, transparent: true,
    opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    toneMapped: false, map: GLOW_TEX, alphaTest: .01
  }));
  stars.frustumCulled = false;
  group.add(stars);

  // sun sprite glare
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW_TEX, color: '#ff9b63', transparent: true, opacity: .72,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, toneMapped: false
  }));
  sun.scale.set(430, 430, 1);
  sun.position.copy(uniforms.sunDir.value).multiplyScalar(2200);
  group.add(sun);

  return { group, stars, sun, uniforms };
}

/* ------------------------------------------------------------------ */
/* canyon                                                               */
/* ------------------------------------------------------------------ */

function buildWall(side) {
  const step = 11;
  const start = -260;
  const count = Math.ceil((TRACK_LENGTH + 700) / step);
  const levels = 8;
  const vertices = [];
  const colors = [];
  const indices = [];

  const cLow = srgb('#211638');
  const cMid = srgb('#3d2459');
  const cHigh = srgb('#6b3668');
  const cRim = srgb('#b65d80');

  for (let i = 0; i <= count; i++) {
    const s = start + i * step;
    const cx = pathX(s);
    const w = halfWidth(s);
    const h = wallHeight(s, side);
    for (let j = 0; j < levels; j++) {
      const t = j / (levels - 1);
      const n = noise2(s * 0.034 + side * 3.7, j * 1.63 + 4.2);
      const n2 = noise2(s * 0.011 + 9.4, j * 0.8);
      const outward = w + Math.pow(t, 1.5) * 21 + (n - 0.5) * 4.4 * (0.25 + t * 0.75);
      const y = -7 + t * (h + 7) + (n2 - 0.5) * 5.5 * t;
      vertices.push(cx + side * outward, y, -s);

      let c;
      if (t < 0.22) c = cLow.clone().lerp(cMid, t / 0.22);
      else if (t < 0.58) c = cMid.clone().lerp(cHigh, (t - 0.22) / 0.36);
      else c = cHigh.clone().lerp(cRim, (t - 0.58) / 0.42);
      const v = 0.88 + n * 0.46 + t * 0.18;
      c.multiplyScalar(v);
      // slight side hue separation
      c.r *= side > 0 ? 1.03 : 0.94;
      c.b *= side > 0 ? 0.92 : 1.08;
      colors.push(c.r, c.g, c.b);
    }
  }

  for (let i = 0; i < count; i++) {
    for (let j = 0; j < levels - 1; j++) {
      const a = i * levels + j;
      const b = a + levels;
      if (side > 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .92, metalness: .08, flatShading: true,
    side: THREE.DoubleSide, envMapIntensity: .35,
    emissive: new THREE.Color('#1a0e30'), emissiveIntensity: .55
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

function buildWallRim(side) {
  const step = 11;
  const start = -260;
  const count = Math.ceil((TRACK_LENGTH + 700) / step);
  const pos = [], col = [], indices = [];
  const ci = new THREE.Color();
  for (let i = 0; i <= count; i++) {
    const s = start + i * step;
    const cx = pathX(s);
    const w = halfWidth(s);
    const h = wallHeight(s, side);
    const n = noise2(s * 0.011 + 9.4, 7 * 0.8);
    const out = w + 21 + (noise2(s * 0.034 + side * 3.7, 7 * 1.63 + 4.2) - .5) * 4.4;
    const y = -7 + (h + 7) + (n - .5) * 5.5;
    pos.push(cx + side * out, y, -s);
    pos.push(cx + side * (out + 0.85), y + 0.55, -s);
    const mix = (Math.sin(s * 0.006 + side * 1.4) * .5 + .5);
    ci.copy(srgb('#ff2f92')).lerp(srgb('#2ef2ff'), mix * .85);
    col.push(ci.r, ci.g, ci.b, ci.r, ci.g, ci.b);
  }
  for (let i = 0; i < count; i++) {
    const a = i * 2;
    if (side > 0) indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    else indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(indices);
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: .86, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

function buildStrata(side, level, color, opacity) {
  const step = 22;
  const start = -160;
  const count = Math.ceil((TRACK_LENGTH + 500) / step);
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const s = start + i * step;
    const cx = pathX(s);
    const w = halfWidth(s);
    const h = wallHeight(s, side);
    const t = level;
    const out = w + Math.pow(t, 1.5) * 21 + (noise2(s * 0.034 + side * 3.7, level * 7 * 1.63 + 4.2) - .5) * 4.4;
    const y = -7 + t * (h + 7) + (noise2(s * 0.011 + 9.4, level * 7 * .8) - .5) * 5.5 * t;
    pts.push(new THREE.Vector3(cx + side * (out + .2), y, -s));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, fog: true
  });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  return line;
}

function buildFloor() {
  const step = 14;
  const start = -260;
  const count = Math.ceil((TRACK_LENGTH + 700) / step);
  const pos = [], uv = [], indices = [], colors = [];
  for (let i = 0; i <= count; i++) {
    const s = start + i * step;
    const cx = pathX(s);
    const w = halfWidth(s) + 3;
    for (const side of [-1, 1]) {
      pos.push(cx + side * w, -0.55, -s);
      uv.push(side < 0 ? 0 : 1, s / 45);
      const n = noise2(s * .03, side * 2.1);
      colors.push(.24 + n * .08, .22 + n * .06, .33 + n * .09);
    }
  }
  for (let i = 0; i < count; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const tex = makeFloorTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: new THREE.Color('#2ef2ff'), emissiveIntensity: .48,
    color: new THREE.Color('#8b8fb8'), roughness: .74, metalness: .3, vertexColors: true,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

function buildEdgeRibbon(side, color, width = .55, lift = .15) {
  const step = 14;
  const start = -260;
  const count = Math.ceil((TRACK_LENGTH + 700) / step);
  const pos = [], indices = [];
  for (let i = 0; i <= count; i++) {
    const s = start + i * step;
    const cx = pathX(s);
    const w = halfWidth(s) + 1.3;
    const off = side * w;
    pos.push(cx + off - width, lift, -s);
    pos.push(cx + off + width, lift, -s);
  }
  for (let i = 0; i < count; i++) {
    const a = i * 2;
    if (side > 0) indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    else indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(indices);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

function buildLaneDashes() {
  const spacing = 17;
  const count = Math.ceil((TRACK_LENGTH + 500) / spacing);
  const geo = new THREE.BoxGeometry(.26, .05, 6.2);
  const mat = new THREE.MeshBasicMaterial({
    color: '#53f6ff', transparent: true, opacity: .62, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const s = -180 + i * spacing;
    dummy.position.set(pathX(s), .02, -s);
    dummy.rotation.y = Math.atan2(-pathSlope(s), 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}


function buildWallLights() {
  const group = new THREE.Group();
  const colors = ['#2ef2ff', '#ff2f92', '#ffb347'];
  for (let s = 120, i = 0; s < 6400; s += 155, i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const w = halfWidth(s);
    const h = 13 + (i % 4) * 4;
    const mat = new THREE.MeshBasicMaterial({
      color: colors[i % 3], transparent: true, opacity: .62,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.14, h, .14), mat);
    bar.position.set(pathX(s) + side * (w - .35), h / 2 + 1, -s);
    bar.rotation.y = Math.atan2(-pathSlope(s), 1);
    group.add(bar);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(.5, .12, .5), mat);
    crown.position.set(pathX(s) + side * (w - .35), h + 1, -s);
    group.add(crown);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEX, color: colors[i % 3], transparent: true, opacity: .38,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    halo.scale.set(4.5, 4.5, 1);
    halo.position.set(pathX(s) + side * (w - .35), h + 1, -s);
    group.add(halo);
  }
  return group;
}

function buildArches() {
  const group = new THREE.Group();
  const materials = [];
  const colors = ['#2ef2ff', '#ff2f92', '#ffb347'];
  for (let s = 190, i = 0; s < 6180; s += 255, i++) {
    const radius = halfWidth(s) + 2.2;
    const color = colors[i % 3];
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: .72, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    });
    materials.push(mat);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, .24, 5, 42, Math.PI), mat);
    arc.position.set(pathX(s), .2, -s);
    arc.rotation.y = Math.atan2(-pathSlope(s), 1);
    group.add(arc);

    const innerMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: .22, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    });
    const inner = new THREE.Mesh(new THREE.TorusGeometry(radius - 1.6, .06, 4, 42, Math.PI), innerMat);
    inner.position.copy(arc.position);
    inner.rotation.copy(arc.rotation);
    group.add(inner);

    // beacon pylon strips at the feet of the arch
    if (i % 2 === 0) {
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(.16, 7, .16), new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        }));
        p.position.set(pathX(s) + side * radius, 3.5, -s);
        group.add(p);
      }
    }
  }
  return { group, materials };
}

function buildMesas() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: '#120d22', roughness: 1, metalness: 0, flatShading: true,
    emissive: new THREE.Color('#1c0a2b'), emissiveIntensity: .35
  });
  for (let i = 0; i < 54; i++) {
    const s = 100 + i * 140 + Math.random() * 80;
    const side = i % 2 === 0 ? -1 : 1;
    const radius = 18 + Math.random() * 26;
    const height = 65 + Math.random() * 100;
    const geo = new THREE.CylinderGeometry(radius * .62, radius, height, 7, 4);
    const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const y = p.getY(j);
      const t = (y + height / 2) / height;
      const k = 1 + (noise2(j * 1.3, i) - .5) * .28;
      p.setX(j, p.getX(j) * k);
      p.setZ(j, p.getZ(j) * k);
      if (t > .92) p.setY(j, y + (noise2(j, i * 3) - .5) * 16);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pathX(s) + side * (halfWidth(s) + 75 + Math.random() * 165), -8, -s);
    m.rotation.y = Math.random() * TAU;
    group.add(m);
  }
  return group;
}

function buildParticles() {
  const count = 700;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * 120;
    positions[i * 3 + 1] = 2 + Math.random() * 46;
    positions[i * 3 + 2] = 30 - Math.random() * 210;
    speeds[i] = .35 + Math.random() * .9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: '#a8e6ff', size: .17, transparent: true, opacity: .42,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    fog: true, map: GLOW_TEX, alphaTest: .01
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, positions, speeds, count, geo, mat };
}

export function createWorld(scene) {
  scene.fog = new THREE.FogExp2(new THREE.Color('#100a22'), .00115);

  const hemi = new THREE.HemisphereLight('#7f8dff', '#2a1033', 2.05);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight('#ff9a68', 2.25);
  sunLight.position.set(-70, 90, 160);
  scene.add(sunLight);
  const fill = new THREE.DirectionalLight('#596dff', 1.35);
  fill.position.set(60, 30, -120);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ff4f8f', .55);
  rim.position.set(-40, 20, -90);
  scene.add(rim);
  scene.add(new THREE.AmbientLight('#392558', .85));

  const sky = buildSky();
  scene.add(sky.group);

  const canyon = new THREE.Group();
  canyon.name = 'canyon';
  canyon.add(buildWall(1));
  canyon.add(buildWall(-1));
  canyon.add(buildWallRim(1));
  canyon.add(buildWallRim(-1));
  canyon.add(buildFloor());
  canyon.add(buildEdgeRibbon(1, '#2ef2ff'));
  canyon.add(buildEdgeRibbon(-1, '#ffb347'));
  canyon.add(buildLaneDashes());
  canyon.add(buildStrata(1, .31, '#ff2f92', .25));
  canyon.add(buildStrata(-1, .31, '#2ef2ff', .22));
  canyon.add(buildStrata(1, .58, '#2ef2ff', .17));
  canyon.add(buildStrata(-1, .58, '#ff2f92', .19));
  canyon.add(buildWallLights());
  scene.add(canyon);

  const arches = buildArches();
  scene.add(arches.group);
  scene.add(buildMesas());

  const dust = buildParticles();
  scene.add(dust.points);

  const state = { time: 0 };

  function update(dt, camera, playerS, speed) {
    state.time += dt;
    sky.group.position.copy(camera.position);
    sky.stars.rotation.y += dt * 0.003;
    sky.sun.material.opacity = .62 + Math.sin(state.time * .4) * .05;

    dust.points.position.set(pathX(playerS), 0, -playerS);
    const arr = dust.positions;
    for (let i = 0; i < dust.count; i++) {
      arr[i * 3 + 2] += speed * dt * dust.speeds[i] * .42;
      if (arr[i * 3 + 2] > 34) {
        arr[i * 3 + 2] -= 240;
        arr[i * 3] = (Math.random() - .5) * 120;
        arr[i * 3 + 1] = 2 + Math.random() * 46;
      }
    }
    dust.geo.attributes.position.needsUpdate = true;

    for (let i = 0; i < arches.materials.length; i++) {
      arches.materials[i].opacity = .60 + Math.sin(state.time * 1.1 + i * .7) * .11;
    }
  }

  return { update, sky, dust, canyon, arches };
}
