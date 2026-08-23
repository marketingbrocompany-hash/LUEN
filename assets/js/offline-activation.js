(()=>{
  const closeFaq=()=>{
    document.querySelectorAll('.faq-item').forEach(item=>{
      item.classList.remove('open');
      item.querySelector('.faq-q')?.setAttribute('aria-expanded','false');
      const answer=item.querySelector('.faq-a');
      if(answer)answer.style.maxHeight='0px';
    });
  };

  closeFaq();
  requestAnimationFrame(closeFaq);

  /* PLATFORM NETWORK · place JP/KR market network immediately above Project Inquiry. */
  const platformSection=document.querySelector('.identity-platform-section');
  const contactSection=document.querySelector('#contact');
  if(platformSection&&contactSection&&contactSection.parentNode){
    contactSection.parentNode.insertBefore(platformSection,contactSection);
  }

  const core=document.createElement('script');
  core.src='assets/js/offline-activation-core.js?v=20260823-1';
  core.async=false;
  document.body.appendChild(core);
})();
