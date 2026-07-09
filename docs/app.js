/* ============================================
   CABIN WEBSITE — app.js
   ============================================ */

// ---- Navbar scroll effect ----
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ---- Hamburger menu ----
const hamburger = document.getElementById('hamburger');
hamburger?.addEventListener('click', () => {
  navbar.classList.toggle('menu-open');
});
document.addEventListener('click', (e) => {
  if (!navbar.contains(e.target)) navbar.classList.remove('menu-open');
});

// ---- Particle Canvas ----
(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], raf;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  function rand(min, max) { return Math.random() * (max - min) + min; }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = rand(0, W);
      this.y = rand(0, H);
      this.r = rand(0.5, 2);
      this.vx = rand(-0.15, 0.15);
      this.vy = rand(-0.1, -0.3);
      this.alpha = rand(0.1, 0.5);
      this.color = Math.random() > 0.6 ? '#2d9e6b' : '#8892a4';
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= 0.0008;
      if (this.y < -10 || this.alpha <= 0) this.reset();
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < 80; i++) particles.push(new Particle());

  // Draw connection lines between close particles
  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const alpha = (1 - dist / 120) * 0.08;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#2d9e6b';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    raf = requestAnimationFrame(loop);
  }
  loop();
})();

// ---- Intersection Observer for scroll animations ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      const delay = parseInt(entry.target.dataset.delay || 0);
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, delay);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.feature-card, .download-card, .hiw-step').forEach(el => {
  observer.observe(el);
});

// ---- Ticker counter animation ----
const tickerNums = document.querySelectorAll('.ticker-num');
let tickerAnimated = false;
const tickerObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !tickerAnimated) {
    tickerAnimated = true;
    tickerNums.forEach(el => {
      const target = parseInt(el.dataset.target);
      if (target === 0) { el.textContent = '0'; return; }
      let current = 0;
      const step = target / 60;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = Math.floor(current).toLocaleString();
        if (current >= target) clearInterval(timer);
      }, 16);
    });
  }
}, { threshold: 0.5 });
const tickerWrapper = document.querySelector('.stats-ticker-wrapper');
if (tickerWrapper) tickerObserver.observe(tickerWrapper);

// ---- Screenshots carousel ----
let currentSlide = 0;
const slides = document.querySelectorAll('.sc-slide');
const dotBtns = document.querySelectorAll('.sc-dot-btn');

function goToSlide(idx) {
  slides[currentSlide].classList.remove('active');
  dotBtns[currentSlide].classList.remove('active');
  currentSlide = (idx + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  dotBtns[currentSlide].classList.add('active');
}

document.getElementById('sc-prev')?.addEventListener('click', () => goToSlide(currentSlide - 1));
document.getElementById('sc-next')?.addEventListener('click', () => goToSlide(currentSlide + 1));
dotBtns.forEach(btn => {
  btn.addEventListener('click', () => goToSlide(parseInt(btn.dataset.idx)));
});

// Auto-advance carousel every 4s
let carouselTimer = setInterval(() => goToSlide(currentSlide + 1), 4000);
document.querySelector('.screenshots-carousel')?.addEventListener('mouseenter', () => clearInterval(carouselTimer));
document.querySelector('.screenshots-carousel')?.addEventListener('mouseleave', () => {
  carouselTimer = setInterval(() => goToSlide(currentSlide + 1), 4000);
});

// ---- Keyboard carousel ----
document.addEventListener('keydown', (e) => {
  const sc = document.getElementById('screenshots');
  if (!sc) return;
  const rect = sc.getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0) {
    if (e.key === 'ArrowLeft') goToSlide(currentSlide - 1);
    if (e.key === 'ArrowRight') goToSlide(currentSlide + 1);
  }
});

// ---- Platform detection — highlight relevant download ----
(function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  let platform = 'mac';
  if (ua.includes('win')) platform = 'windows';
  else if (ua.includes('linux')) platform = 'linux';

  const macCard = document.getElementById('dl-mac');
  const winCard = document.getElementById('dl-windows');
  const linuxCard = document.getElementById('dl-linux');

  // Reset highlight
  [macCard, winCard, linuxCard].forEach(c => c?.classList.remove('platform-mac'));

  if (platform === 'windows') {
    winCard?.classList.add('platform-mac');
    // Swap primary btn style
    winCard?.querySelector('a')?.classList.replace('btn-outline', 'btn-primary');
    macCard?.querySelector('a')?.classList.replace('btn-primary', 'btn-outline');
  } else if (platform === 'linux') {
    linuxCard?.classList.add('platform-mac');
    linuxCard?.querySelector('a')?.classList.replace('btn-outline', 'btn-primary');
    macCard?.querySelector('a')?.classList.replace('btn-primary', 'btn-outline');
  }

  // Also update hero download button text
  const heroBtn = document.getElementById('hero-download-btn');
  if (heroBtn) {
    if (platform === 'windows') heroBtn.innerHTML = heroBtn.innerHTML.replace('macOS', 'Windows');
    else if (platform === 'linux') heroBtn.innerHTML = heroBtn.innerHTML.replace('macOS', 'Linux');
  }
})();

// ---- GSAP animations (if loaded) ----
window.addEventListener('load', () => {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  // Hero title stagger
  gsap.from('.hero-badge', { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out', delay: 0.2 });
  gsap.from('.hero-title', { opacity: 0, y: 40, duration: 0.9, ease: 'power3.out', delay: 0.4 });
  gsap.from('.hero-subtitle', { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out', delay: 0.6 });
  gsap.from('.hero-cta', { opacity: 0, y: 20, duration: 0.7, ease: 'power3.out', delay: 0.8 });
  gsap.from('.hero-meta', { opacity: 0, y: 20, duration: 0.7, ease: 'power3.out', delay: 1.0 });
  gsap.from('.hero-mockup-wrapper', { opacity: 0, y: 60, duration: 1.2, ease: 'power3.out', delay: 1.1 });

  // Floating cards
  gsap.from('.floating-card', {
    opacity: 0, scale: 0.8, duration: 0.8, ease: 'back.out(1.7)',
    stagger: 0.2, delay: 1.5
  });

  // Section titles on scroll
  gsap.utils.toArray('.section-title').forEach(el => {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 85%' },
      opacity: 0, y: 40, duration: 0.8, ease: 'power3.out'
    });
  });

  // OSS card
  gsap.from('.oss-card', {
    scrollTrigger: { trigger: '.oss-card', start: 'top 80%' },
    opacity: 0, y: 50, scale: 0.97, duration: 0.9, ease: 'power3.out'
  });
});

// ---- Smooth anchor scrolling ----
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    navbar.classList.remove('menu-open');
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
