(() => {
  const PLAN_KEY = 'vela.plan.v1';
  const PLANS_KEY = 'vela.plans.v1';
  const CURRENT_KEY = 'vela.trip.current.v1';
  const ROOT_ID = 'vela-trip-hub';
  const VISIBLE_LIMIT = 3;
  const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const writePlans = plans => localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  const normalizeStatus = p => { const s = String(p?.status || '').toLowerCase(); if (s === 'traveling' || s === 'travelling' || s === 'in progress') return 'traveling'; if (s === 'achieve' || s === 'achieved' || s === 'completed') return 'achieve'; return 'planning'; };
  const normalize = plans => Array.isArray(plans) ? plans.filter(p => p && typeof p.id === 'string').map(p => ({ ...p, status: normalizeStatus(p) })) : [];
  const now = () => Date.now();
  const currentPlan = () => read(PLAN_KEY, null);
  const lastEdited = p => Number(p?.lastEditedAt || p?.updatedAt || p?.createdAt || 0);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const formatDate = value => { if (!value) return ''; const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[1]}.${m[2]}.${m[3]}` : String(value); };
  const dates = p => p.startDate && p.endDate ? `${formatDate(p.startDate)} — ${formatDate(p.endDate)}` : 'DATES NOT SET';
  const destination = p => { const d = Array.isArray(p.destinations) && p.destinations.length ? p.destinations.join(' · ') : ''; return d && d.toLowerCase() !== String(p.name || '').trim().toLowerCase() ? d : ''; };

  function deriveCurrent(plans) {
    const traveling = plans.filter(p => normalizeStatus(p) === 'traveling');
    if (traveling.length) return traveling[0];
    return plans.filter(p => normalizeStatus(p) === 'planning').sort((a,b) => lastEdited(b) - lastEdited(a))[0] || null;
  }
  function seed() {
    const legacy = currentPlan();
    let plans = normalize(read(PLANS_KEY, []));
    if (legacy?.id) { const i = plans.findIndex(x => x.id === legacy.id); const merged = { ...legacy, status: normalizeStatus(legacy), lastEditedAt: legacy.lastEditedAt || now() }; if (i >= 0) plans[i] = { ...plans[i], ...merged }; else plans.unshift(merged); }
    const traveling = plans.filter(p => normalizeStatus(p) === 'traveling');
    if (traveling.length > 1) traveling.slice(1).forEach(p => { p.status = 'planning'; });
    if (plans.length) writePlans(plans);
  }
  function getTrips() {
    let plans = normalize(read(PLANS_KEY, []));
    const legacy = currentPlan();
    if (legacy?.id) { const i = plans.findIndex(x => x.id === legacy.id); const merged = { ...legacy, status: normalizeStatus(legacy), lastEditedAt: legacy.lastEditedAt || now() }; if (i >= 0) plans[i] = { ...plans[i], ...merged }; else plans.unshift(merged); }
    return plans;
  }
  function selectCurrent(plans) {
    const current = deriveCurrent(plans);
    if (current?.id) { localStorage.setItem(CURRENT_KEY, current.id); localStorage.setItem(PLAN_KEY, JSON.stringify(current)); }
    else { localStorage.removeItem(CURRENT_KEY); localStorage.removeItem(PLAN_KEY); }
    return current;
  }
  seed();

  function orderedHomeTrips(plans) {
    const traveling = plans.filter(p => normalizeStatus(p) === 'traveling');
    const planning = plans.filter(p => normalizeStatus(p) === 'planning').sort((a,b) => lastEdited(b) - lastEdited(a));
    const result = [];
    if (traveling[0]) result.push(traveling[0]);
    planning.forEach(p => { if (!result.some(x => x.id === p.id) && result.length < VISIBLE_LIMIT) result.push(p); });
    return { result, planning };
  }

  function routeGraphic(p) {
    const hasDestination = !!destination(p);
    const points = hasDestination ? 4 : 3;
    return `<span class="vela-route-art" aria-hidden="true"><span class="vela-route-line"></span>${Array.from({length:points}, (_,i) => `<i class="vela-route-dot d${i+1}"></i>`).join('')}<span class="vela-route-star">✦</span></span>`;
  }

  function card(p, featured = false, index = 1) {
    const status = normalizeStatus(p);
    const label = status === 'traveling' ? 'TRAVELING' : status === 'achieve' ? 'ACHIEVED' : 'PLANNING';
    const dest = destination(p);
    const classes = `vela-trip-card${featured ? ' is-featured' : ' is-compact'}${status === 'traveling' ? ' is-traveling' : ''}`;
    if (!featured) return `<button type="button" class="${classes}" data-trip-id="${esc(p.id)}"><span class="vela-compact-index">${String(index).padStart(2,'0')}</span><span class="vela-compact-copy"><strong>${esc(p.name || 'New Journey')}</strong><small>${esc(dest || dates(p))}</small></span><span class="vela-compact-status">${label}</span><span class="vela-compact-arrow">↗</span></button>`;
    return `<button type="button" class="${classes}" data-trip-id="${esc(p.id)}"><span class="vela-card-index">${String(index).padStart(2,'0')}</span><span class="vela-card-copy"><span class="vela-trip-status">${label}</span><strong>${esc(p.name || 'New Journey')}</strong>${dest ? `<small class="vela-trip-destination">${esc(dest)}</small>` : ''}<small class="vela-trip-date">${esc(dates(p))}</small></span><span class="vela-card-art">${routeGraphic(p)}<span class="vela-art-caption">JOURNEY / ${String(index).padStart(2,'0')}</span></span><span class="vela-trip-card-arrow" aria-hidden="true">↗</span></button>`;
  }

  function makePlan() {
    const uid = () => crypto.randomUUID ? crypto.randomUUID() : `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const me = { id: uid(), name: 'Me', ratio: 100 };
    return { id: uid(), name: 'New Journey', startDate: '', endDate: '', destinations: [], settlementCurrency: 'CNY', status: 'planning', lastEditedAt: now(), members: [me], accounts: [{id:uid(),name:'Cash'},{id:uid(),name:'Bank Card'},{id:uid(),name:'Alipay'},{id:uid(),name:'WeChat Pay'}], events: [], ledger: [] };
  }
  function openTrip(id) { const plans = getTrips(); const target = plans.find(p => p.id === id); if (!target) return; localStorage.setItem(CURRENT_KEY, target.id); localStorage.setItem(PLAN_KEY, JSON.stringify(target)); location.reload(); }
  function createTrip() { const plans = getTrips(); const p = makePlan(); plans.unshift(p); writePlans(plans); localStorage.setItem(CURRENT_KEY, p.id); localStorage.setItem(PLAN_KEY, JSON.stringify(p)); location.reload(); }
  function attachCards(hub) { hub.querySelectorAll('[data-trip-id]').forEach(btn => btn.addEventListener('click', () => openTrip(btn.dataset.tripId))); }

  function renderAll(hub, plans) {
    const stage = hub.querySelector('[data-trip-cards]');
    if (!stage) return;
    const active = plans.filter(p => normalizeStatus(p) !== 'achieve').sort((a,b) => normalizeStatus(a) === 'traveling' ? -1 : normalizeStatus(b) === 'traveling' ? 1 : lastEdited(b) - lastEdited(a));
    stage.innerHTML = active.length ? active.map((p,i) => card(p,true,i+1)).join('') : `<div class="vela-empty">NO ACTIVE JOURNEYS</div>`;
    let library = hub.querySelector('.vela-trip-library');
    if (!library) { library = document.createElement('div'); library.className = 'vela-trip-library'; hub.appendChild(library); }
    const achieved = plans.filter(p => normalizeStatus(p) === 'achieve');
    library.innerHTML = `<div class="vela-library-head"><span>ACHIEVED</span><em>${achieved.length}</em></div>${achieved.length ? achieved.map((p,i) => card(p,false,i+1)).join('') : '<div class="vela-library-empty">No completed journeys yet</div>'}`;
    hub.classList.add('is-all');
    const allBtn = hub.querySelector('.vela-trip-all'); if (allBtn) allBtn.textContent = 'HOME';
    attachCards(hub);
  }

  function render() {
    const home = document.querySelector('.home-page');
    if (!home) return;
    const plans = getTrips();
    if (!plans.length) return;
    const current = selectCurrent(plans);
    const { result } = orderedHomeTrips(plans);
    const existing = home.querySelector(`#${ROOT_ID}`);
    const signature = JSON.stringify({ plans, current: current?.id || null });
    if (existing && existing.dataset.signature === signature && !existing.classList.contains('is-all')) return;
    existing?.remove();
    const featured = result[0];
    const secondary = result.slice(1);
    const hub = document.createElement('section');
    hub.id = ROOT_ID;
    hub.dataset.signature = signature;
    hub.innerHTML = `<header class="vela-home-trip-head"><div class="vela-home-title"><span class="vela-brand-mark">V</span><div><span class="eyebrow">JOURNEYS</span><small>${plans.filter(p => normalizeStatus(p) !== 'achieve').length} ACTIVE</small></div></div><div class="vela-home-trip-actions"><button type="button" class="vela-trip-all" aria-label="View all trips">ALL TRIPS</button><button type="button" class="vela-trip-new" aria-label="New Trip">＋</button></div></header><div class="vela-trip-stage" data-trip-cards>${featured ? card(featured,true,1) : '<div class="vela-empty">NO ACTIVE JOURNEYS</div>'}</div>${secondary.length ? `<div class="vela-upnext"><div class="vela-upnext-head"><span>UP NEXT</span><span>${secondary.length}</span></div>${secondary.map((p,i) => card(p,false,i+2)).join('')}</div>` : ''}<div class="vela-home-foot"><span>KEEP MOVING</span><span>VELA / ${String(plans.length).padStart(2,'0')}</span></div>`;
    const tabs = home.querySelector('.category-tabs');
    home.insertBefore(hub, tabs || home.querySelector('.home-recent') || home.lastElementChild);
    hub.querySelector('.vela-trip-new')?.addEventListener('click', createTrip);
    hub.querySelector('.vela-trip-all')?.addEventListener('click', () => {
      if (hub.classList.contains('is-all')) { hub.remove(); render(); return; }
      renderAll(hub, getTrips());
    });
    attachCards(hub);
  }

  const boot = () => { const tick = () => render(); tick(); const root = document.getElementById('root') || document.body; new MutationObserver(tick).observe(root, { childList:true, subtree:true }); setInterval(tick, 800); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();