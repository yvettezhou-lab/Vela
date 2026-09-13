(() => {
  const PLAN_KEY = 'vela.plan.v1';
  const PLANS_KEY = 'vela.plans.v1';
  const CURRENT_KEY = 'vela.trip.current.v1';
  const ROOT_ID = 'vela-trip-hub';
  const VISIBLE_LIMIT = 3;
  const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const writePlans = plans => localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  const normalize = plans => Array.isArray(plans) ? plans.filter(p => p && typeof p.id === 'string') : [];
  const current = () => read(PLAN_KEY, null);
  function seed(){
    const p=current(); let plans=normalize(read(PLANS_KEY,[]));
    if(p?.id){const i=plans.findIndex(x=>x.id===p.id); if(i>=0) plans[i]=p; else plans.unshift(p); writePlans(plans); localStorage.setItem(CURRENT_KEY,p.id); return;}
    if(plans.length){const id=localStorage.getItem(CURRENT_KEY)||plans[0].id; const active=plans.find(x=>x.id===id)||plans[0]; localStorage.setItem(CURRENT_KEY,active.id); localStorage.setItem(PLAN_KEY,JSON.stringify(active));}
  }
  seed();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dates=p=>p.startDate&&p.endDate?`${p.startDate} — ${p.endDate}`:'Dates not set';
  const destination=p=>Array.isArray(p.destinations)&&p.destinations.length?p.destinations.join(' · '):'Destination not set';
  const entries=p=>Array.isArray(p.ledger)?p.ledger.length:0;
  const isCompleted=p=>String(p?.status||'').toLowerCase()==='completed';
  function activeAndPlans(){
    let plans=normalize(read(PLANS_KEY,[])); const p=current(); const currentId=localStorage.getItem(CURRENT_KEY)||p?.id||plans[0]?.id;
    if(p?.id){const i=plans.findIndex(x=>x.id===p.id); if(i>=0) plans[i]=p; else plans.unshift(p);}
    const active=plans.find(x=>x.id===currentId)||p||plans[0]||null;
    if(active?.id){const i=plans.findIndex(x=>x.id===active.id); if(i>=0&&p?.id===active.id) plans[i]=p; else if(i<0) plans.unshift(active);}
    if(plans.length) writePlans(plans); return {active,plans};
  }
  function makePlan(){const uid=()=>crypto.randomUUID?crypto.randomUUID():`trip-${Date.now()}-${Math.random().toString(16).slice(2)}`; const me={id:uid(),name:'Me',ratio:100}; return {id:uid(),name:'New Journey',startDate:'',endDate:'',destinations:[],settlementCurrency:'CNY',status:'Planning',members:[me],accounts:[{id:uid(),name:'Cash'},{id:uid(),name:'Bank Card'},{id:uid(),name:'Alipay'},{id:uid(),name:'WeChat Pay'}],events:[],ledger:[]};}
  function switchTrip(id){const {plans}=activeAndPlans(); const target=plans.find(p=>p.id===id); if(!target)return; localStorage.setItem(CURRENT_KEY,target.id); localStorage.setItem(PLAN_KEY,JSON.stringify(target)); location.reload();}
  function createTrip(){const {plans}=activeAndPlans(); const p=makePlan(); plans.unshift(p); writePlans(plans); localStorage.setItem(CURRENT_KEY,p.id); localStorage.setItem(PLAN_KEY,JSON.stringify(p)); location.reload();}
  function card(p,active){return `<button type="button" class="vela-trip-card${active?' is-active':''}" data-trip-id="${esc(p.id)}"><span class="vela-trip-card-main"><strong>${esc(p.name||'New Journey')}</strong><small>${esc(destination(p))}</small><small>${esc(dates(p))}</small></span><span class="vela-trip-card-side"><i>${active?'Current':esc(p.status||'Planning')}</i><b>${entries(p)}</b><small>entries</small><em>›</em></span></button>`;}
  function render(){
    const home=Array.from(document.querySelectorAll('.home-page'))[0]; if(!home)return; const {active,plans}=activeAndPlans(); if(!active?.id&&!plans.length)return;
    const existing=home.querySelector(`#${ROOT_ID}`); const signature=JSON.stringify({active,plans}); if(existing&&existing.dataset.signature===signature)return; existing?.remove();
    const ordered=plans.slice(); const visible=ordered.slice(0,VISIBLE_LIMIT); const hiddenCount=Math.max(0,ordered.length-VISIBLE_LIMIT); const hub=document.createElement('section'); hub.id=ROOT_ID; hub.dataset.signature=signature;
    hub.innerHTML=`<div class="vela-trips-heading"><div><span class="eyebrow">MY TRIPS</span><h2>${ordered.length} ${ordered.length===1?'TRIP':'TRIPS'}</h2></div><div class="vela-trip-counts"><span>IN PROGRESS ${ordered.filter(p=>!isCompleted(p)).length}</span><span>COMPLETED ${ordered.filter(isCompleted).length}</span></div></div><div class="vela-trip-cards" data-trip-cards>${visible.map(p=>card(p,p.id===active?.id)).join('')}</div>${hiddenCount?`<button type="button" class="vela-view-all">View All Trips <span>(${hiddenCount} more)</span><b>›</b></button>`:''}<button type="button" class="vela-trip-new">+ New Trip</button>`;
    const tabs=home.querySelector('.category-tabs'); home.insertBefore(hub,tabs||home.querySelector('.home-recent')||home.lastElementChild);
    hub.querySelectorAll('[data-trip-id]').forEach(btn=>btn.addEventListener('click',()=>switchTrip(btn.dataset.tripId)));
    hub.querySelector('.vela-trip-new')?.addEventListener('click',createTrip);
    hub.querySelector('.vela-view-all')?.addEventListener('click',()=>{const cards=hub.querySelector('[data-trip-cards]'); if(!cards)return; cards.innerHTML=ordered.map(p=>card(p,p.id===active?.id)).join(''); cards.classList.add('is-expanded'); hub.querySelector('.vela-view-all')?.remove(); cards.querySelectorAll('[data-trip-id]').forEach(btn=>btn.addEventListener('click',()=>switchTrip(btn.dataset.tripId)));});
  }
  const boot=()=>{const tick=()=>render(); tick(); const root=document.getElementById('root')||document.body; new MutationObserver(tick).observe(root,{childList:true,subtree:true}); setInterval(tick,800);};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
