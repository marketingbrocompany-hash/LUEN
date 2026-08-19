(()=>{
  const style=document.createElement('style');
  style.textContent=`
    .creator-network-showcase{position:relative;min-width:0;width:100%;min-height:650px;overflow:hidden;isolation:isolate;display:flex;flex-direction:column;justify-content:center;border:1px solid rgba(248,229,207,.14);border-radius:38px;background:radial-gradient(circle at 82% 16%,rgba(244,125,53,.18),transparent 30%),radial-gradient(circle at 42% 72%,rgba(244,125,53,.08),transparent 34%),linear-gradient(145deg,rgba(31,18,12,.98),rgba(13,8,5,.98));box-shadow:0 34px 100px rgba(0,0,0,.26)}
    .creator-network-showcase::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.23;background-image:linear-gradient(rgba(248,229,207,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(248,229,207,.055) 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.9),rgba(0,0,0,.35) 72%,transparent)}
    .creator-network-showcase::after{content:"";position:absolute;right:-16%;top:8%;width:74%;aspect-ratio:1;border:1px solid rgba(244,125,53,.16);border-radius:50%;box-shadow:0 0 0 42px rgba(244,125,53,.025),0 0 80px rgba(244,125,53,.08);pointer-events:none}
    .creator-network-head{position:relative;z-index:3;padding:38px 38px 22px}
    .creator-network-head>span{display:flex;align-items:center;gap:9px;margin-bottom:13px;color:var(--orange-2);font:700 10px/1 "Inter","Pretendard",sans-serif;letter-spacing:.17em}
    .creator-network-head>span::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--orange);box-shadow:0 0 14px rgba(244,125,53,.72)}
    .creator-network-head strong{display:block;color:var(--cream);font:700 clamp(28px,2.7vw,40px)/1 "Inter","Pretendard",sans-serif;letter-spacing:-.035em}
    .creator-network-head p{margin-top:10px;color:rgba(248,229,207,.44);font:600 9px/1 "Inter","Pretendard",sans-serif;letter-spacing:.18em}
    .creator-profile-viewport{position:relative;z-index:3;width:100%;overflow:hidden;padding:18px 0 34px}
    .creator-profile-viewport::before,.creator-profile-viewport::after{content:"";position:absolute;z-index:5;top:0;bottom:0;width:58px;pointer-events:none}
    .creator-profile-viewport::before{left:0;background:linear-gradient(90deg,#140b07 0,rgba(20,11,7,.72) 24%,rgba(20,11,7,0) 100%)}
    .creator-profile-viewport::after{right:0;background:linear-gradient(270deg,#130a06 0,rgba(19,10,6,.72) 24%,rgba(19,10,6,0) 100%)}
    .creator-profile-track{display:flex;width:max-content;will-change:transform}
    .creator-profile-set{display:flex;flex:0 0 auto;align-items:center;gap:16px;padding-right:16px}
    .creator-profile-card{position:relative;flex:0 0 270px;width:270px;height:270px;overflow:hidden;border:1px solid rgba(248,229,207,.16);border-radius:22px;background:#0e0906;box-shadow:0 18px 48px rgba(0,0,0,.28);transform:none!important}
    .creator-profile-card img{width:100%;height:100%;object-fit:contain;object-position:center;display:block;background:#0e0906;transform:none!important;filter:none!important}
    .creator-profile-card::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(248,229,207,.035)}
    .creator-network-foot{position:relative;z-index:3;display:flex;align-items:center;gap:11px;padding:2px 38px 34px;color:rgba(248,229,207,.38);font:700 8px/1 "Inter","Pretendard",sans-serif;letter-spacing:.14em}
    .creator-network-foot i{width:3px;height:3px;border-radius:50%;background:var(--orange);opacity:.8}

    .case-studies .case-grid{align-items:start!important}
    .case-studies .case-card,.case-studies .case-05,.case-studies .case-06{display:flex!important;flex-direction:column!important;grid-template-columns:1fr!important;min-height:0!important;transform:none!important;overflow:hidden!important}
    .case-studies .case-card:hover{transform:none!important}
    .case-studies .case-image{width:100%!important;aspect-ratio:16/10!important;min-height:0!important;display:grid!important;place-items:center!important;padding:12px!important;background:radial-gradient(circle at 50% 45%,rgba(244,125,53,.055),transparent 48%),#090604!important;overflow:hidden!important}
    .case-studies .case-image img{width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;border-radius:14px!important;filter:none!important;transform:none!important;background:#090604!important}
    .case-studies .case-card:hover .case-image img{transform:none!important}
    .case-studies .case-image::after{display:none!important}
    .case-studies .case-body{min-height:0!important;padding:26px 26px 28px!important}

    /* P0 accessibility stability fixes */
    .client-voice .voice-item>p{font-size:var(--luen-label)!important}

    @media(max-width:1180px){.creator-network-showcase{width:min(100%,760px);min-height:540px;justify-self:center}.creator-profile-card{flex-basis:235px;width:235px;height:235px}}
    @media(max-width:767px){.creator-network-showcase{min-height:430px;border-radius:28px}.creator-network-head{padding:26px 20px 14px}.creator-network-head strong{font-size:28px}.creator-network-head p{font-size:8px}.creator-profile-viewport{padding:14px 0 26px}.creator-profile-viewport::before,.creator-profile-viewport::after{width:32px}.creator-profile-set{gap:12px;padding-right:12px}.creator-profile-card{flex-basis:190px;width:190px;height:190px;border-radius:18px}.creator-network-foot{flex-wrap:wrap;padding:0 20px 24px;gap:9px;font-size:7.5px}.case-studies .case-image{aspect-ratio:4/3!important;padding:8px!important}.case-studies .case-image img{border-radius:12px!important}.case-studies .case-body{padding:22px 18px 22px!important}}
    @media(max-width:480px){.creator-network-showcase{min-height:402px}.creator-profile-card{flex-basis:174px;width:174px;height:174px}.creator-network-head>span{font-size:9px}}
    @media(prefers-reduced-motion:reduce){
      .creator-profile-viewport{overflow-x:auto;scrollbar-width:none}
      .creator-profile-viewport::-webkit-scrollbar{display:none}
      .creator-profile-track{transform:none!important}
      .lhn-glow,.lcs-node,.lcs-scene,.lcs-node:not(.lcs-action)::after{animation:none!important;transition:none!important}
    }
  `;
  document.head.appendChild(style);

  /* Conversion-first hero copy and CTA hierarchy */
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
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      let offset=0,last=performance.now(),baseWidth=source.getBoundingClientRect().width;
      const tick=now=>{
        const dt=Math.min(.05,(now-last)/1000);last=now;
        if(baseWidth>0){offset=(offset+60*dt)%baseWidth;track.style.transform=`translate3d(${-offset}px,0,0)`;}
        requestAnimationFrame(tick);
      };
      new ResizeObserver(()=>{baseWidth=source.getBoundingClientRect().width||baseWidth}).observe(viewport);
      requestAnimationFrame(tick);
    }
  }

  const portfolioLoops=[...document.querySelectorAll('.portfolio-viewport[data-loop-strip]')];
  if(portfolioLoops[0]) portfolioLoops[0].dataset.speed='70';
  if(portfolioLoops[1]) portfolioLoops[1].dataset.speed='84';

  const core=document.createElement('script');
  core.src='assets/js/site-core.js?v=20260819j';
  document.body.appendChild(core);
})();
