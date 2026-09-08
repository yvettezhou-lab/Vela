(() => {
  function arrange() {
    const page=document.querySelector('.home-page');
    const shell=page?.querySelector('.vela-clean-home');
    if(!shell || shell.dataset.layoutV2==='1') return;
    const hero=shell.querySelector('.vela-clean-map');
    const tabs=shell.querySelector('.vela-clean-tabs');
    const current=shell.querySelector('.vela-clean-current');
    const recent=shell.querySelector('.vela-clean-recent');
    const newTrip=shell.querySelector('.vela-clean-new');
    if(!hero||!tabs||!current||!recent||!newTrip) return;
    shell.dataset.layoutV2='1';
    // The homepage reading order is intentionally: map → recent trips → index → current trip → new trip.
    hero.appendChild(document.createElement('span'));
    shell.append(recent,tabs,current,newTrip);
  }
  const tick=()=>arrange();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tick); else tick();
  new MutationObserver(tick).observe(document.body,{childList:true,subtree:true});
})();
