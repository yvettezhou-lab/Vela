import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { LedgerEntry } from '../../core/domain';
import { useVelaStore } from '../../store/useVelaStore';

const ENTRY_LABELS: Record<LedgerEntry['entryType'], string> = { standard: 'Standard', flight: 'Flight', prepaid_multi_day: 'Prepaid Multi-day' };
const formatDate=(timestamp:number)=>{const date=new Date(timestamp);return Number.isFinite(date.getTime())?date.toLocaleDateString():'—';};

export const LedgerView:React.FC=()=>{
 const trips=useVelaStore(s=>s.trips); const currentTrip=useVelaStore(s=>s.getCurrentTrip()); const deleteLedgerEntry=useVelaStore(s=>s.deleteLedgerEntry); const updateLedgerEntry=useVelaStore(s=>s.updateLedgerEntry); const [selectedTripId,setSelectedTripId]=useState(''); const [filter,setFilter]=useState<'all'|'pending'>('all'); const selectedTrip=trips.find((trip)=>trip.id===selectedTripId)??currentTrip; const ledger=selectedTrip?.ledger;
 if(!selectedTrip)return <section className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-8"><h2 className="text-2xl font-bold">Ledger</h2><p className="mt-6 text-gray-500">No active trip found.</p></section>;
 const membersById=new Map(selectedTrip.members.map(m=>[m.id,m.name])); const entries=[...(ledger??[])].sort((a,b)=>b.createdAt-a.createdAt); const filtered=filter==='pending'?entries.filter(e=>e.isPending):entries; const pendingCount=entries.filter(e=>e.isPending).length;
 const fillCny=(entry:LedgerEntry)=>{
   const raw=window.prompt('Enter the actual CNY amount from your bank or credit card statement', ''); if(raw===null)return; const value=Number(raw); if(!Number.isFinite(value)||value<=0){window.alert('Please enter a CNY amount greater than 0.');return;}
   let allocations=entry.allocations;
   const selected=allocations.length?allocations: [{memberId:entry.payerId,amount:0}];
     if(entry.allocationMode==='custom_percentage' && selected.some(a=>a.percentage!==undefined)){
       let used=0; allocations=selected.map((a,i)=>{const pct=a.percentage??0; const amount=i===selected.length-1?Number((value-used).toFixed(2)):Number((value*pct/100).toFixed(2)); used+=amount; return {...a,amount};});
     }else{
       const base=Math.floor(value*100/selected.length)/100; allocations=selected.map((a,i)=>({...a,amount:i===selected.length-1?Number((value-base*(selected.length-1)).toFixed(2)):base}));
     }
   updateLedgerEntry(selectedTrip.id,entry.id,{...entry,cnyEquivalent:value,isPending:false,allocations,updatedAt:Date.now()});
 };
 return <section className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-8">
  <header className="mb-5"><h2 className="text-2xl font-bold">Ledger</h2><p className="mt-1 text-sm text-gray-500">{selectedTrip.title}</p><div className="mt-4"><label className="text-xs uppercase tracking-wide text-gray-400">Journey</label><select value={selectedTrip.id} onChange={(event)=>{setSelectedTripId(event.target.value);setFilter('all');}} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"><option value={selectedTrip.id}>{selectedTrip.title}</option>{trips.filter((trip)=>trip.id!==selectedTrip.id).sort((a,b)=>b.updatedAt-a.updatedAt).map((trip)=><option key={trip.id} value={trip.id}>{trip.title}{trip.status==='achieve'?' · Achieve':trip.status==='traveling'?' · Current':' · Planning'}</option>)}</select></div></header>
  <div className="mb-5 flex gap-2" role="group" aria-label="Ledger filters"><button type="button" onClick={()=>setFilter('all')} className={filter==='all'?'rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white':'rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600'}>All</button><button type="button" onClick={()=>setFilter('pending')} className={filter==='pending'?'rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white':'rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600'}>Pending CNY{pendingCount?' · '+pendingCount:''}</button></div>
  {filtered.length===0?<div className="p-5 border rounded-lg bg-gray-50 text-sm text-gray-600">{filter==='pending'?'No entries waiting for CNY.':'No ledger entries yet.'}</div>:<div className="space-y-3">{filtered.map(entry=><article key={entry.id} className="flex items-start justify-between gap-4 p-4 border rounded-lg">
   <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold truncate">{ENTRY_LABELS[entry.entryType]}</span>{entry.isPending&&<span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs">CNY Pending</span>}{!entry.includeInCost&&<span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs">Excluded from trip cost</span>}</div>
   <div className="mt-2 text-sm text-gray-600">{membersById.get(entry.payerId)??entry.payerId} · {formatDate(entry.createdAt)}</div><div className="mt-1 text-xs text-gray-500">{entry.originalCurrency} · {entry.originalAmount.toFixed(2)} · CNY {entry.isPending?'Pending':entry.cnyEquivalent.toFixed(2)}</div></div>
   <div className="flex shrink-0 items-center gap-1">{entry.isPending&&<button type="button" onClick={()=>fillCny(entry)} className="rounded-md border px-2 py-1.5 text-xs text-slate-700 hover:bg-gray-50">Add CNY</button>}<button type="button" aria-label={'Delete '+ENTRY_LABELS[entry.entryType]+' entry'} title="Delete entry" className="p-2 rounded-md border text-red-700 hover:bg-red-50" onClick={()=>deleteLedgerEntry(selectedTrip.id,entry.id)}><Trash2 size={17}/></button></div>
  </article>)}</div>}
 </section>;
};
export default LedgerView;