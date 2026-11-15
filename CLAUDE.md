# Sheetal Mannan — personal portfolio

Personal portfolio for Sheetal Mannan (Computer Engineering, University of Guelph 2026, Toronto). It's being redesigned as a **"digital engineering workstation"**: a 3D retro cyberdeck hero, a clean editorial grid layout, and circuit traces that connect the sections. The audience is engineering recruiters and hiring managers.

## Migration status (read first)

The redesign is moving to **Next.js**. As of 2026-11-13 **the Next.js app has not been scaffolded yet**: there is no `package.json`, and everything in the repo is still plain HTML/CSS/JS.

- **Legacy, kept until replaced:** `index.html`, `styles.css`, `script.js` (the scrapbook site) and the prototypes in `design/`. Run these with `python3 -m http.server 8000` from the repo root.
- **Decision on 2026-11-14:** the user chose to build the full site in plain HTML + Three.js + GSAP (CDN) in `site/`, not Next.js. Treat the Next.js / React Three Fiber rules below as applying only if they later ask to migrate; the same principles (refs not state, dispose, dpr cap, cleanup of ScrollTriggers) are followed in the vanilla code.
- **Before scaffolding or installing anything** (`create-next-app`, npm packages, Playwright), confirm with the user first.
- **The cyberdeck prototype** (`design/cyberdeck.html`, vanilla Three.js) is the reference to port into React Three Fiber. Keep its geometry, materials, screen canvas and motion rules.
- **Node:** v20.20.2 via nvm.

## Tech Stack
- **Framework:** Next.js (App Router) / React + TypeScript
- **Styling:** Tailwind CSS
- **3D Engine:** Three.js + React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
- **Choreography & Scroll:** GSAP + ScrollTrigger (`@gsap/react`)
- **2D UI Motion:** CSS Transitions / Motion (governed by Emil Kowalski's design engineering rules)

Don't add dependencies beyond this stack without asking.

## Layout

| Path | What it is |
|---|---|
| `site/` | **The new site (plain HTML + Three.js + GSAP from CDN, no build).** `index.html` (all content as real HTML), `css/site.css` (design tokens for the light and dark themes, then components), `js/deck.js` (3D deck, CRT portrait shader, camera rig), `js/main.js` (theme, nav, scroll journey timeline, PCB trace), `js/holo.js` (Say, hi hologram), `js/board.js` (Skills: code-built circuit board, one part per skill area, with SVG leader lines from each HTML label to its part; badges only on phones), `img/portrait.png` (the one replaceable portrait image; currently a code-drawn placeholder). View at `http://localhost:8000/site/`. |
| `index.html`, `styles.css`, `script.js` | Legacy live site (scrapbook design) |
| `PROJECTS.md` | Source text for the eight projects |
| `assets/` | Avatar, grad photo and hand-drawn doodles (doodles likely retired) |
| `source-assets/cyberdeck.glb` | Sketchfab cyberdeck model, original 43 MB download. **Never edit it.** Kept out of `public/` so it never ships (CC BY 4.0, credit required; see `CREDITS.md`) |
| `source-assets/build_cyberdeck.py` | Builds `source-assets/cyberdeck-sm01.glb` from the original: repaints the "Netlight" lettering as "SM-01" in the base-colour and roughness/metal textures, splits the CRT glass into its own mesh, renames the nodes. Run with `python3 -I` (needs numpy + Pillow). |
| `public/models/cyberdeck-web.glb` | Compressed 2.4 MB copy that pages load, made from `cyberdeck-sm01.glb` |
| `design/model-preview.html` | Orbit viewer for the GLB with the credit line. `?debug` colours each part. |
| `CREDITS.md` | Third-party asset credits and the credit line the site must show |
| `reference/design-mockup.html` | Original mockup (design-tool format, doesn't run). Holds two retired project descriptions. |
| `design/AUDIT.md` | Phase 1 audit: content inventory, content gaps, technical plan |
| `design/directions.html` | Phase 2 board comparing the palette directions |
| `design/cyberdeck.html` | First 3D cyberdeck prototype, built in code (vanilla Three.js). `?theme=a` or `?theme=c` picks the palette. |
| `design/cyberdeck-glb.html` | **Current hero prototype (Stage 1 done)**: the GLB with drag rotation (OrbitControls with limits, damping, keyboard and touch), a teal animated screen on the model's own `crt_screen` mesh, real shadows and the credit caption. Light design only. `window.__deck.rig` is the camera hook for later scroll choreography. |
| `.agents/skills/` | Installed skills: design-taste-frontend, emil-design-eng, gsap-scrolltrigger, react-three-fiber |

## Redesign status

Work happens in phases on the **`redesign` branch**. Keep `main` intact. Commit only when asked.

1. Audit — done
2. Visual directions — done. **A · Phosphor & Putty (light: warm ivory, subtle grid, graphite type) is the approved design.** C · Graphite & Signal is parked; don't build dark mode unless asked.
3. Homepage prototype — done (`design/` holds the earlier prototypes; don't extend them).
4. Remaining sections — built in `site/` on 2026-11-14: Experience, Projects, Skills, Say, hi, both themes, scroll journey into the CRT, PCB trace, hologram.
5. Interactions — built with the above. Still open: the final portrait image (no image-generation tool was available, so `site/img/portrait.png` is a placeholder the user will replace), résumé PDF and GitHub URL (links are left out until provided; marked with HTML comments in `site/index.html`), and deeper project documentation (no `project.md` folder exists; Projects uses only `PROJECTS.md`).
6. Optimisation and testing

## Content rules

- **Keep the original site text** until the new design is finalised. New content comes later.
- **Never invent** experience, skills, project details, results or numbers. Known gaps: the AgroSphere rover (no content yet), case-study detail, résumé PDF, GitHub URL. Ask for these; don't fill them in.
- The email on the current site, `ceng.sheetal.chd@gmail.com`, is unconfirmed.

## How the site works (read before changing `site/`)

- **Themes:** `data-theme` on `<html>`, set before paint by the inline script in `index.html` (saved choice, else the system preference). All colours are tokens at the top of `css/site.css`. The deck and CRT look the same in both themes; only the surroundings change.
- **Scroll journey:** one scrubbed GSAP timeline pins `#hero` (1.5 screens on desktop, 1 on phones) and writes only `deck.journey.{align, approach, enter}` plus the veil's CSS variables. `deck.js` turns those into a camera pose computed from the real `crt_screen` mesh (centre, normal, width, height). While any of the three is above zero the timeline owns the camera and OrbitControls is disabled; at zero the visitor's own angle is restored and controls come back.
- **`.inside` sits directly behind the pinned hero** (`html.journey .inside` has a negative top margin), so the veil dissolves onto Experience. Because of this, links to the top use `#top` with **no element of that id** (the browser then scrolls to the page top), and `#experience` has a negative `scroll-margin-top`. Don't add `id="top"`.
- **PCB trace:** `main.js` builds the SVG from the real positions of `[data-node]` elements and the chip on every resize. Add a node by adding `data-node="section"` or `data-node="entry"` to an element.
- **Reduced motion:** no pin, no scrub, no glitch; the trace is drawn fully lit and the deck is a still frame.
- **Portrait:** both the CRT and the hologram read `site/img/portrait.png` and stylise it in shaders. Replacing that file is all that is needed. It must be a synthetic image, never presented as a photo of the user.

## Design rules

- Content stays real HTML/React DOM. The 3D deck introduces the site; it doesn't contain it.
- Colours are theme tokens (CSS custom properties exposed to Tailwind), so a palette can be swapped in one place.
- Type roles: display face for the name and section titles; a readable sans for paragraphs; mono for labels, tags and indices (12px, 0.14em, uppercase); a pixel font only on the CRT and hologram.
- 12-column grid, 1200px max width, 48px background grid with a crosshair dot every 4 cells.
- Motion has a purpose. No forced snapping or fade-in on every block. Any scroll pinning must stay short, and every section must stay reachable from the nav.
- Avoid the generic dark neon dashboard look.

---

# Project Rules & Skill Coordination

## Skill Boundaries & Separation of Duties

### 1. 3D Canvas & WebGL (`react-three-fiber`)
- **Scope:** Everything inside `<Canvas>` (meshes, materials, shaders, lighting, post-processing, camera rigs).
- **Performance Guardrails:**
  - Always dispose of geometries, materials, and textures on unmount.
  - Never trigger React state updates (`useState`) inside `useFrame`. Mutate refs directly.
  - Use `dpr={[1, 2]}` on `<Canvas>` to prevent mobile GPU bottlenecks.
  - Keep `<Canvas>` fixed in the background (`fixed inset-0 -z-10`) or isolated in dedicated viewport containers so DOM scrolling remains smooth.

### 2. Camera Choreography & Scroll Timelines (`gsap-react`)
- **Scope:** Scroll-pinned sections, scroll-scrubbed 3D camera movements, object reveals, and multi-step scene timelines.
- **Implementation Rules:**
  - Always wrap GSAP animations inside `useGSAP()` from `@gsap/react` for automatic cleanup.
  - Drive 3D object transforms in ScrollTrigger by mutating shared refs or a lightweight store (e.g., Zustand) rather than forcing React re-renders.
  - Do **not** use GSAP for small 2D UI hover states or button clicks.

### 3. Page Architecture & Visual Taste (`design-taste-frontend`)
- **Scope:** Overall layout hierarchy, typography scale, color palette, spacing, and visual restraint.
- **Anti-Slop Guardrails:**
  - Avoid generic AI gradients, glowing purple/blue SaaS cards, and symmetrical 3-column bento grids unless explicitly requested.
  - Ensure all 2D text overlays sitting atop the 3D canvas maintain high contrast (WCAG AA minimum) using subtle scrims, backdrop blurs, or strategic negative space in the 3D framing.

### 4. 2D UI Micro-Interactions (`emil-design-eng`)
- **Scope:** All interactive HTML/React overlay elements (buttons, nav links, modals, drawers, tooltips, toggles).
- **Motion Rules:**
  - Keep UI feedback snappy (under 300ms) with custom `cubic-bezier` curves or crisp spring physics—never sluggish linear eases.
  - Include subtle tactile active states (e.g., `active:scale-[0.97]`) on interactive buttons.
  - Make popovers, dropdowns, and modals origin-aware (`transform-origin` matching the trigger).
  - Animate only GPU-composited properties (`transform`, `opacity`, `clip-path`).

### 5. Live Browser Verification (`playwright-cli`)
- **Scope:** Visual verification, WebGL health checks, and responsive testing.
- **Workflow:**
  - After building or modifying a 3D scene or scroll interaction, use `playwright-cli` to launch the local dev server in a headless browser.
  - Verify there are **zero** console errors, React hydration warnings, or WebGL context loss messages.
  - Test scroll progression and interactive overlay buttons across both desktop (`1440x900`) and mobile (`390x844`) viewports.
- **Status:** `playwright-cli` 0.1.24 is installed globally under Node v20.20.2 (`npm i -g @playwright/cli`; run `source ~/.nvm/nvm.sh && nvm use 20.20.2` first). Run it from the session scratchpad so its `.playwright-cli/` output stays out of the repo. For mobile and touch tests use `run-code` with `browser.newContext({ viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true })` and CDP `Input.dispatchTouchEvent`. The headless Chrome fallback below is only a backup.

---

## Accessibility and performance (required)

- Alt text on images, visible `:focus-visible` styles, 44px minimum tap targets, keyboard-reachable controls, a skip link.
- Honour `prefers-reduced-motion` everywhere, including the 3D scene and GSAP timelines: keep the scene still and show the screen fully typed.
- 3D: the agreed model is the Sketchfab cyberdeck ("Cyberdeck" by 7chaner, Sketchfab, **CC BY 4.0**). Any page that renders it must show the credit line from `CREDITS.md`, and that file must be updated whenever the model is modified. Pages load the compressed `public/models/cyberdeck-web.glb` (2.4 MB: 2K WebP textures + Meshopt, so the loader needs `MeshoptDecoder`), never the 43 MB files. To rebuild it: `python3 -I source-assets/build_cyberdeck.py`, then `npx @gltf-transform/cli@4.1.1 optimize source-assets/cyberdeck-sm01.glb public/models/cyberdeck-web.glb --compress meshopt --texture-compress webp --texture-size 2048 --simplify false --join false --prune-attributes false` (the last flag keeps the screen's UVs). Meshes: `comp_low` (monitor), `key_low` (keyboard deck with the SM-01 lettering), `scope_low` (scope and the small left display), `pipes_low`, `pipes2_low`, `cool_low`, all on the one material `deck_body` (one shared 4-texture atlas, so recolouring a part means editing textures); and `crt_screen` (the main CRT glass, material `crt_screen`, own 0-1 UVs with v running top to bottom, aspect 2.89:1). Screen content goes on `crt_screen` only: a canvas or image as its emissive map, or a custom shader. The screen phosphor is teal `#5dffc1`, sampled from the left display; don't change the left display. The file uses very large units, so normalise its scale on load (see `design/model-preview.html`). Other 3D parts stay built in code. Pause rendering when off screen or when the tab is hidden, provide a fallback when WebGL isn't available, and never block startup on web fonts.
- Responsive down to 320px with no sideways scroll.

## Headless Chrome fallback (backup to playwright-cli)

Add `--enable-unsafe-swiftshader --use-angle=swiftshader` for WebGL pages, and `--enable-logging=stderr` to read console errors.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --enable-unsafe-swiftshader --use-angle=swiftshader --virtual-time-budget=12000 \
  --window-size=1440,900 --screenshot=out.png "http://localhost:8000/design/cyberdeck.html"
```

Headless Chrome won't lay out narrower than about 500px. For a 390px phone check, load the page in a 390px-wide `<iframe>` and crop the screenshot. Save screenshots to the session scratchpad, not the repo.
