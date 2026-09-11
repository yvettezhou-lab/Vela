import { loadPlan, type EntryTemplate, type LedgerEntry } from './domain';

const formatDate = (value?: string) => {
  if (!value) return '';
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value;
};

const templateLabel = (entry: LedgerEntry) => {
  const template: EntryTemplate = entry.template || 'Standard';
  if (template === 'Flight') {
    const outbound = entry.flightOutboundDate && entry.flightArrivalDate ? `${formatDate(entry.flightOutboundDate)} → ${formatDate(entry.flightArrivalDate)}` : formatDate(entry.flightOutboundDate);
    const roundTrip = entry.flightType === 'RoundTrip' && entry.flightReturnDate ? ` · Return ${formatDate(entry.flightReturnDate)}${entry.flightReturnArrivalDate ? ` → ${formatDate(entry.flightReturnArrivalDate)}` : ''}` : '';
    return { label: 'FLIGHT', detail: outbound ? `${outbound}${roundTrip}` : 'Ticket / itinerary' };
  }
  if (template === 'PrepaidMultiDay') {
    const range = entry.usageStartDate && entry.usageEndDate ? `${formatDate(entry.usageStartDate)} → ${formatDate(entry.usageEndDate)}` : 'Multi-day use';
    return { label: 'PREPAID', detail: range };
  }
  return { label: 'STANDARD', detail: 'Single payment' };
};

const entrySignature = (entry: LedgerEntry) => `${entry.description}\u0000${entry.date}\u0000${entry.category}\u0000${entry.amount}\u0000${entry.currency}\u0000${entry.payerId}\u0000${entry.accountId}`;

function decorate() {
  const plan = loadPlan();
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.day-ledger .ledger-card, .planned-block .ledger-card'));
  if (!cards.length) return;
  const remaining = new Map<string, LedgerEntry[]>();
  plan.ledger.forEach(entry => { const key = entrySignature(entry); const list = remaining.get(key) || []; list.push(entry); remaining.set(key, list); });
  cards.forEach(card => {
    if (card.querySelector(':scope > .vela-ledger-template')) return;
    const title = card.querySelector(':scope > div strong'); if (!title) return;
    const description = title.textContent?.trim() || '';
    const metaText = card.querySelector(':scope > div')?.textContent || '';
    const entry = plan.ledger.find(e => (e.description === description || `${e.description} — Refund` === description) && metaText.includes(e.date));
    if (!entry) return;
    const key = entrySignature(entry), candidates = remaining.get(key) || [], matched = candidates.shift() || entry; remaining.set(key, candidates);
    const meta = templateLabel(matched), marker = document.createElement('span'); marker.className = 'vela-ledger-template'; marker.innerHTML = `<b>${meta.label}</b><i>${meta.detail}</i>`;
    title.insertAdjacentElement('afterend', marker); card.dataset.velaTemplate = matched.template || 'Standard'; card.dataset.velaEntryId = matched.id;
  });
}

decorate();
const observer = new MutationObserver(() => decorate());
observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });