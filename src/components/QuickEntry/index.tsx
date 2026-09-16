import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import { TRANSPORT_CATEGORY_ID } from '../../core/validation';
import { Allocation, AllocationMode, FlightType, LedgerEntry } from '../../core/domain';

const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `entry_${Math.random().toString(36).slice(2, 11)}`;

const toDateTimestamp = (value: string) => {
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
};

const toDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayValue = () => toDateValue(new Date());

/** Carina dual-track date behavior:
 * iOS 15/16 -> native input[type=date]
 * iOS 17+ / Android / desktop -> custom React calendar
 * iPadOS desktop UA is identified through Macintosh + touch points.
 */
const getIOSMajorVersion = (): number | null => {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const isIOSDevice = /(iPhone|iPad|iPod)/i.test(ua);
  const isIPadDesktopUA = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  if (!isIOSDevice && !isIPadDesktopUA) return null;

  const iosMatch = ua.match(/OS (\d+)[._]/i);
  if (iosMatch) return Number(iosMatch[1]);

  const versionMatch = ua.match(/Version\/(\d+)(?:[._]|\.)/i);
  return versionMatch ? Number(versionMatch[1]) : null;
};

const useNativeDateInput = () => {
  const [native] = useState(() => {
    const version = getIOSMajorVersion();
    return version === 15 || version === 16;
  });
  return native;
};

const formatCny = (value: number) => (Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '');

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, label, required }) => {
  const [open, setOpen] = useState(false);
  const useNative = useNativeDateInput();
  const [viewDate, setViewDate] = useState(() => {
    const initial = value ? new Date(`${value}T00:00:00`) : new Date();
    return Number.isNaN(initial.getTime()) ? new Date() : initial;
  });

  useEffect(() => {
    if (!value) return;
    const selected = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(selected.getTime())) setViewDate(selected);
  }, [value]);

  const selectDate = (date: Date) => {
    // Only the calendar date is changed; the picker never owns or edits a time field.
    onChange(toDateValue(date));
    setOpen(false);
  };

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : index - firstWeekday + 1,
  );
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const displayValue = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select date';

  if (useNative) {
    return (
      <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">{label}</span>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9a7440]" size={19} strokeWidth={1.8} />
          <input
            type="date"
            value={value}
            required={required}
            onChange={(event) => onChange(event.currentTarget.value)}
            className="w-full rounded-xl bg-[#fbf7ee] px-12 py-3.5 text-base text-[#17243a] shadow-[inset_0_0_0_1px_rgba(80,64,42,.10)] outline-none"
          />
        </div>
      </label>
    );
  }

  return (
    <div className="relative">
      <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-[#fbf7ee] px-4 text-left text-base text-[#17243a] shadow-[inset_0_0_0_1px_rgba(80,64,42,.10)]"
      >
        <Calendar size={19} strokeWidth={1.8} className="shrink-0 text-[#9a7440]" />
        <span className={value ? '' : 'text-[#a7a097]'}>{displayValue}</span>
      </button>
      {open && (
        <div className="vela-date-popover" role="dialog" aria-label={`${label} date picker`}>
          <div className="vela-date-header">
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} aria-label="Previous month">
              <ChevronLeft size={20} />
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} aria-label="Next month">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="vela-date-weekdays">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
          <div className="vela-date-grid">
            {cells.map((day, index) => {
              if (!day) return <span key={`blank-${index}`} aria-hidden="true" />;
              const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
              const cellValue = toDateValue(cellDate);
              const selected = value === cellValue;
              return (
                <button key={cellValue} type="button" onClick={() => selectDate(cellDate)} aria-pressed={selected}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export interface QuickEntryProps {
  onClose?: () => void;
}

const FALLBACK_ACCOUNTS = [
  { id: 'default-account-cash', name: 'Cash' },
  { id: 'default-account-credit-card', name: 'Credit Card' },
];
const FALLBACK_MEMBERS = [{ id: 'default-member-me', name: 'Me' }];

export const QuickEntry: React.FC<QuickEntryProps> = ({ onClose }) => {
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const addLedgerEntry = useVelaStore((state) => state.addLedgerEntry);
  const [entryType, setEntryType] = useState<'standard' | 'flight' | 'prepaid_multi_day'>('standard');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [cnyEquivalent, setCnyEquivalent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayValue);
  const [outboundDate, setOutboundDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [usageStart, setUsageStart] = useState('');
  const [usageEnd, setUsageEnd] = useState('');
  const [flightType, setFlightType] = useState<FlightType>('one_way');
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('equal');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [customPercentages, setCustomPercentages] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fxRate, setFxRate] = useState<number | null>(null);
  const currencyComposingRef = useRef(false);
  const amountComposingRef = useRef(false);
  const cnyEquivalentComposingRef = useRef(false);
  const cnyManualRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accounts = currentTrip?.accounts.length ? currentTrip.accounts : FALLBACK_ACCOUNTS;
  const members = currentTrip?.members.length ? currentTrip.members : FALLBACK_MEMBERS;

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  useEffect(() => {
    if (!currentTrip) return;
    setCategoryId((current) => current && currentTrip.categories.some((category) => category.id === current) ? current : currentTrip.categories[0]?.id ?? '');
    setAccountId((current) => current && accounts.some((account) => account.id === current) ? current : accounts[0]?.id ?? '');
    setPayerId((current) => current && members.some((member) => member.id === current) ? current : members[0]?.id ?? '');
    setCurrency(currentTrip.localCurrency);
    setSelectedParticipants((current) => {
      const validIds = new Set(members.map((member) => member.id));
      const retained = Array.from(current).filter((id) => validIds.has(id));
      return new Set(retained.length ? retained : members.map((member) => member.id));
    });
  }, [currentTrip, accounts, members]);

  useEffect(() => {
    const normalizedCurrency = currency.trim().toUpperCase();
    cnyManualRef.current = false;
    if (!normalizedCurrency) {
      setFxRate(null);
      setCnyEquivalent('');
      return;
    }
    if (normalizedCurrency === 'CNY') {
      setFxRate(1);
      return;
    }

    const controller = new AbortController();
    setFxRate(null);
    setCnyEquivalent('');
    fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(normalizedCurrency)}&to=CNY`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('FX request failed');
        return response.json() as Promise<{ rates?: Record<string, number> }>;
      })
      .then((data) => {
        const rate = Number(data.rates?.CNY);
        if (Number.isFinite(rate) && rate > 0) setFxRate(rate);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFxRate(null);
      });

    return () => controller.abort();
  }, [currency]);

  useEffect(() => {
    if (cnyManualRef.current) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !fxRate) {
      if (!amount) setCnyEquivalent('');
      return;
    }
    setCnyEquivalent(formatCny(numericAmount * fxRate));
  }, [amount, fxRate]);

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildAllocations = (cnyTotal: number): Allocation[] => {
    const participantIds = Array.from(selectedParticipants);
    if (!participantIds.length) throw new Error('Please select at least one participant.');
    const allocations: Allocation[] = participantIds.map((memberId) => ({
      memberId,
      amount: 0,
      ...(allocationMode === 'custom_percentage' ? { percentage: customPercentages[memberId] ?? 0 } : {}),
    }));

    if (allocationMode === 'equal') {
      const baseCents = Math.floor((cnyTotal * 100) / participantIds.length);
      allocations.forEach((allocation) => { allocation.amount = baseCents / 100; });
    } else {
      const percentageTotal = allocations.reduce((sum, allocation) => sum + (allocation.percentage ?? 0), 0);
      if (Math.abs(percentageTotal - 100) > 0.01) throw new Error('Custom percentages must equal 100%.');
      allocations.forEach((allocation) => {
        const percentage = allocation.percentage ?? 0;
        allocation.amount = Math.floor(cnyTotal * percentage) / 100;
      });
    }

    const allocatedCents = allocations.reduce((sum, allocation) => sum + Math.round(allocation.amount * 100), 0);
    const targetCents = Math.round(cnyTotal * 100);
    allocations[0].amount = Math.round((allocations[0].amount * 100 + targetCents - allocatedCents)) / 100;
    return allocations;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const originalAmount = Number(amount);
      const cnyTotal = cnyEquivalent === '' ? originalAmount : Number(cnyEquivalent);
      if (!Number.isFinite(originalAmount) || originalAmount <= 0) throw new Error('Amount must be greater than 0.');
      if (!Number.isFinite(cnyTotal) || cnyTotal <= 0) throw new Error('CNY Equivalent must be greater than 0.');
      if (!payerId) throw new Error('Payer is required.');
      if (!accountId) throw new Error('Payment account is required.');
      if (entryType !== 'flight' && !categoryId) throw new Error('Category is required.');

      const allocations = buildAllocations(cnyTotal);
      const now = Date.now();
      const baseData = {
        id: `entry_${generateId()}`,
        categoryId: entryType === 'flight' ? TRANSPORT_CATEGORY_ID : categoryId,
        originalAmount,
        originalCurrency: currency.trim().toUpperCase(),
        cnyEquivalent: cnyTotal,
        isRefund: false,
        isPending: false,
        payerId,
        accountId,
        allocationMode,
        allocations,
        createdAt: now,
        updatedAt: now,
      };

      let finalEntry: LedgerEntry;
      if (entryType === 'standard') {
        const date = toDateTimestamp(paymentDate);
        if (!Number.isFinite(date)) throw new Error('Payment date is required.');
        finalEntry = { ...baseData, entryType: 'standard', paymentDate: date };
      } else if (entryType === 'flight') {
        const outbound = toDateTimestamp(outboundDate);
        if (!Number.isFinite(outbound)) throw new Error('Outbound date is required.');
        if (flightType === 'round_trip') {
          const returnTimestamp = toDateTimestamp(returnDate);
          if (!Number.isFinite(returnTimestamp)) throw new Error('Return date is required.');
          if (returnTimestamp < outbound) throw new Error('Return date cannot be before outbound date.');
          finalEntry = { ...baseData, entryType: 'flight', flightType: 'round_trip', outboundDate: outbound, returnDate: returnTimestamp };
        } else {
          finalEntry = { ...baseData, entryType: 'flight', flightType: 'one_way', outboundDate: outbound };
        }
      } else {
        const payment = toDateTimestamp(paymentDate);
        const start = toDateTimestamp(usageStart);
        const end = toDateTimestamp(usageEnd);
        if (!Number.isFinite(payment)) throw new Error('Payment date is required.');
        if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Usage dates are required.');
        if (end < start) throw new Error('Usage end cannot be before usage start.');
        finalEntry = { ...baseData, entryType: 'prepaid_multi_day', paymentDate: payment, usageStart: start, usageEnd: end };
      }

      if (!currentTrip) throw new Error('No active trip found.');
      addLedgerEntry(currentTrip.id, finalEntry);

      setAmount('');
      setCnyEquivalent('');
      setError(null);
      setSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(false), 1800);
    } catch (submissionError: unknown) {
      setSuccess(false);
      setError(submissionError instanceof Error ? submissionError.message : String(submissionError));
    }
  };

  if (!currentTrip) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7efdf] p-6 text-[#17243a]">
        <div className="w-full max-w-xl rounded-2xl bg-[#fbf7ee] p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-normal">Quick Entry</h2>
            {onClose && <button type="button" onClick={onClose} aria-label="Close Quick Entry" className="grid min-h-12 min-w-12 place-items-center rounded-full"><X size={22} /></button>}
          </div>
          <p className="mt-5 text-[#766957]">No active trip found. Please create or select a planning or traveling trip first.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="vela-quick-fullscreen flex min-h-[100dvh] flex-col bg-[#f7efdf] text-[#17243a]">
      <header className="flex shrink-0 items-start justify-between px-5 pb-4 pt-[max(18px,env(safe-area-inset-top))]">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[#9a7440]">Vela · Record</p>
          <h2 className="text-[34px] font-normal leading-none">Quick Entry</h2>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="Close Quick Entry" className="vela-quick-close grid min-h-12 min-w-12 place-items-center rounded-full text-[#17243a]"><X size={23} strokeWidth={1.7} /></button>}
      </header>

      {success && <div className="vela-success-toast" role="status" aria-live="polite"><strong>✓ Success</strong><span>已保存</span></div>}

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pb-[calc(120px+env(safe-area-inset-bottom))] pt-2">
        {error && <div role="alert" className="mb-4 rounded-xl bg-[#f5d8d2] px-4 py-3 text-sm text-[#7c3e35]">{error}</div>}

        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#eee5d5] p-1.5">
          {([
            ['standard', 'Standard'],
            ['flight', 'Flight'],
            ['prepaid_multi_day', 'Prepaid'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setEntryType(value)} aria-pressed={entryType === value} className={`min-h-12 rounded-xl border px-2 text-sm font-medium transition ${entryType === value ? 'border-[#17243a] bg-[#17243a] text-[#fffdf8] shadow-md' : 'border-black/5 bg-[#fbf7ee] text-[#6f6659] shadow-sm hover:bg-white'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Amount</span>
            <div className="flex rounded-xl bg-[#fbf7ee] shadow-[inset_0_0_0_1px_rgba(80,64,42,.10)]">
              <input
                type="text"
                value={currency}
                onCompositionStart={() => { currencyComposingRef.current = true; }}
                onCompositionEnd={(event) => {
                  currencyComposingRef.current = false;
                  setCurrency(event.currentTarget.value.trim().toUpperCase());
                }}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  if (!currencyComposingRef.current) setCurrency(next.toUpperCase());
                  else setCurrency(next);
                }}
                autoCapitalize="characters"
                spellCheck={false}
                aria-label="Currency"
                className="w-[72px] rounded-l-xl bg-transparent px-3 text-base text-[#17243a] outline-none"
              />
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onCompositionStart={() => { amountComposingRef.current = true; }}
                onCompositionEnd={(event) => {
                  amountComposingRef.current = false;
                  setAmount(event.currentTarget.value);
                }}
                onChange={(event) => {
                  if (!amountComposingRef.current) setAmount(event.currentTarget.value);
                }}
                className="min-w-0 flex-1 rounded-r-xl bg-transparent px-2 text-base text-[#17243a] outline-none"
                placeholder="0.00"
                required
                aria-label="Amount"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">CNY Equivalent</span>
            <input
              type="text"
              inputMode="decimal"
              value={cnyEquivalent}
              readOnly={currency.trim().toUpperCase() === 'CNY'}
              onCompositionStart={() => { cnyEquivalentComposingRef.current = true; }}
              onCompositionEnd={(event) => {
                cnyEquivalentComposingRef.current = false;
                if (currency.trim().toUpperCase() !== 'CNY') {
                  cnyManualRef.current = true;
                  setCnyEquivalent(event.currentTarget.value);
                }
              }}
              onChange={(event) => {
                if (currency.trim().toUpperCase() !== 'CNY') {
                  cnyManualRef.current = true;
                  if (!cnyEquivalentComposingRef.current) setCnyEquivalent(event.currentTarget.value);
                }
              }}
              className="w-full rounded-xl bg-[#fbf7ee] px-4 text-base text-[#17243a] shadow-[inset_0_0_0_1px_rgba(80,64,42,.10)] outline-none read-only:text-[#857a6a]"
              placeholder={fxRate ? 'Auto' : 'Enter manually'}
              aria-label="CNY Equivalent"
            />
          </label>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5">
          {entryType !== 'flight' && (
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Category</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="w-full appearance-none rounded-xl bg-[#fbf7ee] px-4 text-base text-[#17243a] shadow-[inset_0_0_0_1px_rgba(80,64,42,.10)] outline-none" required>
                {currentTrip.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          )}
          <div className={entryType === 'flight' ? 'col-span-2' : ''}>
            <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Payment Account</span>
            <div className="grid grid-cols-2 gap-3">
              {accounts.map((account) => <button key={account.id} type="button" onClick={() => setAccountId(account.id)} aria-pressed={accountId === account.id} className={`min-h-12 rounded-xl border px-3 text-sm font-medium transition ${accountId === account.id ? 'border-[#17243a] bg-[#17243a] text-[#fffdf8] shadow-md' : 'border-black/5 bg-[#fbf7ee] text-[#17243a] shadow-sm hover:bg-white'}`}>{account.name}</button>)}
            </div>
          </div>
        </div>

        {entryType === 'standard' && (
          <div className="mt-6">
            <DatePicker value={paymentDate} onChange={setPaymentDate} label="Date" required />
          </div>
        )}

        {entryType === 'flight' && (
          <div className="mt-6 space-y-5">
            <div>
              <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Flight</span>
              <div className="grid grid-cols-2 gap-3">
                {([['one_way', 'One Way'], ['round_trip', 'Round Trip']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFlightType(value)} aria-pressed={flightType === value} className={`min-h-12 rounded-xl border px-4 text-sm font-medium transition ${flightType === value ? 'border-[#17243a] bg-[#17243a] text-[#fffdf8] shadow-md' : 'border-black/5 bg-[#fbf7ee] text-[#17243a] shadow-sm hover:bg-white'}`}>{label}</button>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <DatePicker value={outboundDate} onChange={setOutboundDate} label="Outbound" required />
              {flightType === 'round_trip' && <DatePicker value={returnDate} onChange={setReturnDate} label="Return" required />}
            </div>
          </div>
        )}

        {entryType === 'prepaid_multi_day' && (
          <div className="mt-6 space-y-5">
            <DatePicker value={paymentDate} onChange={setPaymentDate} label="Payment Date" required />
            <div className="grid grid-cols-2 gap-5">
              <DatePicker value={usageStart} onChange={setUsageStart} label="Usage Start" required />
              <DatePicker value={usageEnd} onChange={setUsageEnd} label="Usage End" required />
            </div>
          </div>
        )}

        <div className="mt-6">
          <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Who Paid?</span>
          <div className="flex flex-wrap gap-3">
            {members.map((member) => <button key={member.id} type="button" onClick={() => setPayerId(member.id)} aria-pressed={payerId === member.id} className={`min-h-12 rounded-xl border px-5 text-sm font-medium transition ${payerId === member.id ? 'border-[#17243a] bg-[#17243a] text-[#fffdf8] shadow-md' : 'border-black/5 bg-[#fbf7ee] text-[#17243a] shadow-sm hover:bg-white'}`}>{member.name}</button>)}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.14em] text-[#857a6a]">Participants</span>
            <div className="flex gap-1.5 rounded-xl bg-[#eee5d5] p-1">
              {([['equal', 'Equal'], ['custom_percentage', 'Custom %']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setAllocationMode(value)} aria-pressed={allocationMode === value} className={`min-h-10 rounded-lg border px-3 text-xs font-medium transition ${allocationMode === value ? 'border-[#17243a] bg-[#fffdf8] text-[#17243a] shadow-sm' : 'border-transparent text-[#746b5e] hover:bg-[#fbf7ee]'}`}>{label}</button>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {members.map((member) => {
              const selected = selectedParticipants.has(member.id);
              return (
                <button key={member.id} type="button" onClick={() => toggleParticipant(member.id)} aria-pressed={selected} className={`min-h-12 rounded-xl border px-5 text-sm font-medium transition ${selected ? 'border-[#17243a] bg-[#17243a] text-[#fffdf8] shadow-md' : 'border-black/5 bg-[#fbf7ee] text-[#17243a] shadow-sm hover:bg-white'}`}>
                  {member.name}
                  {allocationMode === 'custom_percentage' && selected && <span className="ml-2 opacity-80">{customPercentages[member.id] ?? 0}%</span>}
                </button>
              );
            })}
          </div>
          {allocationMode === 'custom_percentage' && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {members.filter((member) => selectedParticipants.has(member.id)).map((member) => <label key={member.id} className="flex min-h-12 items-center justify-between rounded-xl bg-[#fbf7ee] px-4 shadow-[inset_0_0_0_1px_rgba(80,64,42,.10)]"><span className="text-sm">{member.name}</span><span className="flex items-center gap-1"><input type="text" inputMode="decimal" value={customPercentages[member.id] ?? ''} onChange={(event) => setCustomPercentages((previous) => ({ ...previous, [member.id]: event.target.value === '' ? 0 : Number(event.target.value) }))} className="w-16 bg-transparent text-right text-base outline-none" aria-label={`${member.name} percentage`} /><span className="text-sm text-[#857a6a]">%</span></span></label>)}
            </div>
          )}
        </div>

        <button type="submit" className="mt-8 min-h-12 w-full rounded-2xl bg-[#17243a] px-5 text-base font-medium text-[#fffdf8] shadow-[0_8px_20px_rgba(23,36,58,.16)] transition active:scale-[.99]">Save Entry</button>
      </form>
    </section>
  );
};

export default QuickEntry;
