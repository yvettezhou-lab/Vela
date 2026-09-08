(() => {
  const KEY = 'vela.trips.v1';
  const PLAN_KEY = 'vela.plan.v1';
  const ARCHIVE_KEY = 'vela.plan.archive.v1';
  const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const blankTrip = base => ({
    ...clone(base), id: uid(), name: 'New Journey', startDate: '', endDate: '', destinations: [], status: 'Planning', events: [], ledger: [],
    members: (base.members || [{id:uid(),name:'Me',ratio:100}]).map(m => ({...m,id:uid()})),
    accounts: (base.accounts || [{id:uid(),name:'Cash'}]).map(a => ({...a,id:uid()}))
  });
  function state() {
    let s = read(KEY, null), current = read(PLAN_KEY, null);
    if (!s || !Array.isArray(s.trips)) {
      s = { activeId: current?.id || uid(), trips: current ? [clone(current)] : [] };
      write(KEY, s);
    } else if (current && !s.trips.some(t => t.id === current.id)) {
      s.trips.unshift(clone(current)); s.activeId = current.id; write(KEY, s);
    }
    return s;
  }
  function sync() {
    const current = read(PLAN_KEY, null), s = state();
    if (!current) return s;
    const archived = read(ARCHIVE_KEY, []);
    const archivedIds = new Set(archived.map(x => x.plan?.id));
    s.trips = s.trips.filter(t => !archivedIds.has(t.id));
    const i = s.trips.findIndex(t => t.id === current.id);
    if (i >= 0) s.trips[i] = clone(current); else s.trips.unshift(clone(current));
    s.activeId = current.id; write(KEY, s); return s;
  }
  function make() {
    const s = sync(), current = read(PLAN_KEY, null);
    const trip = blankTrip(current || s.trips[0]);
    s.trips.unshift(trip); s.activeId = trip.id; write(KEY, s); write(PLAN_KEY, trip); location.reload();
  }
  function switchTo(id) {
    const s = sync(), target = s.trips.find(t => t.id === id);
    if (!target || id === s.activeId) return;
    write(KEY, {...s, activeId:id}); write(PLAN_KEY, clone(target)); location.reload();
  }
  function restore(id) {
    const archived = read(ARCHIVE_KEY, []), found = archived.find(x => x.plan?.id === id);
    if (!found) return;
    const s = sync();
    s.trips.unshift(clone(found.plan)); s.activeId = found.plan.id;
    write(KEY, s); write(PLAN_KEY, clone(found.plan));
    write(ARCHIVE_KEY, archived.filter(x => x.plan?.id !== id)); location.reload();
  }
  function render() {
    sync();
    document.querySelector('.vela-trip-index')?.remove();
    const s = state(), archived = read(ARCHIVE_KEY, []), rail = document.createElement('aside');
    rail.className = 'vela-trip-index';
    rail.setAttribute('aria-label','Trip index');
    const title = document.createElement('div'); title.className='vela-trip-index-title'; title.textContent='TRIPS'; rail.append(title);
    s.trips.slice(0,12).forEach((trip, i) => {
      const b=document.createElement('button'); b.className='vela-trip-tab'+(trip.id===s.activeId?' active':''); b.title=trip.name||'Untitled trip';
      b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span><b>${(trip.name||'Untitled').slice(0,18)}</b>`;
      b.onclick=()=>switchTo(trip.id); rail.append(b);
    });
    const add=document.createElement('button'); add.className='vela-trip-add'; add.title='New trip'; add.textContent='+'; add.onclick=make; rail.append(add);
    const ab=document.createElement('button'); ab.className='vela-trip-archived'; ab.textContent='Archived'; ab.onclick=()=>showArchived(archived); rail.append(ab);
    document.body.append(rail);
  }
  function showArchived(items) {
    document.querySelector('.vela-trip-archive-sheet')?.remove();
    const back=document.createElement('div'); back.className='vela-trip-archive-sheet';
    const sheet=document.createElement('section'); sheet.className='vela-trip-archive-inner';
    sheet.innerHTML='<div class="vela-trip-archive-head"><div><span>ARCHIVE</span><h2>Archived Trips</h2></div><button>Close</button></div>';
    const list=document.createElement('div'); list.className='vela-trip-archive-list';
    if(!items.length){const p=document.createElement('p');p.textContent='No archived trips.';list.append(p)}
    items.forEach(x=>{const row=document.createElement('div');row.className='vela-trip-archive-row';row.innerHTML=`<div><strong>${x.plan?.name||'Untitled'}</strong><small>${x.plan?.startDate||'—'} → ${x.plan?.endDate||'—'}</small></div>`;const b=document.createElement('button');b.textContent='Restore';b.onclick=()=>restore(x.plan.id);row.append(b);list.append(row)});
    sheet.append(list); back.append(sheet); back.onclick=e=>{if(e.target===back)back.remove()}; sheet.querySelector('button').onclick=()=>back.remove(); document.body.append(back);
  }
  const start=()=>{render();setInterval(()=>{sync();},1200);};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
