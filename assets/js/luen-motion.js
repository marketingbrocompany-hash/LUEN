/* LUEN homepage editorial motion: progressive enhancement only. */
(() => {
  'use strict';
  if (!('IntersectionObserver' in window) || !window.matchMedia) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;

  /* Existing .sr section reveal already includes every heading.
     Never gate heading visibility on a second IntersectionObserver. */
  document.documentElement.classList.add('luen-motion-enhanced');

  /* Mobile: a tall .sr grid reveals all of its cards at once, so cards below
     the fold arrive already static. Reveal each card as it reaches the
     viewport instead. Cards already on screen are revealed before the
     hidden state is switched on, so nothing flashes away. The case cards
     form a horizontal swipe rail on mobile, so the rail is observed as one
     trigger and its cards stagger in from the left (see luen-motion.css). */
  const stackedCards = [...document.querySelectorAll(
    '.luen-service-choice-grid.sr > .luen-service-choice,' +
    '.luen-flow-list-v2.sr > li'
  )];
  const caseRail = document.querySelector('.case-support-grid-v7.sr');
  const revealGroups = new Map(stackedCards.map(card => [card, [card]]));
  if (caseRail?.children.length) revealGroups.set(caseRail, [...caseRail.children]);
  if (revealGroups.size && window.matchMedia('(max-width:767px)').matches) {
    const reveal = trigger => revealGroups.get(trigger)?.forEach(card => card.classList.add('luen-motion-card-in'));
    const cardObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        cardObserver.unobserve(entry.target);
      });
    }, {threshold:0,rootMargin:'0px 0px -8% 0px'});
    revealGroups.forEach((_cards, trigger) => {
      if (trigger.getBoundingClientRect().top < window.innerHeight * .92) reveal(trigger);
      else cardObserver.observe(trigger);
    });
    window.addEventListener('beforeprint', () => revealGroups.forEach((_cards, trigger) => reveal(trigger)));
    document.documentElement.classList.add('luen-motion-mobile');
  }

  const media = document.querySelector('#case-herahera .case-content-media-v7 img');
  const frame = media?.parentElement;
  if (!media || !frame) return;
  const desktopPointer = window.matchMedia('(min-width:901px) and (hover:hover) and (pointer:fine)');
  if (!desktopPointer.matches) return;
  media.classList.add('luen-motion-parallax');

  let visible = false;
  let scheduled = false;
  const render = () => {
    scheduled = false;
    if (!visible || document.hidden || reduced.matches || !desktopPointer.matches) return;
    const rect = frame.getBoundingClientRect();
    const length = window.innerHeight + rect.height;
    const progress = Math.min(1,Math.max(0,(window.innerHeight-rect.top)/Math.max(1,length)));
    media.style.setProperty('--luen-motion-y',(((progress-.5)*18).toFixed(1))+'px');
  };
  const queueRender = () => {
    if (scheduled || !visible) return;
    scheduled = true;
    window.requestAnimationFrame(render);
  };
  const visibility = new IntersectionObserver(entries => {
    visible = Boolean(entries[0]?.isIntersecting);
    if (visible) queueRender();
  }, {threshold:0,rootMargin:'80px 0px'});
  visibility.observe(frame);
  window.addEventListener('scroll',queueRender,{passive:true});
  window.addEventListener('resize',queueRender,{passive:true});
  document.addEventListener('visibilitychange',queueRender);
})();
