import { loadPlan, savePlan } from './domain';

const STYLE = `
#vela-delete-backdrop{position:fixed;inset:0;background:rgba(5,15,24,.48);backdrop-filter:blur(8px);z-index:1100;display:flex;align-items:center;justify-content:center;padding:18px}
#vela-delete-dialog{width:min(420px,100%);background:#f6eddd;color:#30271e;border:1px solid rgba(118,91,52,.32);box-shadow:0 24px 70px rgba(4,12,18,.35);padding:24px}
#vela-delete-dialog .kicker{font:9px ui-monospace,monospace;letter-spacing:.18em;color:#8a6d43}
#vela-delete-dialog h2{font:400 24px Georgia,serif;margin:7px 0 8px}
#vela-delete-dialog p{font:12px ui-sans-serif,system-ui,sans-serif;line-height:1.55;color:#756957;margin:0}
#vela-delete-dialog strong{color:#30271e}
#vela-delete-dialog .actions{display:flex;gap:9px;margin-top:20px}
#vela-delete-dialog button{flex:1;min-height:44px;border:1px solid rgba(93,78,53,.25);background:#eee1c9;color:#514638;cursor:pointer}
#vela-delete-dialog .danger{background:#6f2f2f;color:#fff4e5;border-color:#6f2f2f}
`;
let styleAdded=false;
function addStyle(){if(styleAdded)return;const s=document.createElement('style');s.textContent=STYLE;document.head.appendChild(s);styleAdded=true;}
function confirmDelete(id:string){
  const plan=loadPlan();const entry=plan.ledger.find(e=>e.id===id);if(!entry)return;
  addStyle();
  const backdrop=document.createElement('div');backdrop.id='vela-delete-backdrop';
  backdrop.innerHTML=`<div id="vela-delete-dialog" role="dialog" aria-modal="true"><span class="kicker">LEDGER · REMOVE ENTRY</span><h2>Delete this payment?</h2><p>This will permanently remove <strong>${entry.description.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}</strong> from the ledger and recalculate the balance.</p><div class="actions"><button id="vd-cancel">Cancel</button><button id="vd-delete" class="danger">Delete Payment</button></div></div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#vd-cancel')?.addEventListener('click',()=>backdrop.remove());
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});
  backdrop.querySelector('#vd-delete')?.addEventListener('click',()=>{
    const latest=loadPlan();const next={...latest,ledger:latest.ledger.filter(e=>e.id!==id)};savePlan(next);location.reload();
  });
}
function bind(){
  document.querySelectorAll<HTMLElement>('[data-vela-entry-id]').forEach(card=>{
    if(card.dataset.velaDeleteBound)return;card.dataset.velaDeleteBound='1';
    const button=document.createElement('button');button.type='button';button.className='vela-delete-entry';button.textContent='×';button.setAttribute('aria-label','Delete entry');
    button.style.cssText='position:absolute;right:10px;top:10px;width:28px;height:28px;border:0;background:transparent;color:#8a6d43;font:18px Georgia,serif;cursor:pointer;opacity:.62';
    const position=getComputedStyle(card).position;if(position==='static')card.style.position='relative';
    button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();confirmDelete(card.dataset.velaEntryId!);});card.appendChild(button);
  });
}
const observer=new MutationObserver(bind);observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true});bind();
