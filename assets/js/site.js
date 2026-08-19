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
    .creator-profile-card{position:relative;flex:0 0 210px;aspect-ratio:4/5;overflow:hidden;border:1px solid rgba(248,229,207,.16);border-radius:24px;background:#1b0f0a;box-shadow:0 18px 48px rgba(0,0,0,.32);transform:translateZ(0)}
    .creator-profile-card:nth-child(3n+2){transform:translateY(12px) translateZ(0)}
    .creator-profile-card:nth-child(3n+3){transform:translateY(-8px) translateZ(0)}
    .creator-profile-card img{width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.015);filter:saturate(.9) contrast(.98) brightness(.92)}
    .creator-profile-card::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to top,rgba(13,8,5,.30),transparent 38%)}
    .creator-network-foot{position:relative;z-index:3;display:flex;align-items:center;gap:11px;padding:2px 38px 34px;color:rgba(248,229,207,.38);font:700 8px/1 "Inter","Pretendard",sans-serif;letter-spacing:.14em}
    .creator-network-foot i{width:3px;height:3px;border-radius:50%;background:var(--orange);opacity:.8}
    @media(max-width:1180px){.creator-network-showcase{width:min(100%,760px);min-height:540px;justify-self:center}.creator-profile-card{flex-basis:190px}}
    @media(max-width:767px){.creator-network-showcase{min-height:430px;border-radius:28px}.creator-network-head{padding:26px 20px 14px}.creator-network-head strong{font-size:28px}.creator-network-head p{font-size:8px}.creator-profile-viewport{padding:14px 0 26px}.creator-profile-viewport::before,.creator-profile-viewport::after{width:32px}.creator-profile-set{gap:12px;padding-right:12px}.creator-profile-card{flex-basis:156px;border-radius:18px}.creator-network-foot{flex-wrap:wrap;padding:0 20px 24px;gap:9px;font-size:7.5px}}
    @media(max-width:480px){.creator-network-showcase{min-height:402px}.creator-profile-card{flex-basis:146px}.creator-network-head>span{font-size:9px}}
    @media(prefers-reduced-motion:reduce){.creator-profile-viewport{overflow-x:auto;scrollbar-width:none}.creator-profile-viewport::-webkit-scrollbar{display:none}.creator-profile-track{transform:none!important}}
  `;
  document.head.appendChild(style);

  const old=document.querySelector('.luen-hero-network');
  if(old){
    old.outerHTML=`<div class="creator-network-showcase" aria-label="LUEN 크리에이터 네트워크">
      <div class="creator-network-head"><span>CREATOR NETWORK</span><strong>KOREA × JAPAN</strong><p>YOUTUBE CREATOR PROFILE</p></div>
      <div class="creator-profile-viewport" aria-label="크리에이터 프로필 슬라이드">
        <div class="creator-profile-track"><div class="creator-profile-set">
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-profile-03.webp" alt="LUEN 크리에이터 프로필 1" width="320" height="320" decoding="async"></figure>
          <figure class="creator-profile-card"><img src="assets/images/cases/case-04.webp" alt="LUEN 크리에이터 프로필 2" width="320" height="320" decoding="async"></figure>
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-profile-01.webp" alt="LUEN 크리에이터 프로필 3" width="320" height="320" decoding="async"></figure>
          <figure class="creator-profile-card"><img src="assets/images/cases/case-01.webp" alt="LUEN 크리에이터 프로필 4" width="320" height="320" decoding="async"></figure>
          <figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-profile-02.webp" alt="LUEN 크리에이터 프로필 5" width="320" height="320" decoding="async"></figure>
          <figure class="creator-profile-card"><img src="assets/images/cases/case-06.webp" alt="LUEN 크리에이터 프로필 6" width="320" height="320" decoding="async"></figure>
          <figure class="creator-profile-card"><img src="assets/images/cases/case-03.webp" alt="LUEN 크리에이터 프로필 7" width="320" height="320" decoding="async"></figure>
          <figure class="creator-profile-card"><img src="assets/images/cases/case-05.webp" alt="LUEN 크리에이터 프로필 8" width="320" height="320" decoding="async"></figure>
        </div></div>
      </div>
      <div class="creator-network-foot" aria-hidden="true"><span>YOUTUBE</span><i></i><span>INSTAGRAM</span><i></i><span>KOREA</span><i></i><span>JAPAN</span></div>
    </div>`;
  }

  const viewport=document.querySelector('.creator-profile-viewport');
  const track=viewport?.querySelector('.creator-profile-track');
  const source=viewport?.querySelector('.creator-profile-set');
  if(viewport&&track&&source&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const clone=source.cloneNode(true);
    clone.setAttribute('aria-hidden','true');
    track.appendChild(clone);
    let offset=0,last=performance.now(),baseWidth=source.getBoundingClientRect().width;
    const tick=now=>{
      const dt=Math.min(.05,(now-last)/1000);last=now;
      if(baseWidth>0){offset=(offset+32*dt)%baseWidth;track.style.transform=`translate3d(${-offset}px,0,0)`;}
      requestAnimationFrame(tick);
    };
    new ResizeObserver(()=>{baseWidth=source.getBoundingClientRect().width||baseWidth}).observe(viewport);
    requestAnimationFrame(tick);
  }

  const core=document.createElement('script');
  core.src='assets/js/site-core.js?v=20260819b';
  document.body.appendChild(core);
})();
