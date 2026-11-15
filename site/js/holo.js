// The Say, hi hologram: the same portrait image as the CRT, projected above the processor.
// A single shader on one quad; it renders only while it is on screen.
import * as THREE from 'three';
import { PORTRAIT_URL } from './deck.js';

export function createHolo({ canvas, reduceMotion }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: false });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uPortrait: { value: null }, uAspect: { value: 1 }, uBox: { value: 0.82 },
    uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uReveal: { value: 0 }, uGlitch: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false,
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D uPortrait;
      uniform float uAspect, uBox, uTime, uReveal, uGlitch;
      uniform vec3 uColor;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float lum(vec2 uv) {
        vec2 q = uv - 0.5;
        if (uAspect > uBox) q.x *= uBox / uAspect; else q.y *= uAspect / uBox;
        return pow(dot(texture2D(uPortrait, q + 0.5).rgb, vec3(0.299, 0.587, 0.114)), 0.48);
      }
      void main() {
        vec2 uv = vUv;
        float band = floor(uv.y * 36.0), tick = floor(uTime * 26.0);
        uv.x += sin(uv.y * 34.0 + uTime * 1.6) * 0.002 + (hash(vec2(band, tick)) - 0.5) * 0.05 * uGlitch * step(0.55, hash(vec2(band * 1.7, tick)));
        float l = smoothstep(0.05, 0.95, lum(uv));
        float edge = clamp(length(vec2(lum(uv + vec2(0.003, 0.0)), lum(uv + vec2(0.0, 0.003))) - lum(uv)) * 11.0, 0.0, 1.0);
        float rows = fract(uv.y * 90.0 + l * 1.8);
        float wire = (1.0 - smoothstep(0.0, 0.2, abs(rows - 0.5))) * smoothstep(0.03, 0.2, l);
        float lines = 0.72 + 0.28 * sin(uv.y * 420.0 - uTime * 5.0);
        float sweep = 1.0 - smoothstep(0.0, 0.05, abs(fract(uv.y - uTime * 0.14) - 0.5));
        float a = (l * 0.85 + edge * 0.6 + wire * 0.22) * lines + sweep * 0.14 * (0.2 + l);
        // rises out of the processor: revealed from the bottom up, with a bright leading edge
        float top = uReveal * 1.15;
        float shown = 1.0 - smoothstep(top - 0.14, top, uv.y);
        float lead = (1.0 - smoothstep(0.0, 0.03, abs(uv.y - (top - 0.02)))) * step(0.01, uReveal) * step(uReveal, 0.99);
        float sides = smoothstep(0.0, 0.1, uv.x) * (1.0 - smoothstep(0.9, 1.0, uv.x)) * (1.0 - smoothstep(0.9, 1.0, uv.y));
        a = (a * shown + lead * 0.5) * sides * (0.93 + 0.07 * sin(uTime * 29.0));
        vec3 c = uColor * (0.75 + 0.55 * l);
        gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const texture = new THREE.TextureLoader().load(PORTRAIT_URL, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    uniforms.uPortrait.value = tex;
    uniforms.uAspect.value = tex.image.width / tex.image.height;
    request();
  });

  function readTheme() {
    const css = getComputedStyle(document.documentElement);
    uniforms.uColor.value.set(css.getPropertyValue('--holo').trim());
    request();
  }
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    uniforms.uBox.value = width / height;
    request();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  document.addEventListener('themechange', readTheme);

  let on = false, visible = false, running = false, raf = 0, last = 0;
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; request(); });
  io.observe(canvas);

  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const u = uniforms.uReveal, goal = on ? 1 : 0;
    u.value = reduceMotion ? goal : THREE.MathUtils.clamp(u.value + Math.sign(goal - u.value) * dt / 1.1, 0, 1);
    if (!reduceMotion) {
      const t = (now / 1000) % 2;
      uniforms.uTime.value = now / 1000;
      uniforms.uGlitch.value = t > 1.82 && t < 1.98 ? Math.sin(Math.PI * (t - 1.82) / 0.16) : 0;
    }
    renderer.render(scene, camera);
    // keep animating while it is showing; stop once fully hidden
    if (!reduceMotion && (on || u.value > 0)) raf = requestAnimationFrame(frame);
    else running = false;
  }
  function request() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  const onVisibility = () => request();
  document.addEventListener('visibilitychange', onVisibility);
  readTheme();
  resize();

  return {
    uniforms,
    setOn(value) { if (on !== value) { on = value; request(); } },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('themechange', readTheme);
      document.removeEventListener('visibilitychange', onVisibility);
      texture.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
