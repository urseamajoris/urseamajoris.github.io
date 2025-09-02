# RAMSC (Ramathibodi Medical Student's Council) — Starter Site

A launch-ready, responsive, accessible, and immersive website scaffold for **RAMSC** in pure **HTML + CSS + vanilla JS**.

> Design goals: **futuristic, immersive, informational, minimalistic**, bright and uplifting. Typography: **Montserrat**.

## Quick start
1. Unzip the archive.
2. Open `index.html` in a browser to preview.
3. Replace assets:
   - Hero image: `assets/img/placeholder-hero.jpg`
   - Gallery images: `assets/img/placeholder-thumb-*.jpg`
   - **Intro video:** add your file to `assets/video/intro.mp4`
4. Deploy by uploading the folder to any static host (GitHub Pages, Netlify, Vercel, shared hosting).

## Pages
- **Home (`index.html`)**: Sticky nav, scroll-aware hero video with overlay CTA, news/events grid.
- **About (`about.html`)**: Description, mission (Thai), values, history timeline, photo gallery with lightbox.
- **Members (`members.html`)**: Filterable/searchable member directory.

## Customize theme
Edit `css/styles.css` (`:root`) to change colors and tokens:
```css
:root {
  --brand-1: #2ED3E6;
  --brand-2: #FFD166;
  --bg: #ffffff;
  --text: #0f172a;
  --muted: #475569;
  --accent: #7C3AED;
  --surface: #f8fafc;
  --radius: 16px;
  --shadow: 0 10px 30px rgba(2,6,23,0.1);
}
/* Alternate palette example (commented in the file) */
```

## Replace logo
- The header currently shows a text logo **RAMSC**. Replace with an `<img>` tag or background image in the header logo area. See comments in `index.html` and `css/styles.css`.

## Scroll video
- The hero uses a scroll-driven `<video>` (muted, playsinline). Add your file at `assets/video/intro.mp4`.
- If no video is present, the poster image shows; the JS gracefully falls back.

## Accessibility & performance
- Semantic landmarks; skip link; focus rings; color contrast.
- IntersectionObserver to play/pause video and reveal sections on scroll.
- Mobile menu supports keyboard and ESC to close.
- Images lazy-loaded; JS deferred; fonts preloaded.

## File tree
```
ramsc-site/
  index.html
  about.html
  members.html
  /assets/
    /img/
      placeholder-hero.jpg
      placeholder-thumb-1.jpg ... placeholder-thumb-6.jpg
    /video/
      intro.mp4   # <— add your actual video here (placeholder path)
  /css/
    styles.css
  /js/
    main.js
  README.md
```

## Notes
- Typography is loaded via Google Fonts (Montserrat).
- Ensure your hosting allows cross-origin font loading (most do).
- To disable motion: respects `prefers-reduced-motion` media query.
