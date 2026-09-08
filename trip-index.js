(() => {
  const KEY = 'vela.trips.v1';
  const PLAN_KEY = 'vela.plan.v1';
  const ARCHIVE_KEY = 'vela.plan.archive.v1';
  const CATEGORY_KEY = 'vela.categoryOrder.v1';
  const DEFAULT_CATEGORIES = ['Accommodation','Food','Transport','Shopping','Tickets','Activities','Communication','Other'];
  const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const blankTrip = base => ({ ...clone(base), id: uid(), name: 'New Journey', startDate: '', endDate: '', destinations: [], status: 'Planning', events: [], ledger: [], members: (base?.members || [{id:uid(),name:'Me',ratio:100}]).map(m => ({...m,id:uid()})), accounts: (base?.accounts || [{id:uid(),name:'Cash'}]).map(a => ({...a,id:uid()})) });
  function state() {
    let s = read(KEY, null), current = read(PLAN_KEY, null);
    if (!s || !Array.isArray(s.trips)) { s = { activeId: current?.id || uid(), trips: current ? [clone(current)] : [] }; write(KEY, s); }
    else if (current && !s.trips.some(t => t.id === current.id)) { s.trips.unshift(clone(current)); s.activeId = current.id; write(KEY, s); }
    return s;
  }
  function sync() {
    const current = read(PLAN_KEY, null), s = state();
    if (!current) return s;
    const archived = read(ARCHIVE_KEY, []), archivedIds = new Set(archived.map(x => x.plan?.id));
    s.trips = s.trips.filter(t => !archivedIds.has(t.id));
    const i = s.trips.findIndex(t => t.id === current.id);
    if (i >= 0) s.trips[i] = clone(current); else s.trips.unshift(clone(current));
    s.activeId = current.id; write(KEY, s); return s;
  }
  function make() { const s = sync(), current = read(PLAN_KEY, null), trip = blankTrip(current || s.trips[0]); s.trips.unshift(trip); s.activeId = trip.id; write(KEY, s); write(PLAN_KEY, trip); location.reload(); }
  function switchTo(id) { const s = sync(), target = s.trips.find(t => t.id === id); if (!target || id === s.activeId) return; write(KEY, {...s, activeId:id}); write(PLAN_KEY, clone(target)); location.reload(); }
  function restore(id) { const archived = read(ARCHIVE_KEY, []), found = archived.find(x => x.plan?.id === id); if (!found) return; const s = sync(); s.trips.unshift(clone(found.plan)); s.activeId = found.plan.id; write(KEY, s); write(PLAN_KEY, clone(found.plan)); write(ARCHIVE_KEY, archived.filter(x => x.plan?.id !== id)); location.reload(); }
  function signature() { const s = read(KEY,{activeId:null,trips:[]}), a = read(ARCHIVE_KEY,[]), c = read(CATEGORY_KEY,DEFAULT_CATEGORIES); return `${s.activeId}|${s.trips.map(t=>`${t.id}:${t.name}`).join('|')}|${a.map(x=>x.plan?.id).join('|')}|${c.join(',')}`; }

  function categoryOrder() {
    const saved = read(CATEGORY_KEY, DEFAULT_CATEGORIES);
    return [...saved.filter(x => DEFAULT_CATEGORIES.includes(x)), ...DEFAULT_CATEGORIES.filter(x => !saved.includes(x))];
  }
  function enableCategoryReorder() {
    document.querySelectorAll('.category-tabs').forEach(tabs => {
      if (tabs.dataset.velaReorder === '1') return;
      tabs.dataset.velaReorder = '1';
      const buttons = [...tabs.querySelectorAll('.category-tab')];
      const order = categoryOrder();
      buttons.sort((a,b) => order.indexOf(a.title) - order.indexOf(b.title)).forEach(b => tabs.appendChild(b));
      tabs.setAttribute('aria-description','Drag category tabs left or right to customize their order.');
      let dragging = null, moved = false;
      buttons.forEach(button => {
        button.style.touchAction = 'pan-y';
        button.addEventListener('pointerdown', e => {
          dragging = { button, x:e.clientX, startX:e.clientX };
          moved = false;
          button.setPointerCapture?.(e.pointerId);
          button.style.transition = 'none';
        });
        button.addEventListener('pointermove', e => {
          if (!dragging || dragging.button !== button) return;
          const dx = e.clientX - dragging.x;
          if (Math.abs(e.clientX - dragging.startX) > 7) moved = true;
          if (!moved) return;
          const siblings = [...tabs.querySelectorAll('.category-tab')].filter(x => x !== button);
          const target = siblings.find(s => {
            const r = s.getBoundingClientRect();
            return e.clientX < r.left + r.width / 2;
          });
          if (target) tabs.insertBefore(button, target);
          else tabs.appendChild(button);
          dragging.x = e.clientX;
        });
        button.addEventListener('pointerup', e => {
          if (!dragging || dragging.button !== button) return;
          button.releasePointerCapture?.(e.pointerId);
          button.style.transition = '';
          if (moved) {
            e.preventDefault();
            e.stopPropagation();
            write(CATEGORY_KEY, [...tabs.querySelectorAll('.category-tab')].map(x => x.title));
            button.dataset.velaSuppressClick = '1';
            setTimeout(() => delete button.dataset.velaSuppressClick, 120);
          }
          dragging = null;
        });
        button.addEventListener('click', e => { if (button.dataset.velaSuppressClick === '1') { e.preventDefault(); e.stopPropagation(); } });
      });
    });
  }

  function render() {
    sync();
    document.querySelector('.vela-trip-index')?.remove();
    const s = state(), archived = read(ARCHIVE_KEY, []), rail = document.createElement('aside');
    rail.className='vela-trip-index'; rail.setAttribute('aria-label','Trip index');
    const title=document.createElement('div'); title.className='vela-trip-index-title'; title.textContent='TRIPS'; rail.append(title);
    s.trips.slice(0,12).forEach((trip,i)=>{
      const b=document.createElement('button'); b.className='vela-trip-tab'+(trip.id===s.activeId?' active':''); b.title=trip.name||'Untitled trip';
      const n=document.createElement('span'); n.textContent=String(i+1).padStart(2,'0'); const name=document.createElement('b'); name.textContent=(trip.name||'Untitled').slice(0,22); b.append(n,name); b.onclick=()=>switchTo(trip.id); rail.append(b);
    });
    const add=document.createElement('button'); add.className='vela-trip-add'; add.title='New trip'; add.textContent='+'; add.onclick=make; rail.append(add);
    const ab=document.createElement('button'); ab.className='vela-trip-archived'; ab.textContent='Archived'; ab.onclick=()=>showArchived(read(ARCHIVE_KEY,[])); rail.append(ab);
    document.body.append(rail);
  }

  function enhanceHome() {
    const hero = document.querySelector('.hero');
    if (!hero || document.querySelector('.vela-new-trip')) return;
    const newTrip = document.createElement('button'); newTrip.className='vela-new-trip';
    const copy = document.createElement('span'); copy.innerHTML='Start a New Trip<small>A NEW JOURNEY AWAITS</small>';
    newTrip.append(copy); newTrip.onclick=make;
    hero.after(newTrip);

    const oldSection = [...document.querySelectorAll('.section')].find(x => x.querySelector('h3')?.textContent?.trim() === 'Recent Ledger');
    if (oldSection) {
      const section = document.createElement('section'); section.className='section vela-recent-trips';
      const head=document.createElement('div'); head.className='section-head'; const h=document.createElement('h3'); h.textContent='Recent Trips'; const view=document.createElement('span'); view.textContent='View All →'; head.append(h,view); section.append(head);
      const s=state(), current=s.activeId, trips=s.trips.filter(t=>t.id!==current).slice(0,4);
      if (!trips.length) { const empty=document.createElement('div'); empty.className='vela-recent-empty'; empty.textContent='No other trips yet.'; section.append(empty); }
      trips.forEach(t=>{
        const row=document.createElement('div'); row.className='vela-recent-trip'; row.title='Open '+(t.name||'trip');
        const mark=document.createElement('div'); mark.className='vela-trip-mark'; mark.textContent='✦';
        const info=document.createElement('div'); const name=document.createElement('strong'); name.textContent=t.name||'Untitled'; const dates=document.createElement('small'); dates.textContent=`${t.startDate||'—'} → ${t.endDate||'—'}`; info.append(name,dates); row.append(mark,info); row.onclick=()=>switchTo(t.id); section.append(row);
      });
      oldSection.replaceWith(section);
    }
  }

  function enhanceQuick() {
    document.querySelector('.vela-quick-float')?.remove();
    if (!document.querySelector('.hero')) return;
    const button=document.createElement('button'); button.className='vela-quick-float'; button.title='Add a payment'; button.setAttribute('aria-label','Add a payment');
    button.onclick=()=>document.querySelector('.primary')?.click();
    document.body.append(button);
  }

  function showArchived(items) {
    document.querySelector('.vela-trip-archive-sheet')?.remove();
    const back=document.createElement('div'); back.className='vela-trip-archive-sheet'; const sheet=document.createElement('section'); sheet.className='vela-trip-archive-inner';
    const head=document.createElement('div'); head.className='vela-trip-archive-head'; const title=document.createElement('div'); const eyebrow=document.createElement('span'); eyebrow.textContent='ARCHIVE'; const h=document.createElement('h2'); h.textContent='Archived Trips'; title.append(eyebrow,h); const close=document.createElement('button'); close.textContent='Close'; head.append(title,close); sheet.append(head);
    const list=document.createElement('div'); list.className='vela-trip-archive-list';
    if(!items.length){const p=document.createElement('p');p.textContent='No archived trips.';list.append(p)}
    items.forEach(x=>{const row=document.createElement('div');row.className='vela-trip-archive-row';const info=document.createElement('div');const strong=document.createElement('strong');strong.textContent=x.plan?.name||'Untitled';const small=document.createElement('small');small.textContent=`${x.plan?.startDate||'—'} → ${x.plan?.endDate||'—'}`;info.append(strong,small);const b=document.createElement('button');b.textContent='Restore';b.onclick=()=>restore(x.plan.id);row.append(info,b);list.append(row)});
    sheet.append(list); back.append(sheet); back.onclick=e=>{if(e.target===back)back.remove()}; close.onclick=()=>back.remove(); document.body.append(back);
  }

  const start=()=>{ let last=''; const tick=()=>{ const s=signature(); if(s!==last){last=s;render();} enhanceHome(); enhanceQuick(); enableCategoryReorder(); }; tick(); setInterval(tick,1200); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
