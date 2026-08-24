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

  /* ------------------------------------------------------------ Navigation */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('navMenu');
  var mobileQuery = window.matchMedia('(max-width: 900px)');
  var menuQuery = window.matchMedia('(max-width: 780px)');
  var navMediaMode = document.body.getAttribute('data-nav-media'); // 'always' | 'mobile' | null

  function syncNav() {
    if (!nav) return;
    var scrolled = window.scrollY > 24;
    nav.classList.toggle('is-stuck', scrolled);

    var overMedia = false;
    if (!scrolled && !menu.classList.contains('is-open')) {
      if (navMediaMode === 'always') overMedia = true;
      else if (navMediaMode === 'mobile') overMedia = mobileQuery.matches;
    }
    nav.classList.toggle('is-over-media', overMedia);
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
        nav.classList.remove('is-over-media');
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

  /* --------------------------------------------------------- Booking form */
  /* Set this to a form endpoint (Formspree, Netlify, a Vercel function, …)
     and submissions will POST as JSON. Left empty, the form hands the
     completed enquiry to the visitor's mail app instead — no data is lost. */
  var FORM_ENDPOINT = '';

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

      var data = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        session: form.elements.session.value,
        dates: form.elements.dates.value.trim(),
        message: form.elements.message.value.trim()
      };

      if (!FORM_ENDPOINT) {
        mailtoFallback(data);
        showStatus('ok', 'Your email app should be open with the details ready to send. If not, text 940-205-1220 or send a DM.');
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
          showStatus('ok', 'Thank you — that\'s on its way to Piper.');
        })
        .catch(function () {
          showStatus('err', 'That didn\'t send. Please text 940-205-1220 or send a DM instead.');
        })
        .then(function () {
          if (submitBtn) {
            submitBtn.removeAttribute('data-state');
            if (submitLabel) submitLabel.textContent = originalLabel;
          }
        });
    });
  }
})();
