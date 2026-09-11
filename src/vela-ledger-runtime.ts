import { loadPlan, type EntryTemplate, type LedgerEntry } from './domain';

const formatDate = (value?: string) => {
  if (!value) return '';
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value;
};

const templateLabel = (entry: LedgerEntry) => {
  const template: EntryTemplate = entry.template || 'Standard';
  if (template === 'Flight') {
    const route = entry.flightType === 'RoundTrip' && entry.flightReturnDate
      ? `${formatDate(entry.flightOutboundDate)} → ${formatDate(entry.flightReturnDate)}`
      : formatDate(entry.flightOutboundDate);
    return { label: 'FLIGHT', detail: route ? `Outbound ${route}` : 'Ticket / itinerary' };
  }
  if (template === 'PrepaidMultiDay') {
    const range = entry.usageStartDate && entry.usageEndDate
      ? `${formatDate(entry.usageStartDate)} → ${formatDate(entry.usageEndDate)}`
      : 'Multi-day use';
    return { label: 'PREPAID', detail: range };
  }
  return { label: 'STANDARD', detail: 'Single payment' };
};

function decorate() {
  const plan = loadPlan();
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.day-ledger .ledger-card, .planned-block .ledger-card'));
  if (!cards.length) return;

  cards.forEach(card => {
    if (card.querySelector(':scope > .vela-ledger-template')) return;
    const title = card.querySelector(':scope > div strong');
    if (!title) return;
    const description = title.textContent?.trim() || '';
    const entry = plan.ledger.find(e => e.description === description || `${e.description} — Refund` === description);
    if (!entry) return;

    const meta = templateLabel(entry);
    const marker = document.createElement('span');
    marker.className = 'vela-ledger-template';
    marker.innerHTML = `<b>${meta.label}</b><i>${meta.detail}</i>`;
    title.insertAdjacentElement('afterend', marker);
    card.dataset.velaTemplate = entry.template || 'Standard';
  });
}

decorate();
const observer = new MutationObserver(() => decorate());
observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
