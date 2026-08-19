(()=>{
  /* GA4 CTA attribution: enrich the existing site-core cta_click event without sending personal data. */
  const ctaSelector='a.btn[href^="#"], a.nav-contact[href^="#"], a.case-inquiry-btn[href^="#"], a.faq-cta[href^="#"], a.float-cta[href^="#"]';
  const getCtaPosition=link=>{
    if(link.classList.contains('float-cta')) return 'floating';
    if(link.closest('.mobile-menu')) return 'mobile_menu';
    if(link.closest('.hero')) return 'hero';
    if(link.closest('nav')) return 'nav';
    if(link.closest('.case-studies')) return 'case';
    if(link.closest('.faq')) return 'faq';
    if(link.closest('.final-scene')) return 'final';
    return 'other';
  };
  document.addEventListener('click',event=>{
    const link=event.target?.closest?.(ctaSelector);
    if(!link) return;
    const context={
      position:getCtaPosition(link),
      label:(link.dataset.analyticsLabel||link.getAttribute('aria-label')||link.textContent||'CTA').replace(/\s+/g,' ').trim().slice(0,80)
    };
    window.__luenLastCtaContext=context;
    queueMicrotask(()=>{if(window.__luenLastCtaContext===context) window.__luenLastCtaContext=null;});
  },true);
  if(typeof window.gtag==='function'&&!window.gtag.__luenCtaPositionEnhanced){
    const originalGtag=window.gtag;
    const enhancedGtag=function(...args){
      if(args[0]==='event'&&args[1]==='cta_click'){
        const context=window.__luenLastCtaContext;
        if(context) args[2]={...(args[2]||{}),cta_label:context.label,cta_position:context.position};
      }
      return originalGtag.apply(this,args);
    };
    enhancedGtag.__luenCtaPositionEnhanced=true;
    window.gtag=enhancedGtag;
  }

  /* Hero creator network visual. Styling lives in assets/css/site-current.css. */
  const old=document.querySelector('.luen-hero-network');
  if(old){
    old.outerHTML=`<div class="creator-network-showcase" aria-label="LUEN 크리에이터 네트워크">
      <div class="creator-network-head"><span>CREATOR NETWORK</span><strong>KOREA × JAPAN</strong><p>YOUTUBE CREATOR PROFILE</p></div>
      <div class="creator-profile-viewport" aria-label="크리에이터 프로필 슬라이드">
        <div class="creator-profile-track"><div class="creator-profile-set">
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-extra-v2-03.webp" alt="LUEN 크리에이터 프로필 1" decoding="sync" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-profile-02.webp" alt="LUEN 크리에이터 프로필 2" decoding="sync" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-extra-v2-01.webp" alt="LUEN 크리에이터 프로필 3" decoding="sync" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-profile-01.webp" alt="LUEN 크리에이터 프로필 4" decoding="sync" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-extra-v2-04.webp" alt="LUEN 크리에이터 프로필 5" decoding="sync" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-profile-03.webp" alt="LUEN 크리에이터 프로필 6" decoding="sync" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-extra-v2-02.webp" alt="LUEN 크리에이터 프로필 7" decoding="sync" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
        </div></div>
      </div>
      <div class="creator-network-foot" aria-hidden="true"><span>YOUTUBE</span><i></i><span>INSTAGRAM</span><i></i><span>KOREA</span><i></i><span>JAPAN</span></div>
    </div>`;
  }

  const viewport=document.querySelector('.creator-profile-viewport');
  const track=viewport?.querySelector('.creator-profile-track');
  const source=viewport?.querySelector('.creator-profile-set');
  if(viewport&&track&&source){
    const clone=source.cloneNode(true);
    clone.setAttribute('aria-hidden','true');
    track.appendChild(clone);

    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let offset=0,last=performance.now(),baseWidth=source.getBoundingClientRect().width,raf=0,visible=true;
    const stop=()=>{if(raf){cancelAnimationFrame(raf);raf=0;}};
    const tick=now=>{
      raf=0;
      if(!visible||document.hidden||reducedMotion.matches)return;
      const dt=Math.min(.05,(now-last)/1000);last=now;
      if(baseWidth>0){offset=(offset+60*dt)%baseWidth;track.style.transform=`translate3d(${-offset}px,0,0)`;}
      raf=requestAnimationFrame(tick);
    };
    const start=()=>{
      if(raf||!visible||document.hidden||reducedMotion.matches)return;
      last=performance.now();
      raf=requestAnimationFrame(tick);
    };
    const sync=()=>{
      if(reducedMotion.matches){stop();track.style.transform='none';return;}
      if(document.hidden||!visible)stop();else start();
    };

    new ResizeObserver(()=>{baseWidth=source.getBoundingClientRect().width||baseWidth}).observe(viewport);
    if('IntersectionObserver' in window){
      new IntersectionObserver(entries=>{
        visible=Boolean(entries[0]?.isIntersecting);
        sync();
      },{rootMargin:'160px 0px',threshold:0}).observe(viewport);
    }
    document.addEventListener('visibilitychange',sync);
    reducedMotion.addEventListener?.('change',sync);
    sync();
  }

  const portfolioLoops=[...document.querySelectorAll('.portfolio-viewport[data-loop-strip]')];
  if(portfolioLoops[0]) portfolioLoops[0].dataset.speed='70';
  if(portfolioLoops[1]) portfolioLoops[1].dataset.speed='84';

  const core=document.createElement('script');
  core.src='assets/js/site-core.js?v=20260819m';
  document.body.appendChild(core);
})();
