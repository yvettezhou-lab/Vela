import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import { getTripPrimaryCurrency } from '../../core/travelSegment';
import type { CashExchangeType, CashExchangeEntry } from '../../core/domain';

const currencies = ['USD','HKD','MYR','SGD','THB','IDR','PHP','JPY','KRW','EUR','GBP','AUD','CNY'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const dateTs = (v:string) => new Date(`${v}T00:00:00`).getTime();
const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export const CashExchangeEntry: React.FC<{ onClose?:()=>void }> = ({ onClose }) => {
  const trips = useVelaStore(s=>s.trips);
  const add = useVelaStore(s=>s.addLedgerEntry);
  const eligible = trips.filter(t=>t.status==='traveling'||t.status==='planning');
  const [tripId,setTripId]=useState('');
  const [kind,setKind]=useState<CashExchangeType>('cash_withdrawal');
  const [currency,setCurrency]=useState('USD');
  const [targetAmount,setTargetAmount]=useState('');
  const [cny,setCny]=useState('');
  const [accountId,setAccountId]=useState('');
  const [date,setDate]=useState(today);
  const [error,setError]=useState('');
  const trip=eligible.find(t=>t.id===tripId)||null;
  const accounts=trip?.accounts.filter(a=>a.archived!==true)??[];
  const me=trip?.members.find(m=>m.archived!==true)?.id||trip?.members[0]?.id||'';

  useEffect(()=>{ if(!tripId){ const active=eligible.find(t=>t.status==='traveling')||eligible[0]; if(active)setTripId(active.id); } },[eligible,tripId]);
  useEffect(()=>{ if(trip && !accountId)setAccountId(trip.accounts.find(a=>a.archived!==true)?.id||''); },[trip,accountId]);

  const save=(e:React.FormEvent)=>{
    e.preventDefault(); setError('');
    try {
      if(!trip) throw new Error('Journey is required.');
      const amount=Number(targetAmount), cnyAmount=cny===''?0:Number(cny);
      if(!Number.isFinite(amount)||amount<=0) throw new Error('Foreign amount must be greater than 0.');
      if(cny!=='' && (!Number.isFinite(cnyAmount)||cnyAmount<=0)) throw new Error('CNY amount must be greater than 0.');
      if(!accountId) throw new Error('Payment account is required.');
      const paymentDate=dateTs(date); if(!Number.isFinite(paymentDate)) throw new Error('Date is required.');
      const entry:CashExchangeEntry={
        id:`entry_${uid()}`, entryType:'cash_exchange', categoryId:'cat_cash_exchange',
        originalAmount:amount, originalCurrency:currency, cnyEquivalent:cnyAmount,
        isRefund:false, isPending:cny==='', payerId:me, accountId, allocationMode:'equal', allocations:[],
        createdAt:Date.now(), updatedAt:Date.now(), paymentDate,
        cashExchangeType:kind, targetAmount:amount, targetCurrency:currency,
      };
      add(trip.id,entry); onClose?.();
    } catch(err){setError(err instanceof Error?err.message:String(err));}
  };

  return <section className="vela-quick-fullscreen flex min-h-[100dvh] flex-col bg-[#f7efdf] text-[#17243a]">
    <header className="flex shrink-0 items-start justify-between px-5 pb-4 pt-[max(18px,env(safe-area-inset-top))]">
      <div><p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[#9a7440]">Vela · Money</p><h2 className="text-[34px] font-normal leading-none">{kind==='cash_withdrawal'?'Cash Withdrawal':'Currency Exchange'}</h2></div>
      {onClose&&<button type="button" onClick={onClose} className="grid min-h-12 min-w-12 place-items-center rounded-full"><X size={23} strokeWidth={1.7}/></button>}
    </header>
    <form onSubmit={save} className="flex-1 overflow-y-auto px-5 pb-20 pt-2">
      {error&&<div className="mb-4 rounded-xl bg-[#f5d8d2] px-4 py-3 text-sm text-[#7c3e35]">{error}</div>}
      <label className="mb-5 block"><span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Journey</span><select value={tripId} onChange={e=>setTripId(e.target.value)} className="w-full rounded-xl bg-[#fbf7ee] px-4 py-3.5 text-base" required>{eligible.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#eee5d5] p-1.5">
        {([['cash_withdrawal','Cash'],['currency_exchange','Exchange']] as const).map(([v,l])=><button key={v} type="button" onClick={()=>setKind(v)} className={kind===v?'min-h-12 rounded-xl border border-[#17243a] bg-[#17243a] text-white':'min-h-12 rounded-xl border border-black/5 bg-[#fbf7ee] text-[#6f6659]'}>{l}</button>)}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-5">
        <label><span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">{kind==='cash_withdrawal'?'Cash received':'Foreign received'}</span><div className="flex rounded-xl bg-[#fbf7ee]"><select value={currency} onChange={e=>setCurrency(e.target.value)} className="w-24 rounded-l-xl bg-transparent px-3">{currencies.map(c=><option key={c}>{c}</option>)}</select><input value={targetAmount} onChange={e=>setTargetAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 rounded-r-xl bg-transparent px-2 py-3.5" required/></div></label>
        <label><span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">CNY actual cost</span><input value={cny} onChange={e=>setCny(e.target.value)} inputMode="decimal" placeholder="Later" className="w-full rounded-xl bg-[#fbf7ee] px-4 py-3.5"/></label>
      </div>
      {cny===''&&<p className="mt-2 text-xs text-[#8a6f4c]">暂不填人民币金额，之后可在 Ledger 的「待补 CNY」中补齐。</p>}
      <div className="mt-6"><span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Payment Account</span><div className="grid grid-cols-2 gap-3">{accounts.map(a=><button key={a.id} type="button" onClick={()=>setAccountId(a.id)} className={accountId===a.id?'min-h-12 rounded-xl border border-[#17243a] bg-[#17243a] text-white':'min-h-12 rounded-xl border border-black/5 bg-[#fbf7ee]'}>{a.name}</button>)}</div></div>
      <div className="mt-6"><label><span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full rounded-xl bg-[#fbf7ee] px-4 py-3.5"/></label></div>
      <button type="submit" className="mt-8 min-h-12 w-full rounded-2xl bg-slate-900 px-5 text-base font-semibold text-white">Save</button>
    </form>
  </section>;
};
export default CashExchangeEntry;