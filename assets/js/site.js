(()=>{
  /* Current production styles: keep runtime loader until index.html is safely consolidated. */
  if(!document.querySelector('link[data-luen-current-styles]')){
    const currentStyles=document.createElement('link');
    currentStyles.rel='stylesheet';
    currentStyles.href='assets/css/site-current.css?v=20260820-2';
    currentStyles.dataset.luenCurrentStyles='true';
    document.head.appendChild(currentStyles);
  }

  /* Conversion-first hero copy and CTA hierarchy. */
  const heroDesc=document.querySelector('.hero-desc');
  if(heroDesc){
    const line=heroDesc.querySelector('.hero-desc-line');
    const strong=heroDesc.querySelector('strong');
    if(line) line.textContent='한국과 일본의 크리에이터 마케팅을 한 팀에서 운영합니다.';
    if(strong) strong.textContent='크리에이터 발굴·섭외부터 콘텐츠 기획, 현지 커뮤니케이션, 업로드 관리, 성과 분석까지 캠페인 전 과정을 연결합니다.';
  }
  const heroCtas=document.querySelectorAll('.hero-cta a');
  if(heroCtas[0]){
    heroCtas[0].setAttribute('href','#contact');
    heroCtas[0].innerHTML='캠페인 상담하기 <span>→</span>';
  }
  if(heroCtas[1]){
    heroCtas[1].setAttribute('href','#work');
    heroCtas[1].innerHTML='대표 캠페인 사례 보기 <span>↓</span>';
  }

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

  /* Inquiry conversion fixes remain runtime-backed until static HTML is safely consolidated. */
  const inquiryForm=document.getElementById('contactForm');
  if(inquiryForm){
    const contactCopy=document.querySelector('.contact-copy');
    if(contactCopy) contactCopy.textContent='브랜드와 목표 시장, 현재 고민만 알려주세요. 이메일 또는 연락처 중 편한 방법 하나를 남겨주시면 확인 후 캠페인 방향과 필요한 크리에이터 구조를 함께 논의합니다.';

    const formGrid=inquiryForm.querySelector('.form-grid');
    if(formGrid&&!inquiryForm.querySelector('.inquiry-reassurance')){
      formGrid.insertAdjacentHTML('beforebegin','<aside class="inquiry-reassurance" aria-label="상담 안내"><span>BEFORE YOU INQUIRE</span><strong>계약 전 단계에서도 상담 가능합니다.</strong><p>예산이나 크리에이터가 아직 정해지지 않아도 괜찮습니다. 현재 목표와 고민만 알려주세요.</p></aside>');
    }

    const email=inquiryForm.querySelector('#email');
    const phone=inquiryForm.querySelector('#phone');
    const emailLabel=inquiryForm.querySelector('label[for="email"]');
    const phoneLabel=inquiryForm.querySelector('label[for="phone"]');
    if(emailLabel) emailLabel.textContent='이메일';
    if(phoneLabel) phoneLabel.textContent='연락처';
    if(email){email.required=false;email.removeAttribute('aria-describedby');}
    if(phone){phone.required=false;phone.removeAttribute('aria-describedby');}
    document.getElementById('contactMethodHint')?.remove();

    const budget=inquiryForm.querySelector('#budget');
    if(budget&&budget.tagName!=='SELECT'){
      const select=document.createElement('select');
      select.id='budget';
      select.name='budget';
      select.innerHTML='<option value="">아직 미정 / 상담 후 결정</option><option value="500만원 이하">500만원 이하</option><option value="500~1,000만원">500~1,000만원</option><option value="1,000~3,000만원">1,000~3,000만원</option><option value="3,000만원 이상">3,000만원 이상</option><option value="협의 필요">협의 필요</option>';
      budget.replaceWith(select);
      const budgetLabel=inquiryForm.querySelector('label[for="budget"]');
      if(budgetLabel) budgetLabel.innerHTML='예산 범위 <span class="field-note">(선택)</span>';
    }

    const collectionDetails=[...inquiryForm.querySelectorAll('.privacy-detail-body dl')][0];
    if(collectionDetails){
      [...collectionDetails.querySelectorAll('div')].forEach(row=>{
        const dt=row.querySelector('dt');
        const dd=row.querySelector('dd');
        if(!dt||!dd)return;
        if(dt.textContent.trim()==='필수 항목') dd.textContent='브랜드/회사명, 담당자명, 목표 시장, 이메일 또는 연락처 중 1개';
        if(dt.textContent.trim()==='선택 항목') dd.textContent='입력하지 않은 연락 수단, 관심 플랫폼, 예산 범위, 프로젝트 내용';
      });
    }
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
      new IntersectionObserver(entries=>{visible=Boolean(entries[0]?.isIntersecting);sync();},{rootMargin:'160px 0px',threshold:0}).observe(viewport);
    }
    document.addEventListener('visibilitychange',sync);
    reducedMotion.addEventListener?.('change',sync);
    sync();
  }

  const portfolioLoops=[...document.querySelectorAll('.portfolio-viewport[data-loop-strip]')];
  if(portfolioLoops[0]) portfolioLoops[0].dataset.speed='70';
  if(portfolioLoops[1]) portfolioLoops[1].dataset.speed='84';

  const core=document.createElement('script');
  core.src='assets/js/site-core.js?v=20260819p';
  document.body.appendChild(core);
})();

(()=>{
  const youtubeSection=document.querySelector('#youtube .container');
  const youtubeHead=youtubeSection?.querySelector('.youtube-v2-head');
  if(!youtubeSection||!youtubeHead||youtubeSection.querySelector('.luen-video-showcase')) return;

  if(!document.querySelector('style[data-luen-video-showcase]')){
    const style=document.createElement('style');
    style.dataset.luenVideoShowcase='true';
    style.textContent=`
      .luen-video-showcase{display:grid;grid-template-columns:minmax(250px,.58fr) minmax(0,1.42fr);gap:34px;align-items:center;margin:64px 0 72px;padding:28px;border:1px solid rgba(248,229,207,.12);border-radius:28px;background:linear-gradient(135deg,rgba(244,125,53,.055),rgba(13,8,5,.52));box-shadow:0 24px 70px rgba(0,0,0,.12)}
      .luen-video-copy{padding:8px 2px 8px 8px}.luen-video-copy>span{display:block;color:var(--orange-2);font:700 11px/1.3 "Inter","Pretendard",sans-serif;letter-spacing:.16em}.luen-video-copy h3{margin-top:16px;color:var(--cream);font-size:clamp(24px,2.4vw,36px);line-height:1.16;letter-spacing:-.04em}.luen-video-copy p{margin-top:17px;color:var(--muted);font-size:15px;line-height:1.75;word-break:keep-all}.luen-video-copy small{display:block;margin-top:22px;color:var(--muted-2);font:600 10px/1.5 "Inter","Pretendard",sans-serif;letter-spacing:.1em}
      .luen-video-frame{position:relative;aspect-ratio:16/9;overflow:hidden;border:1px solid rgba(248,229,207,.13);border-radius:20px;background:#080403;box-shadow:0 22px 60px rgba(0,0,0,.28)}
      .luen-video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
      .luen-video-poster{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:#080403;cursor:pointer;overflow:hidden;color:var(--cream)}
      .luen-video-poster img{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.86) brightness(.72);transition:transform .45s ease,filter .35s ease}.luen-video-poster:hover img{transform:scale(1.025);filter:saturate(.95) brightness(.78)}
      .luen-video-poster::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 42%,rgba(8,4,3,.68) 100%);pointer-events:none}
      .luen-video-play{position:absolute;left:50%;top:50%;z-index:2;width:70px;height:70px;transform:translate(-50%,-50%);display:grid;place-items:center;border:1px solid rgba(255,255,255,.32);border-radius:50%;background:rgba(13,8,5,.72);backdrop-filter:blur(12px);box-shadow:0 12px 38px rgba(0,0,0,.3);transition:transform .22s ease,background .22s ease}.luen-video-play::before{content:"";margin-left:4px;border-left:15px solid var(--orange-2);border-top:10px solid transparent;border-bottom:10px solid transparent}.luen-video-poster:hover .luen-video-play{transform:translate(-50%,-50%) scale(1.06);background:rgba(20,10,5,.86)}
      .luen-video-caption{position:absolute;left:18px;bottom:16px;z-index:2;color:rgba(255,250,244,.9);font:700 10px/1.3 "Inter","Pretendard",sans-serif;letter-spacing:.11em}
      @media(max-width:900px){.luen-video-showcase{grid-template-columns:1fr;gap:22px;margin:48px 0 58px;padding:22px}.luen-video-copy{padding:2px}.luen-video-copy p{font-size:14.5px}.luen-video-frame{border-radius:16px}}
      @media(max-width:560px){.luen-video-showcase{margin:38px 0 48px;padding:14px;border-radius:20px}.luen-video-copy{padding:8px}.luen-video-copy h3{font-size:25px}.luen-video-play{width:58px;height:58px}.luen-video-caption{left:13px;bottom:12px;font-size:9px}}
    `;
    document.head.appendChild(style);
  }

  const showcase=document.createElement('div');
  showcase.className='luen-video-showcase sr d1';
  showcase.innerHTML=`
    <div class="luen-video-copy">
      <span>CONTENT SAMPLE · YOUTUBE</span>
      <h3>콘텐츠의 흐름을<br/>영상으로 확인해보세요.</h3>
      <p>크리에이터의 평소 문법 안에서 제품과 브랜드 메시지가 어떤 장면으로 전달되는지 확인할 수 있습니다.</p>
      <small>CLICK TO PLAY · LAZY LOADED</small>
    </div>
    <div class="luen-video-frame">
      <button class="luen-video-poster" type="button" aria-label="콘텐츠 예시 영상 재생">
        <img src="https://i.ytimg.com/vi/YHLOpZs1MKU/maxresdefault.jpg" alt="콘텐츠 예시 영상 미리보기" loading="lazy" decoding="async"/>
        <span class="luen-video-play" aria-hidden="true"></span>
        <span class="luen-video-caption">LUEN · CONTENT PREVIEW</span>
      </button>
    </div>`;
  youtubeHead.insertAdjacentElement('afterend',showcase);

  showcase.querySelector('.luen-video-poster')?.addEventListener('click',()=>{
    const frame=showcase.querySelector('.luen-video-frame');
    if(!frame) return;
    const iframe=document.createElement('iframe');
    iframe.src='https://www.youtube-nocookie.com/embed/YHLOpZs1MKU?autoplay=1&rel=0&playsinline=1';
    iframe.title='LUEN 콘텐츠 예시 영상';
    iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy='strict-origin-when-cross-origin';
    iframe.allowFullscreen=true;
    frame.replaceChildren(iframe);
    if(typeof window.gtag==='function') window.gtag('event','video_play',{video_provider:'youtube',video_id:'YHLOpZs1MKU',video_position:'content'});
  },{once:true});
})();