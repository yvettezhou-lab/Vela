import { CATEGORIES, entryUsageDates, loadPlan, makeAllocations, savePlan, type AllocationMode, type Category, type EntryTemplate, type FlightType } from './domain';

const today = () => new Date().toISOString().slice(0, 10);
const esc = (value: string) => value.replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c] || c));

function field(label: string, control: string, cls = '') { return `<label class="vela-field ${cls}"><span>${label}</span>${control}</label>`; }
function input(type: string, name: string, value: string, placeholder = '') { return `<input type="${type}" name="${name}" value="${esc(value)}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} />`; }
function select(name: string, options: string[], selected: string) { return `<select name="${name}">${options.map(x => `<option value="${esc(x)}" ${x === selected ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`; }

function openEntry() {
  if (document.querySelector('.vela-entry-modal')) return;
  const plan = loadPlan();
  const firstMember = plan.members[0]?.id || '';
  const firstAccount = plan.accounts[0]?.id || '';
  const modal = document.createElement('div');
  modal.className = 'vela-entry-modal';
  modal.innerHTML = `<div class="vela-entry-sheet" role="dialog" aria-modal="true" aria-label="Quick Entry">
    <div class="vela-entry-head"><div><span class="template-kicker">NEW PAYMENT</span><h2>Quick Entry</h2></div><button type="button" class="vela-entry-close" data-close>Close</button></div>
    <form class="vela-entry-form">
      <div class="entry-template-switch" role="tablist">
        <button type="button" class="active" data-template="Standard"><strong>Standard</strong>Everyday spending</button>
        <button type="button" data-template="Flight"><strong>Flight</strong>Ticket / itinerary</button>
        <button type="button" data-template="PrepaidMultiDay"><strong>Prepaid</strong>Multi-day use</button>
      </div>
      <div class="vela-template-body"></div>
      <div class="vela-common-fields">
        <div class="vela-two">${field('Description', input('text', 'description', '', 'Hotel, dinner, taxi…'))}${field('Amount', input('number', 'amount', '', '0.00'))}</div>
        <div class="vela-two">${field('Category', select('category', [...CATEGORIES], 'Other'))}${field('Currency', input('text', 'currency', 'CNY'))}</div>
        <div class="vela-two">${field('Payer', select('payerId', plan.members.map(m => m.id), firstMember).replace(/<option value="([^"]+)">([^<]*)<\\/option>/g, (_m, id, _name) => `<option value="${esc(id)}">${esc(plan.members.find(m=>m.id===id)?.name||id)}</option>`))}${field('Account', select('accountId', plan.accounts.map(a => a.id), firstAccount).replace(/<option value="([^"]+)">([^<]*)<\\/option>/g, (_m, id, _name) => `<option value="${esc(id)}">${esc(plan.accounts.find(a=>a.id===id)?.name||id)}</option>`))}</div>
        <div class="vela-two">${field('Event', `<select name="eventId"><option value="">— None —</option>${plan.events.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select>`)}<div class="vela-event-item" hidden>${field('Item', '<select name="item"><option value="">— None —</option></select>')}</div></div>
        <div class="vela-allocation-block"><span class="template-kicker">ALLOCATION</span><div class="vela-member-list">${plan.members.map(m => `<label class="vela-member"><input type="checkbox" name="memberId" value="${esc(m.id)}" checked /><span>${esc(m.name)}</span><em>${m.ratio.toFixed(0)}%</em></label>`).join('')}</div><div class="vela-two"><select name="allocationMode"><option value="Default">Default</option><option value="Split">Split equally</option><option value="Custom">Custom %</option></select><div class="vela-custom-pcts" hidden>${plan.members.map(m => `<label>${esc(m.name)}<input type="number" min="0" max="100" step="0.01" name="pct_${esc(m.id)}" value="${m.ratio.toFixed(2)}" /></label>`).join('')}</div></div></div>
      </div>
      <p class="vela-entry-error" role="alert" hidden></p>
      <button class="primary full vela-entry-save" type="submit">Add Payment</button>
    </form>
  </div>`;
  document.body.appendChild(modal);

  const form = modal.querySelector('form') as HTMLFormElement;
  const body = modal.querySelector('.vela-template-body') as HTMLElement;
  const templateButtons = Array.from(modal.querySelectorAll<HTMLButtonElement>('[data-template]'));
  const error = modal.querySelector('.vela-entry-error') as HTMLElement;
  const category = form.elements.namedItem('category') as HTMLSelectElement;
  const eventSelect = form.elements.namedItem('eventId') as HTMLSelectElement;
  const itemWrap = modal.querySelector('.vela-event-item') as HTMLElement;
  const itemSelect = form.elements.namedItem('item') as HTMLSelectElement;
  let template: EntryTemplate = 'Standard';
  let flightType: FlightType = 'OneWay';

  const renderTemplate = () => {
    templateButtons.forEach(b => b.classList.toggle('active', b.dataset.template === template));
    if (template === 'Standard') {
      body.innerHTML = `<div class="vela-template-panel"><div class="template-kicker">STANDARD PAYMENT</div><p class="template-note">One payment, one accounting date. No usage dates and no daily allocation.</p>${field('Payment Date', input('date', 'date', today()))}</div>`;
      category.disabled = false;
    } else if (template === 'Flight') {
      category.value = 'Transport'; category.disabled = true;
      body.innerHTML = `<div class="flight-panel"><div class="template-kicker">FLIGHT / ITINERARY</div><div class="flight-kind"><span>Trip type</span><div class="vela-segment"><button type="button" data-flight="OneWay" class="active">One way</button><button type="button" data-flight="RoundTrip">Round trip</button></div></div><div class="vela-two">${field('Payment Date', input('date','date',today()))}${field('Outbound Date',input('date','flightOutboundDate',today()))}</div><div class="vela-return-date" hidden>${field('Return Date',input('date','flightReturnDate',today()))}</div><p class="template-note">Connections stay inside the itinerary. The amount is recorded once; it is never averaged across calendar days.</p></div>`;
      body.querySelectorAll<HTMLButtonElement>('[data-flight]').forEach(b => b.onclick = () => { flightType = b.dataset.flight as FlightType; body.querySelectorAll('[data-flight]').forEach(x => x.classList.toggle('active', x === b)); const r = body.querySelector('.vela-return-date') as HTMLElement; r.hidden = flightType !== 'RoundTrip'; });
    } else {
      category.disabled = false;
      body.innerHTML = `<div class="prepaid-panel"><div class="template-kicker">PREPAID MULTI-DAY</div><div class="vela-two">${field('Payment Date',input('date','date',today()))}${field('Usage Start',input('date','usageStartDate',today()))}</div>${field('Usage End',input('date','usageEndDate',today()))}<label class="check vela-pretrip"><input type="checkbox" name="planned" /> Pre-trip / not used yet</label><p class="template-note">The payment is evenly allocated across the continuous usage period. This is the only template that creates daily amounts.</p></div>`;
    }
  };
  templateButtons.forEach(b => b.onclick = () => { template = b.dataset.template as EntryTemplate; renderTemplate(); });
  renderTemplate();

  category.onchange = () => { if (template === 'Flight') category.value = 'Transport'; };
  eventSelect.onchange = () => {
    const e = plan.events.find(x => x.id === eventSelect.value);
    itemWrap.hidden = !e;
    itemSelect.innerHTML = `<option value="">— None —</option>${(e?.itemNames || []).map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}`;
  };
  const mode = form.elements.namedItem('allocationMode') as HTMLSelectElement;
  const custom = modal.querySelector('.vela-custom-pcts') as HTMLElement;
  mode.onchange = () => { custom.hidden = mode.value !== 'Custom'; };

  const close = () => modal.remove();
  modal.querySelector('[data-close]')?.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } }, { once: true });

  form.onsubmit = e => {
    e.preventDefault(); error.hidden = true;
    const fd = new FormData(form);
    const amount = Number(fd.get('amount'));
    const description = String(fd.get('description') || '').trim();
    const date = String(fd.get('date') || '');
    const memberIds = fd.getAll('memberId').map(String);
    const allocationMode = String(fd.get('allocationMode') || 'Default') as AllocationMode;
    const currency = String(fd.get('currency') || 'CNY').trim().toUpperCase();
    if (!description || !Number.isFinite(amount) || amount <= 0 || !date || !currency || !memberIds.length) { error.textContent = 'Please complete the payment, amount, date, and at least one participant.'; error.hidden = false; return; }
    try {
      const entry: any = { id: crypto.randomUUID(), date, description, category: category.value as Category, amount, currency, payerId: String(fd.get('payerId') || firstMember), accountId: String(fd.get('accountId') || firstAccount), eventId: String(fd.get('eventId') || '') || undefined, item: String(fd.get('item') || '') || undefined, allocationMode, template, planned: false };
      if (allocationMode === 'Custom') { const customPct: Record<string, number> = {}; memberIds.forEach(id => { customPct[id] = Number(fd.get(`pct_${id}`) || 0); }); entry.allocations = makeAllocations(amount, memberIds, plan.members, allocationMode, customPct); }
      else entry.allocations = makeAllocations(amount, memberIds, plan.members, allocationMode);
      if (template === 'Flight') { entry.flightType = flightType; entry.flightOutboundDate = String(fd.get('flightOutboundDate') || ''); entry.flightReturnDate = flightType === 'RoundTrip' ? String(fd.get('flightReturnDate') || '') : undefined; if (!entry.flightOutboundDate || (flightType === 'RoundTrip' && !entry.flightReturnDate)) throw new Error('Please enter the complete flight itinerary.'); }
      if (template === 'PrepaidMultiDay') { entry.usageStartDate = String(fd.get('usageStartDate') || ''); entry.usageEndDate = String(fd.get('usageEndDate') || ''); entry.planned = fd.get('planned') === 'on'; if (!entry.usageStartDate || !entry.usageEndDate || entry.usageStartDate > entry.usageEndDate) throw new Error('Usage start must be on or before usage end.'); entry.usageDates = entryUsageDates(entry); }
      const next = { ...plan, ledger: [entry, ...plan.ledger] };
      savePlan(next);
      window.location.reload();
    } catch (err) { error.textContent = err instanceof Error ? err.message : 'Unable to create payment.'; error.hidden = false; }
  };
}

document.addEventListener('click', e => {
  const target = e.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('.home-quick');
  if (!button) return;
  e.preventDefault(); e.stopPropagation();
  openEntry();
}, true);
