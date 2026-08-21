(()=>{
  const makeSelectedWorkImagesEager=root=>{
    if(!root)return;
    if(root.matches?.('.portfolio-set img')) root.loading='eager';
    root.querySelectorAll?.('.portfolio-set img').forEach(img=>{img.loading='eager';});
  };

  document.querySelectorAll('.portfolio-set img').forEach(img=>{img.loading='eager';});

  const portfolio=document.querySelector('.portfolio');
  if(portfolio&&'MutationObserver' in window){
    new MutationObserver(mutations=>{
      mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{
        if(node.nodeType===1) makeSelectedWorkImagesEager(node);
      }));
    }).observe(portfolio,{childList:true,subtree:true});
  }

  const runtime=document.createElement('script');
  runtime.src='assets/js/site-runtime.js?v=20260820-1';
  runtime.onload=()=>document.querySelectorAll('.portfolio-set img').forEach(img=>{img.loading='eager';});
  document.body.appendChild(runtime);
})();
