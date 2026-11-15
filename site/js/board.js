// The Skills board: a circuit board built in code, one part per skill area, labelled like a diagram.
// The labels are the real HTML lists beside the canvas; this file draws the board and the leader lines
// from each label to its part. Renders on demand only (tilt, hover, resize), never in a constant loop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 8, D = 5, T = 0.12;          // board size (x, z) and thickness, in world units
const PX = 256;                         // texture pixels per unit
const C = {
  mask: '#23473b', copper: '#3b7560', silk: '#ece6d6', gold: '#c9a55e',
  chip: '#232427', chipText: '#8b8780', substrate: '#2b3a33', lid: '#a3a29d', shield: '#b9b8b2',
};

// The five parts, in label order (A–E). Positions are board centres; anchor height is filled in on build.
const PARTS = [
  { ref: 'U1', name: 'FPGA',  x: -1.55, z: -0.55 },
  { ref: 'U2', name: 'MCU',   x: -2.65, z: 1.5 },
  { ref: 'M1', name: 'WI-FI', x: 2.55,  z: -1.35 },
  { ref: 'U3', name: 'NPU',   x: 0.95,  z: 0.15 },
  { ref: 'J1', name: 'JTAG',  x: 2.55,  z: 1.7 },
];

// Small passives (x, z, rotated?) placed beside the chips they would decouple
const PASSIVES = [];
for (let i = 0; i < 6; i++) PASSIVES.push([-2.3 + i * 0.3, 0.62, true]);
for (let i = 0; i < 4; i++) PASSIVES.push([-0.4, -1.25 + i * 0.3, false]);
for (let i = 0; i < 4; i++) PASSIVES.push([1.85, -0.35 + i * 0.3, false]);
for (let i = 0; i < 3; i++) PASSIVES.push([0.45 + i * 0.3, 1.12, true]);
for (let i = 0; i < 3; i++) PASSIVES.push([-3.55, 0.95 + i * 0.3, false]);
PASSIVES.push([-0.6, 2.05, true], [-0.3, 2.05, true], [3.6, 0.15, false], [3.6, 0.45, false], [-3.4, -1.9, true], [-3.1, -1.9, true]);

/* ── Board surface: one canvas drawn twice, once for colour and once for roughness/metalness ── */
const px = (x) => (x + W / 2) * PX;
const pz = (z) => (z + D / 2) * PX;

function chamferPath(g, pts, c = 0.08) {
  g.beginPath();
  g.moveTo(px(pts[0][0]), pz(pts[0][1]));
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], [cx, cz] = pts[i + 1];
    const l1 = Math.hypot(bx - ax, bz - az), l2 = Math.hypot(cx - bx, cz - bz);
    const k = Math.min(c, l1 / 2, l2 / 2);
    g.lineTo(px(bx - (bx - ax) / l1 * k), pz(bz - (bz - az) / l1 * k));
    g.lineTo(px(bx + (cx - bx) / l2 * k), pz(bz + (cz - bz) / l2 * k));
  }
  const e = pts[pts.length - 1];
  g.lineTo(px(e[0]), pz(e[1]));
  g.stroke();
}

// Nested dogleg buses, so parallel traces never cross. axis 'x' = horizontal first.
function routes() {
  const r = [], g = 0.1;
  for (let i = 0; i < 7; i++) {   // U1 → U3, stepping down
    const a = -1.2 + i * g, b = -0.4 + i * g, k = -0.1 - i * g;
    r.push([[-0.7, a], [k, a], [k, b], [0.3, b]]);
  }
  for (let i = 0; i < 5; i++) {   // U1 → U2
    const x0 = -2.25 + i * g, x1 = -3.0 + i * g, z = 0.6 + i * 0.08;
    r.push([[x0, 0.3], [x0, z], [x1, z], [x1, 1.0]]);
  }
  for (let i = 0; i < 4; i++) {   // U3 → M1
    const z = -0.3 + i * g, k = 2.05 + i * g;
    r.push([[1.6, z], [k, z], [k, -0.85]]);
  }
  for (let i = 0; i < 4; i++) {   // J1 → U1
    const z = 1.3 + i * g, k = -0.85 - i * g;
    r.push([[1.85, z], [k, z], [k, 0.3]]);
  }
  for (let i = 0; i < 2; i++) r.push([[-2.15, 1.65 + i * 0.12], [-1.85, 1.65 + i * 0.12]]);   // U2 → Y1
  for (let i = 0; i < 6; i++) {   // U1 top → across to M1 (left traces turn higher, so none cross)
    const x0 = -2.2 + i * 0.1, z = -2.25 + i * 0.08;
    r.push([[x0, -1.4], [x0, z], [1.6 - (5 - i) * 0.06, z]]);
  }
  for (let i = 0; i < 7; i++) {   // U1 left fan-out to vias
    const z = -1.25 + i * 0.13;
    r.push([[-2.4, z], [-2.9 - (i % 2) * 0.22, z]]);
  }
  for (let i = 0; i < 4; i++) r.push([[2.6 + i * 0.12, 1.4], [2.6 + i * 0.12, -0.85]]);   // J1 → M1
  for (let i = 0; i < 9; i++) {   // U3 bottom fan-out to vias
    const x = 0.4 + i * 0.13;
    r.push([[x, 0.8], [x, 0.93 + (i % 2) * 0.1]]);
  }
  for (let i = 0; i < 4; i++) {   // U2 left fan-out
    const z = 1.2 + i * 0.12;
    r.push([[-3.12, z], [-3.3, z], [-3.42, z - 0.12]]);
  }
  return r;
}

// Inner-layer traces: seen faintly through the mask, free to cross the top layer. Seeded, so always the same.
function innerRoutes() {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const out = [];
  for (let n = 0; n < 46; n++) {
    let x = Math.round((rnd() * 7.2 - 3.6) * 10) / 10, z = Math.round((rnd() * 4.2 - 2.1) * 10) / 10;
    let d = Math.floor(rnd() * 4) * 2;   // start on an axis
    const pts = [[x, z]];
    const segs = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < segs; k++) {
      const len = (d % 2 ? 0.15 + rnd() * 0.3 : 0.3 + rnd() * 1.1);
      const [dx, dz] = dirs[d];
      const nx = x + dx * len, nz = z + dz * len;
      if (Math.abs(nx) > 3.75 || Math.abs(nz) > 2.25) break;
      x = nx; z = nz; pts.push([x, z]);
      d = (d + (rnd() < 0.5 ? 1 : 7)) % 8;   // turn 45°
    }
    if (pts.length > 1) out.push(pts);
  }
  return out;
}

function via(g, x, z, holeCol, ringCol, r = 0.032) {
  g.fillStyle = ringCol; g.beginPath(); g.arc(px(x), pz(z), r * PX, 0, Math.PI * 2); g.fill();
  g.fillStyle = holeCol; g.beginPath(); g.arc(px(x), pz(z), r * 0.45 * PX, 0, Math.PI * 2); g.fill();
}

function drawBoard(g, mr) {
  // mr: drawing the roughness (G) / metalness (B) map instead of colour
  const col = (k) => mr ? { mask: '#007000', copper: '#007000', silk: '#00c800', gold: '#004cff' }[k] : C[k];
  g.fillStyle = col('mask');
  g.fillRect(0, 0, W * PX, D * PX);

  g.lineCap = 'round';
  g.lineJoin = 'round';
  // inner layer first, faint, so the top layer reads over it
  g.globalAlpha = mr ? 1 : 0.5;
  g.strokeStyle = mr ? col('mask') : '#3a6a58';
  g.lineWidth = 0.026 * PX;
  const inner = innerRoutes();
  for (const r of inner) chamferPath(g, r, 0.05);
  g.globalAlpha = 1;
  const hole = mr ? '#00a000' : '#10241d';
  for (const r of inner) for (const p of [r[0], r[r.length - 1]]) via(g, p[0], p[1], hole, col('gold'), 0.026);
  // stitching vias along the board edge
  for (let x = -3.3; x <= 3.31; x += 0.22) for (const z of [-2.32, 2.32]) {
    if (z > 0 && x < -1.6) continue;   // keep the board title clear
    if (z < 0 && x > 3.2) continue;
    via(g, x, z, hole, col('gold'), 0.022);
  }
  for (let z = -1.7; z <= 1.71; z += 0.22) for (const x of [-3.88, 3.88]) {
    if (x > 0 && z < -0.7) continue;    // antenna keep-out
    via(g, x, z, hole, col('gold'), 0.022);
  }
  g.strokeStyle = col('copper');
  g.lineWidth = 0.035 * PX;
  const rs = routes();
  for (const r of rs) chamferPath(g, r);
  // a few power traces and a ground pour edge for weight
  g.lineWidth = 0.12 * PX;
  chamferPath(g, [[-3.75, -2.2], [-3.75, 0.6], [-3.3, 0.85]], 0.2);
  chamferPath(g, [[3.75, 2.2], [3.75, -0.4], [3.4, -0.65]], 0.2);

  // vias at the ends of the buses
  for (const r of rs) {
    const [x, z] = r[r.length - 1];
    if (Math.abs(x) < 3.9) via(g, x, z, hole, col('gold'));
  }
  g.fillStyle = col('gold');

  // passive pads
  for (const [x, z, rot] of PASSIVES) {
    const dx = rot ? 0 : 0.11, dz = rot ? 0.11 : 0;
    for (const s of [-1, 1]) g.fillRect(px(x + s * dx) - 0.06 * PX, pz(z + s * dz) - 0.06 * PX, 0.12 * PX, 0.12 * PX);
  }
  // QFP pads around U2
  const u2 = PARTS[1];
  for (let i = 0; i < 9; i++) {
    const o = -0.4 + i * 0.1;
    for (const s of [-1, 1]) {
      g.fillRect(px(u2.x + o) - 0.025 * PX, pz(u2.z + s * 0.56) - 0.07 * PX, 0.05 * PX, 0.14 * PX);
      g.fillRect(px(u2.x + s * 0.56) - 0.07 * PX, pz(u2.z + o) - 0.025 * PX, 0.14 * PX, 0.05 * PX);
    }
  }
  // castellated pads around M1
  const m1 = PARTS[2];
  for (let i = 0; i < 7; i++) {
    const o = -0.6 + i * 0.2;
    g.fillRect(px(m1.x + o) - 0.04 * PX, pz(m1.z + 0.5) - 0.05 * PX, 0.08 * PX, 0.12 * PX);
  }
  // mounting-hole rings
  for (const [x, z] of [[-3.6, -2.1], [3.6, -2.1], [-3.6, 2.1], [3.6, 2.1]]) {
    g.beginPath(); g.arc(px(x), pz(z), 0.2 * PX, 0, Math.PI * 2); g.fill();
  }
  // Wi-Fi antenna meander, in copper left bare
  g.strokeStyle = col('gold');
  g.lineWidth = 0.04 * PX;
  const ant = [[3.3, -1.0]];
  for (let i = 0; i < 6; i++) { const x = 3.38 + i * 0.09; ant.push([x, -1.0], [x, -1.85], [x + 0.045, -1.85], [x + 0.045, -1.0]); }
  chamferPath(g, ant, 0.02);

  // silkscreen: outlines, reference designators, pin-1 marks, board title
  g.strokeStyle = col('silk');
  g.fillStyle = col('silk');
  g.lineWidth = 0.018 * PX;
  const box = (x, z, w, d) => g.strokeRect(px(x - w / 2), pz(z - d / 2), w * PX, d * PX);
  box(PARTS[0].x, PARTS[0].z, 1.86, 1.86);
  box(u2.x, u2.z, 1.3, 1.3);
  box(m1.x, m1.z, 1.56, 1.16);
  box(PARTS[3].x, PARTS[3].z, 1.46, 1.46);
  box(PARTS[4].x, PARTS[4].z, 1.42, 0.68);
  box(-1.6, 1.75, 0.66, 0.34);
  g.setLineDash([0.06 * PX, 0.05 * PX]);
  box(3.62, -1.42, 0.7, 1.14);
  g.setLineDash([]);
  g.textBaseline = 'middle';
  g.font = `600 ${0.15 * PX}px "IBM Plex Mono", ui-monospace, monospace`;
  const lbl = [['U1', -2.38, -1.62], ['U2', -3.25, 0.75], ['M1', 1.8, -2.08], ['U3', 0.25, -0.75], ['J1', 1.85, 1.25], ['Y1', -1.9, 1.42], ['ANT', 3.36, -2.15]];
  for (const [t, x, z] of lbl) g.fillText(t, px(x), pz(z));
  for (const [x, z] of [[-2.3, -1.3], [-3.0, 1.15], [0.38, -0.42]]) { g.beginPath(); g.arc(px(x), pz(z), 0.035 * PX, 0, Math.PI * 2); g.fill(); }
  g.font = `600 ${0.17 * PX}px "IBM Plex Mono", ui-monospace, monospace`;
  g.fillText('SM-01 · SKILLS BOARD', px(-3.2), pz(2.25));
  g.font = `500 ${0.12 * PX}px "IBM Plex Mono", ui-monospace, monospace`;
  g.fillText('REV A  2026', px(-3.2), pz(2.43) - 0.0);
}

function boardTextures() {
  const make = (mr) => {
    const c = document.createElement('canvas');
    c.width = W * PX; c.height = D * PX;
    drawBoard(c.getContext('2d'), mr);
    const t = new THREE.CanvasTexture(c);
    if (!mr) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    // ExtrudeGeometry's cap UVs are the shape's own coordinates: map them onto the canvas
    t.repeat.set(1 / W, 1 / D);
    t.offset.set(0.5, 0.5);
    return t;
  };
  return { map: make(false), mr: make(true), redraw() {
    for (const [t, mr] of [[this.map, false], [this.mr, true]]) { drawBoard(t.image.getContext('2d'), mr); t.needsUpdate = true; }
  } };
}

function topLabel(text, w, d, bg, fg) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * 200); c.height = Math.round(d * 200);
  const g = c.getContext('2d');
  const draw = () => {
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 ${Math.round(c.height * 0.2)}px "IBM Plex Mono", ui-monospace, monospace`;
    g.fillText(text, c.width / 2, c.height * 0.46);
    g.font = `500 ${Math.round(c.height * 0.11)}px "IBM Plex Mono", ui-monospace, monospace`;
    g.fillText('SM-01', c.width / 2, c.height * 0.7);
    g.beginPath(); g.arc(c.height * 0.14, c.height * 0.14, c.height * 0.05, 0, Math.PI * 2); g.fill();
  };
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.redraw = () => { draw(); t.needsUpdate = true; };
  return t;
}

export function createBoard({ fig, stage, canvas, svg, labels, reduceMotion }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    fig.classList.add('flat');
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth <= 900 ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 100);

  const key = new THREE.DirectionalLight(0xfff4e6, 1.3);
  key.position.set(-3, 12, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);

  const board = new THREE.Group();
  scene.add(board);
  const owned = [];   // textures to dispose
  const std = (o) => new THREE.MeshStandardMaterial(o);

  /* Board: a rounded slab with real mounting holes */
  const shape = new THREE.Shape();
  const r = 0.28, hw = W / 2, hd = D / 2;
  shape.moveTo(-hw + r, -hd); shape.lineTo(hw - r, -hd); shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r); shape.quadraticCurveTo(hw, hd, hw - r, hd); shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r); shape.lineTo(-hw, -hd + r); shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  for (const [x, z] of [[-3.6, -2.1], [3.6, -2.1], [-3.6, 2.1], [3.6, 2.1]]) {
    const h = new THREE.Path(); h.absarc(x, -z, 0.11, 0, Math.PI * 2, true); shape.holes.push(h);
  }
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 16 });
  slabGeo.rotateX(-Math.PI / 2);
  const tex = boardTextures();
  owned.push(tex.map, tex.mr);
  const slab = new THREE.Mesh(slabGeo, [
    std({ map: tex.map, roughnessMap: tex.mr, metalnessMap: tex.mr, roughness: 1, metalness: 1 }),
    std({ color: '#1c3a30', roughness: 0.7 }),
  ]);
  slab.castShadow = slab.receiveShadow = true;
  board.add(slab);

  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.16 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -0.35;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  const parts = PARTS.map(() => new THREE.Group());
  parts.forEach((p, i) => { p.position.set(PARTS[i].x, T, PARTS[i].z); p.userData.part = i; board.add(p); });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const labelled = (text, w, h, d, side, top) => {
    const t = topLabel(text, w, d, top, C.chipText); owned.push(t);
    const s = std({ color: side, roughness: 0.55 });
    return [new THREE.BoxGeometry(w, h, d), [s, s, std({ map: t, roughness: 0.55 }), s, s, s]];
  };
  const tops = [];   // anchor heights per part

  // U1 FPGA: BGA substrate and a metal lid
  {
    const p = parts[0];
    add(p, new THREE.BoxGeometry(1.7, 0.05, 1.7), std({ color: C.substrate, roughness: 0.6 }), 0, 0.045, 0);
    const lidTex = topLabel('FPGA', 1.3, 1.3, C.lid, '#55534e'); owned.push(lidTex);
    const lm = std({ color: C.lid, metalness: 0.85, roughness: 0.38 });
    add(p, new THREE.BoxGeometry(1.3, 0.08, 1.3), [lm, lm, std({ map: lidTex, metalness: 0.85, roughness: 0.38 }), lm, lm, lm], 0, 0.11, 0);
    tops.push(0.15);
  }
  // U2 MCU: QFP body with gull-wing pins
  {
    const p = parts[1];
    const [g, m] = labelled('MCU', 0.95, 0.1, 0.95, C.chip, C.chip);
    add(p, g, m, 0, 0.07, 0);
    const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.03, 0.16), std({ color: '#c8c6bf', metalness: 0.9, roughness: 0.3 }), 36);
    const o = new THREE.Object3D();
    let n = 0;
    for (let s = 0; s < 4; s++) for (let i = 0; i < 9; i++) {
      const a = -0.4 + i * 0.1, rot = s % 2 ? Math.PI / 2 : 0, sign = s < 2 ? 1 : -1;
      o.position.set(s % 2 ? sign * 0.53 : a, 0.03, s % 2 ? a : sign * 0.53);
      o.rotation.set(0, rot, 0); o.updateMatrix(); pins.setMatrixAt(n++, o.matrix);
    }
    pins.castShadow = true; p.add(pins);
    tops.push(0.12);
  }
  // M1 Wi-Fi module: a metal shield can
  {
    const p = parts[2];
    const t = topLabel('WI-FI', 1.4, 1.0, C.shield, '#5d5b55'); owned.push(t);
    const s = std({ color: C.shield, metalness: 0.9, roughness: 0.32 });
    add(p, new THREE.BoxGeometry(1.4, 0.03, 1.0), std({ color: C.substrate, roughness: 0.6 }), 0, 0.015, 0);
    add(p, new THREE.BoxGeometry(1.32, 0.13, 0.92), [s, s, std({ map: t, metalness: 0.9, roughness: 0.32 }), s, s, s], 0, 0.095, 0);
    tops.push(0.16);
  }
  // U3 accelerator with a finned heatsink
  {
    const p = parts[3];
    const [g, m] = labelled('NPU', 1.3, 0.1, 1.3, C.chip, C.chip);
    add(p, g, m, 0, 0.05, 0);
    const al = std({ color: '#8f9396', metalness: 0.75, roughness: 0.42 });
    add(p, new THREE.BoxGeometry(1.0, 0.06, 1.0), al, 0, 0.13, 0);
    const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.36, 1.0), al, 9);
    const o = new THREE.Object3D();
    for (let i = 0; i < 9; i++) { o.position.set(-0.46 + i * 0.115, 0.34, 0); o.updateMatrix(); fins.setMatrixAt(i, o.matrix); }
    fins.castShadow = fins.receiveShadow = true; p.add(fins);
    tops.push(0.52);
  }
  // J1 JTAG header: 2 × 5 gold pins in a black shroud
  {
    const p = parts[4];
    add(p, new THREE.BoxGeometry(1.32, 0.22, 0.6), std({ color: '#1b1c1e', roughness: 0.7 }), 0, 0.11, 0);
    const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), std({ color: C.gold, metalness: 1, roughness: 0.28 }), 10);
    const o = new THREE.Object3D();
    for (let i = 0; i < 10; i++) { o.position.set(-0.508 + (i % 5) * 0.254, 0.3, i < 5 ? -0.127 : 0.127); o.updateMatrix(); pins.setMatrixAt(i, o.matrix); }
    pins.castShadow = true; p.add(pins);
    tops.push(0.51);
  }
  // Y1 crystal and the passives (not linked to a label)
  add(board, new THREE.BoxGeometry(0.5, 0.12, 0.2), std({ color: '#c3c2bc', metalness: 0.9, roughness: 0.3 }), -1.6, T + 0.06, 1.75);
  {
    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.06, 0.1), std({ color: '#b69c6e', roughness: 0.6 }), PASSIVES.length);
    const ends = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.065, 0.105), std({ color: '#cfcdc6', metalness: 0.9, roughness: 0.3 }), PASSIVES.length * 2);
    const o = new THREE.Object3D();
    PASSIVES.forEach(([x, z, rot], i) => {
      o.rotation.set(0, rot ? Math.PI / 2 : 0, 0);
      o.position.set(x, T + 0.03, z); o.updateMatrix(); bodies.setMatrixAt(i, o.matrix);
      for (const s of [-1, 1]) {
        o.position.set(x + (rot ? 0 : s * 0.095), T + 0.032, z + (rot ? s * 0.095 : 0));
        o.updateMatrix(); ends.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), o.matrix);
      }
    });
    bodies.castShadow = ends.castShadow = true;
    board.add(bodies, ends);
  }

  // Highlight: the active part lifts slightly and gains a faint signal glow
  const glow = new THREE.Color('#0a7359');
  parts.forEach((p) => p.traverse((o) => {
    if (!o.isMesh) return;
    o.material = [].concat(o.material).map((m) => m.clone());
    if (o.material.length === 1) o.material = o.material[0];
  }));
  const anchors = tops.map((y, i) => new THREE.Vector3(PARTS[i].x, T + y, PARTS[i].z));

  /* ── Camera framing: fit the board to the stage at a fixed three-quarter view ── */
  const POLAR = 0.78;   // from vertical
  function frame() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * camera.aspect);
    const projDepth = D * Math.cos(POLAR) + 0.6 * Math.sin(POLAR);
    const dist = Math.max((W / 2) / Math.tan(hf), (projDepth / 2) / Math.tan(vf)) * 1.16;
    camera.position.set(0, Math.cos(POLAR) * dist, Math.sin(POLAR) * dist);
    camera.lookAt(0, 0.1, 0.1);
    camera.updateProjectionMatrix();
  }

  /* ── Leader lines in the SVG overlay: label → elbow at the stage edge → the part ── */
  const NS = 'http://www.w3.org/2000/svg';
  const wide = matchMedia('(min-width: 901px)');
  const groups = labels.map((el, i) => {
    const g = document.createElementNS(NS, 'g');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('pathLength', '1');
    const badge = document.createElementNS(NS, 'g');
    badge.setAttribute('class', 'badge');
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '11');
    const t = document.createElementNS(NS, 'text'); t.textContent = 'ABCDE'[i];
    badge.append(c, t);
    g.append(path, badge);
    svg.append(g);
    return { el, side: el.closest('.callouts-r') ? 'r' : 'l', path, badge, h3: el.querySelector('h3') };
  });
  let cache = null;
  function measure() {
    const f = fig.getBoundingClientRect(), s = stage.getBoundingClientRect();
    cache = {
      stage: { x: s.left - f.left, y: s.top - f.top, w: s.width, h: s.height },
      labels: groups.map((g) => {
        const r = g.h3.getBoundingClientRect(), d = g.el.getBoundingClientRect();
        return { x: (g.side === 'l' ? d.right : d.left) - f.left, y: r.top + r.height / 2 - f.top };
      }),
    };
  }
  const v = new THREE.Vector3();
  function drawLeaders() {
    if (!cache) return;
    const { stage: s } = cache;
    groups.forEach((g, i) => {
      v.copy(anchors[i]).applyMatrix4(board.matrixWorld).project(camera);
      const ax = s.x + (v.x + 1) / 2 * s.w, ay = s.y + (1 - v.y) / 2 * s.h;
      g.badge.setAttribute('transform', `translate(${ax.toFixed(1)} ${ay.toFixed(1)})`);
      if (!wide.matches) return;
      const L = cache.labels[i];
      // the elbow sits on the stage edge nearest the label, never past the part itself
      const ex = g.side === 'l' ? Math.min(s.x + s.w * 0.06, ax - 20) : Math.max(s.x + s.w * 0.94, ax + 20);
      const dx = ex - ax, dy = L.y - ay, len = Math.hypot(dx, dy) || 1;   // stop at the badge's rim
      g.path.setAttribute('d', `M${L.x.toFixed(1)} ${L.y.toFixed(1)}H${ex.toFixed(1)}L${(ax + dx / len * 12).toFixed(1)} ${(ay + dy / len * 12).toFixed(1)}`);
    });
  }

  /* ── State, damped toward targets; the loop stops when everything has settled ── */
  let active = -1;
  const tilt = { x: 0, z: 0, tx: 0, tz: 0 };
  const lift = parts.map(() => 0);
  function setActive(i) {
    if (i === active) return;
    active = i;
    groups.forEach((g, k) => { g.el.classList.toggle('active', k === i); g.path.parentNode.classList.toggle('on', k === i); });
    request();
  }
  labels.forEach((el, i) => {
    el.addEventListener('pointerenter', () => setActive(i));
    el.addEventListener('pointerleave', () => setActive(-1));
    el.addEventListener('focusin', () => setActive(i));
    el.addEventListener('focusout', () => setActive(-1));
  });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width * 2 - 1, ny = (e.clientY - r.top) / r.height * 2 - 1;
    if (!reduceMotion && e.pointerType === 'mouse') { tilt.tx = ny * 0.07; tilt.tz = -nx * 0.07; }
    ndc.set(nx, -ny);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(parts, true)[0];
    let o = hit && hit.object;
    while (o && o.userData.part === undefined) o = o.parent;
    setActive(o ? o.userData.part : -1);
    request();
  });
  stage.addEventListener('pointerleave', () => { tilt.tx = tilt.tz = 0; setActive(-1); request(); });

  function step() {
    let moving = false;
    const k = reduceMotion ? 1 : 0.14;
    const ease = (cur, target) => { const d = target - cur; if (Math.abs(d) > 1e-4) moving = true; return Math.abs(d) > 1e-4 ? cur + d * k : target; };
    tilt.x = ease(tilt.x, tilt.tx); tilt.z = ease(tilt.z, tilt.tz);
    board.rotation.set(tilt.x, 0, tilt.z);
    parts.forEach((p, i) => {
      lift[i] = ease(lift[i], i === active ? 1 : 0);
      p.position.y = T + lift[i] * 0.08;
      p.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { m.emissive.copy(glow); m.emissiveIntensity = lift[i] * 0.35; } });
    });
    board.updateMatrixWorld(true);
    renderer.render(scene, camera);
    drawLeaders();
    return moving;
  }

  let visible = false, running = false, raf = 0;
  function loop() {
    if (!visible || document.hidden) { running = false; return; }
    if (step()) raf = requestAnimationFrame(loop); else running = false;
  }
  function request() {
    if (running || !visible || document.hidden) return;
    running = true; raf = requestAnimationFrame(loop);
  }
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) request();
  }, { rootMargin: '120px 0px' });
  io.observe(stage);
  const onVisibility = () => request();
  document.addEventListener('visibilitychange', onVisibility);
  const ro = new ResizeObserver(() => { frame(); measure(); if (visible) step(); });
  ro.observe(fig);
  wide.addEventListener('change', () => { measure(); request(); });

  // canvas lettering waits for nothing, then redraws once the mono face arrives
  if (document.fonts) document.fonts.ready.then(() => {
    tex.redraw();
    owned.forEach((t) => t.userData.redraw && t.userData.redraw());
    if (visible) step();
  });

  frame(); measure();
  return {
    request,
    dispose() {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        for (const m of [].concat(o.material)) m.dispose();
      });
      owned.forEach((t) => t.dispose());
      scene.environment.dispose(); pmrem.dispose(); renderer.dispose();
    },
  };
}
