// Shared by the homepage and the project library: the theme toggle and the typewriter headings.

/* ── Theme: the system preference until the visitor chooses, then their choice ── */
export function initTheme({ reduceMotion }) {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  let timer = 0;
  function showTheme(theme, animate) {
    if (animate && !reduceMotion) {
      root.classList.add('theme-fade');
      clearTimeout(timer);
      timer = setTimeout(() => root.classList.remove('theme-fade'), 320);
    }
    root.dataset.theme = theme;
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    document.dispatchEvent(new Event('themechange'));
  }
  toggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch (e) {}
    showTheme(next, true);
  });
  systemDark.addEventListener('change', (e) => {
    let saved = null;
    try { saved = localStorage.getItem('theme'); } catch (err) {}
    if (!saved) showTheme(e.matches ? 'dark' : 'light', true);
  });
  showTheme(root.dataset.theme, false);
}

/* ── Typewriter headings ───────────────────────────────────────────────
   Each heading types itself once when it scrolls into view (and again when the visitor comes back to it),
   then keeps a blinking block cursor. The full text always occupies its space, so nothing shifts, and it
   is the heading's accessible name, so a screen reader hears one normal heading.
   startFor(heading) may return a ScrollTrigger start for headings that are covered when they enter. */
const CHAR_SECONDS = 0.075;
export function initTypewriter(headings, { gsap, ScrollTrigger, reduceMotion, startFor }) {
  const cleanups = [];
  for (const h of headings) {
    const text = h.textContent.trim();
    h.setAttribute('aria-label', text);
    const line = document.createElement('span');
    line.className = 'tw-line';
    line.setAttribute('aria-hidden', 'true');
    const on = document.createElement('span');
    const cur = document.createElement('span');
    cur.className = 'tw-cur';
    const off = document.createElement('span');
    off.className = 'tw-off';
    line.append(on, cur, off);
    h.replaceChildren(line);
    h.classList.add('tw');
    const show = (n) => { on.textContent = text.slice(0, n); off.textContent = text.slice(n); };
    show(text.length);
    if (reduceMotion || !gsap || !ScrollTrigger) continue;

    const state = { n: 0 };
    let tween = null;
    const type = () => {
      if (tween) tween.kill();
      state.n = 0;
      show(0);
      h.classList.add('typing');
      tween = gsap.to(state, {
        n: text.length, duration: text.length * CHAR_SECONDS, delay: 0.12, ease: `steps(${text.length})`,
        onUpdate: () => show(Math.round(state.n)),
        onComplete: () => { show(text.length); h.classList.remove('typing'); },
      });
    };
    const st = ScrollTrigger.create({
      trigger: h, refreshPriority: -1,
      start: () => (startFor && startFor(h)) || 'top 86%',
      end: 'bottom top',
      onEnter: type, onEnterBack: type,
    });
    cleanups.push(() => { st.kill(); if (tween) tween.kill(); show(text.length); h.classList.remove('typing'); });
  }
  return () => cleanups.forEach((fn) => fn());
}
