import * as THREE from 'three'
import { createTextures } from './textures.js'
import { Builder } from './builder.js'
import { buildSites } from './sites.js'
import { SITES, LAKES, MATCH } from './config.js'
import {
  mulberry32, fbm2, valueNoise2, clamp, smoothstep, lerp, sampleGrid,
  rayAABB, pointInCircle, TAU
} from './utils.js'

export const SUN_DIR = new THREE.Vector3(-0.52, 0.42, 0.62).normalize()
const MAP_SIZE = 760
const MAP_HALF = MAP_SIZE / 2
const CELLS = 256

export class World {
  constructor(scene, quality = 'high') {
    this.scene = scene
    this.quality = quality
    this.size = MAP_SIZE
    this.half = MAP_HALF
    this.cells = CELLS
    this.rng = mulberry32(80231)
    this.lootRng = mulberry32((Date.now() & 0xffff) + 17)
    this.textures = createTextures()
    this.obstacles = []
    this.platforms = []
    this.dynamicObstacles = []
    this.dynamicPlatforms = []
    this.lootPoints = []
    this.botSpawns = []
    this.trees = []
    this.time = 0
    this.roadRoutes = []
    this.siteHeights = SITES.map((s) => this.rawHeight(s.x, s.z))

    this.buildHeightfield()
    this.buildTerrain()
    this.buildSky()
    this.buildWater()
    this.buildLights()
    this.buildRoads()

    this.builder = new Builder(this.textures, this)
    buildSites(this, this.builder)
    this.scatterProps()
    this.batches = this.builder.flush(scene)
    this.builder = null

    this.scatterTrees()
    this.scatterRocks()
    this.scatterGrass()
    this.buildMapCanvas()

    this.playerSpawn = { x: 8, z: 31, yaw: 0 }
    this.spawnStarterLoot()
  }

  /* ------------------------------------------------------------------ */
  /* Terrain                                                             */
  /* ------------------------------------------------------------------ */

  rawHeight(x, z) {
    const r = Math.hypot(x, z)
    const wobble = (fbm2(x * 0.0062 + 31.7, z * 0.0062 - 17.3, 3) - 0.5) * 54
    const coast = smoothstep(352, 258, r + wobble)
    const hills = fbm2(x * 0.0105 + 2.1, z * 0.0105 - 5.4, 4)
    const ridge = 1 - Math.abs(fbm2(x * 0.021 - 9.2, z * 0.021 + 3.7, 3) * 2 - 1)
    const massif = fbm2(x * 0.0034 + 9.1, z * 0.0034 - 2.8, 3)
    let h = -9 + coast * (7 + hills * 21 + ridge * 15 + massif * 16)
    return h
  }

  heightAt(x, z) {
    let h = this.rawHeight(x, z)
    // Flatten site pads.
    for (let i = 0; i < SITES.length; i++) {
      const s = SITES[i]
      const d = Math.hypot(x - s.x, z - s.z)
      const w = 1 - smoothstep(s.radius * 0.82, s.flatten, d)
      if (w > 0) {
        const undulation = (valueNoise2(x * 0.11 + i * 4, z * 0.11) - 0.5) * 0.3
        h = lerp(h, this.siteHeights[i] + undulation, w * 0.96)
      }
    }
    // Inland lakes.
    for (const lake of LAKES) {
      const d = Math.hypot(x - lake.x, z - lake.z)
      const w = 1 - smoothstep(lake.radius * 0.45, lake.radius, d)
      if (w > 0) h -= lake.depth * w
    }
    // Sea floor falloff.
    const r = Math.hypot(x, z)
    if (r > 345) h -= (r - 345) * 0.18
    return h
  }

  buildHeightfield() {
    const n = CELLS + 1
    const data = new Float32Array(n * n)
    for (let iz = 0; iz < n; iz++) {
      const z = -MAP_HALF + (iz / CELLS) * MAP_SIZE
      for (let ix = 0; ix < n; ix++) {
        const x = -MAP_HALF + (ix / CELLS) * MAP_SIZE
        data[iz * n + ix] = this.heightAt(x, z)
      }
    }
    this.heightData = data
  }

  getHeight(x, z) {
    if (!this.heightData) return this.heightAt(x, z)
    return sampleGrid(this.heightData, MAP_SIZE, CELLS, x, z)
  }

  getSlope(x, z) {
    const d = 1.4
    const hx = this.getHeight(x + d, z) - this.getHeight(x - d, z)
    const hz = this.getHeight(x, z + d) - this.getHeight(x, z - d)
    return Math.hypot(hx, hz) / (d * 2)
  }

  buildTerrain() {
    const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, CELLS, CELLS)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const grass = new THREE.Color('#7f8c58')
    const dry = new THREE.Color('#9a8d60')
    const sand = new THREE.Color('#b8a77c')
    const rock = new THREE.Color('#77766c')
    const deep = new THREE.Color('#5a6550')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h = this.getHeight(x, z)
      pos.setY(i, h)
      const slope = this.getSlope(x, z)
      const n = fbm2(x * 0.06 + 4, z * 0.06 - 7, 3)
      c.copy(grass)
      c.lerp(dry, smoothstep(0.45, 0.75, n) * 0.8)
      c.lerp(deep, smoothstep(0.0, 1.2, -h) * 0.6)
      if (h < 1.9) c.lerp(sand, smoothstep(2.4, 0.2, h))
      if (slope > 0.52) c.lerp(rock, smoothstep(0.52, 1.1, slope) * 0.9)
      c.multiplyScalar(0.78 + n * 0.36)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    const map = this.textures.grass
    map.repeat.set(74, 74)
    const mat = new THREE.MeshStandardMaterial({
      map, vertexColors: true, roughness: 0.99, metalness: 0,
      color: 0xffffff
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    mesh.name = 'terrain'
    this.terrain = mesh
    this.scene.add(mesh)
  }

  /* ------------------------------------------------------------------ */
  /* Sky, water, light                                                   */
  /* ------------------------------------------------------------------ */

  buildSky() {
    const uniforms = {
      uTime: { value: 0 },
      uSun: { value: SUN_DIR.clone() }
    }
    const mat = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uSun;
        varying vec3 vDir;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float s = 0.0;
          float a = 0.55;
          for (int i = 0; i < 4; i++) {
            s += noise(p) * a;
            p = p * 2.07 + 13.1;
            a *= 0.5;
          }
          return s;
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 horizon = vec3(0.66, 0.68, 0.63);
          vec3 zenith = vec3(0.12, 0.31, 0.52);
          vec3 col = mix(horizon, zenith, pow(h, 0.62));

          float sd = max(dot(dir, uSun), 0.0);
          col += vec3(1.0, 0.78, 0.48) * pow(sd, 2400.0) * 6.0;
          col += vec3(1.0, 0.58, 0.26) * pow(sd, 9.0) * 0.30;

          if (dir.y > 0.005) {
            vec2 p = dir.xz / (dir.y + 0.23) * 1.15;
            p += vec2(uTime * 0.0045, uTime * 0.0017);
            float n = fbm(p * 1.35);
            float cover = smoothstep(0.50, 0.79, n) * smoothstep(0.0, 0.16, dir.y);
            float lit = pow(sd, 2.2) * 0.85 + 0.16;
            vec3 cloudCol = mix(vec3(0.54, 0.58, 0.63), vec3(1.0, 0.90, 0.78), lit);
            cloudCol = mix(cloudCol, vec3(0.98, 0.72, 0.46), smoothstep(0.72, 0.94, n) * 0.55);
            col = mix(col, cloudCol, cover * 0.86);
          }

          col = mix(col, vec3(0.78, 0.78, 0.71), smoothstep(0.14, -0.03, dir.y) * 0.72);
          col = mix(col, vec3(0.34, 0.40, 0.42), smoothstep(-0.01, -0.18, dir.y) * 0.7);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    })
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 40, 24), mat)
    sky.frustumCulled = false
    sky.name = 'sky'
    this.sky = sky
    this.scene.add(sky)
    this.skyUniforms = uniforms
  }

  buildWater() {
    const uniforms = {
      uTime: { value: 0 },
      uSun: { value: SUN_DIR.clone() }
    }
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uSun;
        varying vec3 vWorld;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float ripple = sin(vWorld.x * 0.16 + uTime * 0.9) * 0.5
                       + sin(vWorld.z * 0.21 - uTime * 0.7) * 0.5
                       + sin((vWorld.x + vWorld.z) * 0.09 + uTime * 0.4) * 0.5;
          vec3 normal = normalize(vec3(ripple * 0.035, 1.0, ripple * 0.028));
          float fres = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);
          vec3 deep = vec3(0.055, 0.16, 0.19);
          vec3 shallow = vec3(0.16, 0.36, 0.37);
          vec3 col = mix(deep, shallow, fres * 0.7);
          vec3 refl = reflect(-uSun, normal);
          float spec = pow(max(dot(refl, viewDir), 0.0), 120.0);
          col += vec3(1.0, 0.75, 0.45) * spec * 2.4;
          col += vec3(0.5, 0.7, 0.7) * smoothstep(0.5, 1.0, fres) * 0.10;
          gl_FragColor = vec4(col, 0.93);
        }
      `
    })
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600, 1, 1), mat)
    water.rotation.x = -Math.PI / 2
    water.position.y = 0
    water.name = 'water'
    this.water = water
    this.scene.add(water)
    this.waterUniforms = uniforms
    this.scene.fog = new THREE.FogExp2(0xb3bdb4, 0.00165)
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xb4cce8, 0x6e6248, 0.95)
    this.scene.add(hemi)
    this.scene.add(new THREE.AmbientLight(0xdde6f0, 0.24))

    const sun = new THREE.DirectionalLight(0xffd0a0, 2.55)
    sun.castShadow = this.quality !== 'low'
    sun.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 440
    sun.shadow.camera.left = -95
    sun.shadow.camera.right = 95
    sun.shadow.camera.top = 95
    sun.shadow.camera.bottom = -95
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.04
    sun.position.copy(SUN_DIR).multiplyScalar(180)
    sun.target.position.set(0, 0, 0)
    this.scene.add(sun)
    this.scene.add(sun.target)
    this.sun = sun

    const fill = new THREE.DirectionalLight(0x7fa8d0, 0.35)
    fill.position.set(60, 40, -90)
    this.scene.add(fill)
  }

  update(dt, focus) {
    this.time += dt
    if (this.skyUniforms) this.skyUniforms.uTime.value = this.time
    if (this.waterUniforms) this.waterUniforms.uTime.value = this.time
    if (this.grassShader) this.grassShader.uniforms.uTime.value = this.time
    if (focus && this.sun) {
      this.sun.position.set(focus.x + SUN_DIR.x * 170, focus.y + SUN_DIR.y * 170 + 12, focus.z + SUN_DIR.z * 170)
      this.sun.target.position.set(focus.x, focus.y, focus.z)
      this.sun.target.updateMatrixWorld()
      this.sky.position.set(focus.x, 0, focus.z)
      this.water.position.set(focus.x, 0, focus.z)
    }
  }

  /* ------------------------------------------------------------------ */
  /* Roads                                                               */
  /* ------------------------------------------------------------------ */

  buildRoads() {
    const routes = [
      { width: 7.2, points: [[0, 26], [2, 46], [26, 66], [66, 60], [100, 48], [112, 44]] },
      { width: 6.4, points: [[-2, 10], [-20, 4], [-58, 28], [-82, 68], [-98, 92]] },
      { width: 6.6, points: [[-14, -4], [-52, -16], [-92, -28], [-124, -38], [-146, -46]] },
      { width: 7.0, points: [[6, -8], [14, -46], [26, -94], [40, -140], [48, -164]] },
      { width: 7.4, points: [[14, -2], [58, -24], [104, -46], [148, -70], [172, -86]] },
      { width: 6.0, points: [[4, 8], [14, 62], [22, 118], [30, 164], [34, 184]] },
      { width: 15, points: [[126, -58], [156, -69], [190, -82], [226, -98]], runway: true }
    ]
    const geos = []
    for (const route of routes) {
      const curve = new THREE.CatmullRomCurve3(route.points.map(([x, z]) => new THREE.Vector3(x, 0, z)))
      const steps = route.runway ? 34 : Math.max(20, route.points.length * 12)
      const pts = curve.getPoints(steps)
      const vertices = []
      const uvs = []
      const indices = []
      let distance = 0
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const prev = pts[Math.max(0, i - 1)]
        const next = pts[Math.min(pts.length - 1, i + 1)]
        const dirX = next.x - prev.x
        const dirZ = next.z - prev.z
        const len = Math.hypot(dirX, dirZ) || 1
        const nx = -dirZ / len
        const nz = dirX / len
        const half = route.width / 2
        if (i > 0) distance += Math.hypot(p.x - prev.x, p.z - prev.z)
        for (const side of [-1, 1]) {
          const x = p.x + nx * half * side
          const z = p.z + nz * half * side
          const y = Math.max(this.getHeight(x, z) + 0.07, 0.12)
          vertices.push(x, y, z)
          uvs.push(side === -1 ? 0 : 1, distance / 10)
        }
        if (i > 0) {
          const a = (i - 1) * 2
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      geos.push(geo)
      this.roadRoutes.push({ points: route.points, width: route.width, runway: route.runway })
    }
    const merged = mergeGeos(geos)
    const map = this.textures.asphalt
    map.repeat.set(1, 1)
    const mat = new THREE.MeshStandardMaterial({ map, color: 0x9a9a94, roughness: 0.97, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    const road = new THREE.Mesh(merged, mat)
    road.receiveShadow = true
    road.name = 'roads'
    this.scene.add(road)
  }

  /* ------------------------------------------------------------------ */
  /* Scatter                                                             */
  /* ------------------------------------------------------------------ */

  nearSite(x, z, pad = 0) {
    for (const s of SITES) {
      if (Math.hypot(x - s.x, z - s.z) < s.radius + pad) return true
    }
    return false
  }

  nearRoad(x, z, pad = 3) {
    for (const r of this.roadRoutes) {
      for (let i = 0; i < r.points.length - 1; i++) {
        const [ax, az] = r.points[i]
        const [bx, bz] = r.points[i + 1]
        if (distToSegment(x, z, ax, az, bx, bz) < r.width / 2 + pad) return true
      }
    }
    return false
  }

  scatterTrees() {
    const rng = mulberry32(4411)
    const pineTrunks = []
    const pineCanopy = []
    const broadTrunks = []
    const broadCanopy = []
    let attempts = 0
    const target = this.quality === 'low' ? 190 : this.quality === 'medium' ? 260 : 320
    while (this.trees.length < target && attempts < target * 30) {
      attempts++
      const a = rng() * TAU
      const r = Math.sqrt(rng()) * 322
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const h = this.getHeight(x, z)
      if (h < 2.2 || h > 74) continue
      if (this.getSlope(x, z) > 0.86) continue
      if (this.nearSite(x, z, 6)) continue
      if (this.nearRoad(x, z, 4)) continue
      if (this.nearLake(x, z, 8)) continue
      let close = false
      for (const t of this.trees) {
        if (Math.hypot(t.x - x, t.z - z) < 4.4) { close = true; break }
      }
      if (close) continue
      const pine = rng() > 0.42
      const scale = 0.75 + rng() * 0.75
      const rot = rng() * TAU
      const tree = { x, z, y: h, scale, pine, rot }
      this.trees.push(tree)
      this.addObstacle({ minX: x - 0.5, maxX: x + 0.5, minY: h - 0.2, maxY: h + 4.2, minZ: z - 0.5, maxZ: z + 0.5 }, 'tree')
      if (pine) {
        pineTrunks.push({ tree })
        for (let i = 0; i < 3; i++) pineCanopy.push({ tree, i })
      } else {
        broadTrunks.push({ tree })
        for (let i = 0; i < 3; i++) broadCanopy.push({ tree, i })
      }
    }

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.4, 1, 6)
    trunkGeo.translate(0, 0.5, 0)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x584732, roughness: 1 })
    const pineGeo = new THREE.ConeGeometry(1, 1, 7)
    const pineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, flatShading: true })
    const broadGeo = new THREE.IcosahedronGeometry(1, 1)
    const broadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, flatShading: true })

    const makeTrunks = (list) => {
      const mesh = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length)
      const m = new THREE.Matrix4()
      const col = new THREE.Color()
      list.forEach((item, i) => {
        const t = item.tree
        const height = (t.pine ? 8.5 : 5.5) * t.scale
        m.compose(
          new THREE.Vector3(t.x, t.y - 0.1, t.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.rot, 0)),
          new THREE.Vector3(t.scale * 0.9, height, t.scale * 0.9)
        )
        mesh.setMatrixAt(i, m)
        col.setHSL(0.08 + rng() * 0.02, 0.24, 0.2 + rng() * 0.07)
        mesh.setColorAt(i, col)
      })
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      this.scene.add(mesh)
    }
    makeTrunks(pineTrunks)
    makeTrunks(broadTrunks)

    const makeCanopy = (list, geo, mat, pine) => {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length)
      const m = new THREE.Matrix4()
      const col = new THREE.Color()
      list.forEach((item, i) => {
        const t = item.tree
        const idx = item.i
        let y
        let radius
        let height
        if (pine) {
          y = t.y + (1.8 + idx * 2.1) * t.scale
          radius = (2.3 - idx * 0.52) * t.scale
          height = (4.4 - idx * 0.7) * t.scale
        } else {
          y = t.y + (3.2 + idx * 1.05) * t.scale
          radius = (2.5 - idx * 0.28) * t.scale
          height = (2.4 - idx * 0.2) * t.scale
        }
        m.compose(
          new THREE.Vector3(t.x + (idx - 1) * 0.55 * t.scale, y, t.z + (idx === 1 ? 0.4 : -0.3) * t.scale),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.rot + idx, 0)),
          new THREE.Vector3(radius, height, radius)
        )
        mesh.setMatrixAt(i, m)
        col.setHSL(0.23 + rng() * 0.04, 0.33 + rng() * 0.1, 0.22 + rng() * 0.1)
        mesh.setColorAt(i, col)
      })
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      this.scene.add(mesh)
    }
    makeCanopy(pineCanopy, pineGeo, pineMat, true)
    makeCanopy(broadCanopy, broadGeo, broadMat, false)
  }

  nearLake(x, z, pad = 0) {
    for (const l of LAKES) if (Math.hypot(x - l.x, z - l.z) < l.radius + pad) return true
    return false
  }

  scatterRocks() {
    const rng = mulberry32(1207)
    const geo = new THREE.DodecahedronGeometry(1, 0)
    const mat = new THREE.MeshStandardMaterial({ color: 0x8f8d83, roughness: 0.98, flatShading: true })
    const list = []
    let attempts = 0
    while (list.length < 130 && attempts < 5000) {
      attempts++
      const a = rng() * TAU
      const r = Math.sqrt(rng()) * 320
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const h = this.getHeight(x, z)
      if (h < 0.4 || this.nearRoad(x, z, 3) || this.nearSite(x, z, 2)) continue
      const s = 0.35 + rng() * 1.9
      list.push({ x, z, y: h, s, rot: rng() * TAU })
      if (s > 0.8) {
        this.addObstacle({ minX: x - s * 0.7, maxX: x + s * 0.7, minY: h - 0.3, maxY: h + s * 0.8, minZ: z - s * 0.7, maxZ: z + s * 0.7 }, 'rock')
      }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, list.length)
    const m = new THREE.Matrix4()
    const col = new THREE.Color()
    list.forEach((rock, i) => {
      m.compose(
        new THREE.Vector3(rock.x, rock.y + rock.s * 0.28, rock.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rock.rot * 0.2, rock.rot, rock.rot * 0.1)),
        new THREE.Vector3(rock.s, rock.s * (0.55 + (i % 3) * 0.1), rock.s * 0.9)
      )
      mesh.setMatrixAt(i, m)
      col.setHSL(0.1, 0.04, 0.34 + (i % 5) * 0.03)
      mesh.setColorAt(i, col)
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.scene.add(mesh)
  }

  scatterGrass() {
    if (this.quality === 'low') return
    const rng = mulberry32(9901)
    const count = this.quality === 'high' ? 2600 : 1200
    const plane = new THREE.PlaneGeometry(1, 1)
    plane.translate(0, 0.5, 0)
    const plane2 = plane.clone()
    plane2.rotateY(Math.PI / 2)
    const merged = mergeGeos([plane, plane2])
    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.grassBlade,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 1,
      color: 0xffffff
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 }
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           float sway = sin(uTime * 1.7 + instanceMatrix[3][0] * 0.33 + instanceMatrix[3][2] * 0.21) * 0.14;
           transformed.x += sway * position.y;
           transformed.z += sway * 0.4 * position.y;
         #endif`
      )
      this.grassShader = shader
    }
    const list = []
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU
      const r = Math.sqrt(rng()) * 300
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const h = this.getHeight(x, z)
      if (h < 2.0 || h > 60) continue
      if (this.nearRoad(x, z, 1.5)) continue
      if (this.getSlope(x, z) > 0.7) continue
      if (rng() > 0.5 && !this.nearSite(x, z, 44)) continue
      if (this.nearLake(x, z, 4)) continue
      list.push({ x, z, h, s: 0.55 + rng() * 0.9, rot: rng() * TAU })
    }
    const mesh = new THREE.InstancedMesh(merged, mat, list.length)
    const m = new THREE.Matrix4()
    const col = new THREE.Color()
    list.forEach((g, i) => {
      m.compose(
        new THREE.Vector3(g.x, g.h - 0.05, g.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, g.rot, 0)),
        new THREE.Vector3(g.s, g.s * (0.8 + (i % 4) * 0.12), g.s)
      )
      mesh.setMatrixAt(i, m)
      col.setHSL(0.2 + rng() * 0.05, 0.22, 0.55 + rng() * 0.2)
      mesh.setColorAt(i, col)
    })
    mesh.frustumCulled = false
    mesh.receiveShadow = true
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.scene.add(mesh)
    this.grassMesh = mesh
  }

  scatterProps() {
    const b = this.builder
    if (!b) return
    // Roadside poles and signs.
    for (const route of this.roadRoutes) {
      if (route.runway) continue
      for (let i = 1; i < route.points.length; i += 2) {
        const [x, z] = route.points[i]
        const offset = 8 + (i % 2) * 2
        b.powerPole(x + offset, z - 4)
      }
    }
    // Random camps and debris across the island.
    const rng = mulberry32(6612)
    for (let i = 0; i < 16; i++) {
      let x, z, tries = 0
      do {
        const a = rng() * TAU
        const r = 60 + Math.sqrt(rng()) * 240
        x = Math.cos(a) * r
        z = Math.sin(a) * r
        tries++
      } while (tries < 60 && (this.nearSite(x, z, 12) || this.nearRoad(x, z, 6) || this.getHeight(x, z) < 3 || this.getSlope(x, z) > 0.5))
      if (this.getHeight(x, z) < 3) continue
      const rot = rng() * TAU
      const ctx = { x, z, rot }
      const y = this.getHeight(x, z)
      if (i % 4 === 0) {
        b.vehicle({ x, z, rot, key: rng() > 0.5 ? 'rust' : 'metalBlue' })
        b.crate(ctx, 2.2, 1.5, y + 0.05, 0.9)
      } else if (i % 4 === 1) {
        b.sandbagWall(x, z, rot, 5.5, 2)
        b.barrel(x + 2, z + 1.2)
        this.addLootPoint(x, y + 0.1, z, 'ammo')
      } else if (i % 4 === 2) {
        for (let c = 0; c < 3; c++) {
          b.crate(ctx, 1.4 + c * 0.8, -1.2 + c * 0.6, y + 0.05, 0.8 + rng() * 0.4)
        }
        this.addLootPoint(x, y + 0.1, z, rng() > 0.5 ? 'medkit' : 'weapon')
      } else {
        b.barrel(x, z)
        b.barrel(x + 0.9, z + 0.6)
        b.barrel(x - 0.6, z + 1.1)
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Physics queries                                                     */
  /* ------------------------------------------------------------------ */

  addObstacle(box, kind = 'static') {
    // Accept either flat bounds or a THREE.Box3 (builders pass Box3).
    const minX = box.minX ?? box.min?.x
    const minY = box.minY ?? box.min?.y
    const minZ = box.minZ ?? box.min?.z
    const maxX = box.maxX ?? box.max?.x
    const maxY = box.maxY ?? box.max?.y
    const maxZ = box.maxZ ?? box.max?.z
    if (![minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)) return
    this.obstacles.push({ minX, minY, minZ, maxX, maxY, maxZ, kind })
  }

  addPlatform(platform) {
    this.platforms.push(platform)
  }

  addDynamicObstacle(box, ref) {
    const entry = { ...box, kind: 'build', ref }
    this.dynamicObstacles.push(entry)
    return entry
  }

  removeDynamicObstacle(entry) {
    const i = this.dynamicObstacles.indexOf(entry)
    if (i >= 0) this.dynamicObstacles.splice(i, 1)
  }

  addDynamicPlatform(platform, ref) {
    const entry = { ...platform, ref }
    this.dynamicPlatforms.push(entry)
    return entry
  }

  removeDynamicPlatform(entry) {
    const i = this.dynamicPlatforms.indexOf(entry)
    if (i >= 0) this.dynamicPlatforms.splice(i, 1)
  }

  addLootPoint(x, y, z, kind, weapon) {
    this.lootPoints.push({ x, y, z, kind, weapon })
  }

  addBotSpawn(x, z) {
    this.botSpawns.push({ x, z })
  }

  spawnStarterLoot() {
    const sp = this.playerSpawn
    const y = this.getHeight(sp.x - 4, sp.z - 6) + 0.06
    this.addLootPoint(sp.x - 4.5, y, sp.z - 6.5, 'weapon', 'm416')
    this.addLootPoint(sp.x + 3.4, this.getHeight(sp.x + 3.4, sp.z - 7) + 0.06, sp.z - 7, 'medkit')
    this.addLootPoint(sp.x + 5.4, this.getHeight(sp.x + 5.4, sp.z - 2) + 0.06, sp.z - 2, 'armor')
  }

  resolveCircle(pos, radius, height) {
    const feet = pos.y
    const head = pos.y + height
    const lists = [this.obstacles, this.dynamicObstacles]
    for (let pass = 0; pass < 2; pass++) {
      for (const list of lists) {
        for (const box of list) {
          if (box.maxY <= feet + 0.36 || box.minY >= head - 0.03) continue
          const nearestX = clamp(pos.x, box.minX, box.maxX)
          const nearestZ = clamp(pos.z, box.minZ, box.maxZ)
          let dx = pos.x - nearestX
          let dz = pos.z - nearestZ
          const d2 = dx * dx + dz * dz
          if (d2 >= radius * radius) continue
          if (d2 < 1e-8) {
            const left = pos.x - box.minX
            const right = box.maxX - pos.x
            const back = pos.z - box.minZ
            const front = box.maxZ - pos.z
            const min = Math.min(left, right, back, front)
            if (min === left) pos.x = box.minX - radius
            else if (min === right) pos.x = box.maxX + radius
            else if (min === back) pos.z = box.minZ - radius
            else pos.z = box.maxZ + radius
          } else {
            const d = Math.sqrt(d2)
            const push = (radius - d) / d
            pos.x += dx * push
            pos.z += dz * push
          }
        }
      }
    }
  }

  groundHeight(x, z, feetY) {
    let h = this.getHeight(x, z)
    const check = (list) => {
      for (const p of list) {
        if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) continue
        if (p.y <= feetY + 0.55 && p.y > h) h = p.y
      }
    }
    check(this.platforms)
    check(this.dynamicPlatforms)
    return h
  }

  // Highest platform / terrain surface at a point (used for loot + bots).
  surfaceHeight(x, z) {
    return this.groundHeight(x, z, 200)
  }

  raycast(origin, dir, maxDist = 300) {
    let best = { distance: maxDist, point: null, normal: new THREE.Vector3(0, 1, 0), kind: 'none', box: null }
    // Terrain (march + bisect)
    const step = 0.6
    let prevT = 0.2
    let prevH = this.getHeight(origin.x + dir.x * prevT, origin.z + dir.z * prevT)
    let prevY = origin.y + dir.y * prevT
    for (let t = step; t <= Math.min(maxDist, 360); t += step) {
      const x = origin.x + dir.x * t
      const z = origin.z + dir.z * t
      const y = origin.y + dir.y * t
      const h = this.getHeight(x, z)
      if (y <= h) {
        let lo = prevT
        let hi = t
        for (let k = 0; k < 7; k++) {
          const mid = (lo + hi) / 2
          const mx = origin.x + dir.x * mid
          const mz = origin.z + dir.z * mid
          const my = origin.y + dir.y * mid
          if (my <= this.getHeight(mx, mz)) hi = mid
          else lo = mid
        }
        const px = origin.x + dir.x * hi
        const pz = origin.z + dir.z * hi
        const py = origin.y + dir.y * hi
        const gradX = this.getHeight(px + 0.6, pz) - this.getHeight(px - 0.6, pz)
        const gradZ = this.getHeight(px, pz + 0.6) - this.getHeight(px, pz - 0.6)
        const normal = new THREE.Vector3(-gradX, 1.2, -gradZ).normalize()
        best = { distance: hi, point: new THREE.Vector3(px, py, pz), normal, kind: 'terrain', box: null }
        break
      }
      prevT = t
      prevH = h
      prevY = y
    }
    // Water surface
    if (origin.y > 0 && dir.y < -1e-4) {
      const tw = -origin.y / dir.y
      if (tw > 0.05 && tw < best.distance) {
        best = {
          distance: tw,
          point: new THREE.Vector3(origin.x + dir.x * tw, 0, origin.z + dir.z * tw),
          normal: new THREE.Vector3(0, 1, 0),
          kind: 'water',
          box: null
        }
      }
    }
    // Boxes
    const checkList = (list, dynamic) => {
      for (const box of list) {
        const t = rayAABB(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, box, best.distance)
        if (t !== null && t < best.distance) {
          const point = new THREE.Vector3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t)
          best = { distance: t, point, normal: boxNormal(box, point), kind: dynamic ? 'build' : box.kind, box }
        }
      }
    }
    checkList(this.obstacles, false)
    checkList(this.dynamicObstacles, true)
    return best
  }

  hasLineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax
    const dy = by - ay
    const dz = bz - az
    const len = Math.hypot(dx, dy, dz)
    if (len < 0.2) return true
    const hit = this.raycast({ x: ax, y: ay, z: az }, { x: dx / len, y: dy / len, z: dz / len }, len - 0.35)
    return hit.distance >= len - 0.4
  }

  /* ------------------------------------------------------------------ */
  /* Minimap                                                             */
  /* ------------------------------------------------------------------ */

  buildMapCanvas() {
    const size = 512
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(size, size)
    const d = img.data
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = -MAP_HALF + (px / size) * MAP_SIZE
        const z = -MAP_HALF + (py / size) * MAP_SIZE
        const h = this.getHeight(x, z)
        const slope = this.getSlope(x, z)
        let r, g, b
        if (h < 0) {
          const deep = clamp(-h / 12, 0, 1)
          r = 18 + (1 - deep) * 14
          g = 46 + (1 - deep) * 26
          b = 54 + (1 - deep) * 20
        } else if (h < 2.4) {
          r = 108; g = 102; b = 76
        } else if (slope > 0.6) {
          r = 92; g = 91; b = 83
        } else {
          const n = fbm2(x * 0.06, z * 0.06, 2)
          r = 58 + n * 18
          g = 74 + n * 22
          b = 46 + n * 14
        }
        const i = (py * size + px) * 4
        d[i] = r
        d[i + 1] = g
        d[i + 2] = b
        d[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    // Roads
    ctx.strokeStyle = 'rgba(58,52,44,0.85)'
    for (const route of this.roadRoutes) {
      ctx.lineWidth = route.runway ? 10 : 3
      ctx.beginPath()
      route.points.forEach(([x, z], i) => {
        const px = ((x + MAP_HALF) / MAP_SIZE) * size
        const py = ((z + MAP_HALF) / MAP_SIZE) * size
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    }
    // Site labels
    ctx.font = 'bold 13px monospace'
    ctx.textAlign = 'center'
    for (const s of SITES) {
      const px = ((s.x + MAP_HALF) / MAP_SIZE) * size
      const py = ((s.z + MAP_HALF) / MAP_SIZE) * size
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fillText(s.name, px, py + 4)
      ctx.fillStyle = 'rgba(255,122,24,0.9)'
      ctx.fillRect(px - 2, py - 12, 4, 4)
    }
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (let i = 1; i < 8; i++) {
      const p = (i / 8) * size
      ctx.beginPath()
      ctx.moveTo(p, 0)
      ctx.lineTo(p, size)
      ctx.moveTo(0, p)
      ctx.lineTo(size, p)
      ctx.stroke()
    }
    this.mapCanvas = c
  }

  mapToScreen(x, z, canvasSize) {
    return {
      x: ((x + MAP_HALF) / MAP_SIZE) * canvasSize,
      y: ((z + MAP_HALF) / MAP_SIZE) * canvasSize
    }
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m) => {
          if (m.map) m.map.dispose()
          m.dispose()
        })
      }
    })
  }
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  if (len2 === 0) return Math.hypot(px - ax, pz - az)
  let t = ((px - ax) * dx + (pz - az) * dz) / len2
  t = clamp(t, 0, 1)
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

function boxNormal(box, point) {
  const dists = [
    { d: Math.abs(point.x - box.minX), n: new THREE.Vector3(-1, 0, 0) },
    { d: Math.abs(point.x - box.maxX), n: new THREE.Vector3(1, 0, 0) },
    { d: Math.abs(point.y - box.minY), n: new THREE.Vector3(0, -1, 0) },
    { d: Math.abs(point.y - box.maxY), n: new THREE.Vector3(0, 1, 0) },
    { d: Math.abs(point.z - box.minZ), n: new THREE.Vector3(0, 0, -1) },
    { d: Math.abs(point.z - box.maxZ), n: new THREE.Vector3(0, 0, 1) }
  ]
  dists.sort((a, b) => a.d - b.d)
  return dists[0].n
}

function mergeGeos(geos) {
  // Local import-free merge to keep this module lean.
  const merged = mergeGeometriesCompat(geos)
  return merged
}

function mergeGeometriesCompat(geos) {
  // Use three's utility lazily through a dynamically imported helper is overkill;
  // this tiny merge handles position/normal/uv non-indexed inputs.
  let total = 0
  const withNormals = geos.every((g) => g.attributes.normal)
  const withUv = geos.every((g) => g.attributes.uv)
  const prepared = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g
    total += ng.attributes.position.count
    return ng
  })
  const pos = new Float32Array(total * 3)
  const nor = withNormals ? new Float32Array(total * 3) : null
  const uv = withUv ? new Float32Array(total * 2) : null
  let offset = 0
  for (const g of prepared) {
    const p = g.attributes.position.array
    pos.set(p, offset * 3)
    if (nor) nor.set(g.attributes.normal.array, offset * 3)
    if (uv) uv.set(g.attributes.uv.array, offset * 2)
    offset += g.attributes.position.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  if (nor) out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  prepared.forEach((g, i) => { if (g !== geos[i]) g.dispose() })
  return out
}
