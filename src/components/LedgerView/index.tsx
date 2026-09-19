import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { LedgerEntry } from '../../core/domain';
import { useVelaStore } from '../../store/useVelaStore';

const ENTRY_LABELS: Record<LedgerEntry['entryType'], string> = { standard: 'Standard', flight: 'Flight', prepaid_multi_day: 'Prepaid Multi-day', cash_exchange: 'Cash / Exchange' };
const formatDate=(timestamp:number)=>{const date=new Date(timestamp);return Number.isFinite(date.getTime())?date.toLocaleDateString():'—';};

export const LedgerView:React.FC=()=>{
 const currentTrip=useVelaStore(s=>s.getCurrentTrip()); const ledger=useVelaStore(s=>s.getCurrentTrip()?.ledger); const deleteLedgerEntry=useVelaStore(s=>s.deleteLedgerEntry); const [filter,setFilter]=useState<'all'|'pending'>('all');
 if(!currentTrip)return <section className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-8"><h2 className="text-2xl font-bold">Ledger</h2><p className="mt-6 text-gray-500">No active trip found.</p></section>;
 const membersById=new Map(currentTrip.members.map(m=>[m.id,m.name])); const entries=[...(ledger??[])].sort((a,b)=>b.createdAt-a.createdAt); const filtered=filter==='pending'?entries.filter(e=>e.isPending):entries; const pendingCount=entries.filter(e=>e.isPending).length;
 return <section className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-8">
  <header className="mb-5"><h2 className="text-2xl font-bold">Ledger</h2><p className="mt-1 text-sm text-gray-500">{currentTrip.title}</p></header>
  <div className="mb-5 flex gap-2" role="group" aria-label="Ledger filters"><button type="button" onClick={()=>setFilter('all')} className={filter==='all'?'rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white':'rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600'}>All</button><button type="button" onClick={()=>setFilter('pending')} className={filter==='pending'?'rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white':'rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600'}>待补 CNY{pendingCount?' · '+pendingCount:''}</button></div>
  {filtered.length===0?<div className="p-5 border rounded-lg bg-gray-50 text-sm text-gray-600">{filter==='pending'?'No entries waiting for CNY.':'No ledger entries yet.'}</div>:<div className="space-y-3">{filtered.map(entry=><article key={entry.id} className="flex items-start justify-between gap-4 p-4 border rounded-lg">
   <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold truncate">{entry.entryType==='cash_exchange'?(entry.cashExchangeType==='cash_withdrawal'?'Cash Withdrawal':'Currency Exchange'):ENTRY_LABELS[entry.entryType]}</span>{entry.isPending&&<span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs">CNY 待补</span>}{entry.isRefund&&<span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs">Income / Refund</span>}</div>
   <div className="mt-2 text-sm text-gray-600">{membersById.get(entry.payerId)??entry.payerId} · {formatDate(entry.createdAt)}</div><div className="mt-1 text-xs text-gray-500">{entry.originalCurrency} · {entry.originalAmount.toFixed(2)} · CNY {entry.isPending?'待补':entry.cnyEquivalent.toFixed(2)}</div></div>
   <button type="button" aria-label={'Delete '+ENTRY_LABELS[entry.entryType]+' entry'} title="Delete entry" className="shrink-0 p-2 rounded-md border text-red-700 hover:bg-red-50" onClick={()=>deleteLedgerEntry(currentTrip.id,entry.id)}><Trash2 size={17}/></button>
  </article>)}</div>}
 </section>;
};
export default LedgerView;