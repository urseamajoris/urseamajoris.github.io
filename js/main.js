(function(){
  document.documentElement.classList.add('js');
  const header = document.querySelector('[data-header]');
  const nav = document.getElementById('site-nav');
  const toggle = document.querySelector('.nav-toggle');
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const onScroll = () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 4);
    syncVideoWithScroll();
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  if (toggle && nav){
    const closeNav = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); document.body.style.overflow=''; };
    const openNav  = () => { nav.classList.add('open'); toggle.setAttribute('aria-expanded','true'); document.body.style.overflow='hidden'; };
    toggle.addEventListener('click', ()=> nav.classList.contains('open') ? closeNav() : openNav());
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeNav(); });
  }

  /*const io = new IntersectionObserver((entries)=>{
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      requestAnimationFrame(() => entry.target.classList.add('in-view'));
      io.unobserve(entry.target);
    }
  });
}, { rootMargin: '0px 0px -18% 0px', threshold: 0.05 });*/

  

  document.querySelectorAll('.reveal').forEach((el, idx) => {
    const delay = parseFloat(el.dataset.revealDelay) || Math.min(idx * 0.1, 0.4);
    el.style.transitionDelay = `${delay}s`;
    io.observe(el);
  });

  const lightbox = document.querySelector('.lightbox');
  if (lightbox){
    const lbImg = lightbox.querySelector('.lightbox-img');
    const lbClose = lightbox.querySelector('.lightbox-close');
    document.querySelectorAll('[data-lightbox] .gallery-item').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        const href = a.getAttribute('href') || a.querySelector('img')?.src;
        if (!href) return;
        lbImg.src = href;
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden','false');
      });
    });
    const close = ()=>{ lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden','true'); lbImg.src = ''; };
    lbClose.addEventListener('click', close);
    lightbox.addEventListener('click', (e)=>{ if(e.target === lightbox) close(); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); });
  }

  const filters = document.querySelector('[data-member-filters]');
  if (filters){
    const search = filters.querySelector('[data-search]') || filters.querySelector('input[type="search"]');
    const roleSel = filters.querySelector('[data-role]') || filters.querySelector('select');
    const sortSel = filters.querySelector('[data-sort]') || filters.querySelectorAll('select')[1];
    const grid = document.querySelector('.member-grid');
    const cards = Array.from(grid.querySelectorAll('.member-card'));
    function apply(){
      const q = (search.value || '').toLowerCase().trim();
      const role = roleSel.value || 'all';
      cards.forEach(card=>{
        const name = (card.dataset.name || '').toLowerCase();
        const roleVal = card.dataset.role || '';
        const matchQ = !q || name.includes(q) || roleVal.toLowerCase().includes(q);
        const matchR = role === 'all' || roleVal === role;
        card.style.display = (matchQ && matchR) ? '' : 'none';
      });
      const sort = (sortSel && sortSel.value) || 'name-asc';
      const visible = cards.filter(c => c.style.display !== 'none');
      visible.sort((a,b)=>{
        const an = (a.dataset.name || '').toLowerCase();
        const bn = (b.dataset.name || '').toLowerCase();
        return sort === 'name-desc' ? bn.localeCompare(an) : an.localeCompare(bn);
      });
      visible.forEach(c=>grid.appendChild(c));
    }
    [search, roleSel, sortSel].forEach(el=> el && el.addEventListener('input', apply));
    apply();
  }

  // Scroll-driven video
  let video, vSection, vDuration = 0;
  function initVideo(){
    video = document.getElementById('introVideo');
    if(!video) return;
    vSection = video.closest('[data-video-scrub]');
    const onMeta = ()=>{ vDuration = video.duration || 0; };
    video.addEventListener('loadedmetadata', onMeta, {once:true});
    const vio = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ video.play().catch(()=>{});} else { video.pause(); } });
    }, { threshold: 0.2 });
    vio.observe(video);
  }
  function syncVideoWithScroll(){
    if(!video || !vSection || !vDuration) return;
    const rect = vSection.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const prog = Math.min(1, Math.max(0, 1 - (rect.top / (rect.height - vh/2 || 1))));
    video.currentTime = prog * vDuration;
  }
  document.addEventListener('DOMContentLoaded', initVideo);
})();

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

  // Sticky header state
  const header = $('[data-header]');
  const headerHeight = () => header ? header.getBoundingClientRect().height : 0;
  const applyHeaderShadow = () => { if (header) header.classList.toggle('scrolled', window.scrollY > 4); };
  on(window, 'scroll', applyHeaderShadow, { passive: true });
  applyHeaderShadow();

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
  on(toggle, 'click', () => nav?.classList.contains('open') ? closeNav() : openNav());
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
        const href = a.getAttribute('href') || a.querySelector('img')?.src;
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
})();
