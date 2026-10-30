import * as THREE from 'three';

function wingGeometry(side) {
  // swept delta wing: coordinates in metres, side = +1 right / -1 left
  const x = (v) => v * side;
  const verts = [
    // top (y = .075)
    x(.38), .075, -1.02,
    x(2.72), .06, .38,
    x(2.42), .05, 1.62,
    x(.38), .07, 1.94,
    // bottom (y = -.075)
    x(.38), -.075, -1.02,
    x(2.72), -.06, .38,
    x(2.42), -.05, 1.62,
    x(.38), -.07, 1.94,
  ];
  const idxTop = side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
  const idxBot = side > 0 ? [4, 5, 6, 4, 6, 7] : [4, 6, 5, 4, 7, 6];
  const idx = [...idxTop, ...idxBot,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function finGeometry(side) {
  const s = side;
  const verts = [
    s * .22, .1, .85, s * .68, .1, 1.47, s * .55, 1.18, 1.44, s * .2, .1, 1.75,
    s * .22, -.03, .85, s * .68, -.03, 1.47, s * .55, 1.08, 1.44, s * .2, -.03, 1.75,
  ];
  const idx = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function leadingEdge(side, points, color) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 16, .035, 4, false);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
}

function shieldMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color('#67f4ff') },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vP = position;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
      void main(){
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.1);
        float bands = .5 + .5 * sin(vP.y * 11.0 + uTime * 5.0);
        float a = (fres * .8 + bands * .12) * uOpacity;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
}

export class Ship {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'player-ship';
    this.root.rotation.order = 'YXZ';
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);

    const hull = new THREE.MeshStandardMaterial({
      color: '#3b4b70', metalness: .82, roughness: .27, envMapIntensity: .7,
      emissive: new THREE.Color('#0a1830'), emissiveIntensity: .65
    });
    const dark = new THREE.MeshStandardMaterial({
      color: '#111628', metalness: .7, roughness: .4,
      emissive: new THREE.Color('#080d1d'), emissiveIntensity: .5
    });
    const trim = new THREE.MeshBasicMaterial({ color: '#2ef2ff', toneMapped: false });
    const trimPink = new THREE.MeshBasicMaterial({ color: '#ff2f92', toneMapped: false });

    this.hull = hull;
    this.trim = trim;

    // fuselage
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(.34, .62, 3.25, 10, 1), hull);
    fuselage.rotation.x = -Math.PI / 2;
    fuselage.position.z = -.2;
    this.body.add(fuselage);

    const rear = new THREE.Mesh(new THREE.CylinderGeometry(.62, .45, 1.1, 10, 1), dark);
    rear.rotation.x = -Math.PI / 2;
    rear.position.z = 1.82;
    this.body.add(rear);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(.34, 1.75, 10), hull);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -2.68;
    this.body.add(nose);

    const spine = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, 2.8), dark);
    spine.position.set(0, .48, -.32);
    this.body.add(spine);

    // wings
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeometry(side), hull);
      this.body.add(wing);

      const edge = leadingEdge(side, [
        new THREE.Vector3(side * .4, .086, -1.0),
        new THREE.Vector3(side * 1.5, .085, -.33),
        new THREE.Vector3(side * 2.7, .068, .38),
      ], side > 0 ? '#2ef2ff' : '#2ef2ff');
      this.body.add(edge);

      const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(.05, .012, 1.1), new THREE.MeshBasicMaterial({
        color: side > 0 ? '#ff2f92' : '#2ef2ff', toneMapped: false, transparent: true, opacity: .9
      }));
      wingStripe.position.set(side * 1.95, .085, .7);
      wingStripe.rotation.y = side * -.18;
      this.body.add(wingStripe);

      const fin = new THREE.Mesh(finGeometry(side), dark);
      this.body.add(fin);
      const finEdge = new THREE.Mesh(new THREE.BoxGeometry(.035, .72, .03), new THREE.MeshBasicMaterial({
        color: '#ff2f92', toneMapped: false, transparent: true, opacity: .9
      }));
      finEdge.position.set(side * .58, .66, 1.44);
      finEdge.rotation.z = side * -.19;
      this.body.add(finEdge);

      // canard
      const canard = new THREE.Mesh(new THREE.BoxGeometry(.72, .035, .34), hull);
      canard.position.set(side * .68, .02, -1.38);
      canard.rotation.z = side * .1;
      canard.rotation.y = side * -.3;
      this.body.add(canard);

      // engine pod
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(.24, .29, 1.75, 8), dark);
      pod.rotation.x = -Math.PI / 2;
      pod.position.set(side * .62, -.02, 1.72);
      this.body.add(pod);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(.235, .035, 4, 16), trim);
      ring.position.set(side * .62, -.02, 2.58);
      this.body.add(ring);

      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(.19, 1.3, 7, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#69f6ff', transparent: true, opacity: .72,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
        })
      );
      flame.rotation.x = Math.PI / 2;
      flame.position.set(side * .62, -.02, 3.15);
      flame.scale.set(1, 1, 1);
      this.body.add(flame);
      if (!this.flames) this.flames = [];
      this.flames.push(flame);

      const light = new THREE.PointLight('#2ef2ff', 5, 16, 2);
      light.position.set(side * .62, 0, 2.2);
      this.body.add(light);
      if (!this.engineLights) this.engineLights = [];
      this.engineLights.push(light);
    }

    // cockpit
    const canopyMat = new THREE.MeshStandardMaterial({
      color: '#061421', metalness: .95, roughness: .09,
      emissive: new THREE.Color('#0a7d96'), emissiveIntensity: .8,
      transparent: true, opacity: .88
    });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 10), canopyMat);
    canopy.scale.set(.78, .82, 1.5);
    canopy.position.set(0, .33, -.82);
    this.body.add(canopy);

    const canopyLine = new THREE.Mesh(new THREE.TorusGeometry(.33, .018, 4, 20, Math.PI), trimPink);
    canopyLine.rotation.set(Math.PI / 2, 0, 0);
    canopyLine.scale.set(1, 1.45, 1);
    canopyLine.position.set(0, .35, -.55);
    this.body.add(canopyLine);

    // belly trim
    const belly = new THREE.Mesh(new THREE.BoxGeometry(.09, .03, 2.2), new THREE.MeshBasicMaterial({
      color: '#2ef2ff', transparent: true, opacity: .55, toneMapped: false
    }));
    belly.position.set(0, -.46, -.1);
    this.body.add(belly);

    // wingtip marker lights
    for (const side of [-1, 1]) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.075, 8, 6), new THREE.MeshBasicMaterial({
        color: side > 0 ? '#ff2f92' : '#71ffb0', toneMapped: false
      }));
      marker.position.set(side * 2.54, .08, 1.35);
      this.body.add(marker);
    }

    // soft rim fill so the fighter reads against the dark canyon
    const fill = new THREE.PointLight('#77c8ff', 26, 22, 2);
    fill.position.set(0, 4.2, 5.5);
    this.body.add(fill);
    const under = new THREE.PointLight('#ff588f', 9, 13, 2);
    under.position.set(0, -2.1, -1.4);
    this.body.add(under);

    // shield
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(3.15, 24, 14), shieldMaterial());
    this.shield.position.z = -.1;
    this.shield.visible = false;
    this.body.add(this.shield);

    this.bank = 0;
    this.pitchVisual = 0;
    this.rollSpin = 0;
    this.time = 0;
    this.enginePositions = [new THREE.Vector3(), new THREE.Vector3()];
  }

  getEngineWorld(index, out = new THREE.Vector3()) {
    out.set(index === 0 ? -.62 : .62, -.02, 3.4);
    this.body.localToWorld(out);
    return out;
  }

  setVisible(v) { this.root.visible = v; }

  update(dt, opts) {
    this.time += dt;
    const { speed = 180, boost = 0, steerX = 0, steerY = 0, invulnerable = 0, rollAngle = 0 } = opts;

    const targetBank = -steerX * .62;
    this.bank += (targetBank - this.bank) * Math.min(1, dt * 5.5);
    this.pitchVisual += (steerY * .18 - this.pitchVisual) * Math.min(1, dt * 4);

    this.body.rotation.z = this.bank + rollAngle;
    this.body.rotation.x = this.pitchVisual;
    this.body.position.y = Math.sin(this.time * 5.2) * .035 + (boost > .2 ? Math.sin(this.time * 31) * .012 : 0);
    this.body.rotation.y = Math.sin(this.time * 1.7) * .012;

    const enginePulse = .92 + Math.sin(this.time * 28) * .08;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i];
      const stretch = 1 + boost * 1.35 + (i === 0 ? .04 : 0);
      f.scale.set(enginePulse * (1 + boost * .28), stretch, enginePulse * (1 + boost * .28));
      f.material.opacity = .55 + boost * .28 + Math.sin(this.time * 37 + i) * .06;
    }
    for (const l of this.engineLights) l.intensity = 9 + boost * 13 + Math.sin(this.time * 30) * .8;

    this.shield.visible = invulnerable > 0;
    if (invulnerable > 0) {
      this.shield.material.uniforms.uOpacity.value = .28 + Math.sin(this.time * 26) * .08;
      this.shield.material.uniforms.uTime.value = this.time;
    }
    this.trim.color.set(boost > .3 ? '#a8fbff' : '#2ef2ff');
  }
}
