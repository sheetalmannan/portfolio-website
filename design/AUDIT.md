# Phase 1 — Codebase & content audit

Branch: `redesign` (same commit as `main`, so `main` is untouched). The only uncommitted items are the untracked `.agents/` skills folder and `skills-lock.json`.

## 1. Architecture

| Item | Current state | Keep for the redesign? |
|---|---|---|
| Stack | Plain static site: `index.html`, `styles.css`, `script.js`. No build step, no package.json, no dependencies. | **Yes.** Three.js can load as an ES module from a CDN with an import map, so the site needs no bundler. |
| Fonts | Google Fonts: Young Serif, Gochi Hand, DM Sans | No. The hand-drawn scrapbook fonts don't fit the workstation concept. |
| JS | ~200 lines, four small modules: typing headings, project strip arrows, Parts-bin chip filter, scroll reveal | The **chip → project highlight** idea is worth keeping (it becomes the Skills section's interaction). The rest gets rewritten. |
| CSS | ~630 lines, hard-coded colours with a few `:root` tokens | Rewrite on a full token system so the chosen palette can be applied in one place. |
| Accessibility already in place | Skip link, `:focus-visible` rings, 44px targets, `aria-pressed` chips, `aria-live` results, reduced-motion handling, screen-reader text for typed headings | Carry all of it over. |
| Performance | ~950 KB of images. The four doodle PNGs are 250 KB each. Margin doodles are positioned with absolute pixel values, so they're fragile. | Doodles are likely retired. Any image kept gets converted to WebP/AVIF. |

**Installed skills (`.agents/skills`)**: `design-taste-frontend`, `emil-design-eng`, `gsap-scrolltrigger`, `react-three-fiber`. The two you named (UI/UX Pro Max, Frontend Design) are not installed.
- I used *design-taste-frontend* and *emil-design-eng* for principles: contrast, one system, motion only with a purpose, no scroll-jacking.
- I did **not** run design-taste's build pipeline. It deals random palettes and layouts for company websites and bans tilt and carousels, which conflicts with this brief.
- *react-three-fiber* doesn't apply (no React).
- *gsap-scrolltrigger* stays optional for Phase 5.

## 2. Content inventory (everything written so far)

**Identity**
- Sheetal Mannan · Computer Engineer · Toronto
- Tagline: "computer engineer · software, AI & hardware · Toronto"
- Intro: "I'm a Computer Engineering grad from the University of Guelph (2026). I like building things that sit between code and circuits — AI/ML tools, applications, and the hardware they run on. I'm looking for new-grad roles in software, AI, and hardware engineering."
- Contact: LinkedIn `linkedin.com/in/sheetal-mannan-6363371bb`, email `ceng.sheetal.chd@gmail.com` (**unconfirmed**), GitHub (**missing**), résumé PDF (**missing**)

**Education**
- B.Eng. Computer Engineering, University of Guelph, 2026. That's all that exists.

**Experience**
1. AI/ML Software Developer — Seasia Infotech (MoogleLabs), Jun – Dec 2024. FastAPI endpoints; ML data pre-processing (+15% training accuracy); real-time face-filter detection app. Tags: Python, FastAPI, Machine learning.
2. IT Analyst Intern — Toronto Transit Commission, May – Dec 2023. Service Desk internal website; SLA incident tracking; Active Directory accounts. Tags: Web development, Active Directory, SLA tracking.

**Projects** (from `PROJECTS.md` plus two that were in the original mockup)

| # | Project | Facts on record | Brief priority |
|---|---|---|---|
| 1 | Self-Stabilizing Utensil (Parkinson's) | Python signal processing, I2C sensors, closed-loop PID, custom PCB with EMC compliance. *Mockup version adds:* Raspberry Pi Pico, isolates 4–8 Hz tremor, dual-axis servos, up to 86% amplitude reduction. | **Lead case study** |
| 2 | DNN Accelerator on FPGA | Verilog, MNIST, 98% accuracy, SoC with AXI4-Lite + ARM | Chip/digital design |
| 3 | Mixed-Signal IC — Smart Watch ECG | 3:1 MUX, PGA, 6-bit SAR ADC, TSMC 65nm, Cadence Virtuoso | Chip design |
| 4 | Real-Time Home Security System | FreeRTOS, 3 tasks, PIR interrupts, ArduCam, semaphores/queues, <200 ms | Embedded |
| 5 | IR Target Detection Quadcopter | 940 nm IR, GPS coords, spiral waypoints in Python, RPi 4 + Cube Orange, 30%+ less position error | Robotics |
| 6 | Digital Waveform Synthesizer | Nexys A7, VHDL, Vivado, 89% faster than software | Digital design |
| 7 | Facial Verification Model | Siamese network, TensorFlow, LFW, custom training loops | AI/ML |
| 8 | 8-bit Program Counter | Full-custom static CMOS (mux, adder, flip-flop register), Cadence Virtuoso | Chip design |
| — | Hot Air Plant Control *(mockup only)* | STM32, µC/OS-III, 4 tasks, PID within 0.3 °C | Embedded |
| — | Hand Gesture Recognition *(mockup only)* | ESP32, non-blocking Wi-Fi server, Flask REST layer | Embedded/software |

**Skills**: 41 items in five groups: Languages; Embedded & hardware; AI / ML; Web & networking; Tools (Cadence Virtuoso added). These map onto the brief's five domains, with some re-sorting (VHDL/Verilog/FPGA → Hardware & Digital Design, and so on).

## 3. Gaps I can't fill without you (no invented facts)

1. **AgroSphere Autonomous Agricultural Rover.** The brief prioritises it, but there's no content about it anywhere in the project.
2. **Case-study depth.** Problem, architecture, your contributions, challenges, decisions and results exist only as one-liners. I need notes, diagrams, photos or video for at least: Utensil, AgroSphere, chip design (ECG + Program Counter, and possibly the FPGA DNN), and one software/AI project.
3. **Utensil details.** Confirm that both descriptions are accurate (Pico + servos + 86%, *and* custom PCB + EMC).
4. **Hot Air Plant Control and Hand Gesture Recognition.** Bring them back or leave them out?
5. **Education details** beyond the degree and year: capstone, relevant courses, awards. Only if you want them shown.
6. **Résumé PDF, GitHub URL, and which email** to publish.
7. **Photos of you.** The current avatar is an illustration. The pixel/hologram avatar can be built from it or from the grad photo.

## 4. Assets

| Asset | Use in redesign |
|---|---|
| `avatar.png` (420², illustration) | Source for the pixel-art avatar (long dark hair, centre part) |
| `grad-photo.jpg` | About section (optional). Convert to WebP. |
| `oscilloscope.png`, `pcb.png`, `laptop.png`, `raspberry.png`, `sparkle.webp` | Hand-drawn chalk doodles. Off-concept for the workstation look, so I suggest retiring them. |
| `reference/design-mockup.html` | Holds the two retired project descriptions |

## 5. What the references teach (studied, not copied)

**edh.dev** renders the *whole site inside* a Commodore PET–style CRT: amber phosphor (`#f6d4b1`), a pixel font, a dithered 3D bust on the screen, and a "Scroll or type help" shell.
- Lesson: one physical object with a believable screen OS is memorable.
- The trade-off: content inside a canvas isn't real HTML, which hurts recruiters, search engines and screen readers. Your brief rightly keeps content in HTML. The deck *introduces* the site; it doesn't contain it.

**universe.dotsuite.dev** uses a wide display face (Syne 800) with Space Mono, tracked uppercase labels (letter-spacing 2–3px), `// section` labels with a hairline rule, a fine 40px grid, and bordered cards with mono tag chips. Its palette is navy `#060a0f` with neon cyan and green.
- Lesson: the editorial/technical type system and the labelling rhythm.
- I'm deliberately *not* taking its neon-on-navy palette, which is the "dark futuristic dashboard" you asked to avoid.

## 6. Technical direction (proposal, for Phase 3)

- **3D:** Three.js loaded via import map, initialised after first paint, with the deck *modelled procedurally* (rounded boxes, extruded bezel, instanced keys = one draw call). There's no GLB to download, colours come straight from the palette tokens, and it stays roughly <200 KB JS on top of Three.js. A Blender GLB stays an option if you want sculpted detail later.
- **Screen and avatar:** a 2D canvas texture (pixel avatar, boot text, scanlines) mapped onto the CRT. It's cheap and easy to animate (blink, breathe).
- **Fallbacks:** reduced motion or no WebGL → a static rendered image of the deck. On phones, the deck is smaller, renders once and doesn't follow the cursor.
- **Circuit narrative:** one SVG trace layer running down the page edge, with a signal pulse driven by scroll *position*, never scroll-jacking. Nodes light as each section enters, and the traces converge into the processor in Contact.
- **Case studies:** one HTML page per project (`/projects/utensil.html`, …) that shares the same CSS. These pages can be linked to directly, and they're readable and easy to index.
