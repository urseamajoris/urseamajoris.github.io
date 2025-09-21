
/*! main.js — Smooth navigation + robust reveal-on-scroll
   RAMSC site utilities
   - Adds `html.js` to enable CSS-gated animations
   - Smooth anchor scroll with sticky header offset & reduced-motion respect
   - Sticky header state, mobile nav (ARIA), close-on-link + ESC
   - Reveal-on-scroll (IntersectionObserver) with safe fallback
   - Lightbox and Members filters
*/

(function () {
  'use strict';

  //--- CSS gating for progressive enhancement
  // Allows CSS rules like: html.js .reveal { opacity:0; transform:translateY(10px); }
  document.documentElement.classList.add('js');

  // Helpers
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Sticky header and scroll-driven video
    const header = $('[data-header]');
    const headerHeight = () => header ? header.getBoundingClientRect().height : 0;
    const applyHeaderShadow = () => { if (header) header.classList.toggle('scrolled', window.scrollY > 4); };

    let video, vSection, vDuration = 0;
    function initVideo() {
      video = document.getElementById('introVideo');
      if (!video) return;
      vSection = video.closest('[data-video-scrub]');
      const onMeta = () => { vDuration = video.duration || 0; };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
      const vio = new IntersectionObserver((entries) => {
        entries.forEach(e => { e.isIntersecting ? video.play().catch(() => {}) : video.pause(); });
      }, { threshold: 0.2 });
      vio.observe(video);
    }
    function syncVideoWithScroll() {
      if (!video || !vSection || !vDuration) return;
      const rect = vSection.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const prog = Math.min(1, Math.max(0, 1 - (rect.top / (rect.height - vh/2 || 1))));
      video.currentTime = prog * vDuration;
    }

    const onScroll = () => {
      applyHeaderShadow();
      syncVideoWithScroll();
    };
    on(window, 'scroll', onScroll, { passive: true });
    onScroll();
    document.addEventListener('DOMContentLoaded', initVideo);

  // Year
  const yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav
  const nav = $('#site-nav');
  const toggle = $('.nav-toggle');
  const openNav = () => {
    if (!nav) return;
    nav.classList.add('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const closeNav = () => {
    if (!nav) return;
    nav.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  const handleToggle = (e) => {
    if (e) e.preventDefault();
    if (!nav) return;
    if (nav.classList.contains('open')) {
      closeNav();
    } else {
      openNav();
    }
  };

  on(toggle, 'click', handleToggle);
  on(toggle, 'touchstart', handleToggle);
  on(document, 'keydown', (e) => { if (e.key === 'Escape') closeNav(); });
  // Close on any nav link click (good for mobile)
  on(nav, 'click', (e) => { if (e.target.closest('a')) closeNav(); });

  // Smooth anchor scrolling with sticky-header offset
  function isSamePageAnchor(a) {
    if (!a || !a.getAttribute) return false;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('#') || href.length <= 1) return false;
    // same page only
    const samePath = location.pathname.replace(/\/+$/, '') === a.pathname.replace(/\/+$/, '');
    const sameHost = location.hostname === a.hostname;
    return samePath && sameHost;
  }
  function smoothScrollTo(target) {
    if (!target) return;
    const y = target.getBoundingClientRect().top + window.pageYOffset - (headerHeight() + 8);
    if (prefersReduced) {
      window.scrollTo(0, y);
    } else {
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    // Move focus for a11y after scroll finishes (approximate)
    const focusDelay = prefersReduced ? 0 : 400;
    setTimeout(() => {
      try {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      } catch {}
    }, focusDelay);
  }
  on(document, 'click', (e) => {
    const a = e.target.closest('a');
    if (!a || !isSamePageAnchor(a)) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const target = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
    if (!target) return;
    e.preventDefault();
    smoothScrollTo(target);
  });
  // If landing on a hash, offset immediately
  window.addEventListener('load', () => {
    if (location.hash.length > 1) {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
      if (target) setTimeout(() => smoothScrollTo(target), 50);
    }
  }, { once: true });

  // Card cover fallback to default image if missing/broken
(function ensureCardCovers(){
  const DEFAULT_COVER = 'assets/img/card.png';
  document.querySelectorAll('.card .card-cover').forEach(img => {
    // If src is empty or whitespace, set default immediately
    if (!img.getAttribute('src') || !img.getAttribute('src').trim()) {
      img.src = DEFAULT_COVER;
    }
    // If the image fails to load, swap to default
    img.addEventListener('error', () => {
      if (img.src.indexOf('card.jpeg') === -1) img.src = DEFAULT_COVER;
    }, { once: true });
  });
})();


  // Reveal on scroll (IO) with graceful fallback
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    // Fallback: simply show content
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  // Lightbox (optional; used on About gallery)
  const lightbox = $('.lightbox');
  if (lightbox) {
    const lbImg = $('.lightbox-img', lightbox);
    const lbClose = $('.lightbox-close', lightbox);
    $$('#main [data-lightbox] .gallery-item').forEach((a) => {
      on(a, 'click', (e) => {
        e.preventDefault();
        const imgEl = a.querySelector('img');
        const href = a.getAttribute('href') || (imgEl ? imgEl.src : '');
        if (!href || !lbImg) return;
        lbImg.src = href;
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
      });
    });
    const close = () => {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      if (lbImg) lbImg.src = '';
    };
    on(lbClose, 'click', close);
    on(lightbox, 'click', (e) => { if (e.target === lightbox) close(); });
    on(document, 'keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  // Members directory filters (if present)
  const filters = $('[data-member-filters]');
  if (filters) {
    const search = filters.querySelector('[data-search]') || filters.querySelector('input[type="search"]');
    const roleSel = filters.querySelector('[data-role]') || filters.querySelector('select');
    const sortSel = filters.querySelector('[data-sort]') || filters.querySelectorAll('select')[1];
    const grid = document.querySelector('.member-grid');
    const cards = grid ? Array.from(grid.querySelectorAll('.member-card')) : [];

    function apply() {
      const q = (search && search.value || '').toLowerCase().trim();
      const role = (roleSel && roleSel.value) || 'all';

      cards.forEach(card => {
        const name = (card.dataset.name || '').toLowerCase();
        const roleVal = card.dataset.role || '';
        const matchQ = !q || name.includes(q) || roleVal.toLowerCase().includes(q);
        const matchR = role === 'all' || roleVal === role;
        card.style.display = (matchQ && matchR) ? '' : 'none';
      });

      const sort = (sortSel && sortSel.value) || 'name-asc';
      const visible = cards.filter(c => c.style.display !== 'none');
      visible.sort((a, b) => {
        const an = (a.dataset.name || '').toLowerCase();
        const bn = (b.dataset.name || '').toLowerCase();
        return sort === 'name-desc' ? bn.localeCompare(an) : an.localeCompare(bn);
      });
      visible.forEach(c => grid && grid.appendChild(c));
    }

    [search, roleSel, sortSel].forEach(el => el && on(el, 'input', apply));
    apply();
  }
  // Dashboard articles preview
  async function loadDashboardArticles() {
    const container = document.getElementById('dashboard-articles');
    if (!container) return;
    try {
      const res = await fetch('articles.json');
      if (!res.ok) throw new Error(res.statusText);
      const articles = await res.json();
      articles
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3)
        .forEach(a => {
          const card = document.createElement('article');
          card.className = 'card reveal';
          const imgSrc = a.hero || 'assets/img/card.png';
          const dateStr = new Date(a.date).toLocaleDateString('en-GB');
          card.innerHTML = `
          <a href="articles.html?id=${a.id}" class="card-link">
            <img src="${imgSrc}" alt="${a.title}">
            <div class="card-body">
              <h3 class="card-titles">${a.title}</h3>
              <p class="card-date"><time datetime="${a.date}">${dateStr}</time></p>
            </div>
          </a>`;
          container.appendChild(card);
        });
      articles.slice(0, 3).forEach(a => {
        const card = document.createElement('article');
        card.className = 'card reveal';
        const imgSrc = a.hero || 'assets/img/card.png';
        card.innerHTML = `
          <a href="articles.html?id=${a.id}" class="card-link">
            <img src="${imgSrc}" alt="${a.title}">
            <div class="card-body"><h3 class="card-titles">${a.title}</h3></div>
          </a>`;
        container.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to load dashboard articles', err);
      container.innerHTML = '<p>Unable to load articles.</p>';
    }
  }

  loadDashboardArticles();
})();
document.addEventListener("mousemove", (e) => {
  const layers = document.querySelectorAll(".layer");
  const x = (e.clientX / window.innerWidth - 0.5) * 2; 
  const y = (e.clientY / window.innerHeight - 0.5) * 2;

  layers.forEach(layer => {
    const depth = layer.getAttribute("data-depth");
    const moveX = x * depth * 30;  // adjust 30 for intensity
    const moveY = y * depth * 30;

    layer.style.transform = `translate(-50%, -50%) translate(${moveX}px, ${moveY}px)`;
  });
});
document.addEventListener("mousemove", (e) => {
  const layers = document.querySelectorAll(".layer");
  const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1 (left) → +1 (right)
  const y = (e.clientY / window.innerHeight - 0.5) * 2; // -1 (top) → +1 (bottom)

  layers.forEach(layer => {
    const depth = layer.getAttribute("data-depth");
    let moveX = x * depth * 13;
    let moveY = y * depth * 13;

    // default parallax shift
    let transform = `translate(-50%, -50%) translate(${moveX}px, ${moveY}px)`;

    // Flask rotates with X
    if (layer.classList.contains("flask")) {
      const rotate = x * 15; // max ±30deg
      transform += ` rotate(${rotate}deg)`;
    }

    // Aura scales with X
    if (layer.classList.contains("aura")) {
      const scale = 1 + (x * -0.07); 
      transform += ` scale(${scale})`;
    }

    // Background scales with Y
    if (layer.classList.contains("background")) {
      const scale = 1 + (y * -0.05); 
      // y=-1 (top) → scale=1.3 (bigger)
      // y=+1 (bottom) → scale=0.7 (smaller)
      transform += ` scale(${scale})`;
    }

    layer.style.transform = transform;
  });
});