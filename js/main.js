
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

// Event sorting function
function sortEvents(eventsData) {
    return eventsData.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        
        if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
        }
        
        const timeA = a.time.split('-')[0].trim();
        const timeB = b.time.split('-')[0].trim();
        
        if (timeA < timeB) return -1;
        if (timeA > timeB) return 1;
        return 0;
    });
}

function formatEventDate(dateString) {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    if (!isNaN(dateObj)) {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    }
    return dateString;
}

function sortEvents(eventsData) {
    return eventsData.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        
        if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
        }
        
        // Add fallback for missing time property
        const timeA = (a.time || '00:00').split('-')[0].trim();
        const timeB = (b.time || '00:00').split('-')[0].trim();
        
        if (timeA < timeB) return -1;
        if (timeA > timeB) return 1;
        return 0;
    });
}

// Upcoming events rendering
function renderUpcomingEvents(eventsData) {
    const list = document.getElementById('upcoming-list');
    if (!list) return;
    list.innerHTML = '';

    const icons = {
        'Academic': '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/><line x1="2" y1="22" x2="22" y2="22"/></svg>',
        'Activity': '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><circle cx="12" cy="12" r="3"/></svg>',
        'Well-being': '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
        'Announcement': '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>'
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureEvents = eventsData.filter(event => {
        return new Date(event.date) >= today;
    });

    futureEvents.slice(0, 3).forEach((event) => {
        const card = document.createElement('div');
        const formattedDate = formatEventDate(event.date); 
        
        // Ensure a valid tag string exists
        const safeTag = (event.tags || 'Announcement').trim();
        const iconSvg = icons[safeTag] || icons['Announcement'];
        const safeTime = event.time || 'TBA';
        
        card.className = 'event-card theme-' + safeTag;
        
        card.innerHTML = `<div class="event-icon-wrapper icon-${safeTag}">${iconSvg}</div>
                          <div class="event-details">
                              <h4 class="event-name">${event.title}</h4>
                              <p class="event-time">${formattedDate} | ${safeTime}</p>
                          </div>`;
        
        list.appendChild(card);
    });
}

// Format event date to "DD MMM YYYY"
let currentDate = new Date();
let currentMonth = currentDate.getMonth() + 1;
let currentYear = currentDate.getFullYear();
let globalEvents = [];
let currentFilter = 'All';

function initCalendar(eventsData) {
    globalEvents = eventsData;
    renderCalendar(currentMonth, currentYear);
}

// Render calendar for a given month and year
function renderCalendar(month, year) {
    const grid = document.getElementById('calendar-grid');
    const headerDisplay = document.getElementById('month-year-display');
    if (!grid || !headerDisplay) return;

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    headerDisplay.textContent = months[month - 1] + ' ' + year;

    const daysInMonth = new Date(year, month, 0).getDate();
    const startDay = new Date(year, month - 1, 1).getDay();

    grid.innerHTML = '';

    let i = 0;
    while (i < startDay) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day empty-day';
        grid.appendChild(emptyDiv);
        i++;
    }

    const tagColors = {
        'Academic': '#37beb0',
        'Activity': '#ff4d4d',
        'Well-being': '#ff85b4',
        'Announcement': '#a694fb'
    };

    let j = 1;
    while (j <= daysInMonth) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';

        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.textContent = j;
        dayDiv.appendChild(dayNum);

        if (globalEvents && Array.isArray(globalEvents)) {
            globalEvents.forEach(event => {
                if (!event.date) return;
                
                const parts = event.date.split('/');
                if (parts.length !== 3) return;
                
                const m = parseInt(parts[0].trim(), 10);
                const d = parseInt(parts[1].trim(), 10);
                const y = parseInt(parts[2].trim(), 10);

                if (d === j && m === month && y === year) {
                    const cleanTag = (event.tags || 'Announcement').trim();
                    
                    if (currentFilter === 'All' || cleanTag === currentFilter) {
                        const eventDiv = document.createElement('div');
                        eventDiv.className = 'event';
                        
                        eventDiv.style.backgroundColor = tagColors[cleanTag] || tagColors['Announcement'];
                        eventDiv.style.color = '#ffffff'; 
                        
                        eventDiv.textContent = event.title;
                        dayDiv.appendChild(eventDiv);
                    }
                }
            });
        }
        grid.appendChild(dayDiv);
        j++;
    }
}

const filterBtns = document.querySelectorAll('.filter-btn');
if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-tag');
            renderCalendar(currentMonth, currentYear);
        });
    });
}

document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }
    renderCalendar(currentMonth, currentYear);
});

document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    }
    renderCalendar(currentMonth, currentYear);
});

// Fetch events data from GitHub
const githubUrl = 'https://raw.githubusercontent.com/Abhi-Ya/RAMSC/main/events.json?t=' + new Date().getTime();

fetch(githubUrl)
    .then(response => response.json())
    .then(data => {
        const sortedData = sortEvents(data);
        initCalendar(sortedData);
        renderUpcomingEvents(sortedData);
    })
    .catch(error => console.error("Error loading events:", error));