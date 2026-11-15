// The cyberdeck scene: model, lighting, the CRT's live content, manual rotation, and the camera rig
// that the scroll journey drives. Nothing here knows about GSAP; the journey only writes three numbers.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODEL_URL = '../public/models/cyberdeck-web.glb';
// The portrait is one replaceable image. Any shoulders-up picture works: the shader turns it into teal phosphor.
export const PORTRAIT_URL = 'img/portrait.png';

const PHOSPHOR = '#5dffc1';   // sampled from the deck's small left display
const VIEW = {
  azimuth: 0.52, polar: 1.27, azimuthRange: 1.2, polarMin: 0.82, polarMax: 1.5, zoomIn: 0.82, zoomOut: 1.2,
  target: new THREE.Vector3(0, -0.75, 0),
};
// Where the portrait sits on the screen, in screen UVs (x, y, width, height); v runs top to bottom
const PORTRAIT_RECT = new THREE.Vector4(0.655, 0.04, 0.318, 0.92);

const LINES = [
  ['SM-OS v1.0 · boot ok', 0.65],
  ['> hi, i\'m sheetal!', 1],
  ['> computer engineer', 0.8],
  ['> toronto', 0.8],
];

export function createDeck({ stage, canvas, note, reduceMotion }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    note.textContent = '3D preview needs WebGL.';
    return null;
  }
  const small = () => innerWidth <= 900;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;   // the deck and light never move (the camera does): shadows are drawn once

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  const camera = new THREE.PerspectiveCamera(26, 1, 0.4, 200);

  const key = new THREE.DirectionalLight(0xfff4e6, 1.15);
  key.position.set(-1.2, 15, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 7;
  key.shadow.blurSamples = 16;
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.035;
  const rim = new THREE.DirectionalLight(0xdfeaff, 0.4);
  rim.position.set(6, 5, -9);
  scene.add(key, rim);

  const norm = new THREE.Group();   // normalised model space: longest side 10 units, y up, screen facing +x
  norm.rotation.y = -Math.PI / 2;   // turn the screen toward +z, where azimuth 0 looks from
  scene.add(norm);

  // ground: a soft contact blob plus the real cast shadow
  const FLOOR_Y = -3.47;
  const blobCanvas = document.createElement('canvas');
  blobCanvas.width = blobCanvas.height = 128;
  {
    const c = blobCanvas.getContext('2d');
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(11, 13.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), transparent: true, depthWrite: false, opacity: 0.26 }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0.4, FLOOR_Y - 0.02, 0);
  norm.add(blob);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y - 0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ── CRT content ──────────────────────────────────────────────────────
     Two independent layers, combined in the glass's shader:
       1. a small canvas with the boot text (redrawn only when the text changes)
       2. the portrait image, converted on the GPU to teal phosphor with contour lines and edge glow
     The glass stays a lit, reflective material; this only replaces what it emits. */
  const ui = document.createElement('canvas');
  ui.width = 1152;
  ui.height = 398;
  const uiTex = new THREE.CanvasTexture(ui);
  uiTex.colorSpace = THREE.SRGBColorSpace;
  uiTex.flipY = false;   // crt_screen's UVs follow glTF: v runs top to bottom
  uiTex.anisotropy = 8;

  const uniforms = {
    uPortrait: { value: null }, uPortraitAspect: { value: 1 }, uHasPortrait: { value: 0 },
    uRect: { value: PORTRAIT_RECT }, uScreenAspect: { value: 2.89 },
    uPhos: { value: new THREE.Color(PHOSPHOR) },
    uTime: { value: 0 }, uGlitch: { value: 0 }, uRecon: { value: 2 }, uScan: { value: 0.12 }, uGain: { value: 1 },
  };
  new THREE.TextureLoader().load(PORTRAIT_URL, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    uniforms.uPortrait.value = tex;
    uniforms.uPortraitAspect.value = tex.image.width / tex.image.height;
    uniforms.uHasPortrait.value = 1;
    requestRender();
  });

  const screenMat = new THREE.MeshStandardMaterial({
    name: 'crt_screen', color: 0x020605, roughness: 0.16, metalness: 0,
    emissive: 0xffffff, emissiveMap: uiTex, envMapIntensity: 0.55,
  });
  screenMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        uniform sampler2D uPortrait;
        uniform float uPortraitAspect, uHasPortrait, uScreenAspect, uTime, uGlitch, uRecon, uScan, uGain;
        uniform vec4 uRect;
        uniform vec3 uPhos;
        float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float pLum(vec2 uv) { return pow(dot(texture2D(uPortrait, uv).rgb, vec3(0.299, 0.587, 0.114)), 0.55); }`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        vec2 suv = vEmissiveMapUv;
        // signal disturbance: some horizontal bands slip sideways for a moment
        float band = floor(suv.y * 42.0);
        float tick = floor(uTime * 28.0);
        float pick = step(0.5, sHash(vec2(band * 1.7, tick)));
        float shift = (sHash(vec2(band, tick)) - 0.5) * 0.05 * uGlitch * pick;
        vec3 crt = texture2D(emissiveMap, vec2(suv.x + shift * 0.3, suv.y)).rgb;
        vec2 pc = (vec2(suv.x + shift, suv.y) - uRect.xy) / uRect.zw;
        if (uHasPortrait > 0.5 && pc.x > 0.0 && pc.x < 1.0 && pc.y > 0.0 && pc.y < 1.0) {
          // fit the image to the box like object-fit: cover
          vec2 q = pc - 0.5;
          float boxAspect = uRect.z * uScreenAspect / uRect.w;
          if (uPortraitAspect > boxAspect) q.x *= boxAspect / uPortraitAspect; else q.y *= uPortraitAspect / boxAspect;
          vec2 puv = vec2(q.x + 0.5, 0.5 - q.y);
          float l = smoothstep(0.03, 0.92, pLum(puv));
          float edge = clamp(length(vec2(pLum(puv + vec2(0.004, 0.0)), pLum(puv + vec2(0.0, 0.004))) - pLum(puv)) * 7.0, 0.0, 1.0);
          // reconstruction: contour rows lifted by brightness, over a faint measuring grid
          float rows = fract(pc.y * 64.0 - l * 1.6);
          float wire = (1.0 - smoothstep(0.0, 0.22, abs(rows - 0.5))) * smoothstep(0.03, 0.2, l);
          float grid = max(step(0.965, fract(pc.x * 12.0)), step(0.965, fract(pc.y * 12.0))) * 0.1;
          float sweep = 1.0 - smoothstep(0.0, 0.07, abs(pc.y - uRecon));
          float fade = smoothstep(0.0, 0.08, pc.x) * (1.0 - smoothstep(0.92, 1.0, pc.x)) * smoothstep(0.0, 0.06, pc.y) * (1.0 - smoothstep(0.94, 1.0, pc.y));
          float v = l * 0.82 + wire * 0.2 + edge * 0.5 + grid * (0.4 + l);
          v *= 1.0 - 0.35 * uGlitch * pick;
          v += sweep * 0.3 * (0.3 + l);
          crt += uPhos * v * fade;
        }
        float scan = 1.0 - uScan * (0.5 + 0.5 * sin(suv.y * 600.0));
        totalEmissiveRadiance = crt * scan * uGain;`);
  };
  const screenGlow = new THREE.SpotLight(PHOSPHOR, 4.5, 7, 1.0, 0.9, 1.6);
  norm.add(screenGlow, screenGlow.target);

  let bootStart = null, lastUiKey = '';
  function drawUi(now) {
    if (bootStart === null) bootStart = now;
    const elapsed = reduceMotion ? 1e9 : now - bootStart;
    const typed = Math.floor(elapsed / 30);
    const cursorOn = reduceMotion || Math.floor(now / 530) % 2 === 0;
    const total = LINES.reduce((n, [t]) => n + t.length + 4, 0);
    const key = Math.min(typed, total) + (cursorOn ? 'c' : '') + document.fonts.status;
    if (key === lastUiKey) return;
    lastUiKey = key;

    const ctx = ui.getContext('2d');
    const W = ui.width, H = ui.height;
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#04100d';
    ctx.fillRect(0, 0, W, H);
    const haze = ctx.createRadialGradient(W * 0.45, H * 0.5, 30, W * 0.5, H * 0.5, W * 0.6);
    haze.addColorStop(0, PHOSPHOR + '1c');
    haze.addColorStop(1, PHOSPHOR + '00');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    ctx.shadowColor = PHOSPHOR;
    ctx.shadowBlur = 14;
    ctx.fillStyle = PHOSPHOR;
    ctx.textBaseline = 'alphabetic';
    const size = 58;
    ctx.font = `${size}px "VT323", monospace`;
    let budget = typed;
    const x0 = 60;
    let y = 98, lastEnd = x0, lastY = y;
    for (const [text, alpha] of LINES) {
      if (budget <= 0) break;
      const shown = text.slice(0, budget);
      budget -= text.length + 4;
      ctx.globalAlpha = alpha;
      ctx.fillText(shown, x0, y);
      lastEnd = x0 + ctx.measureText(shown).width;
      lastY = y;
      y += 82;
    }
    ctx.globalAlpha = 1;
    if (cursorOn) ctx.fillRect(lastEnd + size * 0.18, lastY - size * 0.68, size * 0.46, size * 0.74);

    // corner marks around the portrait window
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.strokeStyle = PHOSPHOR;
    const bx = PORTRAIT_RECT.x * W - 6, by = PORTRAIT_RECT.y * H + 2, bw = PORTRAIT_RECT.z * W + 12, bh = PORTRAIT_RECT.w * H - 4, m = 22;
    for (const [cx, cy, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * m, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * m);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    uiTex.needsUpdate = true;
  }

  /* ── Camera rig ───────────────────────────────────────────────────────
     Manual view = azimuth, polar, zoom around the deck (OrbitControls writes it on drag; rig.set() from code).
     The scroll journey owns the camera whenever any of journey.align / approach / enter is above zero:
       align     the visitor's own angle eases back to the default three-quarter view
       approach  the camera travels to face the CRT square-on, at the distance where the whole screen fits
       enter     it continues to the glass and through it, drifting toward the portrait
     Scrolling back to zero returns to the visitor's angle and hands the controls back. */
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(VIEW.target);
  controls.enablePan = false;
  controls.enableDamping = !reduceMotion;
  controls.dampingFactor = 0.08;
  controls.zoomSpeed = 0.6;
  controls.minAzimuthAngle = VIEW.azimuth - VIEW.azimuthRange;
  controls.maxAzimuthAngle = VIEW.azimuth + VIEW.azimuthRange;
  controls.minPolarAngle = VIEW.polarMin;
  controls.maxPolarAngle = VIEW.polarMax;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
  let fitDistance = 0;
  const frameShift = new THREE.Vector2();   // where the deck sits in the viewport, as a fraction (right of the text, or below it)
  const sph = new THREE.Spherical(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const home = { azimuth: VIEW.azimuth, polar: VIEW.polar, zoom: 1 };
  const rig = {
    home,
    get() {
      sph.setFromVector3(v1.copy(camera.position).sub(controls.target));
      return { azimuth: sph.theta, polar: sph.phi, zoom: fitDistance ? sph.radius / fitDistance : 1 };
    },
    set({ azimuth, polar, zoom }) {
      const now = rig.get();
      sph.set(
        clamp(zoom ?? now.zoom, VIEW.zoomIn, VIEW.zoomOut) * fitDistance,
        clamp(polar ?? now.polar, VIEW.polarMin, VIEW.polarMax),
        clamp(azimuth ?? now.azimuth, VIEW.azimuth - VIEW.azimuthRange, VIEW.azimuth + VIEW.azimuthRange),
      );
      camera.position.setFromSpherical(sph).add(controls.target);
      camera.lookAt(controls.target);
      requestRender();
    },
    reset() {
      if (owned) return;
      if (reduceMotion) { rig.set(home); return; }
      resetFrom = rig.get();
      resetStart = null;
      requestRender();
    },
  };
  let resetFrom = null, resetStart = null;

  const journey = { align: 0, approach: 0, enter: 0 };
  let owned = false, userPose = null;
  // the CRT glass in world space, measured from the mesh once the model has loaded
  const crt = { centre: new THREE.Vector3(), normal: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(), width: 5, height: 1.7, ready: false };

  function applyJourney() {
    const active = journey.align > 0.0005 || journey.approach > 0.0005 || journey.enter > 0.0005;
    if (active && !owned) { owned = true; userPose = rig.get(); controls.enabled = false; resetFrom = null; }
    if (!active && owned) {
      owned = false;
      controls.enabled = true;
      setViewShift(1);
      rig.set(userPose);
      uniforms.uScan.value = 0.12;
      uniforms.uGain.value = 1;
      screenGlow.intensity = 4.5;
      screenMat.envMapIntensity = 0.55;
    }
    if (!owned || !crt.ready) return;
    const a = journey.align, k = journey.approach, e = journey.enter;
    // 1. the visitor's angle, eased to the default view
    sph.set(lerp(userPose.zoom, 1, a) * fitDistance, lerp(userPose.polar, home.polar, a), lerp(userPose.azimuth, home.azimuth, a));
    v1.setFromSpherical(sph).add(VIEW.target);
    // 2. the pose in front of the glass, from the screen's real size, position and facing
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitW = (crt.width / 2) / (t * camera.aspect), fitH = (crt.height / 2) / t;
    const contain = Math.max(fitW, fitH) * 1.1, through = Math.min(fitW, fitH) * 0.5;
    const drift = v3.copy(crt.right).multiplyScalar(crt.width * 0.28 * e);   // toward the portrait while entering
    const look = v2.copy(crt.centre).add(drift);
    camera.position.copy(look).addScaledVector(crt.normal, lerp(contain, through, e));
    camera.position.lerpVectors(v1, camera.position, k);
    look.lerpVectors(VIEW.target, look, k);
    camera.lookAt(look);
    setViewShift(1 - k);
    uniforms.uScan.value = 0.12 + 0.26 * e;
    uniforms.uGain.value = 1 + 0.3 * k;
    screenGlow.intensity = 4.5 * (1 + 0.8 * k);
    screenMat.envMapIntensity = 0.55 * (1 - 0.75 * k);   // fewer room reflections up close, so the picture stays clear
  }

  let viewW = 1, viewH = 1;
  function setViewShift(amount) {
    camera.setViewOffset(viewW, viewH, -frameShift.x * viewW * amount, -frameShift.y * viewH * amount, viewW, viewH);
  }

  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    const zoom = fitDistance ? rig.get().zoom : null;
    viewW = width;
    viewH = height;
    renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.5 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // The deck sits to the right of the text on wide screens and below it on narrow ones.
    const region = small() ? { w: 0.94, h: 0.42, x: 0, y: 0.22 } : { w: 0.5, h: 0.76, x: 0.21, y: 0.02 };
    frameShift.set(region.x, region.y);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    fitDistance = Math.max(5.6 / (t * region.h), 7 / (t * camera.aspect * region.w));
    controls.minDistance = fitDistance * VIEW.zoomIn;
    controls.maxDistance = fitDistance * VIEW.zoomOut;
    controls.rotateSpeed = 0.7 * clamp(height * region.h / 620, 0.4, 1);
    setViewShift(1);
    if (!owned) rig.set(zoom === null ? home : { zoom });
    requestRender();
  }
  new ResizeObserver(resize).observe(stage);

  // Scrolling over the model scrolls the page. Zoom is pinch, or Ctrl/⌘ + scroll.
  canvas.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation(); }, { capture: true });
  canvas.addEventListener('dblclick', () => rig.reset());
  // Touch turns the deck sideways only: tilt is held while fingers are down, so the start of a page scroll can't nudge it.
  const touches = new Set();
  let tiltRelease = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    clearTimeout(tiltRelease);
    if (!touches.size) controls.minPolarAngle = controls.maxPolarAngle = rig.get().polar;
    touches.add(e.pointerId);
  });
  for (const type of ['pointerup', 'pointercancel']) {
    canvas.addEventListener(type, (e) => {
      if (!touches.delete(e.pointerId) || touches.size) return;
      tiltRelease = setTimeout(() => { controls.minPolarAngle = VIEW.polarMin; controls.maxPolarAngle = VIEW.polarMax; }, 900);
    });
  }
  controls.addEventListener('start', () => { resetFrom = null; });
  controls.addEventListener('change', requestRender);
  stage.addEventListener('keydown', (e) => {
    if (owned) return;
    const v = rig.get(), step = 0.14;
    const moves = {
      ArrowLeft: { azimuth: v.azimuth - step }, ArrowRight: { azimuth: v.azimuth + step },
      ArrowUp: { polar: v.polar - step * 0.6 }, ArrowDown: { polar: v.polar + step * 0.6 },
      '+': { zoom: v.zoom - 0.08 }, '=': { zoom: v.zoom - 0.08 }, '-': { zoom: v.zoom + 0.08 },
    };
    if (e.key === 'Home' || e.key === '0') rig.reset();
    else if (moves[e.key]) { resetFrom = null; rig.set(moves[e.key]); }
    else return;
    e.preventDefault();
  });

  /* ── Model ── */
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(MODEL_URL, (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model, true);
    const size = box.getSize(new THREE.Vector3());
    const s = 10 / Math.max(size.x, size.y, size.z);
    model.scale.setScalar(s);
    model.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-s));
    norm.add(model);
    scene.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name !== 'crt_screen') { o.castShadow = o.receiveShadow = true; return; }
      o.material.dispose();
      o.material = screenMat;
      // measure the glass: centre, facing, and its width and height along its own axes
      const pos = o.geometry.attributes.position, nor = o.geometry.attributes.normal;
      const pts = [], n = new THREE.Vector3(), p = new THREE.Vector3();
      const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
        n.add(p.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize());
      }
      crt.normal.copy(n).normalize();
      crt.right.crossVectors(new THREE.Vector3(0, 1, 0), crt.normal).normalize();
      const up = new THREE.Vector3().crossVectors(crt.normal, crt.right);
      const b = new THREE.Box3().setFromPoints(pts);
      b.getCenter(crt.centre);
      let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity;
      for (const q of pts) {
        const r = q.dot(crt.right), u = q.dot(up);
        r0 = Math.min(r0, r); r1 = Math.max(r1, r); u0 = Math.min(u0, u); u1 = Math.max(u1, u);
      }
      crt.width = r1 - r0;
      crt.height = u1 - u0;
      crt.ready = true;
      uniforms.uScreenAspect.value = crt.width / crt.height;
      const c = norm.worldToLocal(crt.centre.clone());
      screenGlow.position.copy(c).add(new THREE.Vector3(0.7, -0.3, 0));
      screenGlow.target.position.copy(c).add(new THREE.Vector3(2.6, -2.6, 0));
    });
    renderer.shadowMap.needsUpdate = true;
    stage.classList.add('ready');
    bootStart = null;
    requestRender();
    resolveReady(api);
  }, undefined, (err) => {
    note.textContent = 'The 3D model could not load.';
    console.error(err);
  });

  /* ── Render loop: only while the hero is on screen and the tab is visible ── */
  let visible = true, running = false, raf = 0;
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; requestRender(); });
  io.observe(stage);
  const onVisibility = () => requestRender();
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stage.classList.remove('ready'); note.textContent = 'Restoring the 3D view…'; });
  canvas.addEventListener('webglcontextrestored', () => { renderer.shadowMap.needsUpdate = true; stage.classList.add('ready'); requestRender(); });

  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    if (!reduceMotion) raf = requestAnimationFrame(frame);
    if (resetFrom && !owned) {   // ease back to the default view (double-click or Home)
      if (resetStart === null) resetStart = now;
      const p = Math.min(1, (now - resetStart) / 450), e = 1 - Math.pow(1 - p, 3);
      const from = resetFrom;
      if (p >= 1) resetFrom = null;
      rig.set({ azimuth: lerp(from.azimuth, home.azimuth, e), polar: lerp(from.polar, home.polar, e), zoom: lerp(from.zoom, 1, e) });
    }
    applyJourney();
    if (controls.enabled) controls.update();
    drawUi(now);
    // portrait disturbance: stable for about 1.8 s, a 160 ms slip, then a quick redraw sweep
    if (!reduceMotion) {
      const t = (now / 1000) % 2;
      uniforms.uTime.value = now / 1000;
      uniforms.uGlitch.value = t > 1.82 && t < 1.98 ? Math.sin(Math.PI * (t - 1.82) / 0.16) : 0;
      uniforms.uRecon.value = t < 0.32 ? t / 0.28 : 2;
    }
    renderer.render(scene, camera);
  }
  function requestRender() {
    if (running || !visible || document.hidden) return;
    if (reduceMotion) { running = true; frame(performance.now()); running = false; return; }
    running = true;
    raf = requestAnimationFrame(frame);
  }
  document.fonts.ready.then(requestRender);
  resize();

  const api = {
    ready, rig, controls, camera, scene, renderer, journey, crt, uniforms, screenMat, requestRender,
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      controls.dispose();
      scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        for (const m of [].concat(o.material)) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); }
      });
      scene.environment.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
  return api;
}
