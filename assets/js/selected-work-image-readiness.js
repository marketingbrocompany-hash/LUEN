/* LUEN Works Archive — image-readiness guard for moving YouTube/Reels rails.
 * Images must be fetched before entering the moving viewport, rather than
 * relying on native lazy-loading of constantly translated cards.
 * Scoped to the existing #selected-content only. No new media or motion.
 */
(()=>{
  'use strict';
  const section=document.getElementById('selected-content');
  if(!section)return;
  const tracks=[...section.querySelectorAll('.portfolio-track')];
  if(!tracks.length)return;
  let activated=false;
  const markReady=img=>{
    if(img.dataset.luenRailReady==='1' && img.loading==='eager')return;
    img.dataset.luenRailReady='1';
    // Keep initial page loading light until the gallery is near the viewport.
    // A clone may override loading back to "lazy"; observe it and restore eager.
    img.loading='eager';
    img.fetchPriority='low';
  };
  const activate=()=>{
    if(activated)return;
    activated=true;
    tracks.forEach(track=>{
      track.querySelectorAll('img').forEach(markReady);
      new MutationObserver(records=>{
        for(const record of records){
          for(const node of record.addedNodes){
            if(node.nodeType!==1)continue;
            if(node.matches?.('img'))markReady(node);
            node.querySelectorAll?.('img').forEach(markReady);
          }
        }
      }).observe(track,{childList:true,subtree:true});
    });
  };
  if(!('IntersectionObserver' in window)){activate();return;}
  const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();
    activate();
  },{rootMargin:'900px 0px',threshold:0});
  observer.observe(section);
})();
