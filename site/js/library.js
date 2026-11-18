// The project library page: theme toggle and the typewriter heading. No 3D here.
import { initTheme, initTypewriter } from './ui.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const { gsap, ScrollTrigger } = window;
if (gsap) gsap.registerPlugin(ScrollTrigger);
initTheme({ reduceMotion });
initTypewriter(document.querySelectorAll('.section-head h1'), { gsap, ScrollTrigger, reduceMotion });
