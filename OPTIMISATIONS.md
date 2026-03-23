# Optimisation Notes

This document records the audit findings and all changes applied to the St. Nicholas Orthodox Church website.

---

## Stack

- **Framework:** Astro 5.x (static output)
- **Deployment:** Cloudflare Pages
- **Rendering:** Fully static — no SSR, no server adapter
- **Data:** Google Calendar fetched at build time — API key is server-only, events are baked into the page as static JSON

---

## Changes Applied

### 1. Explicit static output (`astro.config.mjs`)

**Problem:** `output` was not set. Astro 5 defaults to `'static'`, but this is an implicit contract — adding an adapter in future silently changes the default to `'server'`.

**Fix:** Added `output: 'static'` explicitly.

```js
// before
export default defineConfig({
  site: 'https://stnicholas.github.io',
  base: '/',
});

// after
export default defineConfig({
  output: 'static',
  site: 'https://stnicholas.github.io',
});
```

`base: '/'` was also removed — it is the default and adds noise.

---

### 2. Page `<title>` tag was always wrong (`src/layouts/Layout.astro`)

**Problem:** The layout hardcoded `<title>St. Nicholas Orthodox Church Christchurch</title>`, ignoring the `title` prop passed by every page. Every tab, browser bookmark, and search engine result showed the wrong title.

**Fix:** Changed to `<title>{title}</title>`. Also fixed the home page title from `"Home - stnicholas.github.io"` to `"Home - St. Nicholas Orthodox Church"` to match the convention used by all other pages.

---

### 3. Duplicate `<link rel="preconnect">` tags (`src/layouts/Layout.astro`)

**Problem:** The `preconnect` hints for Google Fonts were duplicated — two identical pairs for `fonts.googleapis.com` and `fonts.gstatic.com`. Duplicate hints waste connection slots and add pointless noise to the document head.

**Fix:** Removed the second (duplicate) pair.

---

### 4. Stylesheet `<slot name="head" />` added to Layout (`src/layouts/Layout.astro`)

**Problem:** Every page injected its per-page `<link rel="stylesheet">` into the Layout's default `<slot>`, which sits inside `<body>`. Stylesheets in `<body>` is invalid HTML and causes a flash of unstyled content — the browser renders the page structure before the CSS arrives.

**Fix:** Added `<slot name="head" />` inside `<head>` in the Layout. All per-page stylesheet links now use `slot="head"` so they are injected into `<head>` at build time.

```astro
<!-- layout -->
<head>
  ...
  <slot name="head" />
</head>

<!-- page -->
<Layout title="...">
  <link slot="head" rel="stylesheet" href="/home.css" />
  ...
</Layout>
```

This was applied to all pages: `index`, `schedule`, `contact`, `giving`, `icon-gallery`, `historical-gallery`, `posts/[slug]`, `parish-life/[...page]`, and all three library pages.

---

### 5. `@import url()` inside `<style>` blocks replaced (`parish-life`, `library/*`)

**Problem:** Four pages used `<style>@import url("/page.css");</style>` to load their stylesheets. A CSS `@import` inside a `<style>` block fires a second, render-blocking network request that only begins after the first stylesheet parses. It is strictly slower than a `<link>` tag.

**Fix:** Initially replaced with `<link slot="head">` tags; subsequently superseded by frontmatter SCSS imports (see change 15).

---

### 6. Removed unused FullCalendar npm packages (`package.json`)

**Problem:** Four `@fullcalendar/*` packages were installed as npm dependencies, but the calendar is loaded entirely from jsDelivr CDN — the npm packages are never imported or used. They sat in `node_modules` adding ~250 KB of parsed JavaScript to the install with no benefit.

**Fix:** Removed `@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/interaction`, and `@fullcalendar/list` from `package.json`.

---

### 7. FullCalendar CDN version mismatch (`src/components/FullCalendar.astro`)

**Problem:** npm had `@fullcalendar/*` pinned to `^6.1.20` but the CDN URLs loaded `fullcalendar@6.1.8`. This was a mismatched version — the installed packages (though unused) and the CDN bundle were different releases.

**Fix:** Updated both CDN URLs (`index.global.min.css` and `index.global.min.js`) to `@6.1.20`.

---

### 8. Explicit `is:inline` on CDN script tag (`src/components/FullCalendar.astro`)

**Problem:** The CDN `<script>` tag had `src` and `id` attributes, which causes Astro to silently treat it as `is:inline` (disabling processing). Astro emits a hint recommending the directive be explicit.

**Fix:** Added `is:inline` to the tag to silence the warning and make the intent clear.

---

### 9. Removed unused `siteTitle` variable (`src/components/Header.astro`)

**Problem:** The Header component defined `const siteTitle = "The Serious Sandwich"` — a leftover from project scaffolding that was never used in the template.

**Fix:** Deleted the variable.

---

### 10. Removed unused `currentPath` prop (`src/components/Header.astro`, `src/layouts/Layout.astro`)

**Problem:** `Layout.astro` computed `Astro.url.pathname` and passed it to `Header` as `currentPath`. The Header never referenced it in the template — it was dead code, likely scaffolded for active nav link highlighting that was never implemented.

**Fix:** Removed `currentPath` from both the Layout (where it was computed and passed) and the Header (where it was declared as a prop).

---

### 11. Cloudflare Pages `_headers` file (`public/_headers`)

**Problem:** No `_headers` file existed. Without one, Cloudflare Pages serves everything with default headers — no security headers, and no cache control. In particular:
- HTML pages have no cache instructions (Cloudflare may cache stale versions after a rebuild)
- Fingerprinted assets in `/_astro/` have no long-lived cache headers
- Basic security headers (XSS protection, clickjacking) are absent

**Fix:** Created `public/_headers`:

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/
  Cache-Control: public, max-age=0, must-revalidate
```

- `/_astro/*` assets are fingerprinted by Astro at build time, so they can be cached for 1 year (`immutable`).
- HTML pages are set to `no-cache` so new deploys propagate immediately.
- Security headers are applied globally.

---

### 12. Google Calendar fetch moved to build time (`src/components/FullCalendar.astro`)

**Problem:** The calendar fetched from the Google Calendar API in the browser at runtime. The API key was embedded in the HTML source via a `data-api-key` attribute and was visible to any visitor in DevTools. Every page load also incurred a live API request, adding latency dependent on Google's servers.

**Fix:** The `fetch()` call was moved to the component frontmatter, which runs only at build time. Events are serialised as JSON into a `data-events` attribute on the calendar element and read by the `is:inline` client script. The API key is now a server-only env var and never appears in the build output.

```astro
---
// Runs at build time only — key never reaches the browser
const res = await fetch(`...googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}...`);
const events = (data.items ?? []).map(ev => ({ ... }));
---

<div id="fullcalendar" data-events={JSON.stringify(events)}></div>

<script is:inline>
  const events = JSON.parse(document.getElementById('fullcalendar').dataset.events ?? '[]');
  new FullCalendar.Calendar(el, { events }).render();
</script>
```

**Required action:** Rename the env vars in your `.env.local` — remove the `PUBLIC_` prefix so they are never exposed to the client:

```
# before
PUBLIC_GOOGLE_CALENDAR_ID=...
PUBLIC_GOOGLE_CALENDAR_API_KEY=...

# after
GOOGLE_CALENDAR_ID=...
GOOGLE_CALENDAR_API_KEY=...
```

---

### 13. Post images — lazy loading and LCP hints (`src/pages/parish-life/[...page].astro`, `src/pages/posts/[slug].astro`)

**Problem:** Post card thumbnails had no `loading` attribute (defaulting to eager, loading all images even off-screen) and no `width`/`height` (causing cumulative layout shift as images load). The post hero also lacked an explicit loading hint.

**Fix:**
- Post card thumbnails: added `loading="lazy"` and `width="600" height="400"` to prevent CLS and defer off-screen loads.
- Post hero: added `loading="eager"` and `fetchpriority="high"` — it is the LCP element on the page and should be fetched immediately.

---

### 14. `post.slug` replaced with `post.id` (`src/pages/posts/[slug].astro`, `src/pages/parish-life/[...page].astro`)

**Problem:** `post.slug` is deprecated in Astro 5. In Astro 5's legacy content collections, `entry.id` is the canonical identifier but includes the file extension (e.g. `"my-post.md"`), while `entry.slug` strips it. Using `slug` continues to work via a compatibility shim but emits deprecation warnings.

**Fix:** Both files now use `post.id.replace(/\.mdx?$/, '')` to strip the file extension and produce the same URL-safe slug without touching the deprecated field.

```astro
// before
params: { slug: post.slug }
href={`/posts/${post.slug}`}

// after
params: { slug: post.id.replace(/\.mdx?$/, '') }
href={`/posts/${post.id.replace(/\.mdx?$/, '')}`}
```

---

### 15. All styles consolidated into `src/styles/` (`src/styles/`)

**Problem:** Every stylesheet in the project lived in `public/` as a parallel pair of `.scss` source + compiled `.css`. Astro never touched `public/` — the Sass was compiled manually (or not at all), the compiled output was committed, and there was no build pipeline. This meant:
- Raw SCSS source files were shipped verbatim to visitors
- Stylesheets were loaded via `<link>` tags pointing to unfingerprinted files (no cache busting)
- Source and compiled output had to be kept in sync manually

**Fix:** All `.scss` source files and their compiled `.css` counterparts were deleted from `public/`. The source files were moved to `src/styles/` and imported in each page/layout's frontmatter. Astro now compiles, bundles, and fingerprints all stylesheets automatically at build time.

Files migrated (first pass — 4 files):
- `learning.scss`, `music.scss`, `schedule.scss`, `service-texts.scss`

Files migrated (second pass — completing the migration):
- `general.scss`, `navigation.scss`, `home.scss`, `contact.scss`, `giving.scss`
- `historical-gallery.scss`, `posts.scss`, `post.scss`, `FullCalendar.scss`
- `style.css` (icomoon icon font — font paths updated to absolute `/fonts/...`)

Each page now imports its styles in the frontmatter:

```astro
---
import "../styles/home.scss";
---
```

`Layout.astro` imports the three global stylesheets (`general.scss`, `navigation.scss`, `style.css`) directly, replacing the three `<link>` tags that were previously in `<head>`. All `<link slot="head">` tags for page-specific styles have been removed. The 19 orphaned files were deleted from `public/`.

---

### 16. Father Valentin profile photo added to contact page (`src/pages/contact.astro`)

**Change:** Replaced the placeholder SVG with the real photo `/contacts/fr-valentine.jpg` for Father Valentin Basiuk. Also added a descriptive `alt` attribute.
