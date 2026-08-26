# Lilylynne Photography

Three-page site for **Piper Vaughan** — family and portrait photographer in
the Denton, Texas area (Aubrey, Denton, Pilot Point, Sanger).

- `index.html` — hero, a one-line welcome, selected work, sessions & pricing, about, service area
- `gallery.html` — the full portfolio, every real client photo, in the same row-based grid as Home
- `contact.html` — booking form and direct contact, nothing else

## Stack

Static HTML, one stylesheet, one small vanilla JS file. No build step, no
dependencies, no framework — the whole site is two documents plus assets, so it
deploys anywhere and there is nothing to keep upgraded.

```
css/styles.css        design system (tokens → components → responsive)
js/main.js            nav, scroll reveals, botanical draw-in, form validation
assets/opt/           web-ready image derivatives (WebP + JPG fallback)
assets/gallery/       original photographs (not deployed)
assets/botanicals.svg the hand-drawn botanical marks, also inlined in each page
```

## Design system

**Type** — Fraunces (display serif, `SOFT`/`WONK` axes on for an organic edge)
and Jost (body/UI). Loaded from Google Fonts with `display=swap`.

**Colour** — warm ivory and cream surfaces with dusty rose, sage and blush
accents. Every text/surface pairing in the palette clears WCAG AA; the type over
the contact-page photograph was measured against the actual image pixels and
clears AA too.

**Botanicals** — five hand-authored SVG marks (`bloom`, `sprig`, `spray`,
`stem`, `trio`) used as punctuation: section dividers, button and link marks,
card headers, and two drifting stems in the service-area band. They inherit
`currentColor`, so they recolour with the surface they sit on.

**Motion** — soft fades on scroll, a slow hero settle, sprig dividers that draw
themselves in, and 1.035 image hovers. All of it collapses under
`prefers-reduced-motion: reduce`.

**Images** — every photograph gets a WebP `srcset` (plus a JPG fallback for
the rare non-WebP browser) whose *top* tier is the full resolution of the
source file, at quality 88 (WebP) / 90 (JPG). The delivered "web-optimized
subset" tops out at 933px wide for portrait crops and 1400px for landscape;
those numbers are the derivatives' ceiling too, so a retina screen gets a
genuinely sharp image up to that size rather than an upscaled small one. A
realistic first visit is ~2MB on desktop / ~700K on mobile — normal for a
photography-led site, and the right trade for images that are the whole
product. The one place this ceiling shows: the three full-bleed page-hero
photos (Contact, Gallery, plus whichever shots anchor Home) render at the
full viewport width, which on very large monitors can exceed the 1400px
source. Higher-resolution originals for those specific shots would close
that gap completely if Piper has them.

## Booking form

The form validates client-side and then hands the enquiry off. Out of the box
there is no backend: it opens the visitor's mail app with everything filled in
and tells them plainly that texting or DMing reaches Piper just as fast.

To post submissions somewhere instead, set one constant near the bottom of
`js/main.js`:

```js
var FORM_ENDPOINT = 'https://…';   // Formspree, Netlify, a serverless function
```

Any endpoint that accepts a JSON `POST` of
`{name, email, phone, session, dates, message}` will work. A honeypot field
(`company`) is already in place.

## Before going live

1. **Domain.** Canonical URLs, Open Graph tags, `sitemap.xml` and `robots.txt`
   all use the placeholder `https://lilylynnephotography.com`. Search and replace
   it with the real domain.
2. **Form endpoint.** See above, or leave the mail-app fallback in place.

## Local preview

```bash
node serve.js
```

Then open <http://localhost:8811>.
