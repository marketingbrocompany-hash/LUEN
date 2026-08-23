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

  /* PROJECT INQUIRY · reduce decision anxiety at the final conversion point. */
  const inquiryCopyStyle=document.createElement('style');
  inquiryCopyStyle.textContent=`
    #contact .section-title::after{
      content:"일본 시장, 어떤 방식이 맞는지부터\\A확인하세요."!important;
    }
    #contact .contact-copy::after{
      content:"예산과 크리에이터가 아직 정해지지 않아도 괜찮습니다. 브랜드와 목표만 남겨주시면 가능한 방향부터 함께 정리해드립니다."!important;
    }
  `;
  document.head.appendChild(inquiryCopyStyle);

  const core=document.createElement('script');
  core.src='assets/js/offline-activation-core.js?v=20260823-1';
  core.async=false;
  document.body.appendChild(core);
})();
