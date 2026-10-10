/* EcoCity 3D world: floating island, models, roads, life, state-driven environment */
(function (root) {
'use strict';
const { M4, C, mixc, fbm, vnoise, hash, rng, Geo, Engine } = root.GL3;
const E = root.Eco, B = E.B, W = E.WORLD, H = (W - 1) / 2;
const tw = v => v - H;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* =====================================================
   Building models (tile = 1 unit, ground y = 0)
   ===================================================== */
const P = {
  wallCream: '#f2e4c6', wallWhite: '#f6f4ee', wallPeach: '#f3c9a5', wallBlue: '#cfe0ea', wallSand: '#e8d3a8',
  roofRed: '#c9503a', roofTerra: '#d77a42', roofSlate: '#5d7790', roofDark: '#4d565f', roofGreen: '#3f8f5a',
  glass: '#7fb6dc', glassDark: '#3e6f97', win: '#35546e', door: '#6a4a2e', wood: '#8a5a33',
  lawn: '#86c95f', hedge: '#3f8f3f', leaf: '#4fae47', leafDark: '#2f7f3c', pine: '#2f7a3f', pineLight: '#3d9149', trunk: '#6b4528',
  concrete: '#c8cbcf', concreteDark: '#8e949b', metal: '#a9b0b6', asphalt: '#4d5258', soil: '#8a6a3f',
  pad: '#b9b4a6', gold: '#e8b52f', coal: '#2a2927', steelBlue: '#5b84ad', red: '#d8443a', white: '#f4f6f8',
};
function box(g, c, x, y, z, w, h, d, ry) { return g.add('box', c, x, y, z, w, h, d, ry); }
function cyl(g, c, x, y, z, r, h, n) { return g.add('cyl:' + (n || 10), c, x, y, z, r, h, r); }
function cone(g, c, x, y, z, r, h, n) { return g.add('cone:' + (n || 8), c, x, y, z, r, h, r); }
function sph(g, c, x, y, z, r, sy, n) { return g.add('sph:' + (n || 8), c, x, y, z, r, sy == null ? r : sy, r); }
function gable(g, c, x, y, z, w, h, len, ry) { return g.add('prism', c, x, y, z, w, h, len, ry); }
function hip(g, c, x, y, z, w, h, d, ry) { return g.add('pyr', c, x, y, z, w, h, d, ry); }

function treeRound(g, x, z, s, c1, c2, y0) {
  y0 = y0 || 0; s = s || 1;
  cyl(g, P.trunk, x, y0, z, 0.035 * s, 0.2 * s, 5);
  sph(g, c1 || P.leaf, x, y0 + 0.3 * s, z, 0.17 * s, 0.16 * s, 7);
  sph(g, c2 || '#5fbf52', x + 0.05 * s, y0 + 0.38 * s, z - 0.03 * s, 0.11 * s, 0.1 * s, 6);
}
function treePine(g, x, z, s, y0) {
  y0 = y0 || 0; s = s || 1;
  cyl(g, P.trunk, x, y0, z, 0.03 * s, 0.14 * s, 5);
  cone(g, P.pine, x, y0 + 0.1 * s, z, 0.18 * s, 0.32 * s, 7);
  cone(g, P.pineLight, x, y0 + 0.28 * s, z, 0.13 * s, 0.26 * s, 7);
}
function windowsRing(g, cx, cz, w, d, y0, rows, rowH, cols, col, inset) {
  // small window boxes on all four faces of an axis-aligned block
  const ww = Math.min(0.11, (w / cols) * 0.55), wd = Math.min(0.11, (d / cols) * 0.55), wh = rowH * 0.5;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * rowH + rowH * 0.28;
    for (let c = 0; c < cols; c++) {
      const fx = -w / 2 + (c + 0.5) * (w / cols), fz = -d / 2 + (c + 0.5) * (d / cols);
      box(g, col, cx + fx, y, cz + d / 2 + 0.004, ww, wh, 0.012);
      box(g, col, cx + fx, y, cz - d / 2 - 0.004, ww, wh, 0.012);
      box(g, col, cx + w / 2 + 0.004, y, cz + fz, 0.012, wh, wd);
      box(g, col, cx - w / 2 - 0.004, y, cz + fz, 0.012, wh, wd);
    }
  }
}
function house(g, x, z, w, d, h, wall, roof, ry, rh) {
  // ridge along the longer side
  box(g, wall, x, 0, z, w, h, d, ry);
  const along = w >= d;
  gable(g, roof, x, h, z, (along ? d : w) + 0.06, rh || 0.2, (along ? w : d) + 0.06, (ry || 0) + (along ? Math.PI / 2 : 0));
  // door + windows on +z face (rotated with house)
  const c = Math.cos(ry || 0), s = Math.sin(ry || 0);
  const P2 = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  let p = P2(-w * 0.18, d / 2 + 0.005); box(g, P.door, p[0], 0, p[1], 0.07, 0.13, 0.012, ry);
  p = P2(w * 0.18, d / 2 + 0.005); box(g, P.win, p[0], h * 0.4, p[1], 0.08, 0.07, 0.012, ry);
  p = P2(w / 2 + 0.005, 0); box(g, P.win, p[0], h * 0.4, p[1], 0.012, 0.07, 0.08, ry);
  p = P2(-w / 2 - 0.005, 0); box(g, P.win, p[0], h * 0.4, p[1], 0.012, 0.07, 0.08, ry);
}

const MODELS = {
  hut(g) {
    box(g, '#8fcb63', 0, 0, 0, 0.92, 0.025, 0.92);
    box(g, '#c9b48a', 0.12, 0.02, 0.32, 0.12, 0.012, 0.3);
    house(g, -0.12, -0.02, 0.44, 0.34, 0.26, P.wallCream, P.roofRed, 0, 0.18);
    house(g, 0.24, -0.26, 0.26, 0.24, 0.2, '#efd9b4', P.roofTerra, 0, 0.14);
    treeRound(g, 0.3, 0.26, 0.8);
    sph(g, P.hedge, -0.34, 0.06, 0.32, 0.07, 0.06, 6); sph(g, P.hedge, -0.22, 0.06, 0.36, 0.06, 0.05, 6);
  },
  house(g) {
    box(g, '#8fcb63', 0, 0, 0, 0.94, 0.025, 0.94);
    box(g, '#b9b6ae', 0.0, 0.02, 0.0, 0.14, 0.012, 0.94);
    house(g, -0.24, -0.2, 0.34, 0.3, 0.26, P.wallWhite, P.roofSlate, 0, 0.18);
    house(g, 0.25, 0.18, 0.34, 0.3, 0.26, P.wallPeach, P.roofRed, 0, 0.18);
    house(g, -0.24, 0.24, 0.3, 0.26, 0.22, P.wallBlue, P.roofTerra, 0, 0.16);
    house(g, 0.25, -0.24, 0.3, 0.26, 0.22, P.wallCream, P.roofDark, 0, 0.16);
  },
  community(g) {
    box(g, '#8fcb63', 0, 0, 0, 0.94, 0.025, 0.94);
    box(g, '#cfc8b8', 0, 0.02, 0.3, 0.9, 0.012, 0.22);
    const walls = [P.wallCream, P.wallPeach, P.wallBlue, P.wallSand], roofs = [P.roofRed, P.roofTerra, P.roofSlate, P.roofRed];
    for (let i = 0; i < 4; i++) {
      const x = -0.33 + i * 0.22;
      box(g, walls[i], x, 0, -0.08, 0.21, 0.42, 0.42);
      gable(g, roofs[i], x, 0.42, -0.08, 0.46, 0.17, 0.23, 0);
      box(g, P.door, x - 0.04, 0, 0.135, 0.06, 0.12, 0.012);
      box(g, P.win, x + 0.05, 0.05, 0.135, 0.06, 0.07, 0.012);
      box(g, P.win, x, 0.25, 0.135, 0.12, 0.08, 0.012);
      box(g, P.win, x, 0.25, -0.295, 0.12, 0.08, 0.012);
    }
    sph(g, P.hedge, -0.36, 0.06, 0.4, 0.06, 0.05, 6); sph(g, P.hedge, 0.36, 0.06, 0.4, 0.06, 0.05, 6);
  },
  apartment(g) {
    box(g, '#9ea4aa', 0, 0, 0, 0.94, 0.03, 0.94);
    box(g, P.concrete, 0.04, 0.03, 0.04, 0.84, 0.16, 0.84);
    box(g, P.glassDark, 0.04, 0.05, 0.465, 0.6, 0.1, 0.012);
    box(g, '#e9e4da', 0, 0.19, -0.04, 0.56, 1.62, 0.56);
    windowsRing(g, 0, -0.04, 0.56, 0.56, 0.21, 9, 0.172, 3, P.glass);
    for (let r = 1; r < 9; r += 2) box(g, '#ffffff', 0, 0.19 + r * 0.172, 0.25, 0.6, 0.018, 0.04);
    box(g, '#d2cdc2', 0, 1.81, -0.04, 0.6, 0.05, 0.6);
    cyl(g, P.metal, 0.14, 1.86, -0.12, 0.07, 0.12, 8);
    box(g, P.concreteDark, -0.12, 1.86, 0.05, 0.14, 0.08, 0.14);
    box(g, '#e9e4da', 0.36, 0.19, 0.3, 0.2, 0.55, 0.22);
    windowsRing(g, 0.36, 0.3, 0.2, 0.22, 0.21, 3, 0.17, 1, P.glass);
  },
  foodFarm(g) {
    box(g, P.soil, 0, 0, 0, 0.96, 0.03, 0.96);
    for (let i = 0; i < 8; i++) box(g, i % 2 ? '#6db53e' : '#8fca4a', -0.4 + i * 0.105, 0.03, 0.04, 0.075, 0.06 + (i % 3) * 0.008, 0.82);
    box(g, '#b8443a', -0.34, 0.03, -0.38, 0.22, 0.16, 0.16);
    gable(g, '#5e3b2a', -0.34, 0.19, -0.38, 0.19, 0.09, 0.25, Math.PI / 2);
    box(g, '#f4f4f4', -0.34, 0.05, -0.299, 0.07, 0.09, 0.01);
    g.add('cyl:10', '#e3c25c', 0.36, 0.05, -0.4, 0.05, 0.09, 0.05, 0, 0, Math.PI / 2);
  },
  cashFarm(g) {
    box(g, '#9b7a47', 0, 0, 0, 0.96, 0.03, 0.96);
    for (let i = 0; i < 7; i++) {
      const x = -0.38 + i * 0.125;
      box(g, '#7fae3e', x, 0.03, 0.05, 0.06, 0.07, 0.8);
      for (let k = 0; k < 6; k++) sph(g, '#fbfaf3', x + (k % 2 ? 0.02 : -0.02), 0.11, -0.32 + k * 0.14, 0.028, 0.026, 5);
    }
    box(g, '#3f78b5', 0.34, 0.03, -0.38, 0.2, 0.13, 0.15);
    gable(g, '#d7d7d2', 0.34, 0.16, -0.38, 0.17, 0.07, 0.23, Math.PI / 2);
  },
  coalPlant(g, fp) {
    const t = fp.map(([x, z]) => [x, z]);
    t.forEach(([x, z]) => box(g, '#55524c', x, 0, z, 0.98, 0.03, 0.98));
    const [a, b, c] = t;
    // turbine hall with sawtooth roof
    box(g, '#9aa1a8', a[0], 0.03, a[1], 0.78, 0.42, 0.66);
    for (let i = 0; i < 3; i++) gable(g, '#5d6670', a[0] - 0.26 + i * 0.26, 0.45, a[1], 0.26, 0.12, 0.66, 0);
    windowsRing(g, a[0], a[1], 0.78, 0.66, 0.08, 2, 0.15, 4, '#5a7f9e');
    // boiler house + chimneys
    box(g, '#8b9096', b[0], 0.03, b[1], 0.56, 0.72, 0.56);
    box(g, '#6d737a', b[0], 0.75, b[1], 0.4, 0.12, 0.4);
    const ch = [[b[0] + 0.28, b[1] - 0.28], [b[0] + 0.28, b[1] + 0.22]];
    ch.forEach(([x, z]) => { for (let k = 0; k < 6; k++) g.add('fr:12:0.88', k % 2 ? '#f2f2f2' : '#c4483a', x, 0.03 + k * 0.27, z, 0.1 - k * 0.008, 0.27, 0.1 - k * 0.008); });
    // coal piles + conveyor
    cone(g, P.coal, c[0] - 0.15, 0.03, c[1] - 0.1, 0.32, 0.3, 9); cone(g, '#1d1c1b', c[0] + 0.2, 0.03, c[1] + 0.18, 0.24, 0.22, 8);
    const mx = (b[0] + c[0]) / 2, mz = (b[1] + c[1]) / 2, ang = Math.atan2(c[0] - b[0], c[1] - b[1]);
    g.add('box', '#6f6a63', mx, 0.32, mz, 0.08, 0.05, 1.0, ang, 0.28);
    box(g, '#c9a33a', c[0] + 0.32, 0.03, c[1] - 0.3, 0.16, 0.08, 0.1);
    return { smoke: ch.map(([x, z]) => [x, 1.72, z, 'dark']) };
  },
  goldFactory(g) {
    box(g, '#a3926e', 0, 0, 0, 0.96, 0.03, 0.96);
    box(g, '#c9b183', -0.12, 0.03, -0.08, 0.56, 0.38, 0.5);
    box(g, P.gold, -0.12, 0.41, -0.08, 0.58, 0.04, 0.52);
    windowsRing(g, -0.12, -0.08, 0.56, 0.5, 0.08, 2, 0.14, 3, '#6a5a3a');
    g.add('fr:10:0.75', '#8e8576', 0.3, 0.03, -0.3, 0.07, 1.0, 0.07);
    sph(g, P.gold, 0.28, 0.03, 0.26, 0.17, 0.15, 10);
    cone(g, '#d9a930', -0.3, 0.03, 0.33, 0.14, 0.12, 8); cone(g, '#b98b28', -0.12, 0.03, 0.38, 0.1, 0.08, 7);
    g.add('box', '#6f6a63', 0.08, 0.2, 0.27, 0.05, 0.04, 0.45, Math.PI / 2, 0, -0.3);
    return { smoke: [[0.3, 1.05, -0.3, 'light']] };
  },
  nuclear(g, fp) {
    const xs = fp.map(p => p[0]), zs = fp.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(g, '#bfc4c8', cx, 0, cz, x1 - x0 + 0.98, 0.03, z1 - z0 + 0.98);
    // cooling tower
    g.add('lathe:20:0.62,0;0.5,0.4;0.4,0.8;0.37,1.15;0.4,1.5;0.43,1.7', '#eef1f4', x0, 0.03, z0, 1, 1, 1);
    g.add('lathe:20:0.4,1.5;0.43,1.7', '#c9ced3', x0, 0.031, z0, 1.01, 1, 1.01);
    // reactor dome
    cyl(g, '#e3e7ec', x1, 0.03, z0, 0.34, 0.42, 16);
    sph(g, '#e9edf1', x1, 0.45, z0, 0.34, 0.26, 14);
    box(g, '#4f7fb0', x1, 0.2, z0, 0.7, 0.04, 0.02 + 0.0);
    // turbine hall
    box(g, '#c3cad1', cx + 0.15, 0.03, z1, 0.95, 0.34, 0.5);
    box(g, '#4f7fb0', cx + 0.15, 0.27, z1 + 0.255, 0.95, 0.05, 0.012);
    windowsRing(g, cx + 0.15, z1, 0.95, 0.5, 0.06, 1, 0.15, 5, '#6f93b8');
    // transformer yard
    for (let i = 0; i < 3; i++) box(g, '#7d858d', x0 - 0.2 + i * 0.16, 0.03, z1 + 0.05, 0.1, 0.14, 0.1);
    return { smoke: [[x0, 1.75, z0, 'steam']] };
  },
  mineralMine(g) {
    box(g, '#9a8668', 0, 0, 0, 0.96, 0.03, 0.96);
    cyl(g, '#8a7457', -0.1, 0.03, 0.08, 0.4, 0.008, 14); cyl(g, '#6f5c45', -0.1, 0.038, 0.08, 0.3, 0.008, 12); cyl(g, '#4f4134', -0.1, 0.046, 0.08, 0.19, 0.008, 10);
    // headframe
    const hx = 0.26, hz = -0.24;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => g.add('box', '#5b4632', hx + a * 0.08, 0.03, hz + b * 0.08, 0.025, 0.72, 0.025, 0, b * -0.09, a * 0.09));
    for (let k = 1; k < 4; k++) box(g, '#5b4632', hx, 0.03 + k * 0.18, hz, 0.15 - k * 0.025, 0.02, 0.15 - k * 0.025);
    g.add('cyl:14', '#3c3c3c', hx, 0.72, hz - 0.04, 0.09, 0.02, 0.09, 0, Math.PI / 2);
    box(g, '#a7522e', 0.3, 0.03, 0.26, 0.24, 0.16, 0.2);
    gable(g, '#5d6670', 0.3, 0.19, 0.26, 0.23, 0.07, 0.27, Math.PI / 2);
    cone(g, '#a59a8b', -0.32, 0.03, -0.32, 0.18, 0.16, 7);
  },
  school(g) {
    box(g, '#8fcb63', 0, 0, 0, 0.96, 0.025, 0.96);
    box(g, P.wallSand, 0, 0.025, -0.24, 0.84, 0.36, 0.34);
    hip(g, '#b84a35', 0, 0.385, -0.24, 0.92, 0.16, 0.42);
    box(g, P.wallSand, -0.3, 0.025, 0.08, 0.26, 0.36, 0.34);
    hip(g, '#b84a35', -0.3, 0.385, 0.08, 0.32, 0.14, 0.4);
    windowsRing(g, 0, -0.24, 0.84, 0.34, 0.06, 2, 0.15, 5, P.win);
    box(g, '#d0663c', 0.2, 0.025, 0.2, 0.44, 0.01, 0.4);
    box(g, '#ffffff', 0.2, 0.036, 0.2, 0.012, 0.002, 0.4); box(g, '#ffffff', 0.2, 0.036, 0.2, 0.44, 0.002, 0.012);
    cyl(g, '#dddddd', 0.43, 0.025, 0.4, 0.008, 0.62, 5);
    box(g, '#ff9933', 0.48, 0.55, 0.4, 0.1, 0.022, 0.006); box(g, '#ffffff', 0.48, 0.528, 0.4, 0.1, 0.022, 0.006); box(g, '#138808', 0.48, 0.506, 0.4, 0.1, 0.022, 0.006);
  },
  waterPlant(g) {
    box(g, '#b4bcc2', 0, 0, 0, 0.96, 0.03, 0.96);
    [[-0.2, -0.2, 0.26], [0.22, 0.18, 0.24]].forEach(([x, z, r]) => { cyl(g, '#d3dadf', x, 0.03, z, r, 0.12, 18); cyl(g, '#3a9fd8', x, 0.03, z, r - 0.03, 0.125, 18); box(g, '#8e979e', x, 0.155, z, r * 2 - 0.05, 0.015, 0.03); });
    box(g, P.wallWhite, 0.24, 0.03, -0.27, 0.32, 0.22, 0.26); box(g, '#2f86c4', 0.24, 0.25, -0.27, 0.34, 0.03, 0.28);
    g.add('cyl:8', '#8e979e', 0.02, 0.07, -0.02, 0.025, 0.5, 0.025, Math.PI / 4, Math.PI / 2);
  },
  dam(g, fp, ctx) {
    const ry = ctx.damAxis === 'x' ? Math.PI / 2 : 0;
    box(g, '#cdc7b9', 0, -0.36, 0, 1.06, 0.6, 0.22, ry);
    box(g, '#595f66', 0, 0.24, 0, 1.06, 0.03, 0.14, ry);
    const c = Math.cos(ry), s = Math.sin(ry);
    for (let i = -1; i <= 1; i++) { const lx = i * 0.28; box(g, '#7c8186', lx * c, 0.0, -lx * s, 0.12, 0.18, 0.24, ry); }
    box(g, '#e6e1d4', 0.42 * c, 0.24, -0.42 * s, 0.14, 0.18, 0.16, ry);
    return { fall: { x: 0, z: 0, ry } };
  },
  wind(g) {
    box(g, '#9fb98a', 0, 0, 0, 0.5, 0.02, 0.5);
    g.add('fr:10:0.55', '#f4f6f7', 0, 0.02, 0, 0.06, 1.55, 0.06);
    box(g, '#eef1f3', 0, 1.55, 0, 0.12, 0.09, 0.2, Math.PI / 4);
    return { spin: [{ x: 0, y: 1.6, z: 0, face: Math.PI / 4, off: 0.11 }] };
  },
  solar(g) {
    box(g, '#bdb6a6', 0, 0, 0, 0.96, 0.025, 0.96);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const x = -0.22 + c * 0.44, z = -0.3 + r * 0.3;
      box(g, '#7d858d', x, 0.025, z + 0.03, 0.02, 0.1, 0.02);
      g.add('box', '#c9d2da', x, 0.1, z, 0.42, 0.012, 0.24, 0, -0.45);
      g.add('box', '#25478a', x, 0.104, z - 0.003, 0.4, 0.012, 0.22, 0, -0.45);
    }
  },
  battery(g) {
    box(g, P.concrete, 0, 0, 0, 0.96, 0.03, 0.96);
    for (let i = 0; i < 3; i++) {
      const z = -0.3 + i * 0.3;
      box(g, '#f2f4f5', -0.08, 0.03, z, 0.6, 0.2, 0.2);
      box(g, '#3e9b62', -0.08, 0.13, z + 0.101, 0.6, 0.04, 0.004);
      box(g, '#8e979e', 0.3, 0.03, z, 0.1, 0.14, 0.14);
    }
    box(g, '#6b737a', 0.36, 0.03, 0.36, 0.14, 0.24, 0.14);
  },
  hospital(g) {
    box(g, '#c9ccc9', 0, 0, 0, 0.96, 0.03, 0.96);
    box(g, P.wallWhite, 0, 0.03, -0.05, 0.78, 0.52, 0.6);
    windowsRing(g, 0, -0.05, 0.78, 0.6, 0.06, 3, 0.15, 5, '#8ec5ea');
    box(g, '#e3e6e9', 0, 0.55, -0.05, 0.8, 0.03, 0.62);
    cyl(g, '#3a7d5a', 0.08, 0.58, -0.08, 0.17, 0.008, 16);
    box(g, '#ffffff', 0.08, 0.59, -0.08, 0.1, 0.002, 0.02); box(g, '#ffffff', 0.04, 0.59, -0.08, 0.02, 0.002, 0.1); box(g, '#ffffff', 0.12, 0.59, -0.08, 0.02, 0.002, 0.1);
    box(g, P.red, 0, 0.36, 0.256, 0.16, 0.05, 0.012); box(g, P.red, 0, 0.305, 0.256, 0.05, 0.16, 0.012);
    box(g, '#dfe3e6', 0, 0.03, 0.33, 0.36, 0.14, 0.12);
    box(g, P.white, 0.32, 0.03, 0.38, 0.18, 0.09, 0.1); box(g, P.red, 0.32, 0.07, 0.43, 0.18, 0.02, 0.005);
  },
  granary(g) {
    box(g, '#c2b9a5', 0, 0, 0, 0.96, 0.03, 0.96);
    [[-0.22, -0.2], [0.18, -0.24], [-0.02, 0.18]].forEach(([x, z], i) => { cyl(g, '#ddd6c4', x, 0.03, z, 0.17, 0.62 - i * 0.06, 14); cone(g, '#a29784', x, 0.65 - i * 0.06, z, 0.18, 0.14, 14); });
    box(g, '#9a6b43', 0.32, 0.03, 0.3, 0.24, 0.16, 0.2); gable(g, '#5d6670', 0.32, 0.19, 0.3, 0.23, 0.07, 0.27, Math.PI / 2);
  },
  itPark(g) {
    box(g, '#c7cdd0', 0, 0, 0, 0.96, 0.03, 0.96);
    box(g, '#4f9fd3', -0.16, 0.03, -0.14, 0.38, 1.25, 0.38);
    for (let k = 1; k < 10; k++) box(g, '#e9f4fb', -0.16, 0.03 + k * 0.125, -0.14, 0.395, 0.015, 0.395);
    box(g, '#7cc1e4', 0.24, 0.03, 0.18, 0.34, 0.8, 0.34);
    for (let k = 1; k < 7; k++) box(g, '#ffffff', 0.24, 0.03 + k * 0.115, 0.18, 0.352, 0.012, 0.352);
    box(g, '#2f6f9f', -0.16, 1.28, -0.14, 0.24, 0.06, 0.24);
    treeRound(g, 0.32, -0.3, 0.6); treeRound(g, -0.34, 0.32, 0.6);
  },
  recycling(g) {
    box(g, '#b8bfb8', 0, 0, 0, 0.96, 0.03, 0.96);
    box(g, '#e7efe7', -0.06, 0.03, -0.12, 0.66, 0.3, 0.48);
    gable(g, P.roofGreen, -0.06, 0.33, -0.12, 0.52, 0.14, 0.7, Math.PI / 2);
    box(g, '#3e9b62', -0.06, 0.1, 0.125, 0.3, 0.1, 0.006);
    ['#2f78c4', '#3e9b62', '#e6b52e'].forEach((c, i) => box(g, c, -0.26 + i * 0.16, 0.03, 0.34, 0.12, 0.12, 0.12));
    g.add('fr:10:0.8', '#f2f4f2', 0.36, 0.03, -0.3, 0.06, 0.55, 0.06);
    cyl(g, '#3e9b62', 0.36, 0.45, -0.3, 0.055, 0.06, 10);
  },
  park(g) {
    box(g, '#7fcc5c', 0, 0, 0, 0.98, 0.03, 0.98);
    cyl(g, '#e3d3a6', 0, 0.03, 0, 0.36, 0.006, 20); cyl(g, '#7fcc5c', 0, 0.03, 0, 0.29, 0.008, 20);
    box(g, '#e3d3a6', 0, 0.03, 0, 0.98, 0.006, 0.08);
    cyl(g, '#bfbab0', 0, 0.035, 0, 0.13, 0.06, 14); cyl(g, '#57b7e8', 0, 0.035, 0, 0.11, 0.062, 14); cyl(g, '#d8f2ff', 0, 0.06, 0, 0.015, 0.12, 6);
    treeRound(g, -0.32, -0.32, 0.9); treeRound(g, 0.34, -0.3, 0.75); treeRound(g, 0.3, 0.34, 0.85); treeRound(g, -0.34, 0.3, 0.7, '#e98bb4', '#f3a6c8');
    sph(g, '#e98bb4', 0.18, 0.05, -0.16, 0.05, 0.04, 6); sph(g, '#f4d35e', -0.16, 0.05, 0.18, 0.05, 0.04, 6);
    box(g, P.wood, 0.0, 0.03, -0.38, 0.14, 0.04, 0.04);
  },
  forest(g) {
    box(g, '#4f9142', 0, 0, 0, 0.98, 0.03, 0.98);
    const pts = [[-0.3, -0.3, 1.1], [0.05, -0.34, 0.9], [0.32, -0.12, 1.2], [-0.32, 0.06, 0.95], [0.0, 0.05, 1.3], [0.3, 0.3, 1.0], [-0.12, 0.34, 1.05], [-0.36, 0.36, 0.8]];
    pts.forEach(([x, z, s], i) => (i % 3 === 1 ? treeRound(g, x, z, s * 0.95, '#3f9a45', '#56b04e', 0.03) : treePine(g, x, z, s * 1.05, 0.03)));
  },
};

function damAxis(S, i) {
  const t = S.tiles[i];
  const r = (x, y) => x >= 0 && y >= 0 && x < W && y < W && S.tiles[E.idx(x, y)].t === 'river';
  return (r(t.x, t.y - 1) || r(t.x, t.y + 1)) ? 'z' : 'x';
}
function buildModel(type, fp, ctx) {
  const g = new Geo();
  const f = MODELS[type];
  const extra = f ? (f(g, fp, ctx || {}) || {}) : {};
  return { g, extra };
}
function rotorGeo() {
  const g = new Geo();
  sph(g, '#e6eaee', 0, 0, 0, 0.045, 0.045, 8);
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; g.add('box', '#fbfcfd', Math.cos(a) * 0.3, Math.sin(a) * 0.3 - 0.0, 0, 0.6, 0.045, 0.012, 0, 0, a); }
  // centre the box geometry: prim box has base at y=0, so shift: blades built along x after rz; fine for silhouette
  return g;
}

/* =====================================================
   The renderer state
   ===================================================== */
let eng = null, cv = null, overlay = null;
const scene = { meshes: [], sprites: [], env: {}, shadowDirty: true };
let S = null, F = null, seedU = 1;
let world = {};           // static per-game meshes
let bmap = new Map();     // building id -> entry
let roadsMesh = null, depMesh = null, uMesh = null, propsMesh = null, hiMesh = null, gridMesh = null, dashMesh = null;
let ghost = null, ghostKey = '';
let sig = { roads: '', dep: '', props: '' };
let curLevel = 1;
let particles = [], smog = [];
let cars = [], carMesh = null, roadGraph = null;
let birds = [], birdMesh = null;
let labels = new Map();
let insets = { l: 0, r: 0, t: 0, b: 0 };
let VW = 1, VH = 1, DPR = 1;
const cam = { tx: -0.5, tz: -0.5, dist: 26, yaw: Math.PI / 4, pitch: 0.84 };
const camG = Object.assign({}, cam);
let orbit = 0;
let camMats = null;
let envS = { p: 0, d: 0, wf: 0.75, dead: 0 }, envT = { p: 0, d: 0, wf: 0.75, dead: 0 };
let gridOn = 0, gridA = 0;
let lastT = 0;

/* ---------- island shape ---------- */
let RO = null; // outline radius function
function makeOutline(seed) {
  const r = rng(seed ^ 0x9e3779b9);
  const a1 = r() * 6.28, a2 = r() * 6.28, a3 = r() * 6.28;
  const back = Math.atan2(-1, -1);
  return th => { let d = th - back; d = Math.atan2(Math.sin(d), Math.cos(d)); return 16.4 + 0.8 * Math.sin(3 * th + a1) + 0.55 * Math.sin(5 * th + a2) + 0.3 * Math.sin(9 * th + a3) + 3.6 * Math.exp(-d * d * 1.5); };
}

/* ---------- world build ---------- */
function freeMesh(m) { if (!m || !m.vao) return; eng.free(m); const i = scene.meshes.indexOf(m); if (i >= 0) scene.meshes.splice(i, 1); }
function addMesh(g, opt) { const m = eng.mesh(g, opt); scene.meshes.push(m); return m; }

function riverInfo(st) {
  const cells = [], set = new Set();
  st.tiles.forEach(t => { if (t.t === 'river') { cells.push([t.x, t.y]); set.add(t.x + ',' + t.y); } });
  const top = cells.filter(c => c[1] === 0).map(c => c[0]).sort((a, b) => a - b);
  const bot = cells.filter(c => c[1] === W - 1).map(c => c[0]).sort((a, b) => a - b);
  const x0 = top.length ? top[0] : 6, x1 = bot.length ? bot[bot.length - 1] : 8;
  const ext = [];
  for (let y = -1; y >= -4; y--) ext.push([x0, y]);
  for (let y = W; y < W + 9; y++) ext.push([x1, y]);
  return { cells: cells.concat(ext), x0, x1, source: [tw(x0), tw(-4.6)] };
}

function buildWorld(st) {
  // drop old
  Object.values(world).forEach(m => { if (m && m.vao) freeMesh(m); });
  world = {};
  const seed = st.seed >>> 0; seedU = seed;
  RO = makeOutline(seed);
  const R = th => RO(th) - 0.05;
  const riv = riverInfo(st);
  const rc = riv.cells.map(([x, y]) => [tw(x), tw(y)]);
  const src = riv.source;
  // mountains (positions decided first so terrain can blend)
  const mr = rng(seed ^ 0x51ed);
  const mounts = [];
  mounts.push({ x: src[0], z: src[1] - 2.0, r: 2.3, h: 4.6, snow: true });
  mounts.push({ x: src[0] - 2.4, z: src[1] - 0.9, r: 1.8, h: 3.0 });
  mounts.push({ x: src[0] + 2.5, z: src[1] - 1.0, r: 1.9, h: 3.4 });
  const back = Math.atan2(-1, -1);
  for (let k = 0; k < 9; k++) {
    const th = back + (k / 8 - 0.5) * 2.4 + (mr() - 0.5) * 0.2;
    const rr = R(th) - 2.0 - mr() * 0.8;
    const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
    if (Math.max(Math.abs(x), Math.abs(z)) < 9.4) continue;
    if (mounts.some(m => Math.hypot(m.x - x, m.z - z) < m.r + 0.8)) continue;
    mounts.push({ x, z, r: 1.3 + mr() * 1.0, h: 1.8 + mr() * 2.2 });
  }
  world.mounts = mounts;

  // river signed distance (cells are 1x1 squares)
  const riverSd = (X, Z) => {
    let d = 9;
    for (const [cx, cz] of rc) { const q = Math.max(Math.abs(X - cx), Math.abs(Z - cz)) - 0.5; if (q < d) d = q; }
    const pd = Math.hypot(X - src[0], Z - src[1]) - 1.15; if (pd < d) d = pd;
    return d;
  };
  const heightAt = (X, Z) => {
    const r = Math.hypot(X, Z), th = Math.atan2(Z, X), Rr = R(th);
    const db = Math.max(Math.abs(X), Math.abs(Z)) - 7.5;
    let h = 0;
    if (db > 0.35) {
      const n = fbm(X * 0.17 + 3, Z * 0.17 - 2, seed & 1023);
      const backness = clamp((-(X + Z) / Math.SQRT2 - 7) / 7, 0, 1);
      h = Math.max(0, n * (1.5 + backness * 1.4) - 0.55) * smooth(0.35, 2.6, db) * smooth(0, 2.4, Rr - r);
    }
    for (const m of mounts) { const d = Math.hypot(X - m.x, Z - m.z); if (d < m.r + 1.2) h = Math.max(h, (1 - smooth(m.r * 0.6, m.r + 1.2, d)) * 0.6); }
    const sd = riverSd(X, Z);
    if (sd < 0.16) { const t = smooth(-0.1, 0.16, sd); h = lerp(-0.38, h, t); }
    return h;
  };
  world.heightAt = heightAt;

  // ---- terrain heightfield ----
  const EXT = 22.5, STEP = 0.3, N = Math.round(EXT * 2 / STEP);
  const NV = N + 1;
  const hx = new Float32Array(NV * NV), px = new Float32Array(NV * NV), pz = new Float32Array(NV * NV);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    let X = -EXT + i * STEP, Z = -EXT + j * STEP;
    const r = Math.hypot(X, Z), th = Math.atan2(Z, X), Rr = R(th);
    let h;
    if (r >= Rr) { X = Math.cos(th) * Rr; Z = Math.sin(th) * Rr; h = heightAt(X * 0.999, Z * 0.999); h = Math.min(h, 0); if (h > -0.05) h = 0; }
    else h = heightAt(X, Z);
    const k = j * NV + i; px[k] = X; pz[k] = Z; hx[k] = h;
  }
  // vertex colours
  const base = new Float32Array(NV * NV * 3), tileOf = new Int16Array(NV * NV);
  const gA = C('#6cbd4a'), gB = C('#58a842'), gC = C('#86cb55'), dark = C('#3f8a37'), sand = C('#dcc68c'), bed = C('#a8916a'), rock = C('#8b8174'), meadow = C('#9fd166');
  for (let k = 0; k < NV * NV; k++) {
    const X = px[k], Z = pz[k], h = hx[k];
    const n = fbm(X * 0.35, Z * 0.35, (seed + 5) & 1023), n2 = vnoise(X * 1.3, Z * 1.3, 77);
    let c = mixc(mixc(gB, gA, n), gC, Math.max(0, n2 - 0.55) * 1.6);
    const ix = Math.round(X + H), iz = Math.round(Z + H);
    const inPlay = ix >= 0 && iz >= 0 && ix < W && iz < W && Math.abs(X) < 7.5 && Math.abs(Z) < 7.5;
    tileOf[k] = inPlay ? E.idx(ix, iz) : -1;
    if (inPlay && ((ix + iz) & 1)) c = mixc(c, gC, 0.12);
    if (!inPlay) {
      const fl = vnoise(X * 0.6, Z * 0.6, 31);
      if (fl > 0.72 && h < 0.4) c = mixc(c, meadow, 0.5);
      if (h > 0.25) c = mixc(c, dark, clamp((h - 0.25) / 1.2, 0, 0.8));
      if (h > 1.3) c = mixc(c, rock, clamp((h - 1.3) / 1.0, 0, 1));
    }
    if (h < -0.02) c = h > -0.24 ? mixc(sand, c, clamp((h + 0.02) / -0.06 + 1, 0, 1) * 0) : bed;
    if (h < -0.02 && h > -0.24) c = sand;
    base[k * 3] = c[0]; base[k * 3 + 1] = c[1]; base[k * 3 + 2] = c[2];
  }
  // normals
  const nor = new Float32Array(NV * NV * 3);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const k = j * NV + i;
    const hl = hx[j * NV + Math.max(0, i - 1)], hr = hx[j * NV + Math.min(N, i + 1)], hd = hx[Math.max(0, j - 1) * NV + i], hu = hx[Math.min(N, j + 1) * NV + i];
    let nx = (hl - hr) / (2 * STEP), nz = (hd - hu) / (2 * STEP), ny = 1; const l = Math.hypot(nx, ny, nz);
    nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
  }
  const tri = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * NV + i, b = a + 1, c = a + NV, d = c + 1;
    // skip cells entirely outside (all clamped onto the rim)
    const ra = Math.hypot(px[a], pz[a]), rb = Math.hypot(-EXT + (i + 1) * STEP, -EXT + j * STEP);
    tri.push(a, c, d, a, d, b);
  }
  const TP = new Float32Array(tri.length * 3), TN = new Float32Array(tri.length * 3), TC = new Float32Array(tri.length * 3);
  const vIdx = new Int32Array(tri.length);
  tri.forEach((k, q) => { vIdx[q] = k; TP[q * 3] = px[k]; TP[q * 3 + 1] = hx[k]; TP[q * 3 + 2] = pz[k]; TN[q * 3] = nor[k * 3]; TN[q * 3 + 1] = nor[k * 3 + 1]; TN[q * 3 + 2] = nor[k * 3 + 2]; });
  world.terrain = addMesh({ p: TP, n: TN, c: TC }, { flat: 0, cast: true });
  world.terrainData = { base, tileOf, vIdx, TC };

  // ---- island body (cliffs + rocky underside) ----
  const body = new Geo(), SEG = 110;
  const rings = [[0, 1.0], [-0.16, 1.0], [-0.55, 0.985], [-1.1, 0.95], [-2.0, 0.86], [-3.3, 0.68], [-5.0, 0.45], [-7.0, 0.22], [-9.0, 0.05]];
  const bandCol = [C('#4f9a3c'), C('#8a5a36'), C('#7a4c2d'), C('#6c4a33'), C('#635143'), C('#57493d'), C('#4c4037'), C('#40362f')];
  const ringPts = rings.map(([y, f], ri) => {
    const pts = [];
    for (let s = 0; s < SEG; s++) {
      const th = s / SEG * Math.PI * 2, Rr = R(th) * f;
      const j = ri === 0 || ri === 1 ? 0 : (hash(s, ri, seed & 255) - 0.5) * 0.9 * (0.4 + ri * 0.1);
      const jy = ri < 2 ? 0 : (hash(s + 99, ri, seed & 255) - 0.5) * 0.5;
      pts.push([Math.cos(th) * (Rr + j), y + jy, Math.sin(th) * (Rr + j)]);
    }
    return pts;
  });
  for (let ri = 0; ri < rings.length - 1; ri++) for (let s = 0; s < SEG; s++) {
    const a = ringPts[ri][s], b = ringPts[ri][(s + 1) % SEG], c = ringPts[ri + 1][(s + 1) % SEG], d = ringPts[ri + 1][s];
    const col = mixc(bandCol[ri], C('#000000'), hash(s, ri, 5) * 0.12);
    body.tri(a, b, c, col).tri(a, c, d, col);
  }
  const tip = [0, -10.5, 0];
  for (let s = 0; s < SEG; s++) body.tri(ringPts[rings.length - 1][s], ringPts[rings.length - 1][(s + 1) % SEG], tip, C('#3a312b'));
  world.body = addMesh(body, { flat: 1, cast: false });

  // ---- mountains ----
  const mg = new Geo();
  mounts.forEach((m, mi) => {
    const segs = 8, fr = [[0, 1], [0.32, 0.74], [0.62, 0.46], [0.86, 0.2], [1, 0]];
    const pts = fr.map(([hf, rf], ri) => {
      const row = [];
      for (let s = 0; s < segs; s++) {
        const th = s / segs * Math.PI * 2 + mi;
        const jr = ri === fr.length - 1 ? 0 : (hash(s, ri, mi + 3) - 0.5) * 0.35 * m.r;
        const rr = m.r * rf + jr * rf;
        row.push([m.x + Math.cos(th) * rr, -0.25 + hf * m.h + (ri && ri < fr.length - 1 ? (hash(s, ri, mi) - 0.5) * 0.3 : 0), m.z + Math.sin(th) * rr]);
      }
      return row;
    });
    for (let ri = 0; ri < fr.length - 1; ri++) for (let s = 0; s < segs; s++) {
      const a = pts[ri][s], b = pts[ri][(s + 1) % segs], c = pts[ri + 1][(s + 1) % segs], d = pts[ri + 1][s];
      const yy = (a[1] + b[1] + c[1] + d[1]) / 4 / m.h;
      let col = yy < 0.22 ? C('#5d9a44') : yy < 0.55 ? mixc(C('#8a7f71'), C('#968d80'), hash(s, ri, 9)) : yy < 0.78 ? C('#a29a8e') : (m.snow || m.h > 3.6 ? C('#f3f5f7') : C('#aaa296'));
      mg.tri(a, b, c, col).tri(a, c, d, mixc(col, C('#000000'), 0.05));
    }
  });
  world.mount = addMesh(mg, { flat: 1, cast: true });

  // ---- water ----
  const wg = new Geo(); const wc = C('#3a9ad9');
  for (let s = 0; s < 96; s++) {
    const a0 = s / 96 * Math.PI * 2, a1 = (s + 1) / 96 * Math.PI * 2;
    wg.tri([0, 0, 0], [Math.cos(a0) * (R(a0) - 0.02), 0, Math.sin(a0) * (R(a0) - 0.02)], [Math.cos(a1) * (R(a1) - 0.02), 0, Math.sin(a1) * (R(a1) - 0.02)], wc);
  }
  world.water = addMesh(wg, { mode: 1, flat: 0, cast: false, blend: true, alpha: 0.9, depthWrite: true, order: 1 });

  // ---- waterfalls ----
  const fg = new Geo();
  fg.add('box', '#ffffff', src[0], -0.3, src[1] - 1.05, 0.75, 2.75, 0.06, 0, -0.18);
  // exit: walk out along +z from the last river cell until we leave the island
  const ex = tw(riv.x1); let ez = tw(W - 1);
  while (Math.hypot(ex, ez) < R(Math.atan2(ez, ex)) - 0.1 && ez < 30) ez += 0.1;
  const eth = Math.atan2(ez, ex), out = [Math.cos(eth), Math.sin(eth)];
  fg.add('box', '#ffffff', ex + out[0] * 0.1, -6.8, ez + out[1] * 0.1, 0.85, 6.55, 0.06, Math.atan2(out[0], out[1]), 0.06);
  world.falls = addMesh(fg, { mode: 2, flat: 1, cast: false, blend: true, alpha: 0.9, depthWrite: false, order: 2 });
  world.mist = [[src[0], 0.0, src[1] - 0.4, 0.8], [ex + out[0] * 0.5, -6.6, ez + out[1] * 0.5, 2.0]];

  // ---- decorative trees ----
  const tr = rng(seed ^ 0x7a11);
  const pinesI = [], roundsI = [];
  for (let Z = -EXT; Z < EXT; Z += 0.5) for (let X = -EXT; X < EXT; X += 0.5) {
    const x = X + (tr() - 0.5) * 0.4, z = Z + (tr() - 0.5) * 0.4;
    const r = Math.hypot(x, z); if (r > R(Math.atan2(z, x)) - 0.55) continue;
    const db = Math.max(Math.abs(x), Math.abs(z)) - 7.5; if (db < 0.75) continue;
    if (riverSd(x, z) < 0.45) continue;
    if (mounts.some(m => Math.hypot(x - m.x, z - m.z) < m.r * 0.95)) continue;
    const h = heightAt(x, z);
    const dens = fbm(x * 0.22 + 11, z * 0.22 - 4, 19);
    const want = 0.38 + (db < 2.2 ? 0.1 : 0);
    if (dens < want && tr() > 0.07) continue;
    const s = 0.85 + tr() * 0.8 + (dens - 0.4) * 0.8;
    const tint = 0.82 + tr() * 0.3;
    const it = [x, h - 0.02, z, s, tr() * 6.28, 0.9 + tr() * 0.3, 0, 0, tint, tint * (0.95 + tr() * 0.1), tint * 0.9];
    (h > 0.35 || tr() < 0.55 ? pinesI : roundsI).push(it);
  }
  const pg = new Geo(); treePine(pg, 0, 0, 1.25); const rg = new Geo(); treeRound(rg, 0, 0, 1.2);
  world.pines = addMesh(pg, { instances: pinesI.length + 1, mode: 7, flat: 1 }); eng.setInst(world.pines, pinesI);
  world.rounds = addMesh(rg, { instances: roundsI.length + 1, mode: 7, flat: 1 }); eng.setInst(world.rounds, roundsI);

  // ---- clouds ----
  const cr = rng(seed ^ 0xc10d), cl = [];
  for (let k = 0; k < 34; k++) {
    const th = k / 34 * Math.PI * 2 + cr() * 0.15, rr = R(th) + 1.5 + cr() * 9, cy = -1.6 - cr() * 3.5;
    const cx0 = Math.cos(th) * rr, cz0 = Math.sin(th) * rr, n = 4 + Math.floor(cr() * 4);
    for (let q = 0; q < n; q++) cl.push([cx0 + (cr() - 0.5) * 3, cy + cr() * 0.8, cz0 + (cr() - 0.5) * 3, 0.9 + cr() * 1.4, 0, 0.55 + cr() * 0.2, 0, 0, 1, 1, 1]);
  }
  for (let k = 0; k < 10; k++) {
    const th = cr() * Math.PI * 2, rr = 30 + cr() * 18, cy = 2 + cr() * 5;
    for (let q = 0; q < 6; q++) cl.push([Math.cos(th) * rr + (cr() - 0.5) * 5, cy + cr(), Math.sin(th) * rr + (cr() - 0.5) * 5, 1.5 + cr() * 2, 0, 0.5, 0, 0, 1, 1, 1]);
  }
  const cg = new Geo(); sph(cg, '#ffffff', 0, 0, 0, 1, 1, 10);
  const cn = new Float32Array(cg.p.length); for (let i = 0; i < cg.p.length; i += 3) { const l = Math.hypot(cg.p[i], cg.p[i + 1], cg.p[i + 2]) || 1; cn[i] = cg.p[i] / l; cn[i + 1] = cg.p[i + 1] / l; cn[i + 2] = cg.p[i + 2] / l; }
  world.clouds = addMesh({ p: cg.p, c: cg.c, n: cn }, { instances: cl.length, flat: 0, cast: false, mode: 0 }); eng.setInst(world.clouds, cl);
  world.cloudsList = cl;

  // ---- birds ----
  const bg = new Geo(); const bc = C('#2b3238');
  bg.tri([0, 0, 0], [-0.22, 0.05, -0.08], [-0.05, 0, 0.04], bc).tri([0, 0, 0], [0.22, 0.05, -0.08], [0.05, 0, 0.04], bc);
  birdMesh = world.birds = addMesh(bg, { instances: 24, mode: 3, flat: 1, cast: false });
  birds = []; const br = rng(seed ^ 0xb1d);
  for (let f = 0; f < 3; f++) { const rad = 9 + br() * 9, h = 4 + br() * 3, sp = (0.08 + br() * 0.06) * (br() < 0.5 ? 1 : -1), ph = br() * 6.28; for (let k = 0; k < 6; k++) birds.push({ rad: rad + (k % 2) * 0.4, h: h + k * 0.05, sp, ph: ph - k * 0.045 * Math.sign(sp), lag: k }); }

  // ---- cars ----
  const carg = new Geo(); box(carg, '#ffffff', 0, 0.02, 0, 0.17, 0.055, 0.09); box(carg, '#2a3a48', -0.015, 0.075, 0, 0.09, 0.045, 0.08); box(carg, '#ffffff', -0.015, 0.075, 0, 0.07, 0.048, 0.084);
  carMesh = world.cars = addMesh(carg, { instances: 48, flat: 1, cast: false });
  cars = [];

  // ---- per-game dynamic meshes reset ----
  [roadsMesh, depMesh, uMesh, propsMesh, hiMesh, gridMesh, dashMesh].forEach(freeMesh);
  roadsMesh = depMesh = uMesh = propsMesh = hiMesh = gridMesh = dashMesh = null;
  bmap.forEach(e => freeEntry(e)); bmap.clear();
  sig = { roads: '', dep: '', props: '' };
  if (ghost) { freeMesh(ghost); ghost = null; ghostKey = ''; }
  labels.forEach(l => l.el.remove()); labels.clear();
  particles = []; smog = [];
  const sr = rng(seed ^ 0x5306);
  for (let k = 0; k < 30; k++) smog.push({ x: (sr() - 0.5) * 16, z: (sr() - 0.5) * 16, y: 1.7 + sr() * 1.8, s: 2.2 + sr() * 2.6, ph: sr() * 6 });
  scene.shadowDirty = true;
}

function recolorTerrain(level) {
  const d = world.terrainData; if (!d) return;
  const { base, tileOf, vIdx, TC } = d;
  for (let q = 0; q < vIdx.length; q++) {
    const k = vIdx[q], ti = tileOf[k];
    let r = base[k * 3], g = base[k * 3 + 1], b = base[k * 3 + 2];
    if (ti >= 0) {
      const t = S.tiles[ti];
      if (!E.inLevel(level, t.x, t.y)) { const l = (r + g + b) / 3; r = (r * 0.6 + l * 0.4) * 0.78; g = (g * 0.6 + l * 0.4) * 0.8; b = (b * 0.6 + l * 0.4) * 0.74; }
    }
    TC[q * 3] = r; TC[q * 3 + 1] = g; TC[q * 3 + 2] = b;
  }
  eng.setColors(world.terrain, TC);
}

function buildGridAndBorder(level) {
  freeMesh(gridMesh); freeMesh(dashMesh);
  const L = E.LEVELS[level], x0 = tw(L.off) - 0.5, x1 = tw(L.off + L.size - 1) + 0.5;
  const g = new Geo(), wc = C('#ffffff');
  for (let k = 0; k <= L.size; k++) {
    const v = x0 + k;
    g.p.push(v, 0.012, x0, v, 0.012, x1, x0, 0.012, v, x1, 0.012, v); for (let q = 0; q < 4; q++) g.c.push(wc[0], wc[1], wc[2]);
  }
  gridMesh = addMesh(g, { mode: 3, flat: 1, cast: false, blend: true, alpha: 0, depthWrite: false, prim: eng.gl.LINES, order: 3 });
  const dg = new Geo(); box(dg, '#ffd25a', 0, 0, 0, 0.32, 0.03, 0.06);
  const list = [], len = x1 - x0;
  for (let s = 0; s < len; s += 0.5) {
    const c = x0 + s + 0.25;
    list.push([c, 0.012, x0, 1, 0], [c, 0.012, x1, 1, 0], [x0, 0.012, c, 1, Math.PI / 2], [x1, 0.012, c, 1, Math.PI / 2]);
  }
  dashMesh = addMesh(dg, { instances: list.length, mode: 3, flat: 1, cast: false }); eng.setInst(dashMesh, list);
}

/* ---------- buildings ---------- */
function fpOffsets(b) {
  const a = S.tiles[b.tiles[0]];
  return b.tiles.map(i => [S.tiles[i].x - a.x, S.tiles[i].y - a.y]);
}
function freeEntry(e) { freeMesh(e.mesh); (e.spin || []).forEach(s => freeMesh(s.mesh)); }
function makeEntry(b, animate) {
  const a = S.tiles[b.tiles[0]];
  const ctx = b.type === 'dam' ? { damAxis: damAxis(S, b.tiles[0]) } : {};
  const { g, extra } = buildModel(b.type, fpOffsets(b), ctx);
  const x = tw(a.x), z = tw(a.y);
  const e = { id: b.id, type: b.type, x, z, extra, tiles: b.tiles.slice(), t0: animate ? performance.now() : 0, on: true };
  e.mesh = addMesh(g, { model: M4.trs(x, 0, z, 0, animate ? 0.01 : 1) });
  e.spin = (extra.spin || []).map(s => ({ s, mesh: addMesh(rotorGeo(), { cast: false, model: M4.id() }), a: hash(a.x, a.y, 3) * 6 }));
  if (b.type === 'dam') {
    // a spillway sheet on the downstream side
    const fg = new Geo(), ry = ctx.damAxis === 'x' ? Math.PI / 2 : 0;
    const off = 0.14;
    fg.add('box', '#ffffff', x + Math.sin(ry) * off, -0.36, z + Math.cos(ry) * off, 0.62, 0.5, 0.04, ry, 0.35);
    e.fall = addMesh(fg, { mode: 2, blend: true, alpha: 0.85, depthWrite: false, cast: false, order: 2 });
  }
  return e;
}
function entryOn(e) { const b = S.buildings[e.id]; if (!b) return false; const d = B[b.type]; if (!d.min) return true; return b._eff > 0; }

function syncBuildings(animate) {
  const seen = new Set();
  for (const b of Object.values(S.buildings)) {
    if (b.type === 'road') continue;
    seen.add(b.id);
    if (!bmap.has(b.id)) { bmap.set(b.id, makeEntry(b, animate && !b.initial)); scene.shadowDirty = true; if (animate && !b.initial) puffAt(b.tiles, 10); }
  }
  for (const [id, e] of bmap) if (!seen.has(id)) { freeEntry(e); if (e.fall) freeMesh(e.fall); bmap.delete(id); scene.shadowDirty = true; const l = labels.get(id); if (l) { l.el.remove(); labels.delete(id); } }
}
function syncStatus() {
  for (const [id, e] of bmap) {
    const b = S.buildings[id]; if (!b) continue;
    const d = B[b.type];
    let state = 'ok';
    if (d.min) {
      if (b._dead) state = 'used'; else if (!(b._eff > 0)) state = 'closed';
    }
    e.on = state === 'ok';
    e.eff = d.min ? (b._eff || 0) : 1;
    const tint = state === 'ok' ? [1, 1, 1] : state === 'used' ? [0.55, 0.5, 0.46] : [0.58, 0.6, 0.66];
    e.mesh.tint = tint; e.spin.forEach(s => s.mesh.tint = tint);
    setLabel(id, state === 'ok' ? null : state === 'used' ? 'Deposit used up' : 'Closed · no workers', e);
  }
}
function setLabel(id, text, e) {
  let l = labels.get(id);
  if (!text) { if (l) { l.el.remove(); labels.delete(id); } return; }
  if (!l) { const el = document.createElement('div'); el.className = 'tag3d'; overlay.appendChild(el); l = { el, e }; labels.set(id, l); }
  if (l.text !== text) {
    const used = text.indexOf('used') > 0;
    l.el.innerHTML = used
      ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 18h16"/><path d="M7 18l2-6h6l2 6"/><path d="M12 4v5"/></svg>'
      : '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="7" r="3"/><path d="M6 20c0-4 3-6 6-6s6 2 6 6"/><path d="M4 4l16 16"/></svg>';
    l.el.title = text; l.text = text; l.el.classList.toggle('used', used);
  }
  l.e = e;
}

/* ---------- roads ---------- */
function syncRoads() {
  const roads = Object.values(S.buildings).filter(b => b.type === 'road').map(b => b.tiles[0]).sort((a, b) => a - b);
  const key = roads.join(',');
  if (key === sig.roads) return;
  sig.roads = key; freeMesh(roadsMesh); roadsMesh = null; scene.shadowDirty = true;
  const set = new Set(roads);
  const has = (x, y) => x >= 0 && y >= 0 && x < W && y < W && set.has(E.idx(x, y));
  const g = new Geo();
  const adj = new Map();
  for (const i of roads) {
    const t = S.tiles[i], x = tw(t.x), z = tw(t.y);
    const n = { N: has(t.x, t.y - 1), S: has(t.x, t.y + 1), W: has(t.x - 1, t.y), E: has(t.x + 1, t.y) };
    adj.set(i, [n.N && E.idx(t.x, t.y - 1), n.S && E.idx(t.x, t.y + 1), n.W && E.idx(t.x - 1, t.y), n.E && E.idx(t.x + 1, t.y)].filter(v => v !== false));
    const bridge = t.t === 'river';
    if (bridge) {
      const alongX = n.W || n.E || !(n.N || n.S) && damAxis(S, i) === 'z';
      const ry = alongX ? Math.PI / 2 : 0;
      box(g, '#a39582', x, -0.05, z, 0.62, 0.1, 1.02, ry);
      box(g, '#505760', x, 0.05, z, 0.5, 0.012, 1.02, ry);
      [-0.29, 0.29].forEach(o => box(g, '#e6e0d2', x + (alongX ? 0 : o), 0.06, z + (alongX ? o : 0), alongX ? 1.02 : 0.03, 0.06, alongX ? 0.03 : 1.02));
      cyl(g, '#b8b0a2', x, -0.5, z, 0.08, 0.45, 8);
      continue;
    }
    box(g, '#c9c6bd', x, 0, z, 1.0, 0.03, 1.0);
    box(g, P.asphalt, x, 0.003, z, 0.8, 0.03, 0.8);
    const arm = (dx, dz) => { box(g, P.asphalt, x + dx * 0.45, 0.003, z + dz * 0.45, dx ? 0.12 : 0.8, 0.03, dz ? 0.12 : 0.8); box(g, '#f1efe6', x + dx * 0.3, 0.034, z + dz * 0.3, dx ? 0.16 : 0.025, 0.004, dz ? 0.16 : 0.025); };
    if (n.N) arm(0, -1); if (n.S) arm(0, 1); if (n.W) arm(-1, 0); if (n.E) arm(1, 0);
    const deg = n.N + n.S + n.W + n.E;
    if (deg === 0) box(g, '#f1efe6', x, 0.034, z, 0.3, 0.004, 0.025);
  }
  roadGraph = adj;
  if (roads.length) roadsMesh = addMesh(g, { flat: 1, cast: false });
  // cars
  const linked = roads.filter(i => adj.get(i).length);
  const want = Math.min(46, Math.round(linked.length * 0.8));
  const rr = rng(roads.length * 7 + 3);
  const cols = [[0.9, 0.2, 0.15], [0.95, 0.95, 0.95], [0.95, 0.75, 0.12], [0.18, 0.45, 0.85], [0.25, 0.3, 0.35], [0.2, 0.65, 0.4]];
  cars = [];
  for (let k = 0; k < want; k++) { const a = linked[Math.floor(rr() * linked.length)]; const nb = adj.get(a); cars.push({ a, b: nb[Math.floor(rr() * nb.length)], t: rr(), sp: 0.35 + rr() * 0.35, col: cols[k % cols.length] }); }
}

/* ---------- deposits & props ---------- */
function syncDeposits() {
  const parts = [];
  for (const d of Object.values(S.deposits)) { const built = !!S.tiles[d.tiles[0]].b; parts.push(d.id + ':' + Math.ceil(d.reserve / d.max * 5) + (built ? 'b' : '')); }
  const key = parts.join('|');
  if (key === sig.dep) return;
  sig.dep = key; freeMesh(depMesh); freeMesh(uMesh); scene.shadowDirty = true;
  const g = new Geo(), ug = new Geo();
  const PATCH = { coal: '#3b3935', gold: '#9e8247', uranium: '#56644b', mineral: '#91846f' };
  for (const d of Object.values(S.deposits)) {
    const frac = d.reserve / d.max, built = !!S.tiles[d.tiles[0]].b;
    d.tiles.forEach((i, q) => {
      const t = S.tiles[i], x = tw(t.x), z = tw(t.y);
      box(g, frac <= 0 ? '#4a4540' : PATCH[d.type], x, 0, z, 0.96, 0.02, 0.96);
      if (built) return;
      const n = Math.ceil(7 * Math.max(0, frac));
      for (let k = 0; k < n; k++) {
        const ox = (hash(i, k, 1) - 0.5) * 0.7, oz = (hash(i, k, 2) - 0.5) * 0.7, s = 0.6 + hash(i, k, 3) * 0.7, ry = hash(i, k, 4) * 6;
        if (d.type === 'coal') g.add('box', k % 2 ? '#22211f' : '#33312d', x + ox, 0.02, z + oz, 0.13 * s, 0.09 * s, 0.11 * s, ry, 0.3, 0.2);
        else if (d.type === 'gold') { sph(g, '#7d6a4a', x + ox, 0.04, z + oz, 0.07 * s, 0.05 * s, 6); sph(g, '#f6c93e', x + ox + 0.03, 0.06, z + oz, 0.035 * s, 0.03 * s, 6); }
        else if (d.type === 'mineral') sph(g, k % 2 ? '#aca08f' : '#8f8372', x + ox, 0.03, z + oz, 0.09 * s, 0.05 * s, 6);
        else if (d.type === 'uranium') { ug.add('cone:5', '#7dff5a', x + ox, 0.02, z + oz, 0.04 * s, 0.2 * s, 0.04 * s, ry, (hash(i, k, 5) - 0.5) * 0.6, (hash(i, k, 6) - 0.5) * 0.6); sph(g, '#48523f', x + ox, 0.02, z + oz, 0.07 * s, 0.04, 6); }
      }
      if (frac <= 0) { cyl(g, '#2f2b27', x, 0.02, z, 0.3, 0.006, 10); }
    });
  }
  depMesh = addMesh(g, { flat: 1, cast: true });
  uMesh = ug.p.length ? addMesh(ug, { flat: 1, cast: false, emit: 0.6 }) : null;
}
function syncProps() {
  const parts = [];
  S.tiles.forEach((t, i) => { if (t.t === 'grass' && !t.b && t.v > 0.8) parts.push(i); });
  const key = parts.join(',');
  if (key === sig.props) return;
  sig.props = key; freeMesh(propsMesh); scene.shadowDirty = true;
  const list = parts.map(i => { const t = S.tiles[i]; const ox = (hash(i, 1, 9) - 0.5) * 0.5, oz = (hash(i, 2, 9) - 0.5) * 0.5; const s = 0.55 + hash(i, 3, 9) * 0.35; const tn = 0.85 + hash(i, 4, 9) * 0.25; return [tw(t.x) + ox, 0, tw(t.y) + oz, s, hash(i, 5, 9) * 6, 1, 0, 0, tn, tn, tn * 0.92]; });
  const g = new Geo(); treeRound(g, 0, 0, 1);
  propsMesh = addMesh(g, { instances: Math.max(1, list.length), mode: 7, flat: 1 }); eng.setInst(propsMesh, list);
}

/* ---------- highlight / ghost ---------- */
function setHighlight(tilesA, colA, tilesB, colB) {
  freeMesh(hiMesh); hiMesh = null;
  const g = new Geo();
  const q = (i, col) => { const t = S.tiles[i], x = tw(t.x), z = tw(t.y); box(g, col, x, 0.02, z, 0.98, 0.02, 0.98); };
  (tilesA || []).forEach(i => q(i, colA)); (tilesB || []).forEach(i => q(i, colB));
  if (!g.p.length) return;
  hiMesh = addMesh(g, { mode: 3, flat: 1, cast: false, blend: true, alpha: 0.55, depthWrite: false, order: 4 });
}
let hoverState = { i: -1, tool: null, ok: false, fp: [] }, selId = null;
function updateHover() {
  const { i, tool, ok, fp } = hoverState;
  let A = [], ca = '#ffffff', Bt = [], cb = '#ffd25a';
  if (selId && S.buildings[selId]) Bt = S.buildings[selId].tiles;
  let gk = '';
  if (i >= 0 && tool && tool !== 'inspect' && tool !== 'demolish') {
    A = fp; ca = ok ? '#6dde74' : '#ff5a4a';
    if (ok && tool !== 'road') gk = tool + ':' + i;
  } else if (i >= 0 && S.tiles[i].b && (tool === 'demolish' || !tool || tool === 'inspect')) {
    A = S.buildings[S.tiles[i].b].tiles; ca = tool === 'demolish' ? '#ff5a4a' : '#ffffff';
  }
  setHighlight(A, ca, Bt, cb);
  if (gk !== ghostKey) {
    if (ghost) { freeMesh(ghost); ghost = null; }
    ghostKey = gk;
    if (gk) {
      const a = S.tiles[fp[0]];
      const offs = fp.map(j => [S.tiles[j].x - a.x, S.tiles[j].y - a.y]);
      const ctx = tool === 'dam' ? { damAxis: damAxis(S, fp[0]) } : {};
      const { g } = buildModel(tool, offs, ctx);
      ghost = addMesh(g, { model: M4.trs(tw(a.x), 0.01, tw(a.y), 0, 1), blend: true, alpha: 0.55, depthWrite: false, cast: false, order: 5, tint: [0.62, 1.35, 0.7], emit: 0.25 });
    }
  }
}

/* ---------- particles ---------- */
function emit(x, y, z, kind, k) {
  if (particles.length > 520) return;
  const dark = kind === 'dark', steam = kind === 'steam', dust = kind === 'dust', mist = kind === 'mist';
  particles.push({ x: x + (Math.random() - 0.5) * 0.05, y, z: z + (Math.random() - 0.5) * 0.05, vx: 0.12 + (Math.random() - 0.5) * 0.08, vy: dust ? 0.25 + Math.random() * 0.3 : mist ? 0.15 : 0.35 + Math.random() * 0.15, vz: 0.05 + (Math.random() - 0.5) * 0.08, age: 0,
    life: dust ? 0.9 : mist ? 1.6 : steam ? 3.2 : 2.6, s0: dust ? 0.08 : mist ? 0.25 * (k || 1) : steam ? 0.16 : 0.09, s1: dust ? 0.3 : mist ? 0.7 * (k || 1) : steam ? 0.75 : 0.42,
    col: dark ? [0.13, 0.13, 0.14] : steam || mist ? [0.95, 0.97, 1.0] : dust ? [0.62, 0.55, 0.45] : [0.72, 0.72, 0.74], a: dark ? 0.55 : steam ? 0.5 : mist ? 0.35 : dust ? 0.6 : 0.45 });
}
function puffAt(tiles, n) {
  tiles.forEach(i => { const t = S.tiles[i]; for (let k = 0; k < n; k++) { const p = emit(tw(t.x) + (Math.random() - 0.5) * 0.8, 0.05, tw(t.y) + (Math.random() - 0.5) * 0.8, 'dust'); } });
}

/* ---------- environment ---------- */
function computeEnv(time) {
  const k = 1 - Math.exp(-0.05);
  for (const key of ['p', 'd', 'wf', 'dead']) envS[key] += (envT[key] - envS[key]) * k;
  const p = clamp(envS.p / 100, 0, 1), dr = clamp(envS.d, 0, 1), dead = clamp(envS.dead, 0, 1);
  // pollution under ~12% leaves the valley pristine; by 80% the city is choking
  const pe = smooth(0.12, 0.8, p);
  let skyTop = mixc(C('#3f8fd8'), C('#7d7462'), pe), skyHor = mixc(C('#cfe8f7'), C('#b9a27a'), pe), skyBot = mixc(C('#eef5fa'), C('#a8977a'), pe);
  skyHor = mixc(skyHor, C('#e8d6a6'), dr * 0.5); skyBot = mixc(skyBot, C('#e3d2a4'), dr * 0.4);
  skyTop = mixc(skyTop, C('#6f7c86'), dead * 0.8); skyHor = mixc(skyHor, C('#a9a49b'), dead * 0.8); skyBot = mixc(skyBot, C('#99948c'), dead * 0.8);
  const sunCol = mixc(mixc(mixc([2.45, 2.25, 1.95], [1.35, 1.05, 0.72], pe), [2.6, 2.2, 1.6], dr * 0.4), [1.0, 0.98, 0.95], dead);
  let grass = mixc([1, 1, 1], [0.8, 0.7, 0.5], pe);
  grass = mixc(grass, [1.25, 0.98, 0.45], dr * 0.9);
  grass = mixc(grass, [0.55, 0.53, 0.5], dead);
  const water = mixc(mixc(C('#38a0e0'), C('#6b6a45'), pe), C('#5f676b'), dead), waterDeep = mixc(mixc(C('#1b5d9b'), C('#3f3f28'), pe), C('#363c40'), dead);
  const e = scene.env;
  e.time = time / 1000; e.sun = (() => { const v = [-0.52, 0.74, 0.42]; const l = Math.hypot(...v); return v.map(a => a / l); })();
  e.sunCol = sunCol; e.sky = mixc(mixc(C('#c8e2ff'), C('#b8a585'), pe), [0.5, 0.5, 0.5], dead).map(v => v * (0.72 - pe * 0.12)); e.gnd = C('#6b5a45').map(v => v * 0.5);
  e.skyTop = skyTop; e.skyHor = skyHor; e.skyBot = skyBot; e.fog = skyHor; e.horY = 0.45;
  e.fogN = cam.dist * (1.55 - pe * 0.95 - dead * 0.35); e.fogF = cam.dist * (3.6 - pe * 1.6 - dead * 0.6);
  e.water = water; e.waterDeep = waterDeep;
  e.shadowCenter = [cam.tx * 0.5, 0, cam.tz * 0.5]; e.shadowRadius = 21;
  if (world.terrain) { world.terrain.tint = grass; }
  [world.pines, world.rounds, propsMesh].forEach(m => { if (m) m.tint = mixc(grass, [1, 1, 1], 0.15); });
  if (world.water) world.water.model = M4.trs(0, -0.43 + 0.33 * clamp(envS.wf, 0, 1) - 0.06 * dr, 0, 0, 1);
  if (uMesh) uMesh.emit = 0.45 + 0.35 * Math.sin(time / 380);
  return pe;
}

/* ---------- camera ---------- */
function camMatrices() {
  const asp = VW / VH, fov = 30 * Math.PI / 180;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const eye = [cam.tx + cam.dist * cp * Math.sin(cam.yaw), cam.dist * sp, cam.tz + cam.dist * cp * Math.cos(cam.yaw)];
  const view = M4.lookAt(eye, [cam.tx, 0, cam.tz], [0, 1, 0]);
  const proj = M4.persp(fov, asp, 0.3, 260);
  // shift the projection centre so the target sits in the middle of the free area between panels
  const cx = (insets.l + (VW - insets.r)) / 2, cy = (insets.t + (VH - insets.b)) / 2;
  proj[8] -= (cx - VW / 2) / (VW / 2); proj[9] -= -(cy - VH / 2) / (VH / 2);
  const vp = M4.mul(proj, view);
  const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]];
  camMats = { vp, inv: M4.inv(vp), eye, right, up, w: Math.round(VW * DPR), h: Math.round(VH * DPR) };
  return camMats;
}
function fitDist(size) {
  const fov = 30 * Math.PI / 180, fw = Math.max(200, VW - insets.l - insets.r), fh = Math.max(200, VH - insets.t - insets.b);
  const tf = Math.tan(fov / 2);
  const wide = size * 1.42 + 1.0, tall = size * 1.42 * Math.sin(cam.pitch) * 0.72 + 1.6;
  return Math.max(wide / (2 * tf * (VW / VH)) * (VW / fw), tall / (2 * tf) * (VH / fh));
}

/* =====================================================
   Public API
   ===================================================== */
const R3 = {
  ok: false,
  init(canvas, overlayEl) {
    cv = canvas; overlay = overlayEl;
    try { eng = new Engine(canvas); } catch (e) { console.warn('3D unavailable', e); return false; }
    R3.ok = true; R3.resize();
    return true;
  },
  resize() {
    if (!cv) return;
    DPR = Math.min(1.75, window.devicePixelRatio || 1);
    VW = cv.clientWidth || 1; VH = cv.clientHeight || 1;
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  },
  setInsets(o) { insets = o; },
  load(st) { S = st; buildWorld(st); curLevel = st.level; recolorTerrain(st.level); buildGridAndBorder(st.level); R3.sync(st, null, false); },
  setLevel(level, instant) {
    curLevel = level; recolorTerrain(level); buildGridAndBorder(level);
    const L = E.LEVELS[level], c = tw(L.off + (L.size - 1) / 2);
    camG.tx = c; camG.tz = c; camG.dist = fitDist(L.size); camG.pitch = 0.84;
    if (instant) Object.assign(cam, camG);
  },
  sync(st, f, animate) {
    S = st; if (!S || !eng) return;
    syncBuildings(animate); syncRoads(); syncDeposits(); syncProps(); syncStatus();
    envT.p = S.pollution; envT.d = E.isDrought(S) ? 1 : 0; envT.dead = S.dead ? 1 : 0;
    if (f && f.waterCap) envT.wf = S.water / f.waterCap;
    updateHover();
  },
  envNow() { Object.assign(envS, envT); },
  hover(i, tool, ok, fp) { hoverState = { i, tool, ok, fp: fp || [] }; if (S) updateHover(); },
  select(id) { selId = id; if (S) updateHover(); },
  grid(on) { gridOn = on ? 1 : 0; },
  orbit(on) { orbit = on ? 1 : 0; },
  pan(dx, dy) {
    const wpp = 2 * camG.dist * Math.tan(15 * Math.PI / 180) / VH;
    const rx = Math.cos(camG.yaw), rz = -Math.sin(camG.yaw), fx = -Math.sin(camG.yaw), fz = -Math.cos(camG.yaw);
    camG.tx -= rx * dx * wpp; camG.tz -= rz * dx * wpp;
    camG.tx -= fx * dy * wpp / Math.sin(camG.pitch); camG.tz -= fz * dy * wpp / Math.sin(camG.pitch);
    const r = Math.hypot(camG.tx, camG.tz); if (r > 13) { camG.tx *= 13 / r; camG.tz *= 13 / r; }
    Object.assign(cam, { tx: camG.tx, tz: camG.tz });
  },
  rotate(dyaw, dpitch) { camG.yaw += dyaw; camG.pitch = clamp(camG.pitch + (dpitch || 0), 0.42, 1.25); cam.yaw = camG.yaw; cam.pitch = camG.pitch; },
  rotateStep(dir) { camG.yaw += dir * Math.PI / 2; },
  zoom(f, sx, sy) {
    const nd = clamp(camG.dist * f, 7, 60);
    if (sx != null) { const p = R3.groundAt(sx, sy); if (p) { const k = 1 - nd / camG.dist; camG.tx += (p[0] - camG.tx) * k; camG.tz += (p[1] - camG.tz) * k; } }
    camG.dist = nd;
  },
  recenter() { R3.setLevel(curLevel, false); },
  lookTile(x, y) { camG.tx = tw(x); camG.tz = tw(y); },
  groundAt(sx, sy) {
    if (!camMats) return null;
    const nx = sx / VW * 2 - 1, ny = 1 - sy / VH * 2;
    const a = M4.xf(camMats.inv, nx, ny, -1), b = M4.xf(camMats.inv, nx, ny, 1);
    const dy = b[1] - a[1]; if (Math.abs(dy) < 1e-6) return null;
    const t = -a[1] / dy; if (t < 0) return null;
    return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t];
  },
  pick(sx, sy) {
    const p = R3.groundAt(sx, sy); if (!p) return -1;
    const x = Math.round(p[0] + H), y = Math.round(p[1] + H);
    if (x < 0 || y < 0 || x >= W || y >= W) return -1;
    return E.idx(x, y);
  },
  project(x, y, z) {
    if (!camMats) return null;
    const v = M4.xf(camMats.vp, x, y, z);
    if (v[3] <= 0) return null;
    return { x: (v[0] * 0.5 + 0.5) * VW, y: (1 - (v[1] * 0.5 + 0.5)) * VH };
  },
  projectTiles(tiles, y) {
    let sx = 0, sz = 0; tiles.forEach(i => { sx += tw(S.tiles[i].x); sz += tw(S.tiles[i].y); });
    return R3.project(sx / tiles.length, y || 0.6, sz / tiles.length);
  },
  puff(tiles) { puffAt(tiles, 12); },
  _dbg() { return { hi: !!hiMesh, hiVis: hiMesh && hiMesh.visible, ghost: !!ghost, gk: ghostKey, hover: hoverState, n: scene.meshes.length, inScene: ghost ? scene.meshes.indexOf(ghost) : -2 }; },
  frame(time) {
    if (!eng || !S) return;
    const dt = Math.min(0.1, lastT ? (time - lastT) / 1000 : 0.016); lastT = time;
    if (orbit) camG.yaw += dt * 0.06;
    const k = 1 - Math.exp(-dt * 7);
    cam.tx += (camG.tx - cam.tx) * k; cam.tz += (camG.tz - cam.tz) * k; cam.dist += (camG.dist - cam.dist) * k; cam.yaw += (camG.yaw - cam.yaw) * k; cam.pitch += (camG.pitch - cam.pitch) * k;
    const pe = computeEnv(time);
    const cm = camMatrices();
    // grid fade
    gridA += ((gridOn ? 0.22 : 0) - gridA) * Math.min(1, dt * 8);
    if (gridMesh) { gridMesh.alpha = gridA; gridMesh.visible = gridA > 0.01; }
    // buildings: pop-in, spinners, smoke
    const now = performance.now();
    for (const e of bmap.values()) {
      if (e.t0) {
        const u = clamp((now - e.t0) / 520, 0, 1);
        const s = u >= 1 ? 1 : 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
        e.mesh.model = M4.trs(e.x, 0, e.z, 0, Math.max(0.01, s));
        if (u >= 1) { e.t0 = 0; scene.shadowDirty = true; }
      }
      for (const sp of e.spin) {
        if (e.on) sp.a += dt * 2.6;
        const s = sp.s, c = Math.cos(s.face), sn = Math.sin(s.face);
        sp.mesh.model = M4.trs(e.x + s.x + sn * s.off, s.y, e.z + s.z + c * s.off, s.face, 1, 0, sp.a);
      }
      if (e.on && e.extra.smoke) {
        for (const [sx, sy, sz, kind] of e.extra.smoke) {
          const rate = (kind === 'steam' ? 5 : kind === 'dark' ? 6 : 3) * (0.4 + 0.6 * (e.eff || 1));
          if (Math.random() < rate * dt) emit(e.x + sx, sy, e.z + sz, kind);
        }
      }
    }
    // mist at waterfalls
    if (world.mist) for (const [x, y, z, s] of world.mist) if (Math.random() < dt * 4) emit(x, y, z, 'mist', s);
    // particles
    const sprites = [];
    for (let q = particles.length - 1; q >= 0; q--) {
      const p = particles[q]; p.age += dt;
      if (p.age > p.life) { particles.splice(q, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy *= 0.995;
      const u = p.age / p.life;
      sprites.push([p.x, p.y, p.z, lerp(p.s0, p.s1, u), p.col[0], p.col[1], p.col[2], p.a * Math.sin(Math.PI * Math.min(1, u * 1.2)) * (1 - u * 0.4)]);
    }
    // smog over the city
    if (pe > 0.03) {
      const a = clamp(pe, 0, 1) * 0.34;
      const sc = mixc([0.42, 0.36, 0.26], [0.36, 0.35, 0.33], clamp(envS.dead, 0, 1));
      for (const s of smog) sprites.push([s.x + Math.sin(time / 9000 + s.ph) * 0.8, s.y, s.z + Math.cos(time / 11000 + s.ph) * 0.8, s.s, sc[0], sc[1], sc[2], a]);
    }
    scene.sprites = sprites;
    // cars
    if (carMesh) {
      const inst = [];
      if (roadGraph) for (const c of cars) {
        c.t += dt * c.sp;
        if (c.t >= 1) { c.t -= 1; const nb = roadGraph.get(c.b) || []; const opts = nb.filter(v => v !== c.a); const nxt = opts.length ? opts[Math.floor(Math.random() * opts.length)] : c.a; c.a = c.b; c.b = nxt; }
        const A = S.tiles[c.a], Bt = S.tiles[c.b]; if (!A || !Bt) continue;
        const ax = tw(A.x), az = tw(A.y), bx = tw(Bt.x), bz = tw(Bt.y);
        const dx = bx - ax, dz = bz - az, ang = Math.atan2(-dz, dx);
        const ox = -dz * 0.14, oz = dx * 0.14;
        const y = (A.t === 'river' || Bt.t === 'river') ? 0.05 : 0.02;
        inst.push([ax + dx * c.t + ox, y, az + dz * c.t + oz, 1, ang, 1, 0, 0, c.col[0], c.col[1], c.col[2]]);
      }
      eng.setInst(carMesh, inst);
    }
    // birds
    if (birdMesh) {
      const inst = birds.map(b => { const a = b.ph + time / 1000 * b.sp; return [Math.cos(a) * b.rad, b.h + Math.sin(time / 700 + b.lag) * 0.15, Math.sin(a) * b.rad, 1, -a + (b.sp > 0 ? 0 : Math.PI), 0.4 + 0.6 * Math.abs(Math.sin(time / 160 + b.lag)), 0, 0, 1, 1, 1]; });
      eng.setInst(birdMesh, inst);
    }
    // clouds drift
    if (world.clouds) world.clouds.model = M4.trs(0, 0, 0, time / 1000 * 0.004, 1);
    // labels
    for (const l of labels.values()) {
      const pp = R3.project(l.e.x, 0.75, l.e.z);
      if (!pp) { l.el.style.display = 'none'; continue; }
      l.el.style.display = ''; l.el.style.transform = 'translate(' + Math.round(pp.x) + 'px,' + Math.round(pp.y) + 'px) translate(-50%,-100%)';
    }
    eng.render(scene, cm);
  },
  // render a building on its own for the build cards
  thumb(type) {
    if (!eng) return null;
    const d = B[type];
    let fp = [[0, 0]];
    if (type === 'coalPlant') fp = [[0, 0], [1, 0], [2, 0]];
    if (type === 'nuclear') fp = [[0, 0], [1, 0], [0, 1], [1, 1]];
    const ctx = { damAxis: 'z' };
    const g = new Geo();
    const ground = d.on === 'river' ? '#3a9ad9' : d.on === 'coal' ? '#3b3935' : d.on === 'gold' ? '#9e8247' : d.on === 'uranium' ? '#56644b' : d.on === 'mineral' ? '#91846f' : '#6cbd4a';
    fp.forEach(([x, z]) => { box(g, '#7a5232', x, -0.22, z, 1.0, 0.2, 1.0); box(g, ground, x, -0.03, z, 1.0, 0.03, 1.0); });
    const m = buildModel(type, fp, ctx).g; g.merge(m, 0, 0, 0);
    if (type === 'road') { box(g, '#c9c6bd', 0, 0, 0, 1, 0.03, 1); box(g, P.asphalt, 0, 0.003, 0, 0.8, 0.03, 1.0); box(g, '#f1efe6', 0, 0.034, 0, 0.025, 0.004, 0.5); }
    const extra = (MODELS[type] && MODELS[type](new Geo(), fp, ctx)) || {};
    const meshes = [eng.mesh(g, { cast: false })];
    (extra.spin || []).forEach(s => { const c = Math.cos(s.face), sn = Math.sin(s.face); meshes.push(eng.mesh(rotorGeo(), { cast: false, model: M4.trs(s.x + sn * s.off, s.y, s.z + c * s.off, s.face, 1, 0, 0.4) })); });
    const xs = fp.map(p => p[0]), zs = fp.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + 1;
    const tall = { apartment: 1.9, itPark: 1.3, wind: 1.9, coalPlant: 1.7, nuclear: 1.7, goldFactory: 1.0 }[type] || 0.6;
    const Wt = 300, Ht = 225, t = R3._tgt || (R3._tgt = eng.target(Wt, Ht));
    const dist = 2.2 + span * 1.25 + tall * 0.9, yaw = Math.PI / 4, pitch = 0.6;
    const eye = [cx + dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch) + tall * 0.35, cz + dist * Math.cos(pitch) * Math.cos(yaw)];
    const view = M4.lookAt(eye, [cx, tall * 0.35, cz], [0, 1, 0]);
    const vp = M4.mul(M4.persp(30 * Math.PI / 180, Wt / Ht, 0.1, 100), view);
    const sc = { meshes, sprites: [], env: Object.assign({}, scene.env, { fogN: 500, fogF: 600, water: C('#38a0e0'), waterDeep: C('#1b5d9b') }) };
    if (!sc.env.sun) { computeEnv(0); Object.assign(sc.env, scene.env, { fogN: 500, fogF: 600 }); }
    eng.render(sc, { vp, eye, right: [view[0], view[4], view[8]], up: [view[1], view[5], view[9]], w: Wt, h: Ht }, { fbo: t.fbo, clear: [0, 0, 0, 0], shadow: false });
    const px = eng.read(t);
    meshes.forEach(m => eng.free(m));
    const c2 = document.createElement('canvas'); c2.width = Wt; c2.height = Ht;
    const id = c2.getContext('2d').createImageData(Wt, Ht);
    for (let y = 0; y < Ht; y++) id.data.set(px.subarray((Ht - 1 - y) * Wt * 4, (Ht - y) * Wt * 4), y * Wt * 4);
    c2.getContext('2d').putImageData(id, 0, 0);
    return c2.toDataURL('image/png');
  },
};
root.R3 = R3;
})(window);
