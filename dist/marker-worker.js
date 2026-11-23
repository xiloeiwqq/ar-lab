importScripts('./vendor/jsQR.js');
// The jsfeat browser bundle exports through window, which is absent in a worker.
self.window = self;
importScripts('./vendor/jsfeat.js');
delete self.window;

const cv = self.jsfeat;
const minPoints = 8;
const maxPoints = 48;
const homography = new cv.motion_model.homography2d();
const ransac = new cv.ransac_params_t(4, 2.5, .45, .99);
const transform = new cv.matrix_t(3, 3, cv.F32C1_t);
const inliers = new cv.matrix_t(maxPoints, 1, cv.U8C1_t);
const keyframeInterval = 18;
const keyframes = [];
let previous;
let current;
let corners;
let points = [];
let markerId;
let seedIn = 0;
let saveIn = keyframeInterval;
let failedFrames = 0;

function createPyramid(width, height) {
  const pyramid = new cv.pyramid_t(3);
  pyramid.allocate(width, height, cv.U8C1_t);
  return pyramid;
}

function resetImages(width, height) {
  previous = createPyramid(width, height);
  current = createPyramid(width, height);
  corners = undefined;
  points = [];
  seedIn = 0;
  saveIn = keyframeInterval;
  failedFrames = 0;
  keyframes.length = 0;
}

function bounds(points) {
  return {
    left: Math.min(...points.map(({ x }) => x)),
    right: Math.max(...points.map(({ x }) => x)),
    top: Math.min(...points.map(({ y }) => y)),
    bottom: Math.max(...points.map(({ y }) => y)),
  };
}

function hasCoverage(points) {
  if (points.length < minPoints) return false;
  const { left, right, top, bottom } = bounds(points);
  return right - left >= 36 && bottom - top >= 36;
}

function cornerScore(pixels, width, x, y) {
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let row = y - 3; row <= y + 3; row++) {
    for (let col = x - 3; col <= x + 3; col++) {
      const p = row * width + col;
      const dx = pixels[p + 1] - pixels[p - 1];
      const dy = pixels[p + width] - pixels[p - width];
      xx += dx * dx;
      yy += dy * dy;
      xy += dx * dy;
    }
  }
  // The smaller eigenvalue is high for corners and low for straight edges.
  return (xx + yy - Math.hypot(xx - yy, 2 * xy)) / 2;
}

function seedSurface(image, quad, retained = []) {
  const { left, right, top, bottom } = bounds(quad);
  const span = Math.max(right - left, bottom - top);
  const padding = Math.max(8, span * .22);
  const reach = Math.max(90, span * 1.45);
  const surface = [];
  for (let y = Math.max(15, Math.ceil(top - reach)); y < Math.min(image.rows - 15, bottom + reach); y += 4) {
    for (let x = Math.max(15, Math.ceil(left - reach)); x < Math.min(image.cols - 15, right + reach); x += 4) {
      if (x >= left - padding && x <= right + padding && y >= top - padding && y <= bottom + padding) continue;
      const score = cornerScore(image.data, image.cols, x, y);
      if (score > 850) surface.push({ x, y, score });
    }
  }
  surface.sort((a, b) => b.score - a.score);
  const selected = retained.slice();
  for (const { x, y } of surface) {
    if (selected.length === maxPoints) break;
    if (selected.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < 14 ** 2)) continue;
    selected.push({ x, y });
  }
  return selected;
}

function patchCorrelation(fromImage, toImage, start, end) {
  const { cols: width, rows: height } = fromImage;
  const x = Math.round(start.x), y = Math.round(start.y);
  const u = Math.round(end.x), v = Math.round(end.y);
  const radius = 4;
  if (Math.min(x, y, u, v) < radius || Math.max(x, u) >= width - radius || Math.max(y, v) >= height - radius) return 0;
  let a = 0, b = 0, aa = 0, bb = 0, ab = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const p = fromImage.data[(y + dy) * width + x + dx];
      const q = toImage.data[(v + dy) * width + u + dx];
      a += p;
      b += q;
      aa += p * p;
      bb += q * q;
      ab += p * q;
    }
  }
  // Correlation rejects a different patch even if its average brightness is similar.
  const size = (2 * radius + 1) ** 2;
  const contrast = Math.sqrt((aa - a * a / size) * (bb - b * b / size));
  return contrast > 0 ? (ab - a * b / size) / contrast : 0;
}

function fitSurface(reference, referencePoints, recovering = false) {
  const count = referencePoints.length;
  const start = Float32Array.from(referencePoints.flatMap(({ x, y }) => [x, y]));
  const end = new Float32Array(start.length);
  const back = new Float32Array(start.length);
  const found = new Uint8Array(count);
  const returned = new Uint8Array(count);
  const windowSize = recovering ? 23 : 17;
  cv.optical_flow_lk.track(reference, current, start, end, count, windowSize, 25, found);
  cv.optical_flow_lk.track(current, reference, end, back, count, windowSize, 25, returned);
  const from = [];
  const to = [];
  const similarities = [];
  for (let i = 0; i < count; i++) {
    const ix = i * 2;
    if (!found[i] || !returned[i] || Math.hypot(start[ix] - back[ix], start[ix + 1] - back[ix + 1]) > 1.6) continue;
    const point = { x: end[ix], y: end[ix + 1] };
    const similarity = recovering ? patchCorrelation(reference.data[0], current.data[0], referencePoints[i], point) : 1;
    if (similarity < .78) continue;
    from.push(referencePoints[i]);
    to.push(point);
    similarities.push(similarity);
  }
  if (!hasCoverage(from) || !cv.motion_estimator.ransac(ransac, homography, from, to, from.length, transform, inliers, 90)) return null;
  const reliableFrom = from.filter((_, i) => inliers.data[i]);
  const reliableTo = to.filter((_, i) => inliers.data[i]);
  const quality = similarities.reduce((sum, similarity, i) => sum + (inliers.data[i] ? similarity : 0), 0);
  if (reliableTo.length < to.length * .65 || !hasCoverage(reliableTo)) return null;
  if (!homography.run(reliableFrom, reliableTo, transform, reliableFrom.length)) return null;
  return { points: reliableTo, quality };
}

function area(quad) {
  return quad.reduce((sum, p, i) => {
    const q = quad[(i + 1) % quad.length];
    return sum + p.x * q.y - p.y * q.x;
  }, 0) / 2;
}

function projectCorners(referenceCorners, width, height) {
  const m = transform.data;
  const projected = referenceCorners.map(({ x, y }) => {
    const w = m[6] * x + m[7] * y + m[8];
    return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
  });
  if (projected.some((p, i) => !Number.isFinite(p.x + p.y) ||
    Math.hypot(p.x - referenceCorners[i].x, p.y - referenceCorners[i].y) > Math.max(width, height) * .25)) return null;
  const ratio = area(projected) / area(referenceCorners);
  return ratio > .55 && ratio < 1.8 ? projected : null;
}

function trackedLocation([topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner]) {
  return { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner };
}

function saveKeyframe(index) {
  const image = previous.data[0];
  const pyramid = keyframes[index]?.pyramid ?? createPyramid(image.cols, image.rows);
  pyramid.data[0].data.set(image.data);
  pyramid.build(pyramid.data[0]);
  keyframes[index] = { pyramid, corners, points };
}

function matchFrame(reference, width, height, recovering = false) {
  const tracked = fitSurface(reference.pyramid, reference.points, recovering);
  const projected = tracked && projectCorners(reference.corners, width, height);
  return projected ? { corners: projected, ...tracked } : null;
}

self.onmessage = ({ data: { pixels, width, height } }) => {
  const image = current?.data[0];
  if (!image || image.cols !== width || image.rows !== height) resetImages(width, height);
  cv.imgproc.grayscale(pixels, width, height, current.data[0]);
  if (!corners) {
    const code = self.jsQR(pixels, width, height, { inversionAttempts: 'dontInvert' });
    if (!code || (markerId !== undefined && markerId !== code.data)) {
      self.postMessage(null);
      return;
    }
    markerId = code.data;
    const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = code.location;
    const quad = [topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner];
    const seeds = seedSurface(current.data[0], quad);
    if (hasCoverage(seeds)) {
      current.build(current.data[0]);
      [previous, current] = [current, previous];
      corners = quad;
      points = seeds;
      saveKeyframe(0);
    }
    self.postMessage({ location: code.location, tracking: corners ? 'surface' : 'code' });
    return;
  }

  current.build(current.data[0]);
  const reference = { pyramid: previous, corners, points };
  let match = matchFrame(reference, width, height, failedFrames > 0);
  if (failedFrames > 0 && (match || failedFrames % 4 === 0)) {
    // Try the initial and recent views while keeping the last accepted position.
    for (const keyframe of keyframes) {
      const candidate = matchFrame(keyframe, width, height, true);
      if (candidate && (!match || candidate.quality > match.quality)) match = candidate;
    }
  }
  if (!match) {
    failedFrames++;
    self.postMessage(null);
    return;
  }
  if (failedFrames > 0) seedIn = 0;
  failedFrames = 0;
  corners = match.corners;
  points = match.points;
  if (--seedIn <= 0 || points.length < maxPoints / 2) {
    points = seedSurface(current.data[0], corners, points);
    seedIn = 5;
  }
  [previous, current] = [current, previous];
  if (--saveIn <= 0) {
    saveKeyframe(1);
    saveIn = keyframeInterval;
  }
  self.postMessage({ location: trackedLocation(corners), tracking: 'surface' });
};
