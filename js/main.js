
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
          <a href="articles.html?id=${encodeURIComponent(a.id)}" class="card-link">
            <img src="${escapeHTML(imgSrc)}" alt="${escapeHTML(a.title)}">
            <div class="card-body">
              <h3 class="card-titles">${escapeHTML(a.title)}</h3>
              <p class="card-date"><time datetime="${escapeHTML(a.date)}">${dateStr}</time></p>
            </div>
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

// ── Safe-rendering helpers ────────────────────────────────────────────────
// Event/article text comes from the submission form, so never put it into
// innerHTML unescaped.
const ALLOWED_TAGS = ['Academic', 'Activity', 'Well-being', 'Announcement'];

function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// The form can submit several tags ("Academic, Activity"); return the valid ones.
function getTags(event) {
    const tags = String((event && event.tags) || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => ALLOWED_TAGS.includes(t));
    return tags.length ? tags : ['Announcement'];
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

const tagColors = {
    'Academic': '#37beb0',
    'Activity': '#ff4d4d',
    'Well-being': '#ff85b4',
    'Announcement': '#a694fb'
};

// Touch / small screens have no hover, so tapping an event opens a bottom sheet instead
const isMobileCalendar = () => window.matchMedia('(hover: none), (max-width: 768px)').matches;

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
                    const eventTags = getTags(event);
                    const cleanTag = eventTags[0];
                    
                    if (currentFilter === 'All' || eventTags.includes(currentFilter)) {
                        const eventDiv = document.createElement('a');
                        eventDiv.className = 'event';
                        eventDiv.href = 'read.html?id=' + encodeURIComponent(event.id);
                        
                        eventDiv.style.backgroundColor = tagColors[cleanTag] || tagColors['Announcement'];
                        eventDiv.style.color = '#ffffff'; 
                        
                        eventDiv.textContent = event.title;
                        eventDiv.dataset.eventId = event.id;
                        dayDiv.appendChild(eventDiv);
                    }
                }
            });
        }
        grid.appendChild(dayDiv);
        j++;
    }
}

// Hover pop-up: shows title, tags, author and date/time at the top-right of the cursor
const calendarGrid = document.getElementById('calendar-grid');
if (calendarGrid) {
    const tooltip = document.createElement('div');
    tooltip.className = 'event-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);

    const OFFSET = 14;

    function positionTooltip(x, y) {
        const w = tooltip.offsetWidth;
        const h = tooltip.offsetHeight;
        let left = x + OFFSET;
        let top = y - h - OFFSET;
        // Flip to the other side if it would run off the viewport
        if (left + w > window.innerWidth - 8) left = x - w - OFFSET;
        if (top < 8) top = y + OFFSET;
        tooltip.style.left = Math.max(8, left) + 'px';
        tooltip.style.top = Math.max(8, top) + 'px';
    }

    calendarGrid.addEventListener('mouseover', (e) => {
        if (isMobileCalendar()) return;
        const target = e.target.closest('.event');
        if (!target) return;
        const event = globalEvents.find(ev => String(ev.id) === target.dataset.eventId);
        if (!event) return;

        const tagsHtml = String(event.tags || 'Announcement').split(',')
            .map(t => t.trim()).filter(t => ALLOWED_TAGS.includes(t))
            .map(t => `<span class="tag tag-${t.toLowerCase()}">${escapeHTML(t)}</span>`).join('');
        const when = [event.date, event.time].filter(Boolean).join(', ');

        tooltip.innerHTML = `
            <div class="event-tooltip-title">${escapeHTML(event.title)}</div>
            <div class="event-tooltip-meta">
                ${tagsHtml}
                ${event.author ? `<span class="event-tooltip-author">By ${escapeHTML(event.author)}</span>` : ''}
                <span class="event-tooltip-date">${escapeHTML(when)}</span>
            </div>`;
        tooltip.classList.add('visible');
        positionTooltip(e.clientX, e.clientY);
    });

    calendarGrid.addEventListener('mousemove', (e) => {
        if (tooltip.classList.contains('visible')) positionTooltip(e.clientX, e.clientY);
    });

    calendarGrid.addEventListener('mouseout', (e) => {
        const from = e.target.closest('.event');
        if (from && !from.contains(e.relatedTarget)) tooltip.classList.remove('visible');
    });

    // Mobile bottom sheet (Google Calendar style): tap an event to see its details
    const sheetOverlay = document.createElement('div');
    sheetOverlay.className = 'event-sheet-overlay';
    sheetOverlay.innerHTML = `
        <div class="event-sheet" role="dialog" aria-modal="true" aria-labelledby="event-sheet-title">
            <div class="event-sheet-handle"></div>
            <button type="button" class="event-sheet-close" aria-label="Close">&times;</button>
            <div class="event-sheet-body"></div>
        </div>`;
    document.body.appendChild(sheetOverlay);
    const sheetBody = sheetOverlay.querySelector('.event-sheet-body');

    function openEventSheet(event) {
        const tags = getTags(event);
        const color = tagColors[tags[0]] || tagColors['Announcement'];
        const tagsHtml = tags.map(t => `<span class="tag tag-${t.toLowerCase()}">${escapeHTML(t)}</span>`).join('');
        const d = new Date(event.date);
        const dateText = isNaN(d) ? event.date : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const when = [dateText, event.time].filter(Boolean).join(' · ');

        sheetBody.innerHTML = `
            <div class="event-sheet-head">
                <span class="event-sheet-dot" style="background:${color}"></span>
                <h3 class="event-sheet-title" id="event-sheet-title">${escapeHTML(event.title)}</h3>
            </div>
            <p class="event-sheet-row event-sheet-when">${escapeHTML(when)}</p>
            ${event.author ? `<p class="event-sheet-row">By ${escapeHTML(event.author)}</p>` : ''}
            <div class="event-sheet-tags">${tagsHtml}</div>
            <a class="event-sheet-link" href="read.html?id=${encodeURIComponent(event.id)}">Read article</a>`;
        sheetOverlay.classList.add('open');
        document.body.classList.add('event-sheet-open');
    }

    function closeEventSheet() {
        sheetOverlay.classList.remove('open');
        document.body.classList.remove('event-sheet-open');
    }

    calendarGrid.addEventListener('click', (e) => {
        const target = e.target.closest('.event');
        if (!target || !isMobileCalendar()) return; // desktop: the link opens the article
        const event = globalEvents.find(ev => String(ev.id) === target.dataset.eventId);
        if (!event) return;
        e.preventDefault();
        openEventSheet(event);
    });

    sheetOverlay.addEventListener('click', (e) => {
        if (e.target === sheetOverlay || e.target.closest('.event-sheet-close')) closeEventSheet();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeEventSheet();
    });
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

const prevMonthBtn = document.getElementById('prev-month');
if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }
    renderCalendar(currentMonth, currentYear);
});

const nextMonthBtn = document.getElementById('next-month');
if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    }
    renderCalendar(currentMonth, currentYear);
});

// ==========================================
// EVENTS FROM _data/*.md (single source for calendar + upcoming list)
// ==========================================
// Each .md front-matter carries the event info, e.g.
//   date: 10/04/2026T09:00 - 17:00:00.000Z   (MM/DD/YYYY, then start - end time)
//   title: "..."
//   tags: ["Activity", "Announcement"]
const EVENTS_DATA_FOLDER = '_data';
let markdownEventsPromise = null;

function parseEventMarkdown(mdText, id) {
    const fmMatch = mdText.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];

    const field = (name) => {
        const m = fm.match(new RegExp('^' + name + ':\\s*"?(.*?)"?\\s*$', 'm'));
        return m ? m[1].trim() : '';
    };
    const pad = (n) => String(n).padStart(2, '0');

    // Date -> normalised "MM/DD/YYYY" (what the calendar and sortEvents expect)
    const rawDate = field('date');
    let date = '';
    const us = rawDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const iso = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (us) date = `${pad(us[1])}/${pad(us[2])}/${us[3]}`;
    else if (iso) date = `${iso[2]}/${iso[3]}/${iso[1]}`;
    if (!date) return null; // no usable date -> can't be placed on the calendar

    // Time -> "HH:MM - HH:MM" (zero-padded so string comparison sorts correctly)
    const times = (rawDate.match(/\d{1,2}:\d{2}/g) || []).map(t => t.padStart(5, '0'));
    const time = times.length >= 2 ? `${times[0]} - ${times[1]}` : (times[0] || '');

    const tagsMatch = fm.match(/^tags:\s*\[(.*?)\]/m);
    const tags = tagsMatch
        ? tagsMatch[1].split(',').map(t => t.replace(/["']/g, '').trim()).filter(Boolean).join(', ')
        : '';

    return { id, title: field('title') || 'Untitled', author: field('author'), date, time, tags };
}

// Fetch 2.md, 3.md, ... until a file is missing; resolve to events sorted by date, then time
function loadMarkdownEvents() {
    if (!markdownEventsPromise) {
        markdownEventsPromise = (async () => {
            const events = [];
            for (let id = 2; ; id++) {
                try {
                    const res = await fetch(`${EVENTS_DATA_FOLDER}/${id}.md`);
                    if (!res.ok) break;
                    const event = parseEventMarkdown(await res.text(), id);
                    if (event) events.push(event);
                } catch (error) {
                    console.error('Error loading event ' + id + ':', error);
                    break;
                }
            }
            return sortEvents(events);
        })();
    }
    return markdownEventsPromise;
}

function getIconSVG(tag) {
    switch (tag) {
        case 'Academic':
            return `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;
        case 'Activity':
            return `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        case 'Well-being':
            return `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        default: // Announcement
            return `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
    }
}

// When the event finishes: its end time on its date, or the end of that day if no time is given
function getEventEnd(ev) {
    const end = new Date(ev.date);
    const times = String(ev.time || '').match(/\d{1,2}:\d{2}/g);
    if (times) {
        const [h, m] = times[times.length - 1].split(':').map(Number);
        end.setHours(h, m, 0, 0);
    } else {
        end.setHours(23, 59, 59, 999);
    }
    return end;
}

// Upcoming events list: next 3 upcoming, or the 3 most recent expired ones if none are upcoming
function renderUpcomingEvents(eventsData) {
    const list = document.getElementById('upcoming-list');
    if (!list) return;

    // An event stays "upcoming" until its end time passes (end of day if it has no time)
    const now = new Date();
    const upcoming = eventsData.filter(ev => getEventEnd(ev) > now);
    const eventsToShow = upcoming.length > 0
        ? upcoming.slice(0, 3)
        : eventsData.slice(-3).reverse(); // eventsData is ascending, so this is newest-first

    if (eventsToShow.length === 0) {
        list.innerHTML = "<p style='color: #666;'>No events scheduled.</p>";
        return;
    }

    list.innerHTML = eventsToShow.map(ev => {
        const theme = getTags(ev)[0];
        const when = [formatEventDate(ev.date), ev.time].filter(Boolean).join(' | ');
        return `
            <a href="read.html?id=${ev.id}" class="event-card theme-${theme}">
                <div class="event-icon-wrapper icon-${theme}">
                    ${getIconSVG(theme)}
                </div>
                <div class="event-details">
                    <h3 class="event-name">${escapeHTML(ev.title)}</h3>
                    <p class="event-time">${escapeHTML(when)}</p>
                </div>
            </a>`;
    }).join('');
}

if (document.getElementById('calendar-grid') || document.getElementById('upcoming-list')) {
    loadMarkdownEvents()
        .then(events => {
            initCalendar(events);
            renderUpcomingEvents(events);
        })
        .catch(error => console.error('Error loading events:', error));
}
