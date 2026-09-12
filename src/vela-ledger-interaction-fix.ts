/* Vela — keep card editing separate from card actions. */
const INTERACTIVE = 'button,a,input,select,textarea,[role="button"]';
function bind(){
  document.querySelectorAll<HTMLElement>('[data-vela-entry-id]').forEach(card=>{
    if(card.dataset.velaInteractionFix==='1') return;
    card.dataset.velaInteractionFix='1';
    card.addEventListener('click',e=>{
      const target=e.target as HTMLElement|null;
      if(target?.closest(INTERACTIVE)) e.stopPropagation();
    },true);
  });
}
const root=document.getElementById('root')||document.body;
new MutationObserver(bind).observe(root,{childList:true,subtree:true});
bind();
