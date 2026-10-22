(()=>{
  /* Runtime-only behavior. Final visual/content DOM is already present in index.html. */
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

  const lightLoopControllers=new Map();
  const pendingIOSLayouts=new Map();
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
  // Safari may temporarily measure a laid-out gallery as only 72px. Use
  // scrollWidth plus the first real card width before cloning any content.
  const sourceGeometry=source=>({
    width:Math.max(source.scrollWidth,source.getBoundingClientRect().width),
    childWidth:source.firstElementChild?.getBoundingClientRect().width||0
  });
  const clearPendingIOSLayout=viewport=>{
    const pending=pendingIOSLayouts.get(viewport);
    if(!pending)return;
    pending.resize?.disconnect();
    pending.intersection?.disconnect();
    if(pending.visibilityHandler)document.removeEventListener('visibilitychange',pending.visibilityHandler);
    if(pending.raf)cancelAnimationFrame(pending.raf);
    pendingIOSLayouts.delete(viewport);
  };
  const waitForIOSLayout=(viewport,source)=>{
    if(pendingIOSLayouts.has(viewport))return;
    const pending={resize:null,intersection:null,visibilityHandler:null,raf:0};
    pendingIOSLayouts.set(viewport,pending);
    const check=()=>{
      pending.raf=0;
      if(pendingIOSLayouts.get(viewport)!==pending||document.hidden||reducedMotion.matches)return;
      const geo=sourceGeometry(source);
      if(geo.width<80||geo.childWidth<4)return;
      clearPendingIOSLayout(viewport);
      setupIOSLightLoop(viewport);
    };
    const schedule=()=>{
      if(!pending.raf)pending.raf=requestAnimationFrame(check);
    };
    if('ResizeObserver' in window){
      pending.resize=new ResizeObserver(schedule);
      pending.resize.observe(source);
      if(source.firstElementChild)pending.resize.observe(source.firstElementChild);
    }
    if('IntersectionObserver' in window){
      pending.intersection=new IntersectionObserver(entries=>{
        if(entries.some(e=>e.isIntersecting))schedule();
      },{rootMargin:'180px 0px',threshold:0});
      pending.intersection.observe(viewport);
    }
    pending.visibilityHandler=()=>{if(!document.hidden)schedule();};
    document.addEventListener('visibilitychange',pending.visibilityHandler);
    schedule();
  };
  const setupIOSLightLoop=viewport=>{
    const track=viewport.querySelector('.loop-track');
    const source=viewport.querySelector('.loop-set:not(.ios-loop-clone)');
    if(!track||!source)return;
    const previous=lightLoopControllers.get(viewport);
    previous?.observer?.disconnect();
    previous?.resizeObserver?.disconnect();
    stopLightLoop(viewport);
    lightLoopControllers.delete(viewport);
    clearPendingIOSLayout(viewport);
    track.querySelectorAll('.ios-loop-clone').forEach(el=>el.remove());
    track.style.transform='translate3d(0,0,0)';
    if(reducedMotion.matches)return;
    const geo=sourceGeometry(source);
    if(geo.width<80||geo.childWidth<4){
      waitForIOSLayout(viewport,source);
      return; // Never clone Safari's unresolved 72px placeholder width.
    }
    const baseWidth=geo.width;
    const copies=Math.max(1,Math.ceil(viewport.clientWidth/baseWidth));
    for(let i=0;i<copies;i++){
      const clone=source.cloneNode(true);
      clone.classList.add('loop-clone','ios-loop-clone');
      clone.setAttribute('aria-hidden','true');
      clone.querySelectorAll('img').forEach(img=>{img.loading='lazy';img.fetchPriority='low';});
      track.appendChild(clone);
    }
    const rawSpeed=Math.max(10,Number(viewport.dataset.iosLoopSpeed||viewport.dataset.speed||45));
    const controller={
      raf:0,visible:!('IntersectionObserver' in window),offset:0,
      last:performance.now(),speed:Math.max(14,Math.min(42,rawSpeed*.55)),
      baseWidth,track,observer:null,resizeObserver:null,tick:null
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
    const remeasure=()=>{
      const actual=sourceGeometry(source);
      if(actual.width<80||actual.childWidth<4||
         Math.abs(actual.width-controller.baseWidth)>Math.max(2,controller.baseWidth*.02)){
        requestAnimationFrame(()=>{
          if(lightLoopControllers.get(viewport)===controller)setupIOSLightLoop(viewport);
        });
        return true;
      }
      return false;
    };
    if('IntersectionObserver' in window){
      controller.observer=new IntersectionObserver(entries=>{
        controller.visible=entries.some(e=>e.isIntersecting);
        if(!controller.visible){stopLightLoop(viewport);return;}
        if(!remeasure())startLightLoop(viewport);
      },{rootMargin:'120px 0px',threshold:0});
      controller.observer.observe(viewport);
    }
    if('ResizeObserver' in window){
      controller.resizeObserver=new ResizeObserver(()=>{remeasure();});
      controller.resizeObserver.observe(source);
      if(source.firstElementChild)controller.resizeObserver.observe(source.firstElementChild);
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
      // Recreate strips to remove duplicate images when motion is reduced.
      iosLoopStrips.forEach(setupIOSLightLoop);
    });
  }

  /* CASE STUDY · restore the real in-store POP proof into the featured case. */
  if(document.querySelector('[data-herahera-pop-proof]')){
    const offlineScript=document.createElement('script');
    offlineScript.src='/assets/js/offline-activation-core.js?v=20260925-2';
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
    const faqConversion=faqList.querySelector('.faq-conversion');
    const faqItems=[...faqList.querySelectorAll(':scope > .faq-item')];
    const extraItems=faqItems.slice(3);
    if(extraItems.length){
      extraItems.forEach(item=>{item.hidden=true;});
      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.className='faq-more-toggle';
      toggle.setAttribute('aria-expanded','false');
      toggle.textContent=`질문 더보기 +${extraItems.length}`;
      faqList.insertBefore(toggle,faqConversion||null);
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
