/* LUEN IN MOTION / isolated homepage hero behavior — no external players */
(()=>{
  'use strict';
  const root=document.querySelector('[data-luen-motion]');
  if(!root)return;
  const cards=Array.from(root.querySelectorAll('[data-motion-index]'));
  if(cards.length!==3)return;
  const status=root.querySelector('[data-motion-status]');
  const toggle=root.querySelector('[data-motion-toggle]');
  const progress=root.querySelector('.luen-motion-progress');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  const dataSaver=Boolean(connection&&connection.saveData);
  const automaticMotion=!reduced&&!dataSaver;
  const intervalMs=7000;
  const names=['01 / CONFIER','02 / QUADTHERA','03 / CLINIC'];
  let current=0,paused=!automaticMotion,visible=true,interval=null,destroyed=false;
  const videos=cards.map(card=>card.querySelector('video'));

  const updateButton=()=>{
    if(!toggle)return;
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.setAttribute('aria-label',paused?'히어로 영상 재생':'히어로 영상 일시정지');
    toggle.innerHTML=paused?'재생하기 <span aria-hidden="true">▶</span>':'일시정지 <span aria-hidden="true">Ⅱ</span>';
  };
  const stopVideos=()=>{
    for(let i=0;i<videos.length;i++){
      const video=videos[i],card=cards[i];
      card.classList.remove('is-playing');
      if(video){
        video.pause();
        try{if(video.readyState>=1)video.currentTime=0;}catch(_err){}
      }
    }
  };
  const playSelected=(forcePlayback=false)=>{
    if(paused||(!visible&&!forcePlayback)||document.hidden||destroyed)return;
    const video=videos[current],card=cards[current];
    if(!video)return;
    if(!video.getAttribute('src')){
      const src=video.getAttribute('data-src');
      if(!src)return;
      video.src=src; // Download only the active campaign clip.
      video.load();
    }
    video.muted=true;
    video.playsInline=true;
    const attempt=video.play();
    if(attempt&&typeof attempt.catch==='function')attempt.catch(()=>card.classList.remove('is-playing'));
  };
  const select=(index,forcePlayback=false)=>{
    if(destroyed)return;
    current=(index+cards.length)%cards.length;
    stopVideos();
    cards.forEach((card,i)=>{
      const active=i===current;
      card.classList.toggle('is-active',active);
      card.setAttribute('aria-pressed',String(active));
    });
    if(status)status.textContent=names[current];
    if(progress)progress.style.setProperty('--luen-motion-progress-x',String(current*100)+'%');
    playSelected(forcePlayback);
  };
  const pauseInterval=()=>{if(interval!==null){clearInterval(interval);interval=null;}};
  const schedule=()=>{
    pauseInterval();
    if(!paused&&visible&&!document.hidden&&automaticMotion)
      interval=window.setInterval(()=>select(current+1),intervalMs);
  };
  const setPaused=(state)=>{
    paused=state;
    updateButton();
    if(state)stopVideos();
    else playSelected();
    schedule();
  };
  videos.forEach((video,i)=>{
    if(!video)return;
    video.addEventListener('playing',()=>{
      if(i===current&&!paused&&visible&&!document.hidden){
        cards[i].classList.add('is-playing');
      }
    });
    video.addEventListener('pause',()=>cards[i].classList.remove('is-playing'));
    video.addEventListener('ended',()=>cards[i].classList.remove('is-playing'));
    video.addEventListener('error',()=>cards[i].classList.remove('is-playing'));
  });
  cards.forEach((card,i)=>card.addEventListener('click',()=>{
    paused=false;
    updateButton();
    select(i,true); // Explicit user interaction always starts requested clip.
    schedule();
  }));
  toggle?.addEventListener('click',()=>setPaused(!paused));
  const onVisibility=()=>{
    if(document.hidden){stopVideos();pauseInterval();}
    else {if(!paused)playSelected();schedule();}
  };
  document.addEventListener('visibilitychange',onVisibility);
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      visible=entries.some(e=>e.isIntersecting);
      if(!visible){stopVideos();pauseInterval();}
      else{if(!paused)playSelected();schedule();}
    },{threshold:0.2});
    observer.observe(root);
  }
  updateButton();
  select(0);
  schedule();
  window.addEventListener('pagehide',()=>{destroyed=true;stopVideos();pauseInterval();},{once:true});
})();
