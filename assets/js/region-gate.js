(()=>{
  /* Korean / Japanese client entry. The choice is remembered so returning visitors skip the gate. */
  const STORAGE_KEY='luen_client_region';
  const store=value=>{try{localStorage.setItem(STORAGE_KEY,value);}catch(_err){}};
  const read=()=>{try{return localStorage.getItem(STORAGE_KEY);}catch(_err){return null;}};
  const track=region=>{
    if(typeof window.gtag==='function')window.gtag('event','region_select',{region,page_path:window.location.pathname});
  };

  /* Links that switch region (nav, mobile menu, gate) save the choice before navigating. */
  document.addEventListener('click',event=>{
    const link=event.target?.closest?.('[data-region-choice]');
    if(!link)return;
    const region=link.dataset.regionChoice;
    store(region);
    track(region);
    if(region==='ko'&&link.closest('#regionGate')){
      event.preventDefault();
      closeGate();
    }
  });

  const gate=document.getElementById('regionGate');
  if(!gate)return;

  const isBot=/bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent);
  const fromSameSite=(()=>{try{return Boolean(document.referrer)&&new URL(document.referrer).host===window.location.host;}catch(_err){return false;}})();
  const shouldShow=!read()&&!window.location.hash&&!fromSameSite&&!isBot;

  let lastFocus=null;
  function onKeydown(event){
    if(event.key==='Escape'){closeGate();return;}
    if(event.key!=='Tab')return;
    const focusable=[...gate.querySelectorAll('a[href],button:not([disabled])')];
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  function closeGate(){
    if(gate.hidden)return;
    document.removeEventListener('keydown',onKeydown);
    gate.classList.add('is-leaving');
    setTimeout(()=>{
      gate.hidden=true;
      gate.classList.remove('is-leaving');
      document.documentElement.classList.remove('region-gate-open');
      lastFocus?.focus?.();
    },window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:280);
  }
  function openGate(){
    lastFocus=document.activeElement;
    gate.hidden=false;
    document.documentElement.classList.add('region-gate-open');
    document.addEventListener('keydown',onKeydown);
    const preferJa=(navigator.languages||[navigator.language||'']).some(lang=>/^ja\b/i.test(lang));
    gate.querySelector(`[data-region-choice="${preferJa?'ja':'ko'}"]`)?.focus({preventScroll:true});
  }
  gate.addEventListener('click',event=>{if(event.target===gate)closeGate();});

  if(shouldShow)openGate();
})();
