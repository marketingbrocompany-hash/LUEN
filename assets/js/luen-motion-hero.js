/* LUEN IN MOTION / three real campaigns orbit on each clip's ENDED event.
   Each item follows an elliptical trajectory; text and faces remain upright. */
(()=>{
  'use strict';
  const root=document.querySelector('[data-luen-motion]');
  if(!root)return;
  const stage=root.querySelector('.luen-motion-canvas');
  const cards=Array.from(root.querySelectorAll('[data-motion-index]'));
  if(!stage||cards.length!==3)return;
  const status=root.querySelector('[data-motion-status]');
  const toggle=root.querySelector('[data-motion-toggle]');
  const progress=root.querySelector('.luen-motion-progress');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  const dataSaver=Boolean(connection&&connection.saveData);
  const automaticMotion=!reduced&&!dataSaver;
  const names=['01 / CONFIER','02 / QUADTHERA','03 / CLINIC'];
  const rotationDuration=960;
  const video=cards.map(card=>card.querySelector('video'));
  let current=0,paused=!automaticMotion,visible=true,rotating=false,destroyed=false;
  let activeAnimations=[];
  let playbackRecoveryTimer=null;
  const clearPlaybackRecovery=()=>{
    if(playbackRecoveryTimer!==null){
      window.clearTimeout(playbackRecoveryTimer);
      playbackRecoveryTimer=null;
    }
  };
  // On unsupported media, stalled decoding or a failed play() promise, show
  // the poster and keep the campaign orbit moving instead of freezing forever.
  // This is only a visual fallback; it never claims the MP4 actually played.
  const schedulePlaybackRecovery=index=>{
    if(index!==current||paused||!visible||document.hidden||destroyed||rotating)return;
    clearPlaybackRecovery();
    if(!automaticMotion){
      paused=true;
      updateButton();
      return;
    }
    playbackRecoveryTimer=window.setTimeout(()=>{
      playbackRecoveryTimer=null;
      if(index!==current||paused||!visible||document.hidden||destroyed||rotating)return;
      cards[index].dataset.videoFallback='poster';
      rotateTo((index+1)%cards.length);
    },3800);
  };

  const geometry=()=>{
    const rect=stage.getBoundingClientRect();
    return {rx:Math.min(205,rect.width*.32),ry:Math.min(65,rect.height*.16)};
  };
  // 90deg is front (bottom); -30deg is next/rear-right; -150deg is previous/rear-left.
  const angleFor=(index,focus)=>Math.PI/2-(index-focus)*Math.PI*2/3;
  const location=(angle,geo)=>{
    const depth=(Math.sin(angle)+.5)/1.5;
    const scale=.77+.23*depth;
    return {
      transform:'translate(-50%, -50%) translate3d('+(Math.cos(angle)*geo.rx).toFixed(2)+'px,'+
        (Math.sin(angle)*geo.ry).toFixed(2)+'px,0) scale('+scale.toFixed(4)+')',
      opacity:(.75+.25*depth).toFixed(3)
    };
  };
  const updateButton=()=>{
    if(!toggle)return;
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.setAttribute('aria-label',paused?'히어로 영상 재생':'히어로 영상 일시정지');
    toggle.innerHTML=paused?'재생하기 <span aria-hidden="true">▶</span>':'일시정지 <span aria-hidden="true">Ⅱ</span>';
  };
  const updateFocus=()=>{
    cards.forEach((card,index)=>{
      const active=index===current;
      card.classList.toggle('is-active',active);
      card.setAttribute('aria-pressed',String(active));
    });
    if(status)status.textContent=names[current];
    if(progress)progress.style.setProperty('--luen-motion-progress-x',(current*100)+'%');
  };
  const render=()=>{
    const geo=geometry();
    cards.forEach((card,index)=>{
      const angle=angleFor(index,current);
      const slot=location(angle,geo);
      card.style.transform=slot.transform;
      card.style.opacity=slot.opacity;
      card.style.zIndex=index===current?'3':'1';
    });
    updateFocus();
  };
  const stopVideos=()=>{
    clearPlaybackRecovery();
    video.forEach((v,i)=>{
      cards[i].classList.remove('is-playing');
      if(!v)return;
      v.pause();
      try{if(v.readyState>=1)v.currentTime=0;}catch(_err){}
    });
  };
  const playSelected=(forcePlayback=false)=>{
    if(paused||(!visible&&!forcePlayback)||document.hidden||destroyed||rotating)return;
    const v=video[current],card=cards[current],index=current;
    if(!v)return;
    if(!v.getAttribute('src')){
      const src=v.getAttribute('data-src');
      if(!src)return;
      v.src=src; // Only active clip downloaded, no YouTube/Instagram iframe.
      try{v.load();}catch(_err){schedulePlaybackRecovery(index);return;}
    }
    v.muted=true;
    v.playsInline=true;
    // Guard initial loading too: some browsers neither reject play() nor
    // emit an error when a media decoder is unavailable.
    if(automaticMotion)schedulePlaybackRecovery(index);
    let attempt;
    try{attempt=v.play();}
    catch(_err){card.classList.remove('is-playing');schedulePlaybackRecovery(index);return;}
    if(attempt&&typeof attempt.catch==='function')
      attempt.catch(err=>{
        if(index!==current||paused||destroyed)return;
        card.classList.remove('is-playing');
        if(err?.name==='NotAllowedError'){
          // A policy block needs a user gesture; don't spin through posters.
          paused=true;
          updateButton();
          stopVideos();
        }else schedulePlaybackRecovery(index);
      });
  };
  const rotateTo=(index,forcePlayback=false)=>{
    if(destroyed||rotating)return;
    const destination=(index+cards.length)%cards.length;
    if(destination===current){
      stopVideos();
      playSelected(forcePlayback);
      return;
    }
    const origin=current;
    // Automatically advance by 120deg. Manual card selection takes the short arc.
    const forward=(destination-origin+3)%3===1;
    const arc=(forward?1:-1)*Math.PI*2/3;
    stopVideos();
    current=destination;
    updateFocus();
    if(!automaticMotion||typeof cards[0].animate!=='function'){
      render();
      playSelected(forcePlayback);
      return;
    }
    rotating=true;
    const geo=geometry();
    activeAnimations=cards.map((card,i)=>{
      const start=angleFor(i,origin);
      const frames=Array.from({length:21},(_,j)=>{
        const t=j/20;
        return location(start+arc*t,geo);
      });
      card.style.zIndex='3'; // All three arc paths remain visible during rotation.
      return card.animate(frames,{
        duration:rotationDuration,
        easing:'cubic-bezier(.45,0,.2,1)',
        fill:'forwards'
      });
    });
    Promise.all(activeAnimations.map(animation=>animation.finished.catch(()=>null)))
      .then(()=>{
        if(destroyed)return;
        // Commit final positions before dropping temporary keyframe effects.
        render();
        activeAnimations.forEach(animation=>animation.cancel());
        activeAnimations=[];
        rotating=false;
        playSelected(forcePlayback);
      });
  };
  const setPaused=(value)=>{
    paused=value;
    updateButton();
    if(paused)stopVideos();
    else playSelected(true);
  };
  video.forEach((v,i)=>{
    if(!v)return;
    v.addEventListener('playing',()=>{
      if(i===current&&!paused&&visible&&!document.hidden){
        clearPlaybackRecovery();
        delete cards[i].dataset.videoFallback;
        cards[i].classList.add('is-playing');
      }
    });
    v.addEventListener('pause',()=>cards[i].classList.remove('is-playing'));
    v.addEventListener('ended',()=>{
      if(i===current)clearPlaybackRecovery();
      cards[i].classList.remove('is-playing');
      if(i!==current||rotating||destroyed)return;
      if(automaticMotion&&!paused&&visible&&!document.hidden)
        rotateTo((current+1)%3);
      else {paused=true;updateButton();} // Reduced motion / data saver: no auto rotation.
    });
    v.addEventListener('waiting',()=>{if(i===current)schedulePlaybackRecovery(i);});
    v.addEventListener('stalled',()=>{if(i===current)schedulePlaybackRecovery(i);});
    v.addEventListener('error',()=>{
      cards[i].classList.remove('is-playing');
      if(i===current)schedulePlaybackRecovery(i);
    });
  });
  cards.forEach((card,i)=>card.addEventListener('click',()=>{
    if(rotating)return;
    paused=false;
    updateButton();
    rotateTo(i,true);
  }));
  toggle?.addEventListener('click',()=>setPaused(!paused));
  const onVisibility=()=>{
    if(document.hidden){stopVideos();}
    else if(!paused)playSelected();
  };
  document.addEventListener('visibilitychange',onVisibility);
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      visible=entries.some(e=>e.isIntersecting);
      if(!visible)stopVideos();
      else if(!paused)playSelected();
    },{threshold:.2});
    observer.observe(root);
  }
  if('ResizeObserver' in window){
    const observer=new ResizeObserver(()=>{
      if(!rotating)render();
    });
    observer.observe(stage);
  }else window.addEventListener('resize',()=>{if(!rotating)render();},{passive:true});
  updateButton();
  render();
  playSelected();
  window.addEventListener('pagehide',()=>{
    destroyed=true;
    stopVideos();
    activeAnimations.forEach(animation=>animation.cancel());
  },{once:true});
})();
