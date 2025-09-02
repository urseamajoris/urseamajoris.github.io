// RAMSC Starter Site — main.js
(function(){
  const header = document.querySelector('[data-header]');
  const nav = document.getElementById('site-nav');
  const toggle = document.querySelector('.nav-toggle');
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Sticky header shadow on scroll
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 4);
    syncVideoWithScroll();
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  // Mobile nav
  if (toggle && nav){
    const closeNav = () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
      document.body.style.overflow='';
    };
    const openNav = () => {
      nav.classList.add('open');
      toggle.setAttribute('aria-expanded','true');
      document.body.style.overflow='hidden';
    };
    toggle.addEventListener('click', ()=>{
      const isOpen = nav.classList.contains('open');
      isOpen ? closeNav() : openNav();
    });
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape') closeNav();
    });
  }

  // Reveal on scroll
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  // Lightbox (About page)
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
    const close = ()=>{
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden','true');
      lbImg.src = '';
    };
    lbClose.addEventListener('click', close);
    lightbox.addEventListener('click', (e)=>{ if(e.target === lightbox) close(); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); });
  }

  // Members filters
  const filters = document.querySelector('[data-member-filters]');
  if (filters){
    const search = filters.querySelector('[data-search]');
    const roleSel = filters.querySelector('[data-role]');
    const sortSel = filters.querySelector('[data-sort]');
    const grid = document.querySelector('.member-grid');
    const cards = Array.from(grid.querySelectorAll('.member-card'));

    function apply(){
      const q = (search.value || '').toLowerCase().trim();
      const role = roleSel.value;
      // Filter
      cards.forEach(card=>{
        const name = card.dataset.name.toLowerCase();
        const roleVal = card.dataset.role;
        const matchQ = !q || name.includes(q) || roleVal.toLowerCase().includes(q);
        const matchR = role === 'all' || roleVal === role;
        card.style.display = (matchQ && matchR) ? '' : 'none';
      });
      // Sort
      const sort = sortSel.value;
      const visible = cards.filter(c => c.style.display !== 'none');
      visible.sort((a,b)=>{
        const an = a.dataset.name.toLowerCase();
        const bn = b.dataset.name.toLowerCase();
        return sort === 'name-desc' ? bn.localeCompare(an) : an.localeCompare(bn);
      });
      visible.forEach(c=>grid.appendChild(c));
    }
    [search, roleSel, sortSel].forEach(el=> el.addEventListener('input', apply));
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

    // Play/pause when in view
    const vio = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(!video) return;
        if(e.isIntersecting){
          // Try to play muted inline
          video.play().catch(()=>{/* ignore autoplay restrictions */});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.2 });
    vio.observe(video);
  }

  function syncVideoWithScroll(){
    if(!video || !vSection || !vDuration) return;
    // Tie currentTime to scroll progress within the section
    const rect = vSection.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const start = Math.max(0, 1 - (rect.top + rect.height)/vh);
    const end = Math.min(1, (vh - rect.top)/vh);
    const progress = Math.max(0, Math.min(1, (start + end) / 2)); // approximate
    video.currentTime = progress * vDuration;
  }

  document.addEventListener('DOMContentLoaded', initVideo);
})();
