(() => {
  const QUILL='/E338C85B-A1F5-4DB3-9C3C-E03DC47C6380.png';
  function install(){
    const home=document.querySelector('.vela-clean-home');
    const newTrip=document.querySelector('.vela-clean-new');
    if(!home||!newTrip||home.dataset.actionsInstalled==='1')return;
    home.dataset.actionsInstalled='1';
    const oldQuill=newTrip.querySelector('.vela-clean-quill');
    oldQuill?.remove();
    const quick=document.createElement('button');
    quick.type='button';
    quick.className='vela-clean-quick';
    quick.setAttribute('aria-label','Record a payment');
    quick.innerHTML=`<img src="${QUILL}" alt="Record a payment">`;
    quick.onclick=()=>document.querySelector('.home-quick')?.click() || document.querySelector('.bottom-nav button:nth-child(2)')?.click();
    home.append(quick);
  }
  const start=()=>setInterval(install,100);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
