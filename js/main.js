// Lilylynne Photography — shared behavior

document.addEventListener('DOMContentLoaded', () => {
  /* Mobile nav toggle */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  /* Scroll reveal */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.reveal');
  if (prefersReduced) {
    revealEls.forEach(el => el.classList.add('is-visible'));
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { root: null, rootMargin: '0px 0px -20% 0px', threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* Hero dim + crop on scroll (desktop only, signature motion) */
  const hero = document.querySelector('.hero');
  if (hero && !prefersReduced && window.matchMedia('(min-width: 861px)').matches) {
    const img = hero.querySelector('.hero-media img');
    const scrim = hero.querySelector('.hero-scrim');
    let ticking = false;
    const update = () => {
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(Math.max(1 - rect.bottom / rect.height, 0), 1);
      if (img) img.style.transform = `scale(${1 + progress * 0.12})`;
      if (scrim) scrim.style.opacity = String(0.55 + progress * 0.35);
      ticking = false;
    };
    update();
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  /* Contact form (front-end only stub) */
  const form = document.querySelector('#contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = form.querySelector('.form-status');
      if (status) {
        status.textContent = "Thanks! I'll get back to you shortly — for faster replies, call or text (940) 205-1220.";
        status.classList.add('visible');
      }
      form.reset();
    });
  }

  /* Lightbox (gallery page) */
  const lightbox = document.querySelector('.lightbox');
  if (lightbox) {
    const lbImg = lightbox.querySelector('img');
    const triggers = Array.from(document.querySelectorAll('.grid-gallery-full button'));
    let current = 0;

    const show = (i) => {
      current = (i + triggers.length) % triggers.length;
      const src = triggers[current].querySelector('img').getAttribute('data-full') || triggers[current].querySelector('img').src;
      lbImg.src = src;
      lbImg.alt = triggers[current].querySelector('img').alt;
    };

    triggers.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        show(i);
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });

    const close = () => {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    };

    lightbox.querySelector('.lightbox-close').addEventListener('click', close);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
    lightbox.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
    lightbox.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
  }
});
