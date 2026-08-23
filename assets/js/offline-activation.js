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

  /* PROJECT INQUIRY + MOBILE ADVANTAGE · control line breaks and make the five advantage cards swipeable on phones. */
  const inquiryCopyStyle=document.createElement('style');
  inquiryCopyStyle.textContent=`
    #contact .section-title::after{
      content:"일본 시장, 어떤 방식이 맞는지부터 확인하세요."!important;
      white-space:normal!important;
    }
    #contact .contact-copy::after{
      content:"예산과 크리에이터가 아직 정해지지 않아도 괜찮습니다. 브랜드와 목표만 남겨주시면 가능한 방향부터 함께 정리해드립니다."!important;
    }
    @media(max-width:767px){
      #contact .section-title::after{
        content:"일본 시장,\\A어떤 방식이 맞는지부터\\A확인하세요."!important;
        white-space:pre-line!important;
      }

      main#top>.luen-advantage-section.identity-advantage-ready .identity-platform-shell{
        overflow:visible!important;
      }
      main#top>.luen-advantage-section.identity-advantage-ready .luen-advantage-grid{
        box-sizing:border-box!important;
        display:flex!important;
        grid-template-columns:none!important;
        align-items:stretch!important;
        gap:12px!important;
        width:100%!important;
        max-width:none!important;
        overflow-x:auto!important;
        overflow-y:hidden!important;
        padding:4px 18px 14px 0!important;
        scroll-snap-type:x mandatory!important;
        scroll-padding-left:0!important;
        overscroll-behavior-inline:contain!important;
        -webkit-overflow-scrolling:touch!important;
        scrollbar-width:none!important;
        touch-action:pan-x!important;
      }
      main#top>.luen-advantage-section.identity-advantage-ready .luen-advantage-grid::-webkit-scrollbar{
        display:none!important;
      }
      main#top>.luen-advantage-section.identity-advantage-ready .luen-advantage-grid>article{
        box-sizing:border-box!important;
        flex:0 0 84%!important;
        width:auto!important;
        min-width:0!important;
        min-height:220px!important;
        height:auto!important;
        padding:24px 22px!important;
        scroll-snap-align:start!important;
        scroll-snap-stop:always!important;
      }
      main#top>.luen-advantage-section.identity-advantage-ready .luen-advantage-grid>article b{
        display:block!important;
        margin-top:42px!important;
        font-size:20px!important;
        line-height:1.25!important;
        letter-spacing:-.035em!important;
        white-space:normal!important;
        word-break:keep-all!important;
      }
      main#top>.luen-advantage-section.identity-advantage-ready .luen-advantage-grid>article p{
        max-width:none!important;
        margin-top:14px!important;
        font-size:14px!important;
        line-height:1.65!important;
        letter-spacing:-.02em!important;
        white-space:normal!important;
        word-break:keep-all!important;
        overflow-wrap:normal!important;
      }
    }
  `;
  document.head.appendChild(inquiryCopyStyle);

  const core=document.createElement('script');
  core.src='assets/js/offline-activation-core.js?v=20260823-1';
  core.async=false;
  document.body.appendChild(core);
})();
