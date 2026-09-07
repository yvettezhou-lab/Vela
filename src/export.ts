import * as XLSX from 'xlsx';
import { isPending, allocationFinal, type Plan } from './domain';

const eventName = (plan: Plan, id?: string) => plan.events.find(e => e.id === id)?.name ?? '';
const memberName = (plan: Plan, id: string) => plan.members.find(m => m.id === id)?.name ?? 'Unknown';
const accountName = (plan: Plan, id: string) => plan.accounts.find(a => a.id === id)?.name ?? '';

export function exportPlanExcel(plan: Plan) {
  const wb = XLSX.utils.book_new();
  const overview = [
    ['Vela Trip Report'],
    ['Plan', plan.name], ['Status', plan.status], ['Start Date', plan.startDate], ['End Date', plan.endDate],
    ['Destinations', plan.destinations.join(' · ')], ['Settlement Currency', plan.settlementCurrency],
    [], ['Members', 'Default Ratio'], ...plan.members.map(m => [m.name, m.ratio / 100]),
  ];
  const ledger = [['Date','Usage Date','Description','Category','Event','Amount','Currency','Payer','Account','Final Amount','Final Currency'], ...plan.ledger.map(e => [e.date,e.usageDate,e.description,e.category,eventName(plan,e.eventId),e.amount,e.currency,memberName(plan,e.payerId),accountName(plan,e.accountId),e.finalAmount ?? '',e.finalCurrency ?? ''])];
  const allocation = [['Ledger ID','Description','Participant','Original Allocation','Original Currency','Final Allocation','Final Currency','Allocation Mode'], ...plan.ledger.flatMap(e => e.allocations.map(a => [e.id,e.description,memberName(plan,a.memberId),a.amount,e.currency,allocationFinal(e,a) ?? '',e.finalCurrency ?? '',e.allocationMode]))];
  const balances = new Map<string,{paid:number;borne:number}>();
  plan.members.forEach(m => balances.set(m.id,{paid:0,borne:0}));
  plan.ledger.filter(e => !isPending(e,plan.settlementCurrency)).forEach(e => { balances.get(e.payerId)!.paid += e.finalAmount ?? 0; e.allocations.forEach(a => balances.get(a.memberId)!.borne += allocationFinal(e,a) ?? 0); });
  const settlement = [['Member','Paid','Borne','Balance'], ...plan.members.map(m => { const x=balances.get(m.id)!; return [m.name,+x.paid.toFixed(2),+x.borne.toFixed(2),+(x.paid-x.borne).toFixed(2)]; })];
  const pending = [['Pending Ledger','Amount','Currency','Reason'], ...plan.ledger.filter(e=>isPending(e,plan.settlementCurrency)).map(e=>[e.description,e.amount,e.currency,e.finalAmount == null ? 'Final amount missing' : `Final currency ${e.finalCurrency ?? ''} differs from ${plan.settlementCurrency}`])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overview), 'Overview');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ledger), 'Ledger');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allocation), 'Allocation Detail');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(settlement), 'Settlement');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pending), 'Pending');
  XLSX.writeFile(wb, `${safeName(plan.name)} - Vela.xlsx`);
}

export function exportPersonalBill(plan: Plan, memberId: string) {
  const member = plan.members.find(m => m.id === memberId);
  if (!member) throw new Error('Member not found.');
  const rows = [['Event','Description','Category','Trip Total','Currency','This Person Allocation','Allocation Currency','Final Allocation','Final Currency'], ...plan.ledger.flatMap(e => {
    const a = e.allocations.find(x => x.memberId === memberId); if (!a) return [];
    return [[eventName(plan,e.eventId),e.description,e.category,e.amount,e.currency,a.amount,e.currency,allocationFinal(e,a) ?? '',e.finalCurrency ?? '']];
  })];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Personal Bill');
  XLSX.writeFile(wb, `${safeName(plan.name)} - ${safeName(member.name)} - Personal Bill.xlsx`);
}

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Vela';
