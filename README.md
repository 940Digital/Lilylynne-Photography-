# Lilylynne Photography

Three-page site for **Piper Vaughan** — family and portrait photographer in
the Denton, Texas area (Aubrey, Denton, Pilot Point, Sanger).

- `index.html` — hero, a one-line welcome, selected work, sessions & pricing, about, service area
- `gallery.html` — the full portfolio, every real client photo, in the same row-based grid as Home
- `contact.html` — booking form and direct contact, nothing else

## Stack

The marketing pages are still plain static HTML, one stylesheet and one small
vanilla JS file, now served from `public/` by the Next.js project that also
hosts the private gallery app (see "Private client galleries" below). The
marketing pages do not use React or any build step of their own.

```
public/css/styles.css        design system (tokens → components → responsive)
public/js/main.js            nav, scroll reveals, botanical draw-in, form validation
public/assets/opt/           web-ready image derivatives (WebP + JPG fallback)
public/assets/gallery/       original photographs (not deployed)
public/assets/botanicals.svg the hand-drawn botanical marks, also inlined in each page
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
source file, at quality 88 (WebP) / 90 (JPG), so a retina screen gets a
genuinely sharp image rather than an upscaled small one. Two source
generations sit side by side in `assets/gallery/`: the original 16-photo
"web-optimized subset" tops out at 933px (portrait) / 1400px (landscape),
while the 30 photos pulled from Piper's fuller portfolio (added later,
`gallery.html`'s bulk) run natively up to 2048px — noticeably sharper on
large screens, and the reason the full-bleed page-hero ceiling noted here
previously mostly no longer applies. A realistic first visit is ~2MB on
desktop / ~700K on mobile for Home — Gallery is heavier (46 photos) but
every image below the fold is lazy-loaded, so nothing downloads until a
visitor actually scrolls to it.

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


## Private client galleries

A Pic-Time replacement lives in the same project. Piper uploads a gallery,
sends the client a private link, and the client views the photos in a grid and
lightbox and downloads them. It is **not linked from the marketing site**: it
is only reachable by a shared `/g/<random link>` or by typing `/admin`. Every
gallery route sends `noindex`, and `robots.txt` disallows `/admin`, `/g/`, `/api/`.

| Piece | What it is |
|---|---|
| `/admin` | Piper's login, dashboard, gallery creation, drag and drop upload, zip, delete |
| `/g/[slug]` | Client view: optional password, grid, lightbox, slideshow, original download, "Download all" zip |
| `/api/cron/daily` | Vercel cron (daily): marks expired galleries, logs a reminder, deletes files after a 3 day grace period |
| Neon Postgres | Gallery and photo records (tables are created automatically on first use, see `src/lib/schema.ts`) |
| Cloudflare R2 | The photo files, private bucket, browser uploads straight to it with presigned URLs |

Branding and every limit (10 galleries, 5 GB each, 60 day expiry) are in
`studio.config.ts`. The marketing pages are served through three rewrites in
`next.config.ts` (`/`, `/gallery`, `/contact`).

### One-time setup

1. **Neon:** Vercel project, Storage tab, add Neon Postgres. Vercel sets
   `DATABASE_URL`. Nothing else to do: the app creates its tables on first use.
2. **R2:** create a private bucket (Cloudflare dashboard, R2). Create an API
   token with Object Read & Write scoped to that bucket. Apply CORS so browsers
   can upload directly (replace the origin if you use another domain):
   ```json
   [{"AllowedOrigins":["https://www.lilylynnephotography.com"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3600}]
   ```
   (R2, the bucket, Settings, CORS Policy.) Do not enable public access.
3. **Environment variables** in the Vercel project (see `.env.example`):
   `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (`npm run hash-password -- "password"`),
   `SESSION_SECRET` (`openssl rand -hex 32`), `CRON_SECRET` (any long random
   string; Vercel then authenticates the cron with it), `APP_URL`,
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
   The existing `ALTCHA_HMAC_KEY` and `RESEND_API_KEY` keep working for the contact form.
4. Deploy. The project is set to the Next.js framework in `vercel.json`.

### Local development

```bash
cp .env.example .env.local     # use DATABASE_URL=pglite://./.data/pg and R2_ENDPOINT=http://localhost:9477
npm run mock-s3                # local stand-in for R2 (separate terminal)
npm run dev                    # http://localhost:3000
```

The embedded Postgres (PGlite) and the mock S3 server are development tools
only. Production uses Neon and R2.

### Spending safeguards

Cloudflare has no stop-at-limit setting for R2, so the app enforces its own
caps (all in `studio.config.ts`) to stay inside R2's free tier:

- `maxTotalBytes` (8 GB of the free 10 GB): new uploads are refused, with a clear
  message, once all galleries together reach it. Delete an old gallery to free space.
- `monthlyReadBudget` (6M of the free 10M reads) and `monthlyWriteBudget` (600k of
  the free 1M writes): counted per calendar month. At the limit, galleries show
  "temporarily unavailable" and uploads pause until next month. Reads are counted
  when a signed URL is issued, which over-counts real fetches (conservative).
- The admin dashboard shows all three meters. Per-gallery (5 GB) and gallery-count
  (10) caps still apply.

These cannot cap Neon or Vercel. Also set a Cloudflare billing alert, and
consider a card with its own spending limit.

### Notes

- Originals must be JPEG, PNG or WebP the browser can decode (max 100 MB each).
  Previews (2000 px) and thumbnails (400 px) are made in the browser before upload.
- The expiry reminder is a log line only. TODO: email it from
  `src/lib/expiry.ts` (Resend is already configured for the contact form).
- On Vercel Hobby, cron jobs run at most once a day, which is all this needs.
