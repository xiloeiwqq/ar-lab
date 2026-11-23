import * as T from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { assets, fills, primaryProfile, vesselScale } from './vessels.js';
import { markerFocalLength } from './marker-pose.js';
import { reactionSeconds, reagents } from './chemistry.js';
const clearLiquid = '#929ad8';
const sedimentColor = '#f3eafa';
const sedimentGlow = '#ddd3f3';
const grainColor = '#fff7ff';
const neutral = new T.Color(clearLiquid);
const minSurfaceNormalY = Math.cos(T.MathUtils.degToRad(15));

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
    new T.MeshStandardMaterial({ color: sedimentColor, emissive: sedimentGlow, emissiveIntensity: .3, roughness: .9 }));
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
  const markerCamera = new T.PerspectiveCamera(45, 1, .025, 70);
  let markerVideo = null;
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
  const vessel = new T.Group();
  const contactShadow = new T.Mesh(new T.PlaneGeometry(3, 3), new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 shadowUv;
      void main() {
        shadowUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 shadowUv;
      void main() {
        float fade = 1.0 - smoothstep(.12, .5, length(shadowUv - .5));
        gl_FragColor = vec4(0.0, 0.0, 0.0, fade * .42);
      }`,
  }));
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = .005;
  contactShadow.visible = false;
  root.add(base, vessel, contactShadow);
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
  const cached = new Map([['simulation', simple]]);
  let current = simple;
  const modelBounds = new T.Box3();
  let contactHeight = modelBounds.setFromObject(current, true).min.y;
  let currentFill = liquidModel(fills.simulation);
  let sourceTint = neutral;
  let mixture = [];
  let animationStart = null;
  let reaction;
  vessel.add(current, currentFill.group);

  const bubbleGeometry = new T.SphereGeometry(1, 14, 10);
  const bubbleMaterial = new T.MeshPhongMaterial({
    color: '#d7faff', emissive: '#29748d', specular: '#ffffff', shininess: 85,
    transparent: true, opacity: .78, depthWrite: false,
  });
  const bubbles = Array.from({ length: 37 }, (_, index) => {
    const mesh = new T.Mesh(bubbleGeometry, bubbleMaterial);
    mesh.renderOrder = 6;
    mesh.visible = false;
    vessel.add(mesh);
    return {
      mesh, angle: index * 2.39996, distance: .15 + ((index * 29) % 61) / 100,
      delay: .5 + ((index * 47) % 100) / 50,
      cycle: 2.1 + ((index * 13) % 45) / 38,
      size: .024 + ((index * 7) % 13) / 250,
    };
  });
  const grainMaterial = new T.MeshStandardMaterial({ color: grainColor, roughness: .85 });
  const grains = Array.from({ length: 31 }, (_, i) => {
    const mesh = new T.Mesh(bubbleGeometry, grainMaterial);
    mesh.scale.setScalar(.016 + (i % 5) * .006);
    mesh.renderOrder = 6;
    mesh.visible = false;
    vessel.add(mesh);
    return mesh;
  });
  const pour = new T.Mesh(new T.CylinderGeometry(.018, .027, 1.77, 12),
    new T.MeshBasicMaterial({ color: '#dad6ff', transparent: true, opacity: .62, depthWrite: false }));
  pour.position.set(.015, 1.75, 0);
  pour.renderOrder = 5;
  pour.visible = false;
  vessel.add(pour);

  const ripples = Array.from({ length: 4 }, () => {
    const mesh = torus(1, .022, '#e4faff', .6);
    mesh.renderOrder = 6;
    mesh.visible = false;
    vessel.add(mesh);
    return mesh;
  });
  const inkMaterial = new T.MeshBasicMaterial({ transparent: true, opacity: .4, depthWrite: false });
  const inkDrops = Array.from({ length: 12 }, () => {
    const mesh = new T.Mesh(bubbleGeometry, inkMaterial);
    mesh.renderOrder = 3;
    mesh.visible = false;
    vessel.add(mesh);
    return mesh;
  });
  const chalkGeometry = new T.DodecahedronGeometry(1);
  const chalkMaterial = grainMaterial.clone();
  const chalkPieces = Array.from({ length: 6 }, (_, i) => {
    const mesh = new T.Mesh(chalkGeometry, chalkMaterial);
    mesh.rotation.set(i * .8, i * 1.2, i * .4);
    mesh.renderOrder = 3;
    vessel.add(mesh);
    return mesh;
  });

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
    const liquidColor = mixture.map((id) => reagents[id]?.liquidColor).find(Boolean);
    sourceTint = liquidColor ? new T.Color(liquidColor) : neutral;
    setColor(sourceTint);
    currentFill.sediment.visible = false;
    for (const { mesh } of bubbles) mesh.visible = false;
    for (const mesh of [...grains, ...ripples, ...inkDrops]) mesh.visible = false;
    drawChalk(mixture.includes('chalk') ? 1 : 0);
    pour.visible = false;
  }
  function startReaction(item) {
    reaction = item;
    grainMaterial.color.set(item?.precipitateColor ?? grainColor);
    cloudy.set('#e0ddf0');
    if (item?.precipitateColor) cloudy.lerp(grainMaterial.color, .55);
    animationStart = item ? performance.now() : null;
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
    vessel.remove(current, currentFill.group);
    currentFill.group.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      node.material.dispose();
    });
    current = model;
    contactHeight = modelBounds.setFromObject(current, true).min.y;
    if (session || markerVideo) vessel.position.y = -contactHeight;
    currentFill = liquidModel(fills[id]);
    vessel.add(current, currentFill.group);
    setColor(sourceTint);
    if (animationStart !== null) animateMixture();
    else if (reaction) drawReaction(reactionSeconds, reducedMotion.matches);
    else drawChalk(mixture.includes('chalk') ? 1 : 0);
  }

  const tint = new T.Color();
  const cloudy = new T.Color('#e0ddf0');
  const targetTint = new T.Color();
  const smoothstep = T.MathUtils.smoothstep;

  function drawChalk(amount) {
    const { spec } = currentFill;
    for (const [i, mesh] of chalkPieces.entries()) {
      const size = (.042 + (i % 3) * .022) * amount;
      mesh.visible = size > .004;
      mesh.scale.set(size * 1.25, size, size);
      const radius = (spec.sedimentRadius ?? spec.radius) * (.20 + (i % 3) * .20);
      mesh.position.set(Math.cos(i * 2.4) * radius, spec.base + size * .75, Math.sin(i * 2.4) * radius);
    }
  }

  function drawBubbles(elapsed, spec, still) {
    for (const { mesh, angle, distance, delay, cycle, size } of bubbles) {
      const age = elapsed - delay;
      const phase = still ? delay / 3.5 : (age % cycle) / cycle;
      const strength = still ? 1 : smoothstep(elapsed, .25, 2.5) * (1 - smoothstep(elapsed, 9.5, reactionSeconds));
      mesh.visible = reaction.gas && (still || (age >= 0 && strength > .01 && phase < .96));
      if (!mesh.visible) continue;
      const swell = smoothstep(phase, 0, .25) * (1 - smoothstep(phase, .80, .97));
      const radius = distance * spec.radius * (.42 + phase * .54);
      const wobble = angle + Math.sin(phase * 9 + angle) * .35;
      const scale = size * swell * (.4 + .6 * strength);
      mesh.position.set(Math.cos(wobble) * radius, T.MathUtils.lerp(spec.base, spec.top + .025, phase), Math.sin(wobble) * radius);
      mesh.scale.set(scale, scale * (1 + .30 * Math.sin(phase * 16)), scale);
    }
  }

  function drawReaction(elapsed, still) {
    const { spec, sediment } = currentFill;
    const settles = reaction.precipitate || reaction.settles;
    const pourAmount = smoothstep(elapsed, 0, .35) * (1 - smoothstep(elapsed, 1.05, 1.8));
    pour.visible = !still && pourAmount > .01;
    pour.scale.set(1.4, pourAmount, 1.4);
    pour.position.y = spec.top + 1.77 * pourAmount / 2;
    const blended = still ? 1 : smoothstep(elapsed, 1.2, 10.5);
    const clouds = settles ? smoothstep(elapsed, .65, 3.3) * (1 - smoothstep(elapsed, 6, 13.5)) : 0;
    targetTint.set(reaction.color ?? sourceTint);
    setColor(tint.copy(sourceTint).lerp(targetTint, blended).lerp(cloudy, clouds * .6));
    const bed = still ? 1 : smoothstep(elapsed, 4.2, 13.2);
    sediment.visible = settles && bed > .01;
    if (sediment.visible) {
      sediment.material.color.set(reaction.precipitateColor ?? sedimentColor);
      sediment.material.emissive.set(reaction.precipitateColor ?? sedimentGlow);
    }
    sediment.scale.set(.75 + .25 * bed, bed, .75 + .25 * bed);
    for (const [i, mesh] of grains.entries()) {
      const arrival = 9.4 + (i % 7) * .55;
      const progress = smoothstep(elapsed, 2.4 + (i % 6) * .38, arrival);
      mesh.visible = settles && !still && elapsed > .8 + (i % 4) * .2 && elapsed < arrival;
      if (!mesh.visible) continue;
      const angle = i * 2.4 + Math.sin(elapsed * 1.8 + i) * (1 - progress) * .34;
      const radius = T.MathUtils.lerp(spec.radius * .78, (spec.sedimentRadius ?? spec.radius) * .84, progress) * (.35 + (i % 7) / 11);
      mesh.position.set(Math.sin(angle) * radius, T.MathUtils.lerp(spec.top * (.65 + (i % 4) * .1), spec.base + .045, progress), Math.cos(angle) * radius);
    }

    const chalkAmount = reaction.dissolves || reaction.settles ? (still ? 0 : 1 - smoothstep(elapsed, 1, 12.2)) : 0;
    drawChalk(chalkAmount);
    drawBubbles(elapsed, spec, still);
    for (const [i, mesh] of ripples.entries()) {
      const age = elapsed - .6 - i * .46;
      const phase = (age % 2.7) / 2.7;
      const strength = 1 - smoothstep(elapsed, reaction.gas ? 8 : 3, reaction.gas ? 12.8 : 7.7);
      mesh.visible = !still && age >= 0 && strength > 0;
      if (!mesh.visible) continue;
      mesh.position.y = spec.top + .012 + i * .002;
      mesh.scale.setScalar(spec.radius * (.07 + .86 * phase));
      mesh.material.opacity = .76 * strength * Math.sin(Math.PI * phase) ** 2;
    }
    inkMaterial.color.copy(targetTint);
    inkMaterial.opacity = .42 * (1 - blended);
    for (const [i, mesh] of inkDrops.entries()) {
      const progress = smoothstep(elapsed, .95 + i * .17, 6.8 + i * .19);
      mesh.visible = Boolean(reaction.color && !still && progress > 0 && progress < 1);
      if (!mesh.visible) continue;
      const angle = i * 2.4 + progress * 4.2;
      const radius = spec.radius * .53 * progress;
      const scale = (.075 + (i % 4) * .019) * Math.sin(Math.PI * progress);
      mesh.position.set(Math.sin(angle) * radius, T.MathUtils.lerp(spec.top, spec.top * .51 + spec.base * .49, progress), Math.cos(angle) * radius);
      mesh.scale.set(scale * 1.6, scale * .65, scale);
    }
  }

  function animateMixture() {
    if (animationStart === null) return;
    const elapsed = Math.min(reactionSeconds, (performance.now() - animationStart) / 1000);
    const still = reducedMotion.matches;
    drawReaction(still ? reactionSeconds : elapsed, still);
    if (elapsed >= reactionSeconds || still) animationStart = null;
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
  let xrOrientationSet = false;
  let placeRequested = false;
  let placement = 0;
  let anchor;
  let onState;
  const surfaceTransform = new T.Matrix4();
  const markerPosition = new T.Vector3();
  const markerRotation = new T.Quaternion();
  const tableRotation = new T.Quaternion();
  const surfaceRotation = new T.Quaternion();
  const markerRight = new T.Vector3();
  const markerUp = new T.Vector3();
  const markerDown = new T.Vector3();
  const tableOrigin = new T.Vector3();
  const vesselOffset = new T.Vector3();
  const dragOffset = new T.Vector3();
  const dragPoint = new T.Vector3();
  const dragRotation = new T.Quaternion();
  const floorPlane = new T.Plane();
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const canvas = renderer.domElement;
  let dragId;
  let displayWidth = 0;
  let displayHeight = 0;

  function updateMarkerProjection() {
    const { videoWidth, videoHeight } = markerVideo;
    if (!videoWidth || !videoHeight || !displayWidth || !displayHeight) return;
    const cover = Math.max(displayWidth / videoWidth, displayHeight / videoHeight);
    const focal = markerFocalLength(videoWidth, videoHeight) * cover;
    markerCamera.aspect = displayWidth / displayHeight;
    markerCamera.fov = T.MathUtils.radToDeg(2 * Math.atan(displayHeight / (2 * focal)));
    markerCamera.updateProjectionMatrix();
  }

  function setMarkerVideo(video) {
    if (markerVideo === video) return;
    markerVideo = video;
    if (video) {
      vesselOffset.set(0, 0, 0);
      root.scale.setScalar(vesselScale);
      root.visible = false;
      beginPlacementScene();
      updateMarkerProjection();
    } else {
      stopDrag();
      restoreWorkbench();
    }
  }

  function setMarkerPose(pose) {
    if (!markerVideo) return;
    if (!pose) {
      root.visible = false;
      stopDrag();
      return;
    }
    updateMarkerProjection();
    markerPosition.fromArray(pose.position);
    markerRight.fromArray(pose.right).normalize();
    markerDown.fromArray(pose.down);
    markerUp.crossVectors(markerDown, markerRight).normalize();
    markerDown.crossVectors(markerRight, markerUp).normalize();
    markerRotation.setFromRotationMatrix(surfaceTransform.makeBasis(markerRight, markerUp, markerDown));
    if (root.visible) {
      tableOrigin.lerp(markerPosition, .55);
      tableRotation.slerp(markerRotation, .55);
    } else {
      tableOrigin.copy(markerPosition);
      tableRotation.copy(markerRotation);
      root.quaternion.copy(tableRotation);
      root.visible = true;
    }
    // Dragging translates the flask. Only camera tracking updates its orientation.
    if (dragId === undefined) root.quaternion.slerp(tableRotation, .3);
    updateVesselPosition();
  }

  function updateVesselPosition() {
    root.position.copy(vesselOffset).applyQuaternion(tableRotation).add(tableOrigin);
  }

  function pointOnTable(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(pointer, markerCamera);
    markerUp.set(0, 1, 0).applyQuaternion(tableRotation);
    floorPlane.setFromNormalAndCoplanarPoint(markerUp, tableOrigin);
    if (!raycaster.ray.intersectPlane(floorPlane, dragPoint)) return null;
    dragRotation.copy(tableRotation).invert();
    return dragPoint.sub(tableOrigin).applyQuaternion(dragRotation);
  }

  function stopDrag(event) {
    if (dragId === undefined || (event && event.pointerId !== dragId)) return;
    const id = dragId;
    dragId = undefined;
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!markerVideo || !root.visible || dragId !== undefined || event.button !== 0) return;
    const point = pointOnTable(event);
    if (!point) return;
    current.updateWorldMatrix(true, true);
    if (raycaster.intersectObject(current, true).length === 0) return;
    dragOffset.copy(vesselOffset).sub(point);
    dragId = event.pointerId;
    canvas.setPointerCapture(dragId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== dragId) return;
    const point = pointOnTable(event);
    if (!point) return;
    point.add(dragOffset);
    if (point.lengthSq() > 2.25) return;
    vesselOffset.set(point.x, 0, point.z);
    updateVesselPosition();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, stopDrag);
  }

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1 || renderer.xr.isPresenting) return;
    displayWidth = width;
    displayHeight = height;
    camera.aspect = width / height;
    // Keep wide vessels in frame when the stage fills a tall phone screen.
    const portraitFov = 2 * Math.atan(Math.tan(T.MathUtils.degToRad(14)) / camera.aspect);
    camera.fov = camera.aspect < 1 ? Math.max(40, T.MathUtils.radToDeg(portraitFov)) : 33;
    camera.updateProjectionMatrix();
    if (markerVideo) updateMarkerProjection();
    renderer.setSize(width, height, false);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function clearPlacement() {
    placement++;
    anchor?.delete();
    anchor = null;
    placeRequested = false;
    placed = false;
    reticle.visible = false;
    root.visible = false;
  }

  function requestPlacement() {
    if (session && !placed && reticle.visible) placeRequested = true;
  }

  function moveVessel() {
    if (!session || !placed) return;
    clearPlacement();
    onState('scanning');
  }

  function applySurfacePose(matrix) {
    surfaceTransform.fromArray(matrix).decompose(root.position, surfaceRotation, root.scale);
    if (!xrOrientationSet) {
      root.quaternion.copy(surfaceRotation);
      xrOrientationSet = true;
    }
    root.scale.setScalar(vesselScale);
  }

  async function attachAnchor(hit, active, revision) {
    try {
      const trackedAnchor = await hit.createAnchor();
      if (session === active && placement === revision) anchor = trackedAnchor;
      else trackedAnchor.delete();
    } catch {
      // Keep the placement pose in the session's local reference space.
    }
  }

  function finishXR(ended) {
    if (session !== ended) return;
    hits?.cancel();
    hits = null;
    session = null;
    clearPlacement();
    restoreWorkbench();
    onState?.('ended');
    requestAnimationFrame(resize);
  }

  function restoreWorkbench() {
    root.position.set(0, 0, 0);
    root.quaternion.identity();
    root.scale.setScalar(1);
    root.visible = true;
    vessel.position.y = 0;
    contactShadow.visible = false;
    orbit.enabled = true;
    base.visible = true;
  }

  function beginPlacementScene() {
    vessel.position.y = -contactHeight;
    contactShadow.visible = true;
    base.visible = false;
    orbit.enabled = false;
  }

  async function startXR(overlay, onChange) {
    const active = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local', 'hit-test', 'dom-overlay'],
      optionalFeatures: ['anchors'],
      domOverlay: { root: overlay },
    });
    session = active;
    onState = onChange;
    xrOrientationSet = false;
    clearPlacement();
    beginPlacementScene();
    active.addEventListener('end', () => finishXR(active), { once: true });
    active.addEventListener('select', requestPlacement);
    try {
      await renderer.xr.setSession(active);
      const viewer = await active.requestReferenceSpace('viewer');
      const source = await active.requestHitTestSource({ space: viewer });
      if (session === active) hits = source;
      else source.cancel();
    } catch (error) {
      if (session === active) await active.end().catch(() => {});
      finishXR(active);
      throw error;
    }
  }

  function updatePlacement(frame, space) {
    if (placed) {
      if (!anchor) return;
      const pose = frame.getPose(anchor.anchorSpace, space);
      root.visible = Boolean(pose);
      if (pose) applySurfacePose(pose.transform.matrix);
      return;
    }
    const placeNow = placeRequested;
    placeRequested = false;
    for (const hit of frame.getHitTestResults(hits)) {
      const matrix = hit.getPose(space)?.transform.matrix;
      // The hit-test pose's local Y axis is the normal to the surface.
      if (!matrix || matrix[5] < minSurfaceNormalY) continue;
      target.matrix.fromArray(matrix);
      target.matrixWorldNeedsUpdate = true;
      if (placeNow) {
        applySurfacePose(matrix);
        root.visible = true;
        placed = true;
        reticle.visible = false;
        if (hit.createAnchor) void attachAnchor(hit, session, ++placement);
        onState('placed');
      } else if (!reticle.visible) {
        reticle.visible = true;
        onState('ready');
      }
      return;
    }
    if (reticle.visible) {
      reticle.visible = false;
      onState('scanning');
    }
  }

  renderer.setAnimationLoop((_, frame) => {
    const space = frame && renderer.xr.getReferenceSpace();
    if (space && hits) updatePlacement(frame, space);
    if (!frame) {
      if (stage.closest('[hidden]')) return;
      if (!markerVideo) orbit.update();
    }
    animateMixture();
    renderer.render(scene, markerVideo ? markerCamera : camera);
  });

  return { resetView, setMixture, startReaction, selectVessel, startXR, endXR: () => session?.end(), requestPlacement, moveVessel, setMarkerVideo, setMarkerPose };
}


