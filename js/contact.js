document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Mobile Menu Toggle Logic
    const navToggle = document.querySelector('.nav-toggle');
    const siteNav = document.getElementById('site-nav');

    if (navToggle && siteNav) {
        navToggle.addEventListener('click', () => {
            // Check if menu is currently open
            const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
            
            // Toggle the aria-expanded attribute for accessibility
            navToggle.setAttribute('aria-expanded', !isExpanded);
            
            // Toggle an 'active' class on the nav to show/hide it via CSS
            siteNav.classList.toggle('active');
            navToggle.classList.toggle('active');
        });
    }

    // 2. Automatic Footer Year Update
    const yearElement = document.querySelector('[data-year]');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // Note: The FAQ <details> and <summary> tags work natively in HTML5 
    // and do not require JavaScript!
});