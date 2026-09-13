(() => {
  const PLAN_KEY = 'vela.plan.v1';
  const PLANS_KEY = 'vela.plans.v1';
  const CURRENT_KEY = 'vela.trip.current.v1';
  const ROOT_ID = 'vela-trip-hub';

  const read = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  };
  const writePlans = (plans) => localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  const normalize = (plans) => Array.isArray(plans) ? plans.filter(p => p && typeof p.id === 'string') : [];
  const current = () => read(PLAN_KEY, null);

  function seed() {
    const p = current();
    let plans = normalize(read(PLANS_KEY, []));
    if (p?.id) {
      const i = plans.findIndex(x => x.id === p.id);
      if (i >= 0) plans[i] = p;
      else plans.unshift(p);
      writePlans(plans);
      localStorage.setItem(CURRENT_KEY, p.id);
      return;
    }
    if (plans.length) {
      const id = localStorage.getItem(CURRENT_KEY) || plans[0].id;
      const active = plans.find(x => x.id === id) || plans[0];
      localStorage.setItem(CURRENT_KEY, active.id);
      localStorage.setItem(PLAN_KEY, JSON.stringify(active));
    }
  }

  seed();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dates = p => p.startDate && p.endDate ? `${p.startDate} — ${p.endDate}` : 'Dates not set';
  const destination = p => Array.isArray(p.destinations) && p.destinations.length ? p.destinations.join(' · ') : 'Destination not set';
  const entries = p => Array.isArray(p.ledger) ? p.ledger.length : 0;

  function activeAndPlans() {
    let plans = normalize(read(PLANS_KEY, []));
    const p = current();
    const currentId = localStorage.getItem(CURRENT_KEY) || p?.id || plans[0]?.id;
    if (p?.id) {
      const i = plans.findIndex(x => x.id === p.id);
      if (i >= 0) plans[i] = p; else plans.unshift(p);
    }
    const active = plans.find(x => x.id === currentId) || p || plans[0] || null;
    if (active?.id) {
      const i = plans.findIndex(x => x.id === active.id);
      if (i >= 0 && p?.id === active.id) plans[i] = p;
      else if (i < 0) plans.unshift(active);
    }
    if (plans.length) writePlans(plans);
    return { active, plans };
  }

  function makePlan() {
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const me = { id: uid(), name: 'Me', ratio: 100 };
    return {
      id: uid(), name: 'New Journey', startDate: '', endDate: '', destinations: [], settlementCurrency: 'CNY', status: 'Planning',
      members: [me], accounts: [
        { id: uid(), name: 'Cash' }, { id: uid(), name: 'Bank Card' }, { id: uid(), name: 'Alipay' }, { id: uid(), name: 'WeChat Pay' }
      ], events: [], ledger: []
    };
  }

  function switchTrip(id) {
    const { plans } = activeAndPlans();
    const target = plans.find(p => p.id === id);
    if (!target) return;
    localStorage.setItem(CURRENT_KEY, target.id);
    localStorage.setItem(PLAN_KEY, JSON.stringify(target));
    location.reload();
  }

  function createTrip() {
    const { plans } = activeAndPlans();
    const p = makePlan();
    plans.unshift(p);
    writePlans(plans);
    localStorage.setItem(CURRENT_KEY, p.id);
    localStorage.setItem(PLAN_KEY, JSON.stringify(p));
    location.reload();
  }

  function render() {
    const home = Array.from(document.querySelectorAll('.home-page'))[0];
    if (!home) return;
    const { active, plans } = activeAndPlans();
    if (!active?.id) return;

    const existing = home.querySelector(`#${ROOT_ID}`);
    if (existing) {
      const signature = JSON.stringify({active, count: plans.length});
      if (existing.dataset.signature === signature) return;
      existing.remove();
    }

    const others = plans.filter(p => p.id !== active.id && p.status !== 'Completed');
    const hub = document.createElement('section');
    hub.id = ROOT_ID;
    hub.dataset.signature = JSON.stringify({active, count: plans.length});
    hub.innerHTML = `
      <section class="vela-current-trip">
        <div class="vela-trip-section-head">
          <div><span class="eyebrow">CURRENT TRIP</span><h3>${esc(active.name || 'New Journey')}</h3></div>
          <span class="vela-trip-live">${esc(active.status || 'Planning')}</span>
        </div>
        <div class="vela-trip-meta"><span>${esc(destination(active))}</span><span>${esc(dates(active))}</span></div>
        <div class="vela-current-note"><strong>All Quick Entry payments go here.</strong><small>${entries(active)} ledger ${entries(active) === 1 ? 'entry' : 'entries'} · ${esc(active.settlementCurrency || 'CNY')}</small></div>
      </section>
      <section class="vela-trip-list">
        <div class="vela-trip-section-head"><div><span class="eyebrow">TRIPS IN PLAN</span><h3>Trips in Plan</h3></div><button type="button" class="vela-trip-new">+ New Trip</button></div>
        ${others.length ? `<div class="vela-trip-cards">${others.map(p => `
          <button type="button" class="vela-trip-card" data-trip-id="${esc(p.id)}">
            <span class="vela-trip-card-main"><strong>${esc(p.name || 'New Journey')}</strong><small>${esc(destination(p))}</small><small>${esc(dates(p))}</small></span>
            <span class="vela-trip-card-side"><i>${esc(p.status || 'Planning')}</i><b>${entries(p)}</b><small>entries</small></span>
          </button>`).join('')}</div>` : `<div class="vela-trip-empty">No other trips in plan.<br><small>+ New Trip keeps another journey alongside this one.</small></div>`}
      </section>`;

    const tabs = home.querySelector('.category-tabs');
    home.insertBefore(hub, tabs || home.querySelector('.home-recent') || home.lastElementChild);
    hub.querySelector('.vela-trip-new')?.addEventListener('click', createTrip);
    hub.querySelectorAll('[data-trip-id]').forEach(btn => btn.addEventListener('click', () => switchTrip(btn.dataset.tripId)));
  }

  const boot = () => {
    const tick = () => render();
    tick();
    const root = document.getElementById('root') || document.body;
    new MutationObserver(tick).observe(root, { childList: true, subtree: true });
    setInterval(tick, 800);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
