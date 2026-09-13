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
  const dates = p => p.startDate && p.endDate ? `${formatDate(p.startDate)} — ${formatDate(p.endDate)}` : p.startDate ? formatDate(p.startDate) : 'DATES NOT SET';
  const destination = p => { const d = Array.isArray(p.destinations) && p.destinations.length ? p.destinations.join(' · ') : ''; return d && d.toLowerCase() !== String(p.name || '').trim().toLowerCase() ? d : ''; };
  const duration = p => { if (!p.startDate || !p.endDate) return ''; const a = new Date(`${p.startDate}T00:00:00`); const b = new Date(`${p.endDate}T00:00:00`); const n = Math.round((b-a)/86400000)+1; return Number.isFinite(n) && n > 0 ? `${n} DAYS` : ''; };
  const money = (n, currency) => `${currency === 'CNY' ? '¥' : currency + ' '}${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
  const summary = p => {
    const entries = Array.isArray(p.ledger) ? p.ledger : [];
    const byCurrency = {};
    let cny = 0;
    entries.forEach(e => {
      const amount = Number(e.amount) || 0;
      const currency = String(e.currency || '').toUpperCase();
      if (currency && currency !== 'CNY') byCurrency[currency] = (byCurrency[currency] || 0) + amount;
      if (e.finalAmount != null && String(e.finalCurrency || '').toUpperCase() === 'CNY') cny += Number(e.finalAmount) || 0;
      else if (currency === 'CNY') cny += amount;
    });
    const local = Object.entries(byCurrency).map(([c,v]) => money(v,c)).join(' · ');
    const parts = [];
    if (duration(p)) parts.push(duration(p));
    if (local) parts.push(local);
    if (entries.length || cny) parts.push(`¥${Math.round(cny).toLocaleString('en-US')}`);
    return parts.join('  ·  ') || 'NO EXPENSES RECORDED';
  };
  const cover = p => String(p?.coverImage || '').trim();

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
    const current = deriveCurrent(plans);
    const traveling = plans.filter(p => normalizeStatus(p) === 'traveling');
    const planning = plans.filter(p => normalizeStatus(p) === 'planning').sort((a,b) => lastEdited(b) - lastEdited(a));
    const result = [];
    if (traveling[0]) result.push(traveling[0]);
    planning.forEach(p => { if (!result.some(x => x.id === p.id) && result.length < VISIBLE_LIMIT) result.push(p); });
    return { current, result, planning };
  }

  function card(p, current, featured = false, number = '') {
    const status = normalizeStatus(p);
    const label = status === 'traveling' ? 'TRAVELING' : status === 'achieve' ? 'ACHIEVED' : 'PLANNING';
    const dest = destination(p);
    const image = cover(p);
    const imageStyle = image ? ` style="background-image:url('${esc(image)}')"` : '';
    const isCurrent = current?.id === p.id;
    if (featured) return `<article class="vela-trip-card is-featured${status === 'traveling' ? ' is-traveling' : ''}" data-trip-id="${esc(p.id)}"><button type="button" class="vela-trip-cover${image ? ' has-image' : ''}"${imageStyle} data-cover-input="${esc(p.id)}" aria-label="Change cover image"><span class="vela-trip-cover-placeholder"><b>V</b><small>ADD COVER</small></span><span class="vela-trip-cover-edit">＋</span></button><button type="button" class="vela-trip-feature-content" data-trip-open="${esc(p.id)}"><span class="vela-trip-feature-top"><span class="vela-trip-status">${label}</span>${isCurrent ? '<span class="vela-trip-current-mark">CURRENT · LEDGER</span>' : ''}<span class="vela-trip-number">${esc(number)}</span></span><span class="vela-trip-feature-copy"><strong>${esc(p.name || 'New Journey')}</strong>${dest ? `<small class="vela-trip-destination">${esc(dest)}</small>` : ''}<small class="vela-trip-date">${esc(dates(p))}</small><small class="vela-trip-summary">${esc(summary(p))}</small></span><span class="vela-trip-feature-open">OPEN JOURNEY <b>↗</b></span></button><input class="vela-cover-input" type="file" accept="image/*" data-cover-for="${esc(p.id)}" /></article>`;
    return `<article class="vela-trip-row-card${status === 'achieve' ? ' is-history' : ''}" data-trip-id="${esc(p.id)}"><button type="button" class="vela-trip-row-cover${image ? ' has-image' : ''}"${imageStyle} data-cover-input="${esc(p.id)}" aria-label="Change cover image"><span>${image ? '' : 'V'}</span></button><button type="button" class="vela-trip-row-main" data-trip-open="${esc(p.id)}"><span class="vela-trip-row-meta"><em>${label}</em>${isCurrent ? '<b>CURRENT</b>' : ''}</span><strong>${esc(p.name || 'New Journey')}</strong>${dest ? `<small>${esc(dest)}</small>` : ''}<small class="vela-trip-row-summary">${esc(summary(p))}</small></button><button type="button" class="vela-trip-row-arrow" data-trip-open="${esc(p.id)}" aria-label="Open trip">↗</button><input class="vela-cover-input" type="file" accept="image/*" data-cover-for="${esc(p.id)}" /></article>`;
  }

  function makePlan() {
    const uid = () => crypto.randomUUID ? crypto.randomUUID() : `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const me = { id: uid(), name: 'Me', ratio: 100 };
    return { id: uid(), name: 'New Journey', startDate: '', endDate: '', destinations: [], settlementCurrency: 'CNY', status: 'planning', lastEditedAt: now(), coverImage: '', members: [me], accounts: [{id:uid(),name:'Cash'},{id:uid(),name:'Bank Card'},{id:uid(),name:'Alipay'},{id:uid(),name:'WeChat Pay'}], events: [], ledger: [] };
  }
  function openTrip(id) { const plans = getTrips(); const target = plans.find(p => p.id === id); if (!target) return; localStorage.setItem(CURRENT_KEY, target.id); localStorage.setItem(PLAN_KEY, JSON.stringify(target)); location.reload(); }
  function createTrip() { const plans = getTrips(); const p = makePlan(); plans.unshift(p); writePlans(plans); localStorage.setItem(CURRENT_KEY, p.id); localStorage.setItem(PLAN_KEY, JSON.stringify(p)); location.reload(); }
  function attachOpeners(hub) { hub.querySelectorAll('[data-trip-open]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openTrip(btn.dataset.tripOpen); })); }
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { const img = new Image(); img.onload = () => { const max = 1400; const scale = Math.min(1, max / Math.max(img.width, img.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale)); const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL('image/jpeg', .78)); }; img.onerror = reject; img.src = reader.result; }; reader.onerror = reject; reader.readAsDataURL(file);
    });
  }
  async function saveCover(id, file) {
    if (!file || !file.type.startsWith('image/')) return;
    try { const image = await compressImage(file); const plans = getTrips(); const i = plans.findIndex(p => p.id === id); if (i < 0) return; plans[i] = { ...plans[i], coverImage: image, lastEditedAt: now() }; writePlans(plans); const current = deriveCurrent(plans); if (current?.id === id) localStorage.setItem(PLAN_KEY, JSON.stringify(plans[i])); render(true); } catch { /* ignore invalid image */ }
  }
  function attachCovers(hub) { hub.querySelectorAll('[data-cover-input]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); const input = hub.querySelector(`[data-cover-for="${CSS.escape(btn.dataset.coverInput)}"]`); input?.click(); })); hub.querySelectorAll('.vela-cover-input').forEach(input => input.addEventListener('change', e => saveCover(input.dataset.coverFor, e.target.files?.[0]))); }

  function render(force = false) {
    const home = document.querySelector('.home-page');
    if (!home) return;
    const plans = getTrips();
    if (!plans.length) return;
    const { current, result } = orderedHomeTrips(plans);
    selectCurrent(plans);
    const existing = home.querySelector(`#${ROOT_ID}`);
    const signature = JSON.stringify({ plans, current: current?.id || null });
    if (!force && existing && existing.dataset.signature === signature) return;
    existing?.remove();
    const featured = current || result[0];
    const secondary = result.filter(p => p.id !== featured?.id).slice(0, 2);
    const history = plans.filter(p => normalizeStatus(p) === 'achieve').sort((a,b) => lastEdited(b)-lastEdited(a)).slice(0,2);
    const activeCount = plans.filter(p => normalizeStatus(p) !== 'achieve').length;
    const hub = document.createElement('section');
    hub.id = ROOT_ID;
    hub.dataset.signature = signature;
    hub.innerHTML = `<header class="vela-home-trip-head"><div class="vela-home-title"><span>JOURNEYS</span><small>${activeCount} ACTIVE</small></div><div class="vela-home-trip-actions"><button type="button" class="vela-trip-all" aria-label="View all trips">ALL TRIPS</button><button type="button" class="vela-trip-new" aria-label="New Trip">＋</button></div></header>${featured ? `<div class="vela-current-label"><span>CURRENT TRIP</span><i></i><small>QUICK ENTRY TARGET</small></div><div class="vela-trip-stage">${card(featured,current,true,'01')}</div>` : ''}${secondary.length ? `<section class="vela-trip-planning"><div class="vela-section-head"><span>PLANNING NEXT</span><small>SWITCH TRIP</small></div>${secondary.map((p,i)=>card(p,current,false,String(i+2).padStart(2,'0'))).join('')}</section>` : ''}${history.length ? `<section class="vela-trip-history"><div class="vela-section-head"><span>HISTORY</span><button type="button" class="vela-section-view" data-history-all>VIEW ALL ↗</button></div>${history.map((p,i)=>card(p,current,false,`H${String(i+1).padStart(2,'0')}`)).join('')}</section>` : ''}`;
    const tabs = home.querySelector('.category-tabs');
    home.insertBefore(hub, tabs || home.querySelector('.home-recent') || home.lastElementChild);
    hub.querySelector('.vela-trip-new')?.addEventListener('click', createTrip);
    hub.querySelector('.vela-trip-all')?.addEventListener('click', () => showAllTrips(hub, plans, current));
    hub.querySelector('[data-history-all]')?.addEventListener('click', () => showAllTrips(hub, plans, current, true));
    attachOpeners(hub);
    attachCovers(hub);
  }
  function showAllTrips(hub, plans, current, historyOnly = false) {
    const active = plans.filter(p => normalizeStatus(p) !== 'achieve').sort((a,b) => (a.id===current?.id?-1:0) - (b.id===current?.id?-1:0) || lastEdited(b)-lastEdited(a));
    const achieved = plans.filter(p => normalizeStatus(p) === 'achieve').sort((a,b)=>lastEdited(b)-lastEdited(a));
    hub.innerHTML = `<header class="vela-home-trip-head"><div class="vela-home-title"><span>${historyOnly ? 'HISTORY' : 'ALL JOURNEYS'}</span><small>${plans.length} TOTAL</small></div><div class="vela-home-trip-actions"><button type="button" class="vela-trip-back">BACK</button><button type="button" class="vela-trip-new" aria-label="New Trip">＋</button></div></header><div class="vela-all-list">${historyOnly ? achieved.map((p,i)=>card(p,current,false,`H${String(i+1).padStart(2,'0')}`)).join('') : `${active.map((p,i)=>card(p,current,i===0,String(i+1).padStart(2,'0'))).join('')}<div class="vela-all-archive-label">HISTORY</div>${achieved.length ? achieved.map((p,i)=>card(p,current,false,`H${String(i+1).padStart(2,'0')}`)).join('') : '<div class="vela-trip-empty">No completed journeys yet.</div>'}</div>`}</div>`;
    hub.querySelector('.vela-trip-back')?.addEventListener('click', () => render(true));
    hub.querySelector('.vela-trip-new')?.addEventListener('click', createTrip);
    attachOpeners(hub);
    attachCovers(hub);
  }
  const boot = () => { const tick = () => render(); tick(); const root = document.getElementById('root') || document.body; new MutationObserver(tick).observe(root, { childList:true, subtree:true }); setInterval(tick, 800); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();