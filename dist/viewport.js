import * as T from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const primaryProfile = [
  [.015, .04], [.76, .04], [.87, .055], [.94, .094], [.982, .16], [.986, .23],
  [.96, .31], [.59, 1.13], [.41, 1.52], [.34, 1.61], [.30, 1.69],
  [.297, 2.25], [.31, 2.28], [.34, 2.29], [.355, 2.33], [.344, 2.38],
  [.30, 2.398], [.265, 2.38], [.264, 2.32], [.273, 2.28],
];
const fills = {
  simulation: { profile: [[0, .105], [.83, .105], [.91, .165], [.918, .225], [.90, .3], [.72, .71]], radius: .72, base: .13, top: .71 },
  erlenmeyer: { profile: [[0, .055], [.57, .055], [.655, .10], [.66, .16], [.60, .30], [.49, .62]], radius: .49, base: .06, top: .62 },
  round: { profile: [[0, .055], [.24, .085], [.44, .16], [.59, .29], [.65, .42], [.71, .59], [.73, .70]], radius: .73, base: .13, top: .70, sedimentRadius: .24 },
};
const clearLiquid = '#929ad8';
const purpleLiquid = '#9e69e2';
const neutral = new T.Color(clearLiquid);

function lathe(profile, segments = 96) {
  return new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), segments);
}
function torus(radius, tube, color, opacity = 1) {
  const mesh = new T.Mesh(new T.TorusGeometry(radius, tube, 12, 100),
    new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function glassMaterial() {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vLocal;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -view.xyz;
        vLocal = position;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vLocal;
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 view = normalize(vView);
        float f = pow(1.0 - abs(dot(normal, view)), 2.7);
        float strip = exp(-abs(normal.x + 0.57) * 24.0) * smoothstep(0.0, 0.55, normal.z);
        float softStrip = exp(-abs(normal.x - 0.65) * 14.0) * smoothstep(0.0, 0.65, normal.z);
        float edge = smoothstep(0.37, 0.98, f);
        vec3 tint = mix(vec3(.22,.22,.48), vec3(.55,.49,.95), f);
        tint = mix(tint, vec3(.71,.88,1.), clamp(strip + edge*.22, 0.0, .92));
        gl_FragColor = vec4(tint, clamp(.095 + .44*f + .36*strip + .17*softStrip, 0.0, .79));
        #include <colorspace_fragment>
      }`,
  });
}

function liquidModel(spec) {
  const group = new T.Group();
  const body = new T.Mesh(lathe(spec.profile), new T.MeshStandardMaterial({
    color: clearLiquid, emissive: clearLiquid, emissiveIntensity: .18, roughness: .29, metalness: .08, transparent: true, opacity: .76, depthWrite: false,
  }));
  const surface = new T.Mesh(new T.CircleGeometry(spec.radius, 96), new T.MeshStandardMaterial({
    color: clearLiquid, emissive: clearLiquid, emissiveIntensity: .27, roughness: .24, metalness: .12, transparent: true, opacity: .85, depthWrite: false,
  }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = spec.top;
  body.renderOrder = 1;
  surface.renderOrder = 2;
  const meniscus = torus(spec.radius - .012, .012, '#dbd9ff', .52);
  meniscus.position.y = spec.top;
  meniscus.renderOrder = 2;
  const sediment = new T.Mesh(new T.CylinderGeometry(spec.sedimentRadius ?? spec.radius, spec.sedimentRadius ?? spec.radius, .045, 52),
    new T.MeshStandardMaterial({ color: '#f3eafa', emissive: '#ddd3f3', emissiveIntensity: .3, roughness: .9 }));
  sediment.position.y = spec.base + .045;
  sediment.visible = false;
  sediment.renderOrder = 1;
  group.add(body, surface, meniscus, sediment);
  return { group, body, surface, sediment, spec };
}

function addMarkings(target) {
  const material = new T.LineBasicMaterial({ color: '#f0eaff', transparent: true, opacity: .65, depthWrite: false });
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const y = .55 + i * .14;
    const radius = 1.013 - (y - .22) * .456;
    const span = i % 2 === 0 ? .155 : .10;
    for (let j = 0; j < 6; j += 1) {
      for (const angle of [j, j + 1].map((n) => .37 + span * n / 6)) {
        points.push(new T.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius));
      }
    }
  }
  const geometry = new T.BufferGeometry().setFromPoints(points);
  const lines = new T.LineSegments(geometry, material);
  lines.renderOrder = 4;
  target.add(lines);
}

function podium() {
  const group = new T.Group();
  const base = new T.Mesh(new T.CylinderGeometry(1.57, 1.62, .15, 110), [
    new T.MeshStandardMaterial({ color: '#251e3c', metalness: .4, roughness: .4 }),
    new T.MeshStandardMaterial({ color: '#423957', metalness: .3, roughness: .57 }),
    new T.MeshStandardMaterial({ color: '#1d1932' }),
  ]);
  base.position.y = -.087;
  group.add(base);
  for (const [radius, tube, height, opacity] of [[1.561, .014, -.018, .8], [1.45, .009, .001, .57], [1.17, .006, .001, .28], [1.675, .005, -.102, .25]]) {
    const edge = torus(radius, tube, '#b19bed', opacity);
    edge.position.y = height;
    group.add(edge);
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 63);
    gradient.addColorStop(0, '#0e0b22');
    gradient.addColorStop(.37, '#15112fd9');
    gradient.addColorStop(1, '#2c1c5200');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const shadow = new T.Mesh(new T.PlaneGeometry(4.7, 4.7), new T.MeshBasicMaterial({
      map: new T.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: .77,
    }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -.161;
    group.add(shadow);
  }
  return group;
}

export function createViewport(container, stage, reducedMotion) {
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setClearColor(0x000000, 0);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  renderer.outputColorSpace = T.SRGBColorSpace;
  container.append(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(33, 1, .025, 70);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.enablePan = false;
  orbit.minDistance = 4.2;
  orbit.maxDistance = 12;
  orbit.minPolarAngle = .42;
  orbit.maxPolarAngle = Math.PI * .53;


  function resetView() {
    camera.position.set(3.63, 2.55, 5.24);
    orbit.target.set(0, .94, 0);
    orbit.update();
  }
  resetView();
  scene.add(new T.HemisphereLight('#dfd8ff', '#382949', 2));
  const key = new T.DirectionalLight('#eeeeff', 2.25);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const edge = new T.DirectionalLight('#846bff', 2.3);
  edge.position.set(3, 2, -4);
  scene.add(edge);

  const root = new T.Group();
  const base = podium();
  root.add(base);
  scene.add(root);
  const glass = glassMaterial();
  const simple = new T.Group();
  const shell = new T.Mesh(lathe(primaryProfile), glass);
  shell.renderOrder = 3;
  simple.add(shell);
  const rim = torus(.308, .026, '#c5beff', .48);
  rim.position.y = 2.364;
  rim.renderOrder = 5;
  simple.add(rim);
  const foot = torus(.897, .014, '#a6a1fa', .42);
  foot.position.y = .09;
  foot.renderOrder = 5;
  simple.add(foot);
  addMarkings(simple);
  const assets = {
    erlenmeyer: { url: './assets/erlenmeyer-reference.glb', height: .145 },
    round: { url: './assets/round-bottom-reference.glb', height: .16, minY: .031966615, z: .025 },
  };
  const cached = new Map([['simulation', simple]]);
  let current = simple;
  let currentFill = liquidModel(fills.simulation);
  let sourceTint = neutral;
  let mixture = [];
  let animationStart = null;
  let reaction;
  root.add(current, currentFill.group);

  const bubbleGeometry = new T.SphereGeometry(1, 10, 8);
  const bubbleMaterial = new T.MeshBasicMaterial({
    color: '#e6e5ff', transparent: true, opacity: .67, depthWrite: false,
  });
  const bubbles = Array.from({ length: 37 }, (_, index) => {
    const mesh = new T.Mesh(bubbleGeometry, bubbleMaterial);
    mesh.renderOrder = 6;
    mesh.visible = false;
    root.add(mesh);
    return {
      mesh, angle: index * 2.39996, distance: .15 + ((index * 29) % 61) / 100,
      delay: ((index * 47) % 100) / 100, speed: .55 + ((index * 13) % 45) / 100,
      size: .012 + ((index * 7) % 13) / 620,
    };
  });
  const grainMaterial = new T.MeshStandardMaterial({ color: '#fff7ff', roughness: .85 });
  const grains = Array.from({ length: 31 }, (_, i) => {
    const mesh = new T.Mesh(bubbleGeometry, grainMaterial);
    mesh.scale.setScalar(.012 + (i % 5) * .002);
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  });
  const pour = new T.Mesh(new T.CylinderGeometry(.018, .027, 1.77, 12),
    new T.MeshBasicMaterial({ color: '#dad6ff', transparent: true, opacity: .62, depthWrite: false }));
  pour.position.set(.015, 1.75, 0);
  pour.renderOrder = 5;
  pour.visible = false;
  root.add(pour);

  function setColor(color) {
    for (const part of [currentFill.body, currentFill.surface]) {
      part.material.color.copy(color);
      part.material.emissive.copy(color);
    }
  }
  function setMixture(ids) {
    mixture = [...ids];
    reaction = undefined;
    animationStart = null;
    sourceTint = mixture.includes('indicator') ? new T.Color(purpleLiquid) : neutral;
    setColor(sourceTint);
    currentFill.sediment.visible = false;
    for (const { mesh } of bubbles) mesh.visible = false;
    for (const mesh of grains) mesh.visible = false;
    pour.visible = false;
  }
  function startReaction(item) {
    reaction = item;
    animationStart = performance.now();
  }

  async function selectVessel(id, stillCurrent) {
    let model = cached.get(id);
    if (!model) {
      const asset = assets[id];
      const { scene: raw } = await new GLTFLoader().loadAsync(asset.url);
      model = new T.Group();
      const factor = 2.398 / asset.height;
      raw.scale.setScalar(factor);
      raw.position.set(0, -(asset.minY ?? 0) * factor, -(asset.z ?? 0) * factor);
      raw.traverse((node) => {
        if (!node.isMesh) return;
        if (node.material.name.toLowerCase().includes('glass')) {
          node.material = glass;
          node.renderOrder = 3;
        } else {
          node.renderOrder = 4;
        }
      });
      model.add(raw);
      cached.set(id, model);
    }
    if (!stillCurrent() || model === current) return;
    root.remove(current, currentFill.group);
    currentFill.group.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      node.material.dispose();
    });
    current = model;
    currentFill = liquidModel(fills[id]);
    root.add(current, currentFill.group);
    setColor(sourceTint);
  }

  const tint = new T.Color();
  function animateMixture() {
    if (animationStart === null) return;
    const elapsed = (performance.now() - animationStart) / 1000;
    const still = reducedMotion.matches;
    const begin = still ? 1 : T.MathUtils.smoothstep(elapsed, .32, 1.35);
    const finalColor = reaction?.color ?? (reaction?.precipitate ? '#cac6e2' : null);
    if (finalColor) setColor(tint.copy(sourceTint).lerp(new T.Color(finalColor), begin));
    pour.visible = !still && elapsed < .64;
    pour.scale.y = Math.min(1, elapsed * 5);
    const { spec, sediment } = currentFill;
    if (reaction?.precipitate) {
      sediment.visible = still || elapsed > 1.1;
      sediment.scale.y = still ? 1 : T.MathUtils.smoothstep(elapsed, 1.1, 3.7);
      for (const [i, mesh] of grains.entries()) {
        mesh.visible = !still && elapsed > .5 && elapsed < 4.1;
        const level = T.MathUtils.smoothstep(elapsed, .8 + (i % 6) / 10, 3.8);
        const r = spec.radius * (.23 + (i % 7) / 14);
        mesh.position.set(Math.sin(i * 2.399) * r, T.MathUtils.lerp(spec.top * (.63 + (i % 4) / 13), spec.base + .045, level), Math.cos(i * 2.399) * r);
      }
    }
    if (reaction?.gas) {
      for (const { mesh, angle, distance, delay, speed, size } of bubbles) {
        const age = still ? delay : elapsed - .12 - delay;
        mesh.visible = age >= 0 && (still || elapsed < 6.2 - delay * 2.6);
        if (!mesh.visible) continue;
        const phase = still ? delay * .7 : (age * speed) % 1;
        const radius = distance * spec.radius * (1 - phase * .77);
        mesh.position.set(Math.sin(angle + phase) * radius, spec.base + phase * (spec.top + .82), Math.cos(angle + phase) * radius);
        mesh.scale.setScalar(size * (.8 + phase));
      }
    }
    if (elapsed > 6.3 || still) animationStart = null;
  }

  const reticle = torus(.09, .0035, '#b6f895');
  reticle.visible = false;
  const target = new T.Group();
  target.matrixAutoUpdate = false;
  target.add(reticle);
  scene.add(target);
  let session;
  let hits;
  let placed = false;
  let onState;
  let cameraEnabled = false;

  function setCameraMode(enabled) {
    cameraEnabled = enabled;
    base.visible = !enabled && !session;
  }

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1 || renderer.xr.isPresenting) return;
    camera.aspect = width / height;
    // Keep wide vessels in frame when the stage fills a tall phone screen.
    const portraitFov = 2 * Math.atan(Math.tan(T.MathUtils.degToRad(14)) / camera.aspect);
    camera.fov = camera.aspect < 1 ? Math.max(40, T.MathUtils.radToDeg(portraitFov)) : 33;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function finishXR(ended) {
    if (session !== ended) return;
    hits?.cancel();
    hits = null;
    session = null;
    reticle.visible = false;
    root.position.set(0, 0, 0);
    root.quaternion.identity();
    root.scale.setScalar(1);
    root.visible = true;
    orbit.enabled = true;
    base.visible = !cameraEnabled;
    onState?.('ended');
    requestAnimationFrame(resize);
  }

  async function startXR(overlay, onChange) {
    const active = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local', 'hit-test', 'dom-overlay'],
      domOverlay: { root: overlay },
    });
    session = active;
    onState = onChange;
    placed = false;
    root.visible = false;
    base.visible = false;
    orbit.enabled = false;
    active.addEventListener('end', () => finishXR(active), { once: true });
    active.addEventListener('select', () => {
      if (!reticle.visible || placed || session !== active) return;
      target.matrix.decompose(root.position, root.quaternion, root.scale);
      root.scale.setScalar(.087);
      root.visible = true;
      placed = true;
      reticle.visible = false;
      onState('placed');
    });
    try {
      await renderer.xr.setSession(active);
      const viewer = await active.requestReferenceSpace('viewer');
      hits = await active.requestHitTestSource({ space: viewer });
    } catch (error) {
      if (session === active) await active.end().catch(() => {});
      finishXR(active);
      throw error;
    }
  }

  renderer.setAnimationLoop((_, frame) => {
    if (frame && hits && !placed) {
      const hit = frame.getHitTestResults(hits)[0];
      const space = renderer.xr.getReferenceSpace();
      const pose = space && hit?.getPose(space);
      reticle.visible = Boolean(pose);
      if (pose) {
        target.matrix.fromArray(pose.transform.matrix);
        target.matrixWorldNeedsUpdate = true;
      }
    }
    if (!frame) {
      if (stage.closest('[hidden]')) return;
      orbit.update();
    }
    animateMixture();
    renderer.render(scene, camera);
  });

  return { resetView, setMixture, startReaction, selectVessel, startXR, endXR: () => session?.end(), cameraMode: setCameraMode };
}


