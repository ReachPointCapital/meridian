// A soft spotlight follows the cursor across whichever card it is over (src/modern.css reads --mx and --my).
// Purely decorative: skipped on touch screens and for people who ask for reduced motion.
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // "has the card fill and some border": the app's own hover handlers rewrite the inline border, so match loosely
  var CARD = '[style*="background-color: var(--bg-secondary)"][style*="border"], .hero-tile';
  var lit = null;

  function clear(el) {
    if (!el) return;
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
  }

  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var card = e.target && e.target.closest ? e.target.closest(CARD) : null;
    if (lit && lit !== card) clear(lit);
    lit = card;
    if (!card) return;
    var r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
})();
