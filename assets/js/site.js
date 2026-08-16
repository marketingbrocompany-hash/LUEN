(function(){
  const nav=document.getElementById('nav');
  const floatCta=document.getElementById('floatCta');
  const scrollProgress=document.getElementById('scrollProgress');
  let ticking=false;

  function onScroll(){
    if(ticking) return;
    ticking=true;
    requestAnimationFrame(()=>{
      nav.classList.toggle('scrolled',window.scrollY>40);
      floatCta.classList.toggle('show',window.scrollY>window.innerHeight*.72);
      const maxScroll=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      scrollProgress.style.transform='scaleX('+Math.min(1,window.scrollY/maxScroll)+')';
      ticking=false;
    });
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();

  const hamburger=document.getElementById('hamburger');
  const mobileMenu=document.getElementById('mobileMenu');
  const mobileClose=document.getElementById('mobileClose');

  function setMenu(open){
    mobileMenu.classList.toggle('open',open);
    mobileMenu.setAttribute('aria-hidden',String(!open));
    hamburger.setAttribute('aria-expanded',String(open));
    document.body.style.overflow=open?'hidden':'';
  }
  hamburger.addEventListener('click',()=>setMenu(true));
  mobileClose.addEventListener('click',()=>setMenu(false));
  document.querySelectorAll('.mobile-link').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});

  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },{threshold:.08,rootMargin:'0px 0px -40px 0px'});
    document.querySelectorAll('.sr').forEach(el=>io.observe(el));
  }else{
    document.querySelectorAll('.sr').forEach(el=>el.classList.add('in'));
  }


  document.querySelectorAll('.faq-q').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const item=btn.closest('.faq-item');
      const wasOpen=item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(other=>{
        other.classList.remove('open');
        const ob=other.querySelector('.faq-q');
        ob.setAttribute('aria-expanded','false');
        other.querySelector('.faq-a').style.maxHeight='0px';
      });
      if(!wasOpen){
        item.classList.add('open');
        btn.setAttribute('aria-expanded','true');
        const answer=item.querySelector('.faq-a');
        answer.style.maxHeight=answer.scrollHeight+'px';
      }
    });
  });
  document.querySelectorAll('.faq-item.open .faq-a').forEach(a=>a.style.maxHeight=a.scrollHeight+'px');



  const loopControllers=new Map();
  function setupLoopStrip(viewport){
    const track=viewport.querySelector('.loop-track');
    const source=viewport.querySelector('.loop-set:not(.loop-clone)');
    if(!track||!source)return;
    const old=loopControllers.get(viewport);if(old&&old.raf)cancelAnimationFrame(old.raf);
    track.querySelectorAll('.loop-clone').forEach(el=>el.remove());
    track.style.transform='translate3d(0,0,0)';
    const baseWidth=source.getBoundingClientRect().width;if(!baseWidth)return;
    const copies=Math.max(2,Math.ceil((viewport.clientWidth+baseWidth*2)/baseWidth));
    for(let i=0;i<copies;i++){const clone=source.cloneNode(true);clone.classList.add('loop-clone');clone.setAttribute('aria-hidden','true');track.appendChild(clone);}
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){loopControllers.set(viewport,{raf:0});return;}
    let offset=0,last=performance.now();const speed=Math.max(10,Number(viewport.dataset.speed||45));
    const tick=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;offset+=speed*dt;if(offset>=baseWidth)offset-=baseWidth;track.style.transform=`translate3d(${-offset}px,0,0)`;const raf=requestAnimationFrame(tick);loopControllers.set(viewport,{raf});};
    const raf=requestAnimationFrame(tick);loopControllers.set(viewport,{raf});
  }
  function initLoopStrips(){document.querySelectorAll('[data-loop-strip]').forEach(setupLoopStrip);}
  window.addEventListener('load',()=>requestAnimationFrame(initLoopStrips));
  window.addEventListener('resize',()=>{clearTimeout(window.__luenLoopResize);window.__luenLoopResize=setTimeout(initLoopStrips,180);});

  const form=document.getElementById('contactForm');
  const status=document.getElementById('copyStatus');
  form.addEventListener('submit',e=>{
    e.preventDefault();
    if(!form.reportValidity()) return;

    const data=new FormData(form);
    const subject='[LUEN 홈페이지 문의] '+(data.get('company')||'프로젝트 문의');
    const body=[
      '브랜드 / 회사명: '+data.get('company'),
      '담당자명: '+data.get('name'),
      '이메일: '+data.get('email'),
      '연락처: '+(data.get('phone')||'미입력'),
      '목표 시장: '+data.get('market'),
      '관심 플랫폼: '+data.get('platform'),
      '예산 범위: '+(data.get('budget')||'미입력'),
      '',
      '프로젝트 내용',
      data.get('message')
    ].join('\\n');

    const mailto='mailto:Marketingbro.company@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    status.textContent='문의 내용을 작성한 메일 창을 열고 있습니다. 전송 전 이메일과 연락처를 다시 확인해주세요.';
    window.location.href=mailto;
  });

  const voiceStage=document.querySelector('[data-voice-stage]');
  if(voiceStage){
    const items=[...voiceStage.querySelectorAll('.voice-item')];
    const dots=[...voiceStage.querySelectorAll('.voice-dots button')];
    let voiceIndex=0,voiceTimer=null;
    const showVoice=(idx)=>{
      voiceIndex=(idx+items.length)%items.length;
      items.forEach((el,i)=>el.classList.toggle('active',i===voiceIndex));
      dots.forEach((el,i)=>el.classList.toggle('active',i===voiceIndex));
    };
    const startVoice=()=>{ if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return; clearInterval(voiceTimer); voiceTimer=setInterval(()=>showVoice(voiceIndex+1),5200); };
    dots.forEach((btn,i)=>btn.addEventListener('click',()=>{showVoice(i);startVoice();}));
    voiceStage.addEventListener('mouseenter',()=>clearInterval(voiceTimer));
    voiceStage.addEventListener('mouseleave',startVoice);
    startVoice();
  }

})();

;

(()=>{
  const root=document.querySelector('.luen-hero-network');
  if(!root || !window.matchMedia('(pointer:fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const grid=root.querySelector('.lhn-grid');
  const glow=root.querySelector('.lhn-glow');
  root.addEventListener('pointermove',e=>{
    const r=root.getBoundingClientRect();
    const nx=(e.clientX-r.left)/r.width-.5;
    const ny=(e.clientY-r.top)/r.height-.5;
    if(grid) grid.style.transform=`translate(${(-nx*5).toFixed(2)}px,${(-ny*5).toFixed(2)}px)`;
    if(glow){glow.style.marginLeft=`${(nx*6).toFixed(2)}px`;glow.style.marginTop=`${(ny*5).toFixed(2)}px`;}
  });
  root.addEventListener('pointerleave',()=>{
    if(grid) grid.style.transform='translate(0,0)';
    if(glow){glow.style.marginLeft='0';glow.style.marginTop='0';}
  });
})();

;

(function(){
  const map=document.querySelector('#platforms .market-map');
  const svg=map&&map.querySelector('.market-map-lines');
  const hub=map&&map.querySelector('.market-hub');
  if(!map||!svg||!hub)return;
  const selectors=['.jp-youtube','.jp-instagram','.jp-tiktok','.jp-x','.jp-ameba','.kr-google','.kr-youtube','.kr-instagram','.kr-naver'];
  const paths=[...svg.querySelectorAll('path')];
  const maskCircle=svg.querySelector('#marketHubRouteMask circle');

  function redrawMarketRoutes(){
    const mr=map.getBoundingClientRect();
    const hr=hub.getBoundingClientRect();
    const width=map.clientWidth,height=map.clientHeight;
    if(!width||!height)return;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const hx=hr.left-mr.left+hr.width/2;
    const hy=hr.top-mr.top+hr.height/2;
    const hubRadius=Math.max(hr.width,hr.height)/2+11;
    if(maskCircle){maskCircle.setAttribute('cx',hx);maskCircle.setAttribute('cy',hy);maskCircle.setAttribute('r',hubRadius);}

    selectors.forEach((sel,i)=>{
      const node=map.querySelector(sel),path=paths[i];
      if(!node||!path)return;
      const nr=node.getBoundingClientRect();
      const tx=nr.left-mr.left+nr.width/2;
      const ty=nr.top-mr.top+nr.height/2;
      const dx=tx-hx,dy=ty-hy;
      const dist=Math.hypot(dx,dy)||1;
      const ux=dx/dist,uy=dy/dist;
      const sx=hx+ux*hubRadius,sy=hy+uy*hubRadius;
      const halfW=nr.width/2,halfH=nr.height/2;
      const edgeX=Math.abs(ux)<.0001?Infinity:halfW/Math.abs(ux);
      const edgeY=Math.abs(uy)<.0001?Infinity:halfH/Math.abs(uy);
      const edgeDist=Math.min(edgeX,edgeY)+5;
      const ex=tx-ux*edgeDist,ey=ty-uy*edgeDist;
      const mx=(sx+ex)/2,my=(sy+ey)/2;
      const bend=(i%2===0?-1:1)*Math.min(14,dist*.025);
      const cx=mx-uy*bend,cy=my+ux*bend;
      path.setAttribute('d',`M${sx.toFixed(1)} ${sy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    });
  }
  const schedule=()=>requestAnimationFrame(redrawMarketRoutes);
  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('resize',()=>{clearTimeout(window.__luenMarketRouteResize);window.__luenMarketRouteResize=setTimeout(schedule,120)});
  if('ResizeObserver' in window){new ResizeObserver(schedule).observe(map);}
  schedule();
})();

;

(()=>{
  const section=document.querySelector('.case-studies');
  const button=document.querySelector('.mobile-case-more');
  if(!section||!button)return;
  button.addEventListener('click',()=>{
    const open=section.classList.toggle('show-all-cases');
    button.setAttribute('aria-expanded',String(open));
    button.firstChild.nodeValue=open?'사례 접기 ':'다른 사례 3개 더 보기 ';
  });
})();
