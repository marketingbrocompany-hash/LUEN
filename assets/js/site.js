(()=>{
  const version='20260823-2';
  const ensureStyle=(dataAttr,href)=>{
    if(document.querySelector(`link[${dataAttr}]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=`${href}?v=${version}`;
    link.setAttribute(dataAttr,'true');
    document.head.appendChild(link);
  };

  ensureStyle('data-luen-current-styles','assets/css/site-current.css');
  ensureStyle('data-luen-content-video-styles','assets/css/content-video.css');

  if(!document.querySelector('script[data-luen-site-base]')){
    const base=document.createElement('script');
    base.src=`assets/js/site-base.js?v=${version}`;
    base.dataset.luenSiteBase='true';
    document.body.appendChild(base);
  }
})();
