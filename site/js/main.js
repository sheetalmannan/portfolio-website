// Page behaviour: theme, navigation, the scroll journey into the CRT, and the PCB trace that links the sections.
// GSAP and ScrollTrigger are loaded as globals from the CDN (see index.html).
import { createDeck } from './deck.js';
import { createHolo } from './holo.js';
import { createBoard } from './board.js';
import { initTheme, initTypewriter } from './ui.js';

const root = document.documentElement;
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reduceMotion = motionQuery.matches;
const { gsap, ScrollTrigger } = window;
if (gsap) gsap.registerPlugin(ScrollTrigger);
if (!reduceMotion && gsap) root.classList.add('motion');

initTheme({ reduceMotion });

/* ── Navigation ── */
const nav = document.getElementById('nav');
const links = document.getElementById('nav-links');
const menuBtn = document.getElementById('menu-btn');
function setMenu(open) {
  links.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && links.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });
document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setMenu(false); });
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });

const navLinks = [...links.querySelectorAll('a[href^="#"]')];
const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href') === '#top' ? '#hero' : a.getAttribute('href'))).filter(Boolean);
const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    for (const a of navLinks) a.toggleAttribute('aria-current', false);
    const current = navLinks.find((a) => a.getAttribute('href') === '#' + (entry.target.dataset.spy || entry.target.id));
    if (current) current.setAttribute('aria-current', 'true');
  }
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => spy.observe(s));

/* ── 3D deck and hologram ── */
const deck = createDeck({
  stage: document.getElementById('stage'), canvas: document.getElementById('deck'),
  note: document.getElementById('note'), reduceMotion,
});
const projector = document.getElementById('projector');
const holo = createHolo({ canvas: document.getElementById('holo'), reduceMotion });
const boardFig = document.getElementById('board-fig');
const board = createBoard({
  fig: boardFig, stage: document.getElementById('board-stage'), canvas: document.getElementById('board'),
  svg: document.getElementById('leaders'), labels: [...boardFig.querySelectorAll('[data-part]')], reduceMotion,
});
window.__site = { deck, holo, board };

/* ── Skills reveal: once, when the board scrolls in. Badges land on the parts, the leader lines draw out
   one after another, then all five skill cards appear together. Cards stay focusable throughout. ── */
if (board && gsap && !reduceMotion) {
  const cards = boardFig.querySelectorAll('.domain');
  const badges = boardFig.querySelectorAll('.leaders .badge');
  gsap.set(cards, { opacity: 0, y: 14 });
  gsap.set(badges, { opacity: 0 });
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    const paths = boardFig.querySelectorAll('.leaders path');
    gsap.timeline({ onComplete: () => { boardFig.classList.add('lit'); gsap.set(paths, { clearProps: 'strokeDashoffset' }); } })
      .fromTo(badges, { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.07, ease: 'power1.out' }, 0)
      .fromTo(boardFig.querySelectorAll('.leaders .badge circle'), { attr: { r: 0 } }, { attr: { r: 11 }, duration: 0.4, stagger: 0.07, ease: 'back.out(2.2)' }, 0)
      .fromTo(paths, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, stagger: 0.12, ease: 'power2.inOut' }, 0.25)
      .to(cards, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, '-=0.15');
  };
  ScrollTrigger.create({ trigger: boardFig, start: 'top 72%', end: 'bottom top', onEnter: reveal, onEnterBack: reveal, onLeave: reveal });
  boardFig.addEventListener('focusin', reveal);
} else if (boardFig) {
  boardFig.classList.add('lit');
}

/* ── The journey into the screen ───────────────────────────────────────
   One scrubbed timeline while the hero is pinned. It only writes deck.journey (align → approach → enter)
   and the veil's CSS variables; the deck decides what the camera does with those numbers. */
const mm = gsap ? gsap.matchMedia() : null;
if (mm && deck) {
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', wide: '(min-width: 901px)' }, (ctx) => {
    if (!ctx.conditions.motion) return;
    root.classList.add('journey');
    const j = deck.journey;
    const veil = document.getElementById('veil');
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '#hero', start: 'top top',
        // a short pin: about one and a half screens on desktop, one on a phone
        end: () => '+=' + Math.round(innerHeight * (ctx.conditions.wide ? 1.5 : 1)),
        pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: deck.requestRender,
      },
    });
    tl.addLabel('align', 0)
      .to(j, { align: 1, duration: 0.14, ease: 'power1.out' }, 'align')
      .to('#hero-copy, #hero-foot', { autoAlpha: 0, y: -20, duration: 0.14, ease: 'power1.in' }, 0.02)
      .addLabel('approach', 0.08)
      .to(j, { approach: 1, duration: 0.6, ease: 'power2.inOut' }, 'approach')
      .addLabel('enter', 0.68)
      .to(j, { enter: 1, duration: 0.32, ease: 'power1.in' }, 'enter')
      .to(veil, { '--veil-scan': 1, duration: 0.1 }, 0.76)
      .to(veil, { '--veil': 1, duration: 0.1, ease: 'power1.in' }, 0.8)
      .to(veil, { '--veil-line': 1, '--veil-line-w': 1, duration: 0.05, ease: 'power2.out' }, 0.88)
      .to(veil, { '--veil-mix': 1, duration: 0.09, ease: 'power1.inOut' }, 0.91)
      .to(veil, { '--veil-line': 0, '--veil-scan': 0, duration: 0.05 }, 0.93)
      // the inside of the machine is already in place behind the hero: dissolve onto it
      .to('#hero', { autoAlpha: 0, duration: 0.05 }, 0.95);
    return () => { root.classList.remove('journey'); j.align = j.approach = j.enter = 0; deck.requestRender(); };
  });
  deck.ready.then(() => ScrollTrigger.refresh());
}

/* ── Typewriter section headings ── */
initTypewriter(document.querySelectorAll('.section-head h2'), {
  gsap, ScrollTrigger, reduceMotion,
  // Experience sits behind the pinned hero until the veil dissolves: type it at that moment, not before
  startFor: (h) => {
    if (h.id !== 'h-experience' || !root.classList.contains('journey')) return null;
    const pin = ScrollTrigger.getAll().find((t) => t.pin && t.pin.id === 'hero');
    return pin ? Math.round(pin.start + (pin.end - pin.start) * 0.93) : null;
  },
});

/* ── PCB trace ─────────────────────────────────────────────────────────
   One main trace comes out of the screen, runs down the left rail and ends in the processor's pins.
   Each section head and each job has a stub and a pad. A pulse rides the trace as the page scrolls;
   pads light when it reaches them. Rebuilt from the real layout on every resize. */
const inside = document.getElementById('inside');
const svg = document.getElementById('circuit');
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
let circuit = null;

function buildCircuit() {
  const box = inside.getBoundingClientRect();
  const W = box.width, H = box.height;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const rel = (r) => ({ left: r.left - box.left, top: r.top - box.top, right: r.right - box.left, bottom: r.bottom - box.top });
  const nodes = [...inside.querySelectorAll('[data-node]')];
  const first = rel(nodes[0].getBoundingClientRect());
  const railGap = W > 900 ? 40 : 18;
  const x = Math.round(first.left - railGap) + 0.5;   // the rail
  const chip = rel(document.getElementById('chip').getBoundingClientRect());
  const cx = (chip.left + chip.right) / 2, pinY = chip.bottom - (chip.bottom - chip.top) * 0.07;
  const pitch = (chip.right - chip.left) * (20 / 220);   // pin spacing in the chip drawing
  const runY = Math.min(H - 14, chip.bottom + 30);       // the bottom run, below the contact links

  // main: out of the screen at top centre, across to the rail, down, along the bottom, up into a pin
  const c = 14;   // 45° corner size
  const mid = W / 2;
  const d = [
    `M${mid} 0`, `V30`, `L${mid - c} ${30 + c}`, `H${x + c}`, `L${x} ${30 + 2 * c}`,
    `V${runY - c}`, `L${x + c} ${runY}`, `H${cx - pitch - c}`, `L${cx - pitch} ${runY - c}`, `V${pinY}`,
  ].join(' ');
  const base = el('path', { class: 'base', d });
  const live = el('path', { class: 'live', d, pathLength: 1 });
  svg.append(base, live);
  const L = base.getTotalLength();
  const railStart = 30 + 2 * c;
  // length of the lead-in before the rail starts
  const lead = el('path', { d: [`M${mid} 0`, `V30`, `L${mid - c} ${30 + c}`, `H${x + c}`, `L${x} ${railStart}`].join(' ') });
  svg.append(lead);
  const lengthToRail = lead.getTotalLength();
  lead.remove();
  const lenAtRail = (y) => lengthToRail + (y - railStart);

  // stubs and pads
  const items = nodes.map((node) => {
    const r = rel(node.getBoundingClientRect());
    const y = Math.round(r.top + (node.dataset.node === 'entry' ? 36 : 9)) + 0.5;
    const end = r.left - (node.dataset.node === 'entry' ? 0 : 12);
    const sd = `M${x} ${y} H${end}`;
    const stub = el('path', { class: 'stub live', d: sd, pathLength: 1 });
    const pad = el('circle', { class: 'pad', cx: x, cy: y, r: node.dataset.node === 'entry' ? 3.5 : 4.5 });
    svg.append(el('path', { class: 'base', d: sd }), stub, pad);
    return { node, stub, pad, at: lenAtRail(y) };
  });
  // two more traces branch off the bottom run and join the processor: three signals converge
  const tails = [0, 1].map((i) => {
    const px = cx + pitch * i;
    const td = `M${cx - pitch - c} ${runY} H${px - c} L${px} ${runY - c} V${pinY}`;
    const tail = el('path', { class: 'stub live', d: td, pathLength: 1 });
    svg.append(el('path', { class: 'base', d: td }), tail);
    return tail;
  });
  const halo = el('circle', { class: 'pulse-halo', r: 9 });
  const pulse = el('circle', { class: 'pulse', r: 3 });
  svg.append(halo, pulse);
  circuit = { base, live, L, items, tails, pulse, halo, railX: x, railStart, lengthToRail, top: box.top + scrollY, H };
  drawCircuit(state.p);
}

const state = { p: 0 };
function drawCircuit(p) {
  if (!circuit) return;
  const { base, live, L, items, tails, pulse, halo } = circuit;
  live.style.strokeDashoffset = 1 - p;
  const pt = base.getPointAtLength(p * L);
  const moving = p > 0.001 && p < 0.999;
  for (const dot of [pulse, halo]) {
    dot.setAttribute('cx', pt.x);
    dot.setAttribute('cy', pt.y);
    dot.style.opacity = moving ? 1 : 0;
  }
  for (const item of items) {
    const on = p * L >= item.at;
    item.stub.classList.toggle('on', on);
    item.pad.classList.toggle('on', on);
    item.node.classList.toggle('on', on);
  }
  const done = p >= 0.995;
  tails.forEach((t) => t.classList.toggle('on', done));
  projector.classList.toggle('on', done);
  if (holo) holo.setOn(done);
}

// where the pulse should be for the current scroll position: level with 58% of the viewport,
// and guaranteed to reach the processor by the time the page reaches its end
function targetProgress() {
  if (!circuit) return 0;
  const { L, lengthToRail, railStart, top } = circuit;
  const headY = scrollY + innerHeight * 0.58 - top;
  let p = Math.max(0, Math.min(1, (lengthToRail + (headY - railStart)) / L));
  if (headY < 0) p = 0;
  const remaining = document.documentElement.scrollHeight - innerHeight - scrollY;
  const finish = 1 - Math.max(0, Math.min(1, remaining / (innerHeight * 0.45)));
  return p + (1 - p) * finish;
}

if (reduceMotion || !gsap) {
  // conventional page: the whole trace is simply drawn and lit
  state.p = 1;
  new ResizeObserver(buildCircuit).observe(inside);
} else {
  const follow = gsap.quickTo(state, 'p', { duration: 0.35, ease: 'power2.out', onUpdate: () => drawCircuit(state.p) });
  const trigger = ScrollTrigger.create({ trigger: inside, start: 'top bottom', end: 'max', onUpdate: () => follow(targetProgress()) });
  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { buildCircuit(); ScrollTrigger.refresh(); follow(targetProgress()); }, 120);
  }).observe(inside);
  document.fonts.ready.then(() => { buildCircuit(); trigger.refresh(); });
}
buildCircuit();
