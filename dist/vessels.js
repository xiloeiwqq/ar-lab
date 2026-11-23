export const primaryProfile = [
  [.015, .04], [.76, .04], [.87, .055], [.94, .094], [.982, .16], [.986, .23],
  [.96, .31], [.59, 1.13], [.41, 1.52], [.34, 1.61], [.30, 1.69],
  [.297, 2.25], [.31, 2.28], [.34, 2.29], [.355, 2.33], [.344, 2.38],
  [.30, 2.398], [.265, 2.38], [.264, 2.32], [.273, 2.28],
];

export const fills = {
  simulation: { profile: [[0, .105], [.83, .105], [.91, .165], [.918, .225], [.90, .3], [.72, .71]], radius: .72, base: .13, top: .71 },
  erlenmeyer: { profile: [[0, .055], [.57, .055], [.655, .10], [.66, .16], [.60, .30], [.49, .62]], radius: .49, base: .06, top: .62 },
  round: { profile: [[0, .055], [.24, .085], [.44, .16], [.59, .29], [.65, .42], [.71, .59], [.73, .70]], radius: .73, base: .13, top: .70, sedimentRadius: .24 },
};

export const assets = {
  erlenmeyer: { url: './assets/erlenmeyer-reference.glb', height: .145 },
  round: { url: './assets/round-bottom-reference.glb', height: .16, minY: .031966615, z: .025 },
};

export const vesselScale = .087;
