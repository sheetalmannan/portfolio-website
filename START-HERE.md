# Sheetal's portfolio — starter kit for Claude Code

## What's in this folder
- `assets/` — the final images used in the mockup
  - `pcb.png`, `oscilloscope.png`, `laptop.png`, `raspberry.png` (white crayon doodles, transparent backgrounds)
  - `sparkle.webp` (looping animated sparkle, transparent)
- `reference/design-mockup.html` — the mockup's source. It uses a design-tool format
  (`{{...}}` placeholders, `<sc-for>`/`<sc-if>` tags), so it won't run as-is.
  Use it as the reference for layout, colours, fonts, text and spacing.

## First prompt to paste into Claude Code

Build my personal portfolio website as a static site in this folder, using plain HTML,
CSS and a little vanilla JavaScript (no framework). Use reference/design-mockup.html as
the design reference: copy its layout, colours, fonts (Young Serif, Gochi Hand, DM Sans
from Google Fonts), text content and section order exactly. Use the images in assets/.

Sections, in order:
1. Hero: green cutting-mat grid background with paper grain, round avatar, my name,
   tagline, and three hand-drawn circled links (projects, experience, say hi). Doodles
   (oscilloscope, circuit board, raspberry, sparkle, laptop) arranged around the name.
2. Intro card ("hi, I'm Sheetal!") with the grad photo in a pinned polaroid on the right.
3. ./Experience — two paper cards (MoogleLabs, TTC).
4. ./Parts bin — tech stack as clickable chips in labelled drawers. Clicking a chip
   highlights the project/experience cards that used it and fades the others.
5. ./Projects — three polaroid project cards.
6. Let's talk — email, LinkedIn and GitHub icon links.

Section headings start with "./" and end with a blinking block cursor (respect
prefers-reduced-motion). Sparkles and doodles also appear in the side margins on wide
screens and are hidden below 1240px. Make it fully responsive and accessible
(alt text, focus styles, 44px tap targets). Split into index.html, styles.css and script.js.
