/* ==========================================================================
   Lilylynne Photography
   Small, dependency-free behaviour. Everything degrades gracefully:
   with JS off the page is fully readable and the form still submits.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- Year */
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------------------------------------------------------- Hero carousel */
  // The first slide is marked up active directly in the HTML, so this whole
  // feature is additive: if this script never runs, the hero is still a
  // single correct, fully visible photo — never blank.
  var heroCarousel = document.getElementById('heroCarousel');
  if (heroCarousel && !reduceMotion) {
    var heroSlides = heroCarousel.querySelectorAll('.hero__slide');
    if (heroSlides.length > 1) {
      var heroIndex = 0;
      var heroZ = 1; // matches the first slide's default stacking; only ever climbs
      var heroTimer = null;
      var heroResetTimer = null;

      function showHeroSlide(next) {
        var prev = heroIndex;
        heroIndex = next;

        // Higher than anything before it — guarantees the incoming slide
        // covers the previous one as it glides in, with no risk of a tie
        // even across the loop's wraparound back to slide 0.
        heroZ += 1;
        heroSlides[next].style.zIndex = String(heroZ);
        heroSlides[next].classList.add('is-active');

        // Once fully covered, silently park the previous slide back off
        // to the left (no transition) so it's ready to glide in again next
        // time its turn comes, instead of just sitting there already "in."
        if (heroResetTimer) window.clearTimeout(heroResetTimer);
        heroResetTimer = window.setTimeout(function () {
          var prevSlide = heroSlides[prev];
          prevSlide.classList.add('is-resetting');
          prevSlide.classList.remove('is-active');
          prevSlide.style.zIndex = '';
          void prevSlide.offsetWidth; // flush, so removing is-resetting next doesn't animate the snap-back
          prevSlide.classList.remove('is-resetting');
        }, 1500);
      }

      // The very first slide holds for 3s; every one after that holds for
      // 5s. heroHasAdvanced only ever flips once, so pausing/resuming the
      // tab doesn't re-grant the shorter first delay.
      var heroHasAdvanced = false;

      function scheduleHero(delay) {
        heroTimer = window.setTimeout(function () {
          heroHasAdvanced = true;
          showHeroSlide((heroIndex + 1) % heroSlides.length);
          scheduleHero(5000);
        }, delay);
      }
      function startHero() {
        stopHero();
        scheduleHero(heroHasAdvanced ? 5000 : 3000);
      }
      function stopHero() {
        if (heroTimer) { window.clearTimeout(heroTimer); heroTimer = null; }
      }

      startHero();

      // No point animating a hero nobody can see — pause while the tab is
      // hidden, resume when it's back.
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopHero(); else startHero();
      });
    }
  }

  /* ------------------------------------------------------------ Navigation */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('navMenu');
  var menuQuery = window.matchMedia('(max-width: 780px)');

  function syncNav() {
    if (!nav) return;
    nav.classList.toggle('is-stuck', window.scrollY > 24);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { syncNav(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', syncNav);
  syncNav();

  function closeMenu() {
    if (!menu) return;
    menu.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    syncNav();
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var first = menu.querySelector('a');
        if (first) first.focus();
      } else {
        syncNav();
      }
    });

    Array.prototype.forEach.call(menu.querySelectorAll('a'), function (a) {
      a.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        closeMenu();
        toggle.focus();
      }
    });

    menuQuery.addEventListener('change', function (e) { if (!e.matches) closeMenu(); });
  }

  /* -------------------------------------------------------- Scroll reveals */
  var revealables = document.querySelectorAll('[data-reveal]');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(revealables, function (el) { el.classList.add('is-in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(revealables, function (el) { revealObserver.observe(el); });
  }

  /* -------------------------------------- Botanical dividers draw themselves */
  var dividers = document.querySelectorAll('.sprig-divider');
  if (dividers.length && !reduceMotion && 'IntersectionObserver' in window) {
    var drawObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var svg = entry.target;
        // <use> renders into a shadow tree, so clone the symbol's paths in
        // order to measure and animate each stroke individually.
        var use = svg.querySelector('use');
        if (use) {
          var href = use.getAttribute('href') || use.getAttribute('xlink:href');
          var symbol = href && document.querySelector(href);
          if (symbol) {
            var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            Array.prototype.forEach.call(symbol.children, function (child) {
              g.appendChild(child.cloneNode(true));
            });
            svg.replaceChild(g, use);
          }
        }
        Array.prototype.forEach.call(svg.querySelectorAll('path'), function (path, i) {
          var len = path.getTotalLength();
          path.style.setProperty('--len', len);
          path.setAttribute('data-draw', '');
          path.style.transitionDelay = (i * 70) + 'ms';
          // Force a style flush so the transition has a start value.
          void path.getBoundingClientRect();
          path.classList.add('is-in');
        });
        Array.prototype.forEach.call(svg.querySelectorAll('circle'), function (c) {
          c.style.opacity = '0';
          c.style.transition = 'opacity .8s ease 1.1s';
          void c.getBoundingClientRect();
          c.style.opacity = '1';
        });
        drawObserver.unobserve(svg);
      });
    }, { threshold: 0.4 });

    Array.prototype.forEach.call(dividers, function (svg) { drawObserver.observe(svg); });
  }

  /* --------------------------------------------------------------- Lightbox */
  // Every photo in a gallery grid (the home page's featured work and the
  // full gallery page both use .spread rows of figure.media) opens large on
  // tap/click; tapping it again — or the dimmed backdrop, or Escape — closes
  // it. The About portrait and the hero/page-hero photos aren't wrapped in
  // .spread, so they're untouched.
  var lightboxFigures = document.querySelectorAll('.spread figure.media');
  if (lightboxFigures.length) {
    var lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Enlarged photo');
    lightbox.tabIndex = -1;

    var lightboxImg = document.createElement('img');
    lightboxImg.className = 'lightbox__img';
    lightbox.appendChild(lightboxImg);
    document.body.appendChild(lightbox);

    var lastFigure = null;

    function openLightbox(figure) {
      var img = figure.querySelector('img');
      if (!img) return;
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt || '';
      lastFigure = figure;
      lightbox.classList.add('is-open');
      document.body.classList.add('lightbox-open');
      lightbox.focus();
    }

    function closeLightbox() {
      if (!lightbox.classList.contains('is-open')) return;
      lightbox.classList.remove('is-open');
      document.body.classList.remove('lightbox-open');
      if (lastFigure) lastFigure.focus();
    }

    Array.prototype.forEach.call(lightboxFigures, function (figure) {
      figure.setAttribute('tabindex', '0');
      figure.setAttribute('role', 'button');
      figure.setAttribute('aria-label', 'View this photo larger');
      figure.addEventListener('click', function () { openLightbox(figure); });
      figure.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(figure);
        }
      });
    });

    lightbox.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  /* --------------------------------------------------------- Booking form */
  /* Set this to a form endpoint (Formspree, Netlify, a Vercel function, …)
     and submissions will POST as JSON. Left empty, the form hands the
     completed enquiry to the visitor's mail app instead — no data is lost. */
  var FORM_ENDPOINT = '/api/contact';

  var form = document.getElementById('bookingForm');
  if (form) {
    var status = document.getElementById('formStatus');
    var submitBtn = form.querySelector('[type="submit"]');
    var submitLabel = submitBtn ? submitBtn.querySelector('[data-label]') : null;
    var originalLabel = submitLabel ? submitLabel.textContent : '';

    function fieldOf(input) { return input.closest('.field'); }

    function messageFor(input) {
      if (input.validity.valueMissing) {
        return input.tagName === 'SELECT'
          ? 'Please choose a session type.'
          : 'Please fill this in.';
      }
      if (input.validity.typeMismatch && input.type === 'email') {
        return 'That email address does not look quite right.';
      }
      if (input.validity.tooShort) {
        return 'A little more detail, please.';
      }
      if (input.id === 'captchaAnswer') {
        return 'Please answer the question above.';
      }
      return 'Please check this field.';
    }

    function validate(input) {
      var wrap = fieldOf(input);
      if (!wrap) return true;
      var errorEl = wrap.querySelector('.field__error');
      var ok = input.checkValidity();
      wrap.classList.toggle('is-invalid', !ok);
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (errorEl) errorEl.textContent = ok ? '' : messageFor(input);
      return ok;
    }

    var inputs = form.querySelectorAll('input, select, textarea');
    Array.prototype.forEach.call(inputs, function (input) {
      if (input.type === 'hidden' || input.name === 'company') return;
      input.addEventListener('blur', function () { validate(input); });
      input.addEventListener('input', function () {
        if (fieldOf(input) && fieldOf(input).classList.contains('is-invalid')) validate(input);
      });
    });

    /* Simple math captcha: two small random numbers, checked again server-side. */
    var captchaQuestionEl = document.getElementById('captchaQuestion');
    var captchaAnswerInput = document.getElementById('captchaAnswer');
    var captchaAInput = document.getElementById('captchaA');
    var captchaBInput = document.getElementById('captchaB');
    var captchaSum = 0;

    function newCaptcha() {
      var a = 1 + Math.floor(Math.random() * 9);
      var b = 1 + Math.floor(Math.random() * 9);
      captchaSum = a + b;
      if (captchaQuestionEl) captchaQuestionEl.textContent = a + ' + ' + b;
      if (captchaAInput) captchaAInput.value = a;
      if (captchaBInput) captchaBInput.value = b;
      if (captchaAnswerInput) captchaAnswerInput.value = '';
    }
    newCaptcha();

    function showStatus(kind, text) {
      if (!status) return;
      status.className = 'form__status is-visible form__status--' + kind;
      var msg = status.querySelector('[data-status-text]');
      if (msg) msg.textContent = text;
    }

    function mailtoFallback(data) {
      var lines = [
        'Name: ' + data.name,
        'Email: ' + data.email,
        'Phone: ' + (data.phone || 'not given'),
        'Session type: ' + data.session,
        'Preferred dates or times: ' + (data.dates || 'flexible'),
        '',
        data.message
      ];
      var href = 'mailto:piperlvaughan@gmail.com'
        + '?subject=' + encodeURIComponent('Session enquiry from ' + data.name)
        + '&body=' + encodeURIComponent(lines.join('\n'));
      window.location.href = href;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot: a real visitor never sees or fills this.
      if (form.elements.company && form.elements.company.value) return;

      var valid = true;
      var firstBad = null;
      Array.prototype.forEach.call(inputs, function (input) {
        if (input.type === 'hidden' || input.name === 'company') return;
        if (!validate(input)) {
          valid = false;
          if (!firstBad) firstBad = input;
        }
      });

      if (!valid) {
        showStatus('err', 'A couple of fields still need filling in.');
        if (firstBad) firstBad.focus();
        return;
      }

      var captchaOk = captchaAnswerInput && parseInt(captchaAnswerInput.value, 10) === captchaSum;
      if (!captchaOk) {
        var captchaWrap = fieldOf(captchaAnswerInput);
        if (captchaWrap) captchaWrap.classList.add('is-invalid');
        var captchaError = document.getElementById('captcha-error');
        if (captchaError) captchaError.textContent = 'That answer is not quite right.';
        showStatus('err', 'Please double-check the quick math question.');
        newCaptcha();
        if (captchaAnswerInput) captchaAnswerInput.focus();
        return;
      }

      var data = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        session: form.elements.session.value,
        dates: form.elements.dates.value.trim(),
        message: form.elements.message.value.trim(),
        captchaA: form.elements.captchaA.value,
        captchaB: form.elements.captchaB.value,
        captchaAnswer: captchaAnswerInput.value.trim()
      };

      if (!FORM_ENDPOINT) {
        mailtoFallback(data);
        showStatus('ok', 'Your email app should be open with the details ready to send. If not, text 940-205-1220 or send a DM.');
        newCaptcha();
        return;
      }

      if (submitBtn) {
        submitBtn.setAttribute('data-state', 'sending');
        if (submitLabel) submitLabel.textContent = 'Sending';
      }

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed');
          form.reset();
          showStatus('ok', 'Thank you! That\'s on its way to Piper.');
        })
        .catch(function () {
          showStatus('err', 'That didn\'t send. Please text 940-205-1220 or send a DM instead.');
        })
        .then(function () {
          newCaptcha();
          if (submitBtn) {
            submitBtn.removeAttribute('data-state');
            if (submitLabel) submitLabel.textContent = originalLabel;
          }
        });
    });
  }
})();
