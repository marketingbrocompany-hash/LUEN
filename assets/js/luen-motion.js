/* LUEN homepage editorial motion: progressive enhancement only. */
(() => {
  'use strict';
  if (!('IntersectionObserver' in window) || !window.matchMedia) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;

  /* Existing .sr section reveal already includes every heading.
     Never gate heading visibility on a second IntersectionObserver. */
  document.documentElement.classList.add('luen-motion-enhanced');

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
