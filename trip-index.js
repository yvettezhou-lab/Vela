(() => {
  const KEY='vela.trips.v1', PLAN_KEY='vela.plan.v1', ARCHIVE_KEY='vela.plan.archive.v1';
  const read=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const blankTrip=base=>({...clone(base||{}),id:uid(),name:'New Journey',startDate:'',endDate:'',destinations:[],status:'Planning',events:[],ledger:[],members:(base?.members||[{id:uid(),name:'Me',ratio:100}]).map(m=>({...m,id:uid()})),accounts:(base?.accounts||[{id:uid(),name:'Cash'}]).map(a=>({...a,id:uid()}))});
  function state(){let s=read(KEY,null),current=read(PLAN_KEY,null);if(!s||!Array.isArray(s.trips))s={activeId:current?.id||uid(),trips:current?[clone(current)]:[]};if(current&&!s.trips.some(t=>t.id===current.id))s.trips.unshift(clone(current));if(current)s.activeId=current.id;write(KEY,s);return s}
  function sync(){const s=state(),current=read(PLAN_KEY,null),archived=read(ARCHIVE_KEY,[]),archivedIds=new Set(archived.map(x=>x.plan?.id));s.trips=s.trips.filter(t=>!archivedIds.has(t.id));if(current){const i=s.trips.findIndex(t=>t.id===current.id);if(i>=0)s.trips[i]=clone(current);else s.trips.unshift(clone(current));s.activeId=current.id}write(KEY,s);return s}
  function make(){const s=sync(),current=read(PLAN_KEY,null),trip=blankTrip(current||s.trips[0]);s.trips.unshift(trip);s.activeId=trip.id;write(KEY,s);write(PLAN_KEY,trip);location.reload()}
  function switchTo(id){const s=sync(),target=s.trips.find(t=>t.id===id);if(!target||id===s.activeId)return;write(KEY,{...s,activeId:id});write(PLAN_KEY,clone(target));location.reload()}
  const dateLabel=t=>{if(!t.startDate&&!t.endDate)return 'Dates not set';if(t.startDate&&t.endDate){const a=new Date(`${t.startDate}T00:00:00`),b=new Date(`${t.endDate}T00:00:00`),days=Math.round((b-a)/86400000)+1;return `${a.toLocaleDateString(undefined,{day:'numeric',month:'short'})} — ${b.toLocaleDateString(undefined,{day:'numeric',month:'short'})} · ${days} days`}return t.startDate||t.endDate};
  const isEmptyDraft=t=>(t.name||'New Journey')==='New Journey'&&!t.startDate&&!t.endDate&&!t.destinations?.length&&!t.ledger?.length;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function buildHome(){
    const page=document.querySelector('.home-page');if(!page||page.dataset.velaRebuilt==='1')return;
    const openPlan=page.querySelector('.home-topbar .quiet');
    const quick=page.querySelector('.home-quick');
    const s=sync();const current=s.trips.find(t=>t.id===s.activeId)||read(PLAN_KEY,null)||{name:'New Journey',destinations:[],startDate:'',endDate:'',ledger:[]};
    page.dataset.velaRebuilt='1';page.replaceChildren();
    const shell=document.createElement('div');shell.className='vela-clean-home';shell.setAttribute('aria-label','Vela Home');
    shell.innerHTML=`
      <header class="vela-home-header">
        <div class="vela-wordmark">Vela</div>
        <div class="vela-header-kicker">TRAVEL JOURNAL</div>
      </header>
      <main class="vela-home-content">
        <section class="vela-current-card" role="button" tabindex="0" aria-label="Open current trip">
          <div class="vela-card-kicker">CURRENT TRIP</div>
          <h1>${esc(current.name||'New Journey')}</h1>
          <div class="vela-current-meta">
            <span>${esc(current.destinations?.length?current.destinations.join(' · '):'Choose a destination')}</span>
            <span>${esc(dateLabel(current))}</span>
          </div>
          <span class="vela-card-arrow" aria-hidden="true">↗</span>
        </section>
        <button class="vela-new-trip" type="button">
          <span class="vela-new-icon">＋</span>
          <span><b>Start a New Trip</b><small>Create a new journey</small></span>
          <strong aria-hidden="true">→</strong>
        </button>
        <section class="vela-recent-section">
          <div class="vela-section-head"><div><span class="vela-card-kicker">YOUR JOURNEYS</span><h2>Recent Trips</h2></div><button class="vela-view-all" type="button">View All <span>→</span></button></div>
          <div class="vela-recent-list"></div>
        </section>
      </main>`;
    const currentCard=shell.querySelector('.vela-current-card');currentCard.onclick=()=>openPlan?.click();currentCard.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')currentCard.click()};
    shell.querySelector('.vela-new-trip').onclick=make;
    const goLogbook=()=>document.querySelector('.bottom-nav button:nth-child(4)')?.click();shell.querySelector('.vela-view-all').onclick=goLogbook;
    const list=shell.querySelector('.vela-recent-list');const others=s.trips.filter(t=>t.id!==current.id&&!isEmptyDraft(t)).slice(0,4);
    if(!others.length){list.innerHTML='<div class="vela-empty"><span>✦</span><p>Your next journey will appear here.</p></div>'}else others.forEach(t=>{const row=document.createElement('button');row.className='vela-recent-row';row.type='button';row.innerHTML=`<span class="vela-recent-mark">${t.destinations?.length?'⌁':'✦'}</span><span class="vela-recent-copy"><b>${esc(t.name||'Untitled trip')}</b><small>${esc(t.destinations?.length?t.destinations.join(' · '):dateLabel(t))}</small></span><span class="vela-recent-date">${esc(dateLabel(t))}</span><strong>›</strong>`;row.onclick=()=>switchTo(t.id);list.append(row)});
    if(quick){quick.className='home-quick vela-clean-quick';quick.setAttribute('aria-label','Quick Entry');shell.append(quick)}
    page.append(shell);
  }
  function start(){buildHome();const observer=new MutationObserver(()=>buildHome());observer.observe(document.getElementById('root')||document.body,{subtree:true,childList:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
