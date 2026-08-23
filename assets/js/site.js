(()=>{
  /* Runtime-only behavior. Final visual/content DOM is already present in index.html. */
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

  const lightLoopControllers=new Map();
  const stopLightLoop=viewport=>{
    const controller=lightLoopControllers.get(viewport);
    if(!controller?.raf)return;
    cancelAnimationFrame(controller.raf);
    controller.raf=0;
  };
  const startLightLoop=viewport=>{
    const controller=lightLoopControllers.get(viewport);
    if(!controller||controller.raf||!controller.visible||document.hidden||reducedMotion.matches)return;
    controller.last=performance.now();
    controller.raf=requestAnimationFrame(controller.tick);
  };
  const setupIOSLightLoop=viewport=>{
    const track=viewport.querySelector('.loop-track');
    const source=viewport.querySelector('.loop-set:not(.ios-loop-clone)');
    if(!track||!source)return;

    const previous=lightLoopControllers.get(viewport);
    previous?.observer?.disconnect();
    stopLightLoop(viewport);
    track.querySelectorAll('.ios-loop-clone').forEach(el=>el.remove());
    track.style.transform='translate3d(0,0,0)';

    const baseWidth=source.getBoundingClientRect().width;
    if(!baseWidth)return;
    const copies=Math.max(1,Math.ceil(viewport.clientWidth/baseWidth));
    for(let i=0;i<copies;i++){
      const clone=source.cloneNode(true);
      clone.classList.add('loop-clone','ios-loop-clone');
      clone.setAttribute('aria-hidden','true');
      track.appendChild(clone);
    }
    if(reducedMotion.matches)return;

    const rawSpeed=Math.max(10,Number(viewport.dataset.iosLoopSpeed||viewport.dataset.speed||45));
    const controller={
      raf:0,
      visible:true,
      offset:0,
      last:performance.now(),
      speed:Math.max(14,Math.min(42,rawSpeed*.55)),
      baseWidth,
      track,
      observer:null,
      tick:null
    };
    controller.tick=now=>{
      controller.raf=0;
      if(!controller.visible||document.hidden||reducedMotion.matches)return;
      const elapsed=now-controller.last;
      if(elapsed<33){controller.raf=requestAnimationFrame(controller.tick);return;}
      const dt=Math.min(.07,elapsed/1000);
      controller.last=now;
      controller.offset=(controller.offset+controller.speed*dt)%controller.baseWidth;
      controller.track.style.transform=`translate3d(${-controller.offset}px,0,0)`;
      controller.raf=requestAnimationFrame(controller.tick);
    };
    if('IntersectionObserver' in window){
      controller.observer=new IntersectionObserver(entries=>{
        controller.visible=Boolean(entries[0]?.isIntersecting);
        if(controller.visible)startLightLoop(viewport);else stopLightLoop(viewport);
      },{rootMargin:'120px 0px',threshold:0});
      controller.observer.observe(viewport);
    }
    lightLoopControllers.set(viewport,controller);
    startLightLoop(viewport);
  };

  let iosLoopStrips=[];
  if(isIOS){
    document.documentElement.classList.add('ios-safari','ios-light-loops');
    iosLoopStrips=[...document.querySelectorAll('[data-loop-strip]')];
    iosLoopStrips.forEach(el=>{
      el.dataset.iosLoopSpeed=el.dataset.speed||'';
      el.removeAttribute('data-loop-strip');
    });
    /* Decorative SVG motion remains disabled on iOS to preserve Safari GPU headroom. */
    document.querySelectorAll('animateMotion, animate').forEach(el=>el.remove());
    const initIOSLoops=()=>requestAnimationFrame(()=>iosLoopStrips.forEach(setupIOSLightLoop));
    window.addEventListener('load',initIOSLoops,{once:true});
    let lastWidth=document.documentElement.clientWidth;
    window.addEventListener('resize',()=>{
      const nextWidth=document.documentElement.clientWidth;
      if(Math.abs(nextWidth-lastWidth)<2)return;
      lastWidth=nextWidth;
      clearTimeout(window.__luenIOSLoopResize);
      window.__luenIOSLoopResize=setTimeout(initIOSLoops,220);
    },{passive:true});
    document.addEventListener('visibilitychange',()=>{
      lightLoopControllers.forEach((_controller,viewport)=>{
        if(document.hidden)stopLightLoop(viewport);else startLightLoop(viewport);
      });
    });
    reducedMotion.addEventListener?.('change',()=>{
      iosLoopStrips.forEach(viewport=>{
        if(reducedMotion.matches)stopLightLoop(viewport);else setupIOSLightLoop(viewport);
      });
    });
  }

  /* CROSS-BORDER PLATFORM MIX · platform cards live before Case Studies. */
  const identitySection=document.querySelector('.identity-platform-section');
  const identityShell=identitySection?.querySelector('.identity-platform-shell');
  const identityTop=identitySection?.querySelector('.identity-top');
  const identitySignature=identitySection?.querySelector('.identity-signature');
  const platformNetwork=identitySection?.querySelector('#platforms');
  const caseStudies=document.querySelector('#cases');
  if(identitySection&&identityShell&&identityTop&&identitySignature&&platformNetwork&&caseStudies){
    identityTop.innerHTML=`
      <div class="eyebrow">Cross-border Advantage</div>
      <div class="luen-advantage-heading">
        <h2 class="section-title">한국과 일본 양쪽 시장을 이해하는<br/><em>Cross-border Creator Marketing Partner</em></h2>
        <p>YouTube부터 Instagram, TikTok, X, Ameba Blog까지 시장과 목적에 맞는 플랫폼을 연결합니다.</p>
      </div>`;

    identitySection.querySelector('.luen-advantage-grid')?.remove();
    const advantageGrid=document.createElement('div');
    advantageGrid.id='platforms';
    advantageGrid.className='luen-advantage-grid sr d1';
    advantageGrid.innerHTML=`
      <article><span>01</span><b>YouTube</b><p>이해 · 신뢰</p></article>
      <article><span>02</span><b>Instagram</b><p>발견 · 경험</p></article>
      <article><span>03</span><b>TikTok</b><p>트렌드 · 확산</p></article>
      <article><span>04</span><b>X</b><p>화제 · 공유</p></article>
      <article><span>05</span><b>Ameba Blog</b><p>검색 · 후기</p></article>`;

    const advantageSection=document.createElement('section');
    advantageSection.id='about';
    advantageSection.className='luen-advantage-section identity-advantage-ready';
    advantageSection.setAttribute('aria-label','LUEN cross-border platform advantage');
    const advantageShell=document.createElement('div');
    advantageShell.className='container identity-platform-shell';
    advantageShell.append(identityTop,advantageGrid);
    advantageSection.appendChild(advantageShell);
    caseStudies.parentNode.insertBefore(advantageSection,caseStudies);

    /* The old JP/KR platform map is intentionally removed after its content is consolidated above. */
    identitySection.remove();
  }

  /* CAMPAIGN PROCESS · refine the headline copy without altering the timeline. */
  const processTitle=document.querySelector('#process .process-v2-head .section-title');
  if(processTitle)processTitle.innerHTML='실행은 꼼꼼하고<br/><em>브랜드의 경험은 단순하게.</em>';

  /* FAQ · normalize the initial state before site-core binds accordion behavior. */
  document.querySelectorAll('.faq-item').forEach(item=>{
    item.classList.remove('open');
    item.querySelector('.faq-q')?.setAttribute('aria-expanded','false');
    const answer=item.querySelector('.faq-a');
    if(answer)answer.style.maxHeight='0px';
  });

  /* CASE 03 · load only the proof block core; visual stability is handled in CSS. */
  if(document.querySelector('#cases .case-grid')){
    const offlineScript=document.createElement('script');
    offlineScript.src='assets/js/offline-activation-core.js?v=20260823-1';
    offlineScript.async=false;
    offlineScript.dataset.offlineActivationCore='true';
    document.body.appendChild(offlineScript);
  }

  const ctaSelector='a.btn[href^="#"], a.nav-contact[href^="#"], a.case-inquiry-btn[href^="#"], a.faq-cta[href^="#"], a.float-cta[href^="#"]';
  const getCtaPosition=link=>link.classList.contains('float-cta')?'floating':link.closest('.mobile-menu')?'mobile_menu':link.closest('.hero')?'hero':link.closest('nav')?'nav':link.closest('.case-studies')?'case':link.closest('.faq')?'faq':link.closest('.final-scene')?'final':'other';
  document.addEventListener('click',event=>{
    const link=event.target?.closest?.(ctaSelector);
    if(!link)return;
    const context={position:getCtaPosition(link),label:(link.dataset.analyticsLabel||link.getAttribute('aria-label')||link.textContent||'CTA').replace(/\s+/g,' ').trim().slice(0,80)};
    window.__luenLastCtaContext=context;
    if(typeof queueMicrotask==='function')queueMicrotask(()=>{if(window.__luenLastCtaContext===context)window.__luenLastCtaContext=null;});
    else Promise.resolve().then(()=>{if(window.__luenLastCtaContext===context)window.__luenLastCtaContext=null;});
  },true);
  if(typeof window.gtag==='function'&&!window.gtag.__luenCtaPositionEnhanced){
    const originalGtag=window.gtag;
    const enhancedGtag=function(...args){
      if(args[0]==='event'&&args[1]==='cta_click'){
        const context=window.__luenLastCtaContext;
        if(context)args[2]={...(args[2]||{}),cta_label:context.label,cta_position:context.position};
      }
      return originalGtag.apply(this,args);
    };
    enhancedGtag.__luenCtaPositionEnhanced=true;
    window.gtag=enhancedGtag;
  }

  const viewport=document.querySelector('.creator-profile-viewport');
  const track=viewport?.querySelector('.creator-profile-track');
  const source=viewport?.querySelector('.creator-profile-set');
  if(viewport&&track&&source){
    const clone=source.cloneNode(true);
    clone.setAttribute('aria-hidden','true');
    track.appendChild(clone);
    let offset=0,last=performance.now(),baseWidth=source.getBoundingClientRect().width,raf=0,visible=true;
    const speed=isIOS?36:60;
    const frameInterval=isIOS?33:0;
    const stop=()=>{if(raf){cancelAnimationFrame(raf);raf=0;}};
    const tick=now=>{
      raf=0;
      if(!visible||document.hidden||reducedMotion.matches)return;
      const elapsed=now-last;
      if(frameInterval&&elapsed<frameInterval){raf=requestAnimationFrame(tick);return;}
      const dt=Math.min(isIOS?.07:.05,elapsed/1000);
      last=now;
      if(baseWidth>0){offset=(offset+speed*dt)%baseWidth;track.style.transform=`translate3d(${-offset}px,0,0)`;}
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
    if('ResizeObserver' in window)new ResizeObserver(()=>{baseWidth=source.getBoundingClientRect().width||baseWidth;}).observe(viewport);
    if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=Boolean(entries[0]?.isIntersecting);sync();},{rootMargin:'160px 0px',threshold:0}).observe(viewport);
    document.addEventListener('visibilitychange',sync);
    reducedMotion.addEventListener?.('change',sync);
    window.addEventListener('load',()=>{baseWidth=source.getBoundingClientRect().width||baseWidth;sync();},{once:true});
    sync();
  }

  document.querySelector('.luen-content-video video')?.addEventListener('play',()=>{
    if(typeof window.gtag==='function')window.gtag('event','video_play',{video_provider:'self_hosted',video_asset:'luen-content-trim.mp4',video_position:'content'});
  },{once:true});

  /* FAQ · keep the first three questions visible and reveal the remainder on demand. */
  const faqList=document.querySelector('.faq-list');
  if(faqList){
    faqList.querySelector('.faq-conversion')?.remove();
    const faqItems=[...faqList.querySelectorAll(':scope > .faq-item')];
    const extraItems=faqItems.slice(3);
    if(extraItems.length){
      extraItems.forEach(item=>{item.hidden=true;});
      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.className='faq-more-toggle';
      toggle.setAttribute('aria-expanded','false');
      toggle.textContent=`질문 더보기 +${extraItems.length}`;
      faqList.appendChild(toggle);
      toggle.addEventListener('click',()=>{
        const nextExpanded=toggle.getAttribute('aria-expanded')!=='true';
        toggle.setAttribute('aria-expanded',String(nextExpanded));
        extraItems.forEach(item=>{item.hidden=!nextExpanded;});
        toggle.textContent=nextExpanded?'질문 접기':`질문 더보기 +${extraItems.length}`;
        if(!nextExpanded){
          extraItems.forEach(item=>{
            item.classList.remove('open');
            item.querySelector('.faq-q')?.setAttribute('aria-expanded','false');
            const answer=item.querySelector('.faq-a');
            if(answer)answer.style.maxHeight='0px';
          });
        }
      });
    }
  }
})();
