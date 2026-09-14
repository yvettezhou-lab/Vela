(() => {
  const QUILL='/E338C85B-A1F5-4DB3-9C3C-E03DC47C6380.png';
  function mainNavButton(label){
    const nav=document.querySelector('.app > .bottom-nav');
    if(!nav)return null;
    return Array.from(nav.querySelectorAll('button')).find(button=>button.textContent?.trim()===label)||null;
  }
  function install(){
    const home=document.querySelector('.vela-clean-home');
    const newTrip=document.querySelector('.vela-clean-new');
    if(home&&!home.dataset.navBridgeInstalled){
      home.dataset.navBridgeInstalled='1';
      home.addEventListener('click',event=>{
        const target=event.target;
        if(!(target instanceof Element))return;
        const button=target.closest('.vela-bottom-nav button');
        if(!(button instanceof HTMLElement))return;
        const label=button.textContent?.trim()||'';
        const mainButton=mainNavButton(label);
        if(mainButton){
          event.preventDefault();
          event.stopImmediatePropagation();
          mainButton.click();
        }
      },true);
    }
    if(!home||!newTrip||newTrip.dataset.actionsInstalled==='1')return;
    newTrip.dataset.actionsInstalled='1';
    const quick=document.createElement('button');
    quick.type='button';
    quick.className='vela-clean-quick';
    quick.setAttribute('aria-label','Record a payment');
    quick.innerHTML=`<img src="${QUILL}" alt="Record a payment">`;
    quick.onclick=e=>{e.stopPropagation();document.querySelector('.home-quick')?.click() || mainNavButton('Ledger')?.click()};
    newTrip.append(quick);
  }
  const start=()=>setInterval(install,100);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
