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
    } else if (plans.length) {
      const id = localStorage.getItem(CURRENT_KEY) || plans[0].id;
      const active = plans.find(x => x.id === id) || plans[0];
      localStorage.setItem(CURRENT_KEY, active.id);
      localStorage.setItem(PLAN_KEY, JSON.stringify(active));
    }
  }

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    if (key !== PLAN_KEY) return;
    try {
      const p = JSON.parse(value);
      if (!p?.id) return;
      const plans = normalize(read(PLANS_KEY, []));
      const i = plans.findIndex(x => x.id === p.id);
      if (i >= 0) plans[i] = p; else plans.unshift(p);
      originalSetItem(PLANS_KEY, JSON.stringify(plans));
      originalSetItem(CURRENT_KEY, p.id);
    } catch {}
  };

  seed();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dates = p => p.startDate && p.endDate ? `${p.startDate} — ${p.endDate}` : 'Dates not set';
  const destination = p => Array.isArray(p.destinations) && p.destinations.length ? p.destinations.join(' · ') : 'Destination not set';
  const entries = p => Array.isArray(p.ledger) ? p.ledger.length : 0;

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
    const plans = normalize(read(PLANS_KEY, []));
    const target = plans.find(p => p.id === id);
    if (!target) return;
    originalSetItem(CURRENT_KEY, target.id);
    originalSetItem(PLAN_KEY, JSON.stringify(target));
    location.reload();
  }

  function createTrip() {
    const p = makePlan();
    const plans = normalize(read(PLANS_KEY, []));
    plans.unshift(p);
    writePlans(plans);
    originalSetItem(CURRENT_KEY, p.id);
    originalSetItem(PLAN_KEY, JSON.stringify(p));
    location.reload();
  }

  function render() {
    const home = Array.from(document.querySelectorAll('.page')).find(p => p.querySelector('.topbar h1')?.textContent?.trim() === (current()?.name || 'New Journey'));
    if (!home || !home.classList.contains('home-page')) return;
    if (home.querySelector(`#${ROOT_ID}`)) return;

    const active = current();
    if (!active?.id) return;
    let plans = normalize(read(PLANS_KEY, []));
    const ai = plans.findIndex(p => p.id === active.id);
    if (ai >= 0) plans[ai] = active; else plans.unshift(active);
    writePlans(plans);

    const others = plans.filter(p => p.id !== active.id && p.status !== 'Completed');
    const hub = document.createElement('section');
    hub.id = ROOT_ID;
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
        <div class="vela-trip-section-head"><div><span class="eyebrow">IN PLAN</span><h3>Trips in Plan</h3></div><button type="button" class="vela-trip-new">+ New Trip</button></div>
        ${others.length ? `<div class="vela-trip-cards">${others.map(p => `
          <button type="button" class="vela-trip-card" data-trip-id="${esc(p.id)}">
            <span class="vela-trip-card-main"><strong>${esc(p.name || 'New Journey')}</strong><small>${esc(destination(p))}</small><small>${esc(dates(p))}</small></span>
            <span class="vela-trip-card-side"><i>${esc(p.status || 'Planning')}</i><b>${entries(p)}</b><small>entries</small></span>
          </button>`).join('')}</div>` : `<div class="vela-trip-empty">No other trips in the plan yet.<br><small>Create another trip and it will stay here without replacing this one.</small></div>`}
      </section>`;

    const tabs = home.querySelector('.category-tabs');
    home.insertBefore(hub, tabs || home.querySelector('.home-recent') || home.lastElementChild);
    hub.querySelector('.vela-trip-new')?.addEventListener('click', createTrip);
    hub.querySelectorAll('[data-trip-id]').forEach(btn => btn.addEventListener('click', () => switchTrip(btn.dataset.tripId)));
  }

  const boot = () => {
    render();
    const root = document.getElementById('root') || document.body;
    new MutationObserver(render).observe(root, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
