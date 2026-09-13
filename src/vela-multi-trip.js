(() => {
  const PLAN_KEY = 'vela.plan.v1';
  const PLANS_KEY = 'vela.plans.v1';
  const CURRENT_KEY = 'vela.trip.current.v1';
  const ROOT_ID = 'vela-trip-hub';
  const VISIBLE_LIMIT = 3;

  const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const writePlans = plans => localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  const normalizeStatus = p => {
    const s = String(p?.status || '').toLowerCase();
    if (s === 'traveling' || s === 'travelling' || s === 'in progress') return 'traveling';
    if (s === 'achieve' || s === 'achieved' || s === 'completed') return 'achieve';
    return 'planning';
  };
  const normalize = plans => Array.isArray(plans) ? plans.filter(p => p && typeof p.id === 'string').map(p => ({...p, status: normalizeStatus(p)})) : [];
  const now = () => Date.now();
  const currentPlan = () => read(PLAN_KEY, null);
  const lastEdited = p => Number(p?.lastEditedAt || p?.updatedAt || p?.createdAt || 0);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dates = p => p.startDate && p.endDate ? `${p.startDate} — ${p.endDate}` : 'Dates not set';
  const destination = p => Array.isArray(p.destinations) && p.destinations.length ? p.destinations.join(' · ') : 'Destination not set';

  function deriveCurrent(plans) {
    const traveling = plans.filter(p => normalizeStatus(p) === 'traveling');
    if (traveling.length) return traveling[0];
    return plans.filter(p => normalizeStatus(p) === 'planning').sort((a,b) => lastEdited(b) - lastEdited(a))[0] || null;
  }

  function seed() {
    const legacy = currentPlan();
    let plans = normalize(read(PLANS_KEY, []));
    if (legacy?.id) {
      const i = plans.findIndex(x => x.id === legacy.id);
      const merged = {...legacy, status: normalizeStatus(legacy), lastEditedAt: legacy.lastEditedAt || now()};
      if (i >= 0) plans[i] = {...plans[i], ...merged}; else plans.unshift(merged);
    }
    const traveling = plans.filter(p => normalizeStatus(p) === 'traveling');
    if (traveling.length > 1) traveling.slice(1).forEach(p => { p.status = 'planning'; });
    if (plans.length) writePlans(plans);
  }

  function getTrips() {
    let plans = normalize(read(PLANS_KEY, []));
    const legacy = currentPlan();
    if (legacy?.id) {
      const i = plans.findIndex(x => x.id === legacy.id);
      const merged = {...legacy, status: normalizeStatus(legacy), lastEditedAt: legacy.lastEditedAt || now()};
      if (i >= 0) plans[i] = {...plans[i], ...merged}; else plans.unshift(merged);
    }
    return plans;
  }

  function selectCurrent(plans) {
    const current = deriveCurrent(plans);
    if (current?.id) {
      localStorage.setItem(CURRENT_KEY, current.id);
      localStorage.setItem(PLAN_KEY, JSON.stringify(current));
    } else {
      localStorage.removeItem(CURRENT_KEY);
      localStorage.removeItem(PLAN_KEY);
    }
    return current;
  }

  seed();

  function orderedHomeTrips(plans) {
    const current = deriveCurrent(plans);
    const traveling = plans.filter(p => normalizeStatus(p) === 'traveling');
    const planning = plans.filter(p => normalizeStatus(p) === 'planning').sort((a,b) => lastEdited(b) - lastEdited(a));
    const result = [];
    if (traveling[0]) result.push(traveling[0]);
    planning.forEach(p => { if (!result.some(x => x.id === p.id) && result.length < VISIBLE_LIMIT) result.push(p); });
    return {current, result, planning};
  }

  function card(p, current) {
    const status = normalizeStatus(p);
    const isCurrentPlanning = status === 'planning' && current?.id === p.id && !plansHaveTraveling;
    const classes = `vela-trip-card${status === 'traveling' ? ' is-traveling' : ''}${isCurrentPlanning ? ' is-current-planning' : ''}`;
    const label = status === 'traveling' ? 'TRAVELING' : 'PLANNING';
    return `<button type="button" class="${classes}" data-trip-id="${esc(p.id)}">
      <span class="vela-trip-card-main">
        <span class="vela-trip-status">${label}</span>
        <strong>${esc(p.name || 'New Journey')}</strong>
        <small>${esc(destination(p))}</small>
        <small>${esc(dates(p))}</small>
      </span>
      <span class="vela-trip-card-arrow">›</span>
    </button>`;
  }

  let plansHaveTraveling = false;

  function makePlan() {
    const uid = () => crypto.randomUUID ? crypto.randomUUID() : `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const me = {id: uid(), name: 'Me', ratio: 100};
    return {id: uid(), name: 'New Journey', startDate: '', endDate: '', destinations: [], settlementCurrency: 'CNY', status: 'planning', lastEditedAt: now(), members: [me], accounts: [{id:uid(),name:'Cash'},{id:uid(),name:'Bank Card'},{id:uid(),name:'Alipay'},{id:uid(),name:'WeChat Pay'}], events: [], ledger: []};
  }

  function openTrip(id) {
    const plans = getTrips();
    const target = plans.find(p => p.id === id);
    if (!target) return;
    localStorage.setItem(CURRENT_KEY, target.id);
    localStorage.setItem(PLAN_KEY, JSON.stringify(target));
    location.reload();
  }

  function createTrip() {
    const plans = getTrips();
    const p = makePlan();
    plans.unshift(p);
    writePlans(plans);
    localStorage.setItem(CURRENT_KEY, p.id);
    localStorage.setItem(PLAN_KEY, JSON.stringify(p));
    location.reload();
  }

  function attachCards(hub) {
    hub.querySelectorAll('[data-trip-id]').forEach(btn => btn.addEventListener('click', () => openTrip(btn.dataset.tripId)));
  }

  function render() {
    const home = document.querySelector('.home-page');
    if (!home) return;
    const plans = getTrips();
    if (!plans.length) return;
    const {current, result, planning} = orderedHomeTrips(plans);
    plansHaveTraveling = plans.some(p => normalizeStatus(p) === 'traveling');
    selectCurrent(plans);

    const existing = home.querySelector(`#${ROOT_ID}`);
    const signature = JSON.stringify({plans, current: current?.id || null});
    if (existing && existing.dataset.signature === signature) return;
    existing?.remove();

    const travelingCount = plans.filter(p => normalizeStatus(p) === 'traveling').length;
    const planningCount = plans.filter(p => normalizeStatus(p) === 'planning').length;
    const achieveCount = plans.filter(p => normalizeStatus(p) === 'achieve').length;
    const hiddenCount = Math.max(0, planning.length - result.filter(p => normalizeStatus(p) === 'planning').length);

    const hub = document.createElement('section');
    hub.id = ROOT_ID;
    hub.dataset.signature = signature;
    hub.innerHTML = `
      <div class="vela-trips-heading">
        <div class="vela-trips-title"><span class="eyebrow">MY TRIPS</span><h2>${plans.length} ${plans.length === 1 ? 'TRIP' : 'TRIPS'}</h2></div>
        <button type="button" class="vela-trip-new" aria-label="New Trip">＋</button>
      </div>
      <div class="vela-trip-counts"><span>${travelingCount} TRAVELING</span><span>${planningCount} PLANNING</span><span>${achieveCount} ACHIEVED</span></div>
      ${travelingCount ? `<div class="vela-trip-section-label">TRAVELING</div>` : ''}
      <div class="vela-trip-cards" data-trip-cards>${result.map(p => card(p,current)).join('')}</div>
      ${planningCount ? `<div class="vela-trip-section-row"><span>PLANNING</span>${planning.length > 0 ? `<span class="vela-trip-section-count">${planning.length}</span>` : ''}</div>` : ''}
      <div class="vela-trip-links">
        <button type="button" class="vela-trip-link vela-expenses-link">ALL TRIPS' EXPENSES <b>›</b></button>
        <button type="button" class="vela-trip-link vela-view-all">VIEW ALL TRIPS <b>›</b></button>
      </div>`;

    const tabs = home.querySelector('.category-tabs');
    home.insertBefore(hub, tabs || home.querySelector('.home-recent') || home.lastElementChild);
    hub.querySelector('.vela-trip-new')?.addEventListener('click', createTrip);
    attachCards(hub);
    hub.querySelector('.vela-view-all')?.addEventListener('click', () => {
      const cards = hub.querySelector('[data-trip-cards]');
      if (!cards) return;
      const all = plans.filter(p => normalizeStatus(p) !== 'achieve' || true);
      cards.innerHTML = all.map(p => card(p,current)).join('');
      cards.classList.add('is-expanded');
      hub.querySelector('.vela-trip-section-label')?.remove();
      hub.querySelector('.vela-trip-section-row')?.remove();
      hub.querySelector('.vela-view-all')?.closest('.vela-trip-link')?.remove();
      attachCards(hub);
    });
  }

  const boot = () => {
    const tick = () => render();
    tick();
    const root = document.getElementById('root') || document.body;
    new MutationObserver(tick).observe(root, {childList:true, subtree:true});
    setInterval(tick, 800);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
