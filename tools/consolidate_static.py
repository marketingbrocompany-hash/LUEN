from pathlib import Path
import re

root=Path('.')
index=root/'index.html'
s=index.read_text(encoding='utf-8')

def once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {n}')
    s=s.replace(old,new,1)

once('<link rel="manifest" href="/site.webmanifest"/>','<link rel="manifest" href="/site.webmanifest?v=20260823-3"/>','manifest')
once('<link rel="stylesheet" href="assets/css/site.css"/>','<link rel="stylesheet" href="assets/css/site.css?v=20260823-3"/>','site css')
once('<link rel="stylesheet" href="assets/css/platform-network.css?v=20260823-2"/>','''<link rel="stylesheet" href="assets/css/platform-network.css?v=20260823-3"/>
<link rel="stylesheet" href="assets/css/site-current.css?v=20260823-3" data-luen-current-styles="true"/>
<link rel="stylesheet" href="assets/css/content-video.css?v=20260823-3" data-luen-content-video-styles="true"/>''','production css')
once('<a class="btn btn-primary" href="#work">Selected Work 보기 <span>↓</span></a>','<a class="btn btn-primary" href="#contact">캠페인 상담하기 <span>→</span></a>','hero cta 1')
once('<a class="btn btn-secondary" href="#platforms">서비스 구조 보기</a>','<a class="btn btn-secondary" href="#cases">대표 캠페인 사례 보기 <span>↓</span></a>','hero cta 2')

creator='''<div class="creator-network-showcase" aria-label="LUEN 크리에이터 네트워크">
<div class="creator-network-head"><span>CREATOR NETWORK</span><strong>KOREA × JAPAN</strong><p>YOUTUBE CREATOR PROFILE</p></div>
<div class="creator-profile-viewport" aria-label="크리에이터 프로필 슬라이드">
<div class="creator-profile-track"><div class="creator-profile-set">
<figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-extra-v2-03.webp" alt="LUEN 크리에이터 프로필 1" decoding="async" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
<figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-profile-02.webp" alt="LUEN 크리에이터 프로필 2" decoding="async" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
<figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-extra-v2-01.webp" alt="LUEN 크리에이터 프로필 3" decoding="async" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
<figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-profile-01.webp" alt="LUEN 크리에이터 프로필 4" decoding="async" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
<figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-extra-v2-04.webp" alt="LUEN 크리에이터 프로필 5" decoding="async" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
<figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-profile-03.webp" alt="LUEN 크리에이터 프로필 6" decoding="async" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
<figure class="creator-profile-card"><img src="assets/images/hero-creators/creator-extra-v2-02.webp" alt="LUEN 크리에이터 프로필 7" decoding="async" loading="eager" onerror="this.closest('.creator-profile-card').remove()"></figure>
</div></div>
</div>
<div class="creator-network-foot" aria-hidden="true"><span>YOUTUBE</span><i></i><span>INSTAGRAM</span><i></i><span>KOREA</span><i></i><span>JAPAN</span></div>
</div>'''
start_marker='<div aria-label="한국과 일본의 플랫폼 네트워크" class="luen-hero-network" id="networkCard">'
start=s.find(start_marker)
if start<0: raise SystemExit('hero old visual start not found')
end_marker='\n</div>\n</section>\n<div aria-hidden="true" class="marquee"'
end=s.find(end_marker,start)
if end<0: raise SystemExit('hero old visual end not found')
s=s[:start]+creator+s[end:]

outcome='''<!-- OUTCOME / BUSINESS PROOF -->
<section aria-label="LUEN 비즈니스 성과 사례" class="proof-strip outcome-strip">
<div class="container proof-grid">
<article class="proof-item"><span class="proof-kicker">PURCHASE</span><strong>라쿠텐 판매 랭킹 1위</strong><p>실사용 중심의 리뷰 콘텐츠로 제품의 기능과 구매 이유를 자연스럽게 전달한 사례</p></article>
<article class="proof-item"><span class="proof-kicker">RESERVATION</span><strong>실제 예약 300~1,000건+</strong><p>일본 소비자의 시술 전 불안과 궁금증을 해소해 예약으로 이어진 캠페인 사례</p></article>
<article class="proof-item"><span class="proof-kicker">STORE VISIT</span><strong>팬들의 매장 성지순례</strong><p>유튜버 매장 POP까지 제작해 콘텐츠 경험을 오프라인 방문과 인증으로 확장한 사례</p></article>
<article class="proof-item"><span class="proof-kicker">MARKET INTEREST</span><strong>인지도·구매 관심 확대</strong><p>한국 식품의 매력을 강한 체험 콘텐츠로 전달해 일본 시장의 관심을 넓힌 사례</p></article>
</div>
</section>
<!-- CAPABILITY SNAPSHOT -->
<section aria-label="LUEN capability snapshot" class="proof-strip capability-strip">
<div class="container proof-grid proof-grid-numbers">
<article class="proof-item"><span class="proof-kicker">CREATOR NETWORK</span><strong>1,300+</strong><p>한국과 일본을 연결하는 크리에이터 협업 네트워크</p></article>
<article class="proof-item"><span class="proof-kicker">CONTENT</span><strong>600+</strong><p>YouTube · Reels · Short-form 기반 콘텐츠 제작·집행</p></article>
<article class="proof-item"><span class="proof-kicker">CAMPAIGN</span><strong>280+</strong><p>브랜드 목적과 시장에 맞춰 설계한 캠페인 프로젝트</p></article>
<article class="proof-item"><span class="proof-kicker">PLATFORM</span><strong>7</strong><p>YouTube · Instagram · TikTok · X · Ameba · Naver · Google</p></article>
</div>
</section>
<!-- WORK -->'''
pattern=r'<!-- PROOF / CAPABILITY SNAPSHOT -->\n<section aria-label="LUEN capability snapshot" class="proof-strip">.*?</section>\n<!-- WORK -->'
s,n=re.subn(pattern,outcome,s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'legacy proof replacement count {n}')

once('class="portfolio-viewport" data-loop-strip="" data-speed="46"','class="portfolio-viewport" data-loop-strip="" data-speed="70"','long speed')
once('class="portfolio-viewport" data-loop-strip="" data-speed="58"','class="portfolio-viewport" data-loop-strip="" data-speed="84"','short speed')

def insert_after_article(src,html,key):
    global s
    if key in s: return
    pos=s.find(src)
    if pos<0: raise SystemExit(f'{key}: source image not found')
    end=s.find('</article>',pos)
    if end<0: raise SystemExit(f'{key}: article end not found')
    end+=len('</article>')
    s=s[:end]+'\n'+html+s[end:]

insert_after_article('assets/images/selected-work/longform-10.webp','''<article aria-label="JP F&B VLOG 캠페인 썸네일" class="portfolio-card" data-selected-work="fnb-vlog">
<img alt="JP F&B VLOG 캠페인 썸네일" src="assets/images/selected-work/longform-11.jpg" width="1280" height="720" loading="lazy" decoding="async"/>
<span class="portfolio-country">JP</span><div class="portfolio-meta"><span>F&amp;B · VLOG</span><b>YouTube Long Form</b></div>
</article>''','data-selected-work="fnb-vlog"')
insert_after_article('assets/images/selected-work/reels-10.webp','''<article aria-label="JP 클리닉 VLOG 캠페인 썸네일" class="portfolio-card portrait" data-selected-work="clinic-vlog">
<img alt="JP 클리닉 VLOG 캠페인 썸네일" src="assets/images/selected-work/shortform-11.jpg" width="1152" height="2048" loading="lazy" decoding="async"/>
<span class="portfolio-country">JP</span><div class="portfolio-meta"><span>CLINIC · VLOG</span><b>Instagram Reels</b></div>
</article>''','data-selected-work="clinic-vlog"')

video='''<article class="luen-content-video sr d1" aria-label="실제 크리에이터 콘텐츠 예시">
<div class="luen-content-video-copy"><span>REAL CREATOR CONTENT</span><h3>브랜드 메시지가<br/>실제 콘텐츠 안에서<br/>어떻게 이어지는지 확인해보세요.</h3><p>제품 소개, 사용 장면, 크리에이터의 언어가 하나의 흐름으로 연결되는 실제 편집 콘텐츠 예시입니다.</p><div class="luen-content-video-meta" aria-hidden="true"><span>EDITED CONTENT</span><span>DIRECT MP4</span><span>KOREA × JAPAN</span></div></div>
<div class="luen-content-video-frame"><video controls playsinline preload="metadata" aria-label="LUEN 실제 크리에이터 콘텐츠 예시 영상"><source src="assets/video/luen-content-trim.mp4" type="video/mp4"/>현재 브라우저에서는 영상을 재생할 수 없습니다.</video></div>
</article>
'''
if 'class="luen-content-video sr d1"' not in s:
    once('<div class="luen-content-expertise-grid sr d1">',video+'<div class="luen-content-expertise-grid sr d1">','content video')

once('브랜드, 목표 시장, 관심 플랫폼과 현재 고민을 알려주세요. 회신받을 연락처를 남겨주시면 확인 후 캠페인 방향과 필요한 크리에이터 구조를 함께 논의합니다.','브랜드와 목표 시장, 현재 고민만 알려주세요. 이메일 또는 연락처 중 편한 방법 하나를 남겨주시면 확인 후 캠페인 방향과 필요한 크리에이터 구조를 함께 논의합니다.','contact copy')
once('<div class="form-grid">','''<aside class="inquiry-reassurance" aria-label="상담 안내"><span>BEFORE YOU INQUIRE</span><strong>계약 전 단계에서도 상담 가능합니다.</strong><p>예산이나 크리에이터가 아직 정해지지 않아도 괜찮습니다. 현재 목표와 고민만 알려주세요.</p></aside>
<div class="form-grid">''','reassurance')
once('<label for="email">이메일 (선택)</label>','<label for="email">이메일</label>','email label')
once('<input autocomplete="tel" id="phone" name="phone" placeholder="예: 010-1234-5678 / +81 ..." required type="tel"/>','<input autocomplete="tel" id="phone" name="phone" placeholder="예: 010-1234-5678 / +81 ..." type="tel"/>','phone optional')
budget_re=r'<div class="field full">\n<label for="budget">예산 범위</label>\n<input id="budget" name="budget" placeholder="예: 500만원 / 협의 필요" required type="text"/>\n</div>'
budget='''<div class="field full">
<label for="budget">예산 범위 <span class="field-note">(선택)</span></label>
<select id="budget" name="budget"><option value="">아직 미정 / 상담 후 결정</option><option value="500만원 이하">500만원 이하</option><option value="500~1,000만원">500~1,000만원</option><option value="1,000~3,000만원">1,000~3,000만원</option><option value="3,000만원 이상">3,000만원 이상</option><option value="협의 필요">협의 필요</option></select>
</div>'''
s,n=re.subn(budget_re,budget,s,count=1)
if n!=1: raise SystemExit(f'budget replacement count {n}')
once('<div><dt>필수 항목</dt><dd>브랜드/회사명, 담당자명, 연락처, 목표 시장, 예산 범위</dd></div>','<div><dt>필수 항목</dt><dd>브랜드/회사명, 담당자명, 목표 시장, 이메일 또는 연락처 중 1개</dd></div>','privacy required')
once('<div><dt>선택 항목</dt><dd>이메일, 관심 플랫폼, 프로젝트 내용</dd></div>','<div><dt>선택 항목</dt><dd>입력하지 않은 연락 수단, 관심 플랫폼, 예산 범위, 프로젝트 내용</dd></div>','privacy optional')

footer='''<div class="footer-bottom">
<p>© 2026 LUEN. All rights reserved.</p>
<p>KOREA × JAPAN CREATOR MARKETING</p>
</div>'''
once(footer,footer+'\n<div class="footer-business-info" aria-label="LUEN 사업자 정보"><span>루엔</span><span>대표 이호규</span><span>사업자등록번호 412-43-01039</span><span>서울특별시 마포구 동교로17안길 10, 3층(서교동)</span><span><a href="privacy.html">개인정보처리방침</a></span></div>','footer info')
once('<script src="assets/js/site.js?v=20260823-2"></script>','<script src="assets/js/site.js?v=20260823-3"></script>\n<script src="assets/js/site-core.js?v=20260823-3"></script>','scripts')
index.write_text(s,encoding='utf-8')

runtime=r'''(()=>{
  /* Runtime-only behavior. Final visual/content DOM is already present in index.html. */
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(isIOS){
    document.documentElement.classList.add('ios-safari');
    const iosStyle=document.createElement('style');
    iosStyle.dataset.luenIosStability='true';
    iosStyle.textContent=`.ios-safari [data-loop-strip] .loop-track,.ios-safari .creator-profile-track{transform:none!important;will-change:auto!important}.ios-safari .chart-runner{display:none!important}@media(max-width:820px){.ios-safari .portfolio-viewport{overflow-x:auto!important;overflow-y:hidden!important;-webkit-overflow-scrolling:touch;scrollbar-width:none}.ios-safari .portfolio-viewport::-webkit-scrollbar{display:none}.ios-safari .portfolio-track{width:max-content!important}.ios-safari .creator-profile-viewport{overflow-x:auto!important;-webkit-overflow-scrolling:touch;scrollbar-width:none}.ios-safari .creator-profile-viewport::-webkit-scrollbar{display:none}.ios-safari .creator-profile-track{width:max-content!important}}`;
    document.head.appendChild(iosStyle);
    document.querySelectorAll('[data-loop-strip]').forEach(el=>{el.dataset.iosLoopSpeed=el.dataset.speed||'';el.removeAttribute('data-loop-strip');});
    document.querySelectorAll('animateMotion, animate').forEach(el=>el.remove());
  }
  const ctaSelector='a.btn[href^="#"], a.nav-contact[href^="#"], a.case-inquiry-btn[href^="#"], a.faq-cta[href^="#"], a.float-cta[href^="#"]';
  const getCtaPosition=link=>link.classList.contains('float-cta')?'floating':link.closest('.mobile-menu')?'mobile_menu':link.closest('.hero')?'hero':link.closest('nav')?'nav':link.closest('.case-studies')?'case':link.closest('.faq')?'faq':link.closest('.final-scene')?'final':'other';
  document.addEventListener('click',event=>{const link=event.target?.closest?.(ctaSelector);if(!link)return;const context={position:getCtaPosition(link),label:(link.dataset.analyticsLabel||link.getAttribute('aria-label')||link.textContent||'CTA').replace(/\s+/g,' ').trim().slice(0,80)};window.__luenLastCtaContext=context;if(typeof queueMicrotask==='function')queueMicrotask(()=>{if(window.__luenLastCtaContext===context)window.__luenLastCtaContext=null;});else Promise.resolve().then(()=>{if(window.__luenLastCtaContext===context)window.__luenLastCtaContext=null;});},true);
  if(typeof window.gtag==='function'&&!window.gtag.__luenCtaPositionEnhanced){const originalGtag=window.gtag;const enhancedGtag=function(...args){if(args[0]==='event'&&args[1]==='cta_click'){const context=window.__luenLastCtaContext;if(context)args[2]={...(args[2]||{}),cta_label:context.label,cta_position:context.position};}return originalGtag.apply(this,args);};enhancedGtag.__luenCtaPositionEnhanced=true;window.gtag=enhancedGtag;}
  const viewport=document.querySelector('.creator-profile-viewport'),track=viewport?.querySelector('.creator-profile-track'),source=viewport?.querySelector('.creator-profile-set');
  if(viewport&&track&&source&&!isIOS){const clone=source.cloneNode(true);clone.setAttribute('aria-hidden','true');track.appendChild(clone);const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');let offset=0,last=performance.now(),baseWidth=source.getBoundingClientRect().width,raf=0,visible=true;const stop=()=>{if(raf){cancelAnimationFrame(raf);raf=0;}};const tick=now=>{raf=0;if(!visible||document.hidden||reducedMotion.matches)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(baseWidth>0){offset=(offset+60*dt)%baseWidth;track.style.transform=`translate3d(${-offset}px,0,0)`;}raf=requestAnimationFrame(tick);};const start=()=>{if(raf||!visible||document.hidden||reducedMotion.matches)return;last=performance.now();raf=requestAnimationFrame(tick);};const sync=()=>{if(reducedMotion.matches){stop();track.style.transform='none';return;}if(document.hidden||!visible)stop();else start();};if('ResizeObserver'in window)new ResizeObserver(()=>{baseWidth=source.getBoundingClientRect().width||baseWidth;}).observe(viewport);if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=Boolean(entries[0]?.isIntersecting);sync();},{rootMargin:'160px 0px',threshold:0}).observe(viewport);document.addEventListener('visibilitychange',sync);reducedMotion.addEventListener?.('change',sync);sync();}
  document.querySelector('.luen-content-video video')?.addEventListener('play',()=>{if(typeof window.gtag==='function')window.gtag('event','video_play',{video_provider:'self_hosted',video_asset:'luen-content-trim.mp4',video_position:'content'});},{once:true});
})();
'''
(root/'assets/js/site.js').write_text(runtime,encoding='utf-8')

vs=root/'assets/css/visual-simplify.css'
v=vs.read_text(encoding='utf-8')
marker='/* STATIC SOURCE CONSOLIDATION · 2026-08-23 */'
if marker not in v:
    v+='''\n\n/* STATIC SOURCE CONSOLIDATION · 2026-08-23 */
.outcome-strip .proof-item strong{font-family:"Pretendard Variable","Pretendard",sans-serif;font-size:clamp(22px,2vw,31px);line-height:1.28;letter-spacing:-.035em;min-height:0}
.outcome-strip .proof-item p{min-height:0}
.footer-business-info{display:flex;flex-wrap:wrap;align-items:center;gap:7px 12px;margin-top:22px;padding-top:18px;border-top:1px solid rgba(245,243,238,.12);color:#9B968D;font-size:12px;line-height:1.6}
.footer-business-info span{display:inline-flex;align-items:center;gap:7px}
.footer-business-info span+span::before{content:"";width:3px;height:3px;border-radius:50%;background:#D96532}
.footer-business-info a{color:#9B968D;font-weight:700;text-decoration:none;border-bottom:1px solid rgba(245,243,238,.22)}
.footer-business-info a:hover,.footer-business-info a:focus-visible{color:#F5F3EE;border-color:#D96532;outline:none}
@media(max-width:767px){.outcome-strip .proof-item strong{font-size:23px;line-height:1.34}}
@media(max-width:640px){.footer-business-info{align-items:flex-start;flex-direction:column;gap:5px;font-size:11.5px}.footer-business-info span+span::before{display:none}}
'''
    vs.write_text(v,encoding='utf-8')

cv=root/'assets/css/content-video.css'
c=cv.read_text(encoding='utf-8').replace('content-video-base.css?v=20260823-2','content-video-base.css?v=20260823-3').replace('visual-simplify.css?v=20260823-2','visual-simplify.css?v=20260823-3')
cv.write_text(c,encoding='utf-8')
pn=root/'assets/css/platform-network.css'
p=pn.read_text(encoding='utf-8').replace('platform-network-base.css?v=20260823-2','platform-network-base.css?v=20260823-3').replace('initial-theme.css?v=20260823-2','initial-theme.css?v=20260823-3')
pn.write_text(p,encoding='utf-8')
legacy=root/'assets/js/site-base.js'
if legacy.exists(): legacy.unlink()
print('Static source consolidation complete')
