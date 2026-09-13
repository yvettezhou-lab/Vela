(() => {
  const PLANS_KEY = 'vela.plans.v1';
  const PLAN_KEY = 'vela.plan.v1';
  const CURRENT_KEY = 'vela.trip.current.v1';
  const ROOT = 'vela-home-v3';

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const save = plans => localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  const now = () => Date.now();
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));

  const state = trip => {
    const value = String(trip?.status || '').toLowerCase();
    if (['traveling', 'travelling', 'in progress'].includes(value)) return 'traveling';
    if (['achieve', 'achieved', 'completed'].includes(value)) return 'achieve';
    return 'planning';
  };
  const edited = trip => Number(trip?.lastEditedAt || trip?.updatedAt || trip?.createdAt || 0);
  const fmt = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : String(value || '');
  };
  const dates = trip => trip.startDate && trip.endDate
    ? `${fmt(trip.startDate)} — ${fmt(trip.endDate)}`
    : trip.startDate ? fmt(trip.startDate) : 'DATES NOT SET';
  const destination = trip => {
    const value = Array.isArray(trip.destinations) ? trip.destinations.filter(Boolean).join(' · ') : '';
    return value && value.trim().toLowerCase() !== String(trip.name || '').trim().toLowerCase() ? value : '';
  };
  const dayCount = trip => {
    if (!trip.startDate || !trip.endDate) return '';
    const start = new Date(`${trip.startDate}T00:00:00`);
    const end = new Date(`${trip.endDate}T00:00:00`);
    const days = Math.round((end - start) / 86400000) + 1;
    return days > 0 ? `${days} DAYS` : '';
  };

  // Trip summary: duration + original/local currencies + CNY settlement amount.
  const tripSummary = trip => {
    const entries = Array.isArray(trip.ledger) ? trip.ledger : [];
    const local = {};
    let cny = 0;
    entries.forEach(entry => {
      const amount = Number(entry.amount) || 0;
      const currency = String(entry.currency || '').toUpperCase();
      if (currency && currency !== 'CNY') local[currency] = (local[currency] || 0) + amount;
      if (String(entry.finalCurrency || '').toUpperCase() === 'CNY' && entry.finalAmount != null) {
        cny += Number(entry.finalAmount) || 0;
      } else if (currency === 'CNY') {
        cny += amount;
      }
    });
    const localText = Object.entries(local)
      .map(([currency, amount]) => `${currency} ${Math.round(amount).toLocaleString('en-US')}`)
      .join(' · ');
    return [dayCount(trip), localText, cny ? `¥${Math.round(cny).toLocaleString('en-US')}` : '']
      .filter(Boolean)
      .join(' · ');
  };
  const cover = trip => String(trip?.coverImage || '').trim();

  function trips() {
    let plans = Array.isArray(read(PLANS_KEY, [])) ? read(PLANS_KEY, []) : [];
    const legacy = read(PLAN_KEY, null);
    if (legacy?.id) {
      const index = plans.findIndex(item => item.id === legacy.id);
      const merged = { ...legacy, status: state(legacy), lastEditedAt: legacy.lastEditedAt || now() };
      if (index >= 0) plans[index] = { ...plans[index], ...merged };
      else plans.unshift(merged);
    }
    plans = plans
      .filter(item => item && typeof item.id === 'string')
      .map(item => ({ ...item, status: state(item) }));

    // Product rule: at most one Traveling trip.
    const traveling = plans.filter(item => item.status === 'traveling');
    traveling.slice(1).forEach(item => { item.status = 'planning'; });
    if (traveling.length > 1) save(plans);
    return plans;
  }

  // Current is derived, never a separate Trip state.
  function current(plans) {
    return plans.find(item => item.status === 'traveling')
      || plans.filter(item => item.status === 'planning').sort((a, b) => edited(b) - edited(a))[0]
      || null;
  }
  function persist(plans) {
    save(plans);
    const currentTrip = current(plans);
    if (currentTrip) localStorage.setItem(CURRENT_KEY, currentTrip.id);
  }
  function setSelected(trip) {
    // Compatibility with the existing Trip Detail page.
    localStorage.setItem(CURRENT_KEY, trip.id);
    localStorage.setItem(PLAN_KEY, JSON.stringify(trip));
  }
  function openTrip(id) {
    const trip = trips().find(item => item.id === id);
    if (!trip) return;
    setSelected(trip);
    location.reload();
  }
  function newTrip() {
    const me = { id: uid(), name: 'Me', ratio: 100 };
    const trip = {
      id: uid(), name: 'New Journey', startDate: '', endDate: '', destinations: [],
      settlementCurrency: 'CNY', status: 'planning', lastEditedAt: now(), coverImage: '',
      members: [me],
      accounts: [{ id: uid(), name: 'Cash' }, { id: uid(), name: 'Bank Card' }, { id: uid(), name: 'Alipay' }, { id: uid(), name: 'WeChat Pay' }],
      events: [], ledger: []
    };
    const plans = trips();
    plans.unshift(trip);
    persist(plans);
    setSelected(trip);
    location.reload();
  }

  // User-owned cover image. Resize before storing so localStorage remains practical.
  function compress(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const max = 1500;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function coverButton(trip, hero = false) {
    const image = cover(trip);
    return `<button class="v3-cover ${hero ? 'v3-cover-hero' : ''} ${image ? 'has-image' : ''}" type="button" data-cover="${esc(trip.id)}" style="${image ? `background-image:url('${esc(image)}')` : ''}" aria-label="Change cover image"><span>${image ? '' : 'V'}</span><b>＋</b></button>`;
  }

  function row(trip) {
    const status = state(trip);
    const label = status === 'traveling' ? 'TRAVELING' : status === 'achieve' ? 'ACHIEVED' : 'PLANNING';
    const place = destination(trip);
    const summary = tripSummary(trip);
    return `<article class="v3-row" data-id="${esc(trip.id)}">
      ${coverButton(trip)}
      <button class="v3-row-main" data-open="${esc(trip.id)}">
        <div class="v3-row-copy">
          <strong>${esc(trip.name || 'New Journey')}</strong>
          ${trip.subtitle && trip.subtitle !== trip.name ? `<em>${esc(trip.subtitle)}</em>` : ''}
          <span>▣ &nbsp;${esc(dates(trip))}</span>
          ${place ? `<span>⌖ &nbsp;${esc(place)}</span>` : ''}
          ${summary ? `<small>${esc(summary)}</small>` : ''}
        </div>
        <span class="v3-pill ${status}">${label}</span>
        <i>›</i>
      </button>
      <input type="file" accept="image/*" data-file="${esc(trip.id)}" />
    </article>`;
  }

  function hero(trip, currentTrip) {
    const status = state(trip);
    const place = destination(trip);
    const summary = tripSummary(trip);
    return `<article class="v3-hero ${status === 'traveling' ? 'traveling' : ''}">
      <div class="v3-hero-copy">
        <div class="v3-hero-top"><span><i></i>${currentTrip?.id === trip.id ? 'CURRENT TRIP' : 'TRIP'}</span><b>01</b></div>
        <div class="v3-status">${status === 'traveling' ? 'TRAVELING' : status === 'achieve' ? 'ACHIEVED' : 'PLANNING'}</div>
        <button class="v3-open-title" data-open="${esc(trip.id)}">
          <strong>${esc(trip.name || 'New Journey')}</strong>
          ${trip.subtitle && trip.subtitle !== trip.name ? `<em>${esc(trip.subtitle)}</em>` : ''}
        </button>
        <div class="v3-meta">
          <span>▣ &nbsp;${esc(dates(trip))}</span>
          <span>⌖ &nbsp;${esc(place || 'DESTINATION NOT SET')}</span>
          ${summary ? `<small>${esc(summary)}</small>` : ''}
        </div>
        <button class="v3-quick" data-open="${esc(trip.id)}">▤ &nbsp;&nbsp; Quick Entry will be recorded<br><b>　　 to this trip</b><i>›</i></button>
      </div>
      ${coverButton(trip, true)}
      <input type="file" accept="image/*" data-file="${esc(trip.id)}" />
    </article>`;
  }

  function allView(host) {
    const plans = trips();
    const currentTrip = current(plans);
    const ordered = [...plans].sort((a, b) => {
      const aCurrent = a.id === currentTrip?.id ? 1 : 0;
      const bCurrent = b.id === currentTrip?.id ? 1 : 0;
      return bCurrent - aCurrent || edited(b) - edited(a);
    });
    host.innerHTML = `<header class="v3-head">
      <div class="v3-brand"><span>Vela</span><small>ALL JOURNEYS</small></div>
      <div class="v3-actions"><button data-back>BACK</button><button class="v3-plus" data-new>＋</button></div>
    </header><div class="v3-all-list">${ordered.map(row).join('')}</div>`;
    bind(host);
  }

  function bind(host) {
    host.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      openTrip(button.dataset.open);
    }));
    host.querySelectorAll('[data-cover]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      host.querySelector(`[data-file="${CSS.escape(button.dataset.cover)}"]`)?.click();
    }));
    host.querySelectorAll('[data-file]').forEach(input => input.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const image = await compress(file);
        const plans = trips();
        const index = plans.findIndex(item => item.id === input.dataset.file);
        if (index < 0) return;
        plans[index] = { ...plans[index], coverImage: image, lastEditedAt: now() };
        persist(plans);
        render(true);
      } catch {
        // Keep the existing cover if the selected image cannot be processed.
      }
    }));
    host.querySelector('[data-new]')?.addEventListener('click', newTrip);
    host.querySelector('[data-all]')?.addEventListener('click', () => allView(host));
    host.querySelector('[data-back]')?.addEventListener('click', () => render(true));
  }

  function render(force = false) {
    const home = document.querySelector('.home-page');
    if (!home) return;

    const plans = trips();
    const currentTrip = current(plans);
    const traveling = plans.filter(item => item.status === 'traveling');
    const planning = plans.filter(item => item.status === 'planning').sort((a, b) => edited(b) - edited(a));
    const visible = [...traveling.slice(0, 1), ...planning.filter(item => item.id !== traveling[0]?.id)].slice(0, 3);
    const feature = currentTrip || visible[0] || null;
    const next = visible.filter(item => item.id !== feature?.id).slice(0, 2);
    const achieved = plans.filter(item => item.status === 'achieve').sort((a, b) => edited(b) - edited(a)).slice(0, 2);
    const signature = JSON.stringify(plans.map(item => [item.id, item.status, item.name, item.subtitle, item.startDate, item.endDate, item.destinations, item.coverImage, edited(item), item.ledger?.length || 0]));
    const old = home.querySelector(`#${ROOT}`);
    if (!force && old?.dataset.sig === signature) return;
    old?.remove();

    const host = document.createElement('section');
    host.id = ROOT;
    host.dataset.sig = signature;
    const countLabel = plans.length === 1 ? 'TRIP' : 'TRIPS';
    host.innerHTML = `<header class="v3-head">
      <div class="v3-brand"><span>Vela</span><small>TRAVEL&nbsp;&nbsp;·&nbsp;&nbsp;RECORD&nbsp;&nbsp;·&nbsp;&nbsp;BELONG</small></div>
      <div class="v3-actions"><strong>${plans.length}</strong><small>${countLabel}</small><i></i><button data-all>ALL TRIPS</button><button class="v3-plus" data-new>＋</button></div>
    </header>
    <div class="v3-tagline">A More<br><i>Curious You</i></div>
    ${feature ? `<section class="v3-current">${hero(feature, currentTrip)}</section>` : `<section class="v3-empty"><p>YOUR NEXT JOURNEY AWAITS.</p><button class="v3-empty-new" data-new>＋ NEW TRIP</button></section>`}
    ${next.length ? `<section class="v3-section"><header><span>PLANNING NEXT</span><button data-all>View all&nbsp; ›</button></header>${next.map(row).join('')}</section>` : ''}
    ${achieved.length ? `<section class="v3-section v3-recent"><header><span>RECENT JOURNEYS</span><button data-all>View all&nbsp; ›</button></header><div class="v3-recent-grid">${achieved.map(row).join('')}</div></section>` : ''}
    <section class="v3-memory"><div class="v3-memory-copy"><span>SOME PLACES</span><span>STAY WITH YOU</span><i></i></div><em>Further<br>Brighter<br>Together</em></section>`;

    const tabs = home.querySelector('.category-tabs');
    home.insertBefore(host, tabs || home.firstElementChild);
    bind(host);
  }

  const seed = trips();
  if (seed.length) save(seed);
  const boot = () => render();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  new MutationObserver(() => {
    if (document.querySelector('.home-page') && !document.querySelector(`#${ROOT}`)) render();
  }).observe(document.body, { childList: true, subtree: true });
})();
