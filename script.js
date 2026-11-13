// Section headings type themselves out, one letter at a time, then backspace
// and retype on a loop, starting when scrolled into view.
(function () {
  const headings = document.querySelectorAll('.heading h2');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) return;

  const HOLD_TYPED = 3000;  // pause on the full word, cursor blinking
  const HOLD_EMPTY = 600;   // pause on the empty prompt before retyping

  function type(h2) {
    const typed = h2.querySelector('.typed');
    const text = h2.dataset.text;
    let i = 0;

    function typeNext() {
      h2.classList.add('is-typing');
      typed.textContent = text.slice(0, ++i);
      if (i < text.length) {
        setTimeout(typeNext, 70 + Math.random() * 70);
      } else {
        h2.classList.remove('is-typing');
        setTimeout(deleteNext, HOLD_TYPED);
      }
    }

    function deleteNext() {
      h2.classList.add('is-typing');
      typed.textContent = text.slice(0, --i);
      if (i > 0) {
        setTimeout(deleteNext, 40);
      } else {
        h2.classList.remove('is-typing');
        setTimeout(typeNext, HOLD_EMPTY);
      }
    }

    typeNext();
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      setTimeout(() => type(entry.target), 250);
    });
  }, { threshold: 0.6 });

  headings.forEach((h2) => {
    const textNode = h2.firstChild;
    const text = textNode.textContent;
    h2.dataset.text = text;

    // Screen readers get the full heading; the typed copy is visual only.
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = text;
    const typed = document.createElement('span');
    typed.className = 'typed';
    typed.setAttribute('aria-hidden', 'true');
    h2.replaceChild(typed, textNode);
    h2.insertBefore(label, typed);

    observer.observe(h2);
  });
})();

// Projects strip: arrow buttons scroll one polaroid at a time.
(function () {
  const strip = document.querySelector('.strip');
  const prev = document.querySelector('.carousel-btn.prev');
  const next = document.querySelector('.carousel-btn.next');

  function step() {
    const card = strip.querySelector('.project');
    return card.offsetWidth + parseFloat(getComputedStyle(strip).columnGap || 0);
  }

  function update() {
    prev.disabled = strip.scrollLeft <= 2;
    next.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
  }

  prev.addEventListener('click', () => strip.scrollBy({ left: -step() }));
  next.addEventListener('click', () => strip.scrollBy({ left: step() }));
  strip.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// Parts bin: tap a chip to highlight the cards that used it.
(function () {
  const where = {
    'Python': ['utensil', 'quadcopter', 'moogle'],
    'I2C': ['utensil'],
    'Verilog': ['dnn'],
    'VHDL': ['synth'],
    'FPGA': ['dnn', 'synth'],
    'Xilinx Vivado': ['synth'],
    'FreeRTOS': ['security'],
    'RTOS': ['security'],
    'Raspberry Pi': ['quadcopter'],
    'TensorFlow': ['facial'],
    'Cadence Virtuoso': ['ecg', 'counter'],
    'FastAPI': ['moogle']
  };
  const names = {
    utensil: 'Self-Stabilizing Utensil',
    dnn: 'DNN Accelerator on FPGA',
    ecg: 'Smart Watch ECG Sensor',
    security: 'Home Security System',
    quadcopter: 'IR Quadcopter',
    synth: 'Digital Waveform Synthesizer',
    facial: 'Facial Verification Model',
    counter: '8-bit Program Counter',
    moogle: 'my MoogleLabs role'
  };

  const chips = document.querySelectorAll('.chips button');
  const cards = document.querySelectorAll('.hl');
  const selText = document.querySelector('.sel-text');
  const strip = document.querySelector('.strip');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let selected = null;

  // Mark the chips that link to featured work with a yellow dot.
  chips.forEach((chip) => {
    if (where[chip.textContent]) chip.classList.add('has-work');
  });

  // Bring the first matching project into view inside the strip (without moving the page).
  function scrollToProject(id) {
    const card = strip.querySelector('[data-id="' + id + '"]');
    if (!card) return;
    const left = card.offsetLeft - strip.offsetLeft - (strip.clientWidth - card.offsetWidth) / 2;
    strip.scrollTo({ left: left, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function render() {
    const hits = selected ? (where[selected] || []) : [];

    chips.forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.textContent === selected));
    });

    cards.forEach((card) => {
      const hit = hits.includes(card.dataset.id);
      card.classList.toggle('is-faded', !!selected && !hit);
      card.classList.toggle('is-hit', !!selected && hit);
    });

    if (!selected) {
      selText.textContent = '';
    } else if (hits.length) {
      selText.textContent = selected + ' → ' + hits.map((h) => names[h]).join(', ');
    } else {
      selText.textContent = selected + ': not in a featured project yet. ask me about it!';
    }
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selected = selected === chip.textContent ? null : chip.textContent;
      render();
      const firstProject = (where[selected] || []).find((id) => id !== 'moogle');
      if (firstProject) scrollToProject(firstProject);
    });
  });

  // Esc clears the selection
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selected) {
      selected = null;
      render();
    }
  });
})();

// Cards drift up into place the first time they scroll into view.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.intro, .paper-card, .bin, .carousel, .icon-links').forEach((el) => {
    el.classList.add('reveal');
    observer.observe(el);
  });
})();
