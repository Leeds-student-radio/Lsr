/* Apple-style polish: scroll-edge material intensification.
   Purely additive — toggles one class, touches nothing else on the page,
   and never runs if the user has asked for reduced motion/transparency. */
(() => {
  const nav = document.querySelector('.nav-container');
  if (!nav) return;

  const reduceTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
  if (reduceTransparency) return;

  let ticking = false;
  const applyState = () => {
    nav.classList.toggle('nav-scrolled', window.scrollY > 8);
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(applyState);
      ticking = true;
    }
  }, { passive: true });

  applyState();
})();
