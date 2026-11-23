const markerWidth = .10;

export function markerFocalLength(width, height) {
  // Use the same camera estimate for the pose and the rendered projection.
  return Math.max(width, height) * .87;
}

export function estimateMarkerPose(location, width, height) {
  const focal = markerFocalLength(width, height);
  const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = location;
  const [tl, tr, br, bl] = [topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner]
    .map(({ x, y }) => [(x - width / 2) / focal, (y - height / 2) / focal]);

  // Recover the projective transform from the unit square to the camera image.
  const dx1 = tr[0] - br[0];
  const dx2 = bl[0] - br[0];
  const dx3 = tl[0] - tr[0] + br[0] - bl[0];
  const dy1 = tr[1] - br[1];
  const dy2 = bl[1] - br[1];
  const dy3 = tl[1] - tr[1] + br[1] - bl[1];
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < .0001) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const right = [tr[0] * (1 + g) - tl[0], tr[1] * (1 + g) - tl[1], g];
  const down = [bl[0] * (1 + h) - tl[0], bl[1] * (1 + h) - tl[1], h];
  const scale = 2 * markerWidth / (Math.hypot(...right) + Math.hypot(...down));
  const center = [tl[0], tl[1], 1].map((value, i) => (value + (right[i] + down[i]) / 2) * scale);
  if (!Number.isFinite(center[2]) || center[2] <= .04) return null;

  // Camera image coordinates point down and forward, while Three.js uses up and back.
  const toThree = ([x, y, z]) => [x, -y, -z];
  return { position: toThree(center), right: toThree(right), down: toThree(down) };
}
