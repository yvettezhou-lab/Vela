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
  function buildHome(){
    const page=document.querySelector('.home-page');if(!page||page.dataset.velaRebuilt==='1')return;
    const openPlan=page.querySelector('.home-topbar .quiet');
    const quick=page.querySelector('.home-quick');
    const s=sync();const current=s.trips.find(t=>t.id===s.activeId)||read(PLAN_KEY,null)||{name:'New Journey',destinations:[],startDate:'',endDate:'',ledger:[]};
    page.dataset.velaRebuilt='1';
    page.replaceChildren();
    const shell=document.createElement('div');shell.className='vela-clean-home';shell.setAttribute('aria-label','Vela Home');
    const currentCard=document.createElement('section');currentCard.className='vela-clean-current';currentCard.setAttribute('role','button');currentCard.setAttribute('tabindex','0');currentCard.innerHTML=`<div class="vela-clean-label">CURRENT TRIP</div><div class="vela-clean-tripline"><b>${current.name||'New Journey'}</b></div><div class="vela-clean-destination">${current.destinations?.length?current.destinations.join(' · '):'Choose a destination'}</div><div class="vela-clean-date">${dateLabel(current)}</div>`;
    currentCard.onclick=()=>openPlan?.click();currentCard.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')currentCard.click()};shell.append(currentCard);
    const newTrip=document.createElement('button');newTrip.className='vela-clean-new';newTrip.type='button';newTrip.setAttribute('aria-label','Start a New Trip');newTrip.innerHTML='<span class="vela-clean-new-copy"><b>Start a New Trip</b></span><strong aria-hidden="true">→</strong>';newTrip.onclick=make;shell.append(newTrip);
    const recent=document.createElement('section');recent.className='vela-clean-recent';recent.innerHTML='<div class="vela-clean-recent-head"><button class="vela-clean-recent-link" type="button"><span>Recent Trips</span></button><button class="vela-clean-viewall" type="button">View All →</button></div><div class="vela-clean-recent-list"></div>';
    const goLogbook=()=>document.querySelector('.bottom-nav button:nth-child(4)')?.click();recent.querySelector('.vela-clean-recent-link').onclick=goLogbook;recent.querySelector('.vela-clean-viewall').onclick=goLogbook;
    const list=recent.querySelector('.vela-clean-recent-list');const others=s.trips.filter(t=>t.id!==current.id&&!isEmptyDraft(t)).slice(0,3);
    if(!others.length){const empty=document.createElement('p');empty.className='vela-clean-empty';empty.textContent='Your next journey will appear here.';list.append(empty)}else others.forEach(t=>{const row=document.createElement('button');row.className='vela-clean-row';row.type='button';row.innerHTML=`<span class="vela-clean-row-mark">✧</span><span class="vela-clean-row-copy"><b>${t.name||'Untitled trip'}</b><small>${dateLabel(t)}</small></span><strong>›</strong>`;row.onclick=()=>switchTo(t.id);list.append(row)});shell.append(recent);
    if(quick){quick.className='home-quick vela-clean-quick';quick.setAttribute('aria-label','Quick Entry');shell.append(quick)}
    page.append(shell);
  }
  function start(){buildHome();const observer=new MutationObserver(()=>buildHome());observer.observe(document.getElementById('root')||document.body,{subtree:true,childList:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
