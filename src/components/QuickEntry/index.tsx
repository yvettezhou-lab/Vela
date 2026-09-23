import { getSegmentPrimaryCurrency, getTripPrimaryCurrency } from '../../core/travelSegment';
import React, { Component, ErrorInfo, ReactNode, useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import { TRANSPORT_CATEGORY_ID } from '../../core/validation';
import { Allocation, AllocationMode, FlightType, LedgerEntry } from '../../core/domain';

const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `entry_${Math.random().toString(36).slice(2, 11)}`;

const toDateTimestamp = (value: string) => {
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
};

const toDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayValue = () => toDateValue(new Date());
const normalizePercentageInput = (value: string) => value.replace(/^0+(?=\d)/, '');
const formatCny = (value: number) => (Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '');

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  pickerId: string;
  openPickerId: string | null;
  onOpenPicker: (pickerId: string | null) => void;
}

const parseDateValue = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const formatPickerDate = (value: string) => {
  const date = parseDateValue(value);
  return date ? `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Select date';
};

const getMonthCells = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1;
    return day >= 1 && day <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
};

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, label, required, pickerId, openPickerId, onOpenPicker }) => {
  const selectedDate = parseDateValue(value);
  const open = openPickerId === pickerId;
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const monthCells = getMonthCells(viewMonth);
  const today = toDateValue(new Date());
  const selectedValue = selectedDate ? toDateValue(selectedDate) : '';

  const openPicker = () => {
    if (open) {
      onOpenPicker(null);
      return;
    }
    const base = parseDateValue(value) ?? new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    onOpenPicker(pickerId);
  };

  const chooseDate = (date: Date) => {
    onChange(toDateValue(date));
    onOpenPicker(null);
  };

  return (
    <div className={`trip-date-picker quick-entry-date-picker${label === 'Usage End' ? ' quick-entry-date-picker-end' : ''}${label === 'Usage Start' || label === 'Usage End' ? ' quick-entry-date-picker-above' : ''}`}>
      <span>{label}</span>
      <button type="button" className={`trip-date-trigger${open ? ' is-open' : ''}`} onClick={openPicker} aria-expanded={open} aria-haspopup="dialog">
        <Calendar size={15} />
        <strong>{formatPickerDate(value)}</strong>
        <span className="trip-date-action">{open ? 'Done' : 'Change'}</span>
      </button>

      {open && (
        <div className="trip-date-popover" role="dialog" aria-label={`${label} calendar`}>
          <div className="trip-date-month">
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <strong>{viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
          </div>
          <div className="trip-date-week">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="trip-date-grid">
            {monthCells.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} className="trip-date-empty" />;
              const dateValue = toDateValue(date);
              const selected = dateValue === selectedValue;
              const isToday = dateValue === today;
              return (
                <button key={dateValue} type="button" onClick={() => chooseDate(date)} aria-label={dateValue} aria-pressed={selected} className={`trip-date-day ${selected ? 'selected' : isToday ? 'today' : ''}`}>
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          {required && !value && <p className="pt-1 text-center text-xs text-[#9a8f80]">Select a date</p>}
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
const LEDGER_CURRENCIES = ['CNY', 'MYR', 'SGD', 'THB', 'IDR', 'PHP', 'JPY', 'KRW', 'USD', 'EUR', 'GBP', 'AUD', 'HKD', 'ARS', 'AFN', 'ALL', 'DZD', 'BRL', 'KHR', 'CAD', 'CZK', 'DKK', 'EGP', 'HUF', 'ISK', 'INR', 'ILS', 'JOD', 'KZT', 'LAK', 'MVR', 'MXN', 'MNT', 'MAD', 'MMK', 'NPR', 'NZD', 'NOK', 'PLN', 'RUB', 'SAR', 'ZAR', 'TWD', 'LKR', 'SEK', 'CHF', 'TRY', 'AED', 'VND'];

const QuickEntryContent: React.FC<QuickEntryProps> = ({ onClose }) => {
  const trips = useVelaStore((state) => state.trips);
  const addLedgerEntry = useVelaStore((state) => state.addLedgerEntry);
  const eligibleTrips = trips.filter((trip) => trip && (trip.status === 'traveling' || trip.status === 'planning'));
  const currentTrip = eligibleTrips.find((trip) => trip.status === 'traveling') ?? null;
  const nearestTrips = eligibleTrips
    .filter((trip) => trip.id !== currentTrip?.id)
    .sort((a, b) => {
      const aStart = Math.min(...(a.segments ?? []).map((segment) => segment.startDate).filter(Number.isFinite));
      const bStart = Math.min(...(b.segments ?? []).map((segment) => segment.startDate).filter(Number.isFinite));
      return aStart - bStart;
    });
  const tripChoices = currentTrip ? [currentTrip, ...nearestTrips].slice(0, 4) : nearestTrips.slice(0, 4);
  const [targetTripId, setTargetTripId] = useState('');
  const [openDatePicker, setOpenDatePicker] = useState<string | null>(null);
  const targetTrip = eligibleTrips.find((trip) => trip.id === targetTripId) ?? null;
  const [entryType, setEntryType] = useState<'standard' | 'flight' | 'prepaid_multi_day'>('standard');
    const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [cnyEquivalent, setCnyEquivalent] = useState('');
  const [deferCny, setDeferCny] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [includeInCost, setIncludeInCost] = useState(true);
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
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const defaultTripId = currentTrip?.id ?? nearestTrips[0]?.id ?? '';
    setTargetTripId((current) => current && eligibleTrips.some((trip) => trip.id === current) ? current : defaultTripId);
  }, [trips]);

  const activeAccounts = targetTrip?.accounts?.filter((account) => account.archived !== true) ?? [];
  const accounts = activeAccounts.length ? activeAccounts : FALLBACK_ACCOUNTS;
  const activeMembers = targetTrip?.members?.filter((member) => member.archived !== true) ?? [];
  const members = activeMembers;
  const categories = targetTrip?.categories?.filter((category) => category.archived !== true) ?? [];
  const segments = targetTrip?.segments ?? [];

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  useEffect(() => {
    if (!targetTrip) return;
    setCategoryId((current) => {
      if (current && categories.some((category) => category.id === current)) return current;
      const nextCategoryId = categories[0]?.id ?? '';
      const defaultCategory = categories.find((category) => category.id === nextCategoryId);
      setIncludeInCost(defaultCategory?.excludeFromStats !== true);
      return nextCategoryId;
    });
    setAccountId((current) => current && accounts.some((account) => account.id === current) ? current : accounts[0]?.id ?? '');
    setPayerId((current) => current && members.some((member) => member.id === current) ? current : members[0]?.id ?? '');
    setCurrency(getTripPrimaryCurrency(targetTrip));
    const savedRule = targetTrip.allocationRules;
    if (savedRule) {
      setCustomPercentages({});
      const ruleMemberIds = Object.keys(savedRule.percentages);
      setSelectedParticipants(new Set(ruleMemberIds.filter((id) => members.some((member) => member.id === id))));
    } else {
      setSelectedParticipants((current) => {
        const validIds = new Set(members.map((member) => member.id));
        const retained = Array.from(current).filter((id) => validIds.has(id));
        return new Set(retained.length ? retained : members.map((member) => member.id));
      });
    }
  }, [targetTrip]);

  useEffect(() => {
    if (!targetTrip) return;
    const dateValue = entryType === 'flight' ? outboundDate : paymentDate;
    const date = toDateTimestamp(dateValue);
    if (!Number.isFinite(date)) return;
    const resolved = getSegmentPrimaryCurrency(segments, date);
    if (resolved) setCurrency(resolved);
  }, [targetTrip, segments, entryType, paymentDate, outboundDate]);

  useEffect(() => {
    const normalizedCurrency = currency.trim().toUpperCase();
    cnyManualRef.current = false;
    if (!normalizedCurrency) {
      setFxRate(null);
      setCnyEquivalent('');
      return;
    }
    if (normalizedCurrency === 'CNY') {
      setDeferCny(false);
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
    if (deferCny) return;
    if (cnyManualRef.current) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !fxRate) {
      if (!amount) setCnyEquivalent('');
      return;
    }
    setCnyEquivalent(formatCny(numericAmount * fxRate));
  }, [amount, fxRate, deferCny]);

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildAllocations = (cnyTotal: number): Allocation[] => {
    let participantIds: string[];
    let percentages: Record<string, number> | null = null;

    if (allocationMode === 'preset_percentage') {
      if (!targetTrip?.allocationRules?.percentages) throw new Error('This journey has no preset allocation rule yet.');
      percentages = { ...targetTrip.allocationRules.percentages };
      participantIds = Object.keys(percentages).filter((id) => members.some((member) => member.id === id) && Number(percentages[id]) > 0);
      if (!participantIds.length) throw new Error('Preset allocation has no valid participants.');
      const total = participantIds.reduce((sum, id) => sum + Number(percentages![id] ?? 0), 0);
      if (Math.abs(total - 100) > 0.01) throw new Error('Preset allocation percentages must equal 100%.');
    } else {
      participantIds = Array.from(selectedParticipants);
      if (!participantIds.length) throw new Error('Please select at least one participant.');
      if (allocationMode === 'custom_percentage') {
        percentages = Object.fromEntries(participantIds.map((id) => [id, customPercentages[id] ?? 0]));
        const total = participantIds.reduce((sum, id) => sum + Number(percentages![id] ?? 0), 0);
        if (Math.abs(total - 100) > 0.01) throw new Error('Custom percentages must equal 100%.');
      }
    }

    const allocations: Allocation[] = participantIds.map((memberId) => ({
      memberId,
      amount: 0,
      ...(percentages ? { percentage: Number(percentages[memberId] ?? 0) } : {}),
    }));

    if (allocationMode === 'equal') {
      const baseCents = Math.floor((cnyTotal * 100) / participantIds.length);
      allocations.forEach((allocation) => { allocation.amount = baseCents / 100; });
    } else {
      allocations.forEach((allocation) => {
        const percentage = allocation.percentage ?? 0;
        allocation.amount = Math.floor(cnyTotal * percentage) / 100;
      });
    }

    const allocatedCents = allocations.reduce((sum, allocation) => sum + Math.round(allocation.amount * 100), 0);
    const targetCents = Math.round(cnyTotal * 100);
    allocations[allocations.length - 1].amount = Math.round((allocations[allocations.length - 1].amount * 100 + targetCents - allocatedCents)) / 100;
    return allocations;
  };

  useEffect(() => {
    if (!error) return;
    formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [error]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const originalAmount = Number(amount);
      const cnyTotal = deferCny ? 0 : (cnyEquivalent === '' ? originalAmount : Number(cnyEquivalent));
      if (!Number.isFinite(originalAmount) || originalAmount <= 0) throw new Error('Amount must be greater than 0.');
      if (!deferCny && (!Number.isFinite(cnyTotal) || cnyTotal <= 0)) throw new Error('CNY Equivalent must be greater than 0.');
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
        includeInCost,
        isRefund: false,
        isPending: deferCny,
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

      if (!targetTrip) throw new Error('Journey is required.');
      addLedgerEntry(targetTrip.id, finalEntry);

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

  if (!eligibleTrips.length) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7efdf] p-6 text-[#17243a]">
        <div className="w-full max-w-xl rounded-2xl bg-[#fbf7ee] p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-normal">Quick Entry</h2>
            {onClose && <button type="button" onClick={onClose} aria-label="Close Quick Entry" className="grid min-h-12 min-w-12 items-center justify-center rounded-full"><X size={22} /></button>}
          </div>
          <p className="mt-5 text-[#766957]">Create a planning or active journey first.</p>
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

      {success && <div className="vela-success-toast" role="status" aria-live="polite"><strong>✓ Success</strong><span>Saved</span></div>}

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pb-[calc(180px+env(safe-area-inset-bottom))] pt-2">
        {error && <div role="alert" className="mb-4 rounded-xl bg-[#f5d8d2] px-4 py-3 text-sm text-[#7c3e35]">{error}</div>}

        <div className="quick-entry-journey mb-5 pb-3">
          <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Journey</span>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Journey">
            {tripChoices.map((trip) => {
              const destinations = (trip.segments ?? [])
                .flatMap((segment) => segment.destinations ?? [])
                .map((destination) => destination.city?.trim())
                .filter(Boolean)
                .slice(0, 2);
              const label = destinations.join(' · ') || trip.title;
              return (
                <button key={trip.id} type="button" onClick={() => setTargetTripId(trip.id)} aria-pressed={targetTripId === trip.id} className={`min-h-10 rounded-lg border px-2 text-xs font-medium transition ${targetTripId === trip.id ? 'border-[#17243a] bg-[#17243a] text-[#fffdf8] shadow-md' : 'border-black/5 bg-[#fbf7ee] text-[#17243a] shadow-sm hover:bg-white'}`}>
                  <span className="block truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="quick-entry-entry-type mt-3 grid grid-cols-3 gap-3 rounded-2xl bg-[#eee5d5] p-1.5">
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
              <select
                value={currency}
                onChange={(event) => setCurrency(event.currentTarget.value)}
                aria-label="Currency"
                className="w-[86px] appearance-none rounded-l-xl bg-transparent px-3 text-base font-medium text-[#17243a] outline-none"
              >
                {LEDGER_CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
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
              placeholder={deferCny ? 'Later' : (fxRate ? 'Auto' : 'Enter manually')}
              aria-label="CNY Equivalent"
            />
            {currency.trim().toUpperCase() !== 'CNY' && <button type="button" onClick={() => { setDeferCny(v => !v); if (!deferCny) setCnyEquivalent(''); }} className={`mt-2 text-xs ${deferCny ? 'text-[#17243a] font-semibold' : 'text-[#857a6a]'}`}>{deferCny ? '✓ Enter CNY later' : 'Enter CNY later'}</button>}
          </label>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5">
          {entryType !== 'flight' && (
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[#857a6a]">Category</span>
              <select value={categoryId} onChange={(event) => { const next = event.target.value; setCategoryId(next); setIncludeInCost(categories.find((category) => category.id === next)?.excludeFromStats !== true); }} className="w-full appearance-none rounded-xl bg-[#fbf7ee] px-4 text-base text-[#17243a] shadow-[inset_0_0_0_1px_rgba(80,64,42,.10)] outline-none" required>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
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

        <div className="vela-cost-toggle">
          <div className="vela-cost-toggle-copy">
            <span className="vela-cost-toggle-title">Include in Statistics</span>
            <span className="vela-cost-toggle-help">{includeInCost ? 'Included in trip total, daily average, and Reflection.' : 'Excluded from trip cost statistics; kept in Ledger, Allocation, and Settlement.'}</span>
          </div>
          <button type="button" role="switch" aria-checked={includeInCost} onClick={() => setIncludeInCost((value) => !value)} className={`vela-cost-switch ${includeInCost ? 'is-on' : ''}`} aria-label={includeInCost ? 'Included in statistics, tap to exclude' : 'Excluded from statistics, tap to include'}>
            <span className="vela-cost-switch-knob" />
          </button>
          <span className="vela-cost-switch-state">{includeInCost ? 'Included' : 'Excluded'}</span>
        </div>

        {entryType === 'standard' && (
          <div className="mt-6">
            <DatePicker pickerId="standard-payment" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={paymentDate} onChange={setPaymentDate} label="Date" required />
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
              <DatePicker pickerId="flight-outbound" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={outboundDate} onChange={setOutboundDate} label="Outbound" required />
              {flightType === 'round_trip' && <DatePicker pickerId="flight-return" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={returnDate} onChange={setReturnDate} label="Return" required />}
            </div>
          </div>
        )}

        {entryType === 'prepaid_multi_day' && (
          <div className="mt-6 space-y-5">
            <DatePicker pickerId="prepaid-payment" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={paymentDate} onChange={setPaymentDate} label="Payment Date" required />
            <div className="grid grid-cols-2 gap-5">
              <DatePicker pickerId="prepaid-usage-start" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={usageStart} onChange={setUsageStart} label="Usage Start" required />
              <DatePicker pickerId="prepaid-usage-end" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={usageEnd} onChange={setUsageEnd} label="Usage End" required />
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
              {([
                ['equal', 'Equal Split'],
                ['preset_percentage', 'Preset Percentage'],
                ['custom_percentage', 'Custom Percentage'],
              ] as const).map(([value, label]) => {
                const disabled = value === 'preset_percentage' && !targetTrip?.allocationRules?.percentages;
                return <button key={value} type="button" disabled={disabled} onClick={() => setAllocationMode(value)} aria-pressed={allocationMode === value} className={`min-h-10 rounded-lg border px-3 text-xs font-medium transition ${allocationMode === value ? 'border-[#17243a] bg-[#fffdf8] text-[#17243a] shadow-sm' : 'border-transparent text-[#746b5e] hover:bg-[#fbf7ee]'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>{label}</button>;
              })}
            </div>
          </div>
          {allocationMode === 'preset_percentage' && targetTrip?.allocationRules?.percentages && (
            <div className="mb-3 rounded-xl bg-[#fbf7ee] px-4 py-3 text-xs text-[#6f6659]">
              Using this journey's preset allocation:{Object.entries(targetTrip.allocationRules.percentages)
                .filter(([id, percentage]) => members.some((member) => member.id === id) && Number(percentage) > 0)
                .map(([id, percentage]) => `${members.find((member) => member.id === id)?.name ?? id} ${percentage}%`)
                .join(' · ')}
            </div>
          )}
          {allocationMode !== 'preset_percentage' && <div className="flex flex-wrap gap-3">
            {members.map((member) => {
              const selected = selectedParticipants.has(member.id);
              return (
                <button key={member.id} type="button" onClick={() => toggleParticipant(member.id)} aria-pressed={selected} className={`min-h-12 rounded-xl border px-5 text-sm font-medium transition ${selected ? 'border-[#17243a] bg-[#17243a] text-[#fffdf8] shadow-md' : 'border-black/5 bg-[#fbf7ee] text-[#17243a] shadow-sm hover:bg-white'}`}>
                  {member.name}
                  {allocationMode === 'custom_percentage' && selected && <span className="ml-2 opacity-80">{customPercentages[member.id] ?? 0}%</span>}
                </button>
              );
            })}
          </div>}
          {allocationMode === 'custom_percentage' && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {members.filter((member) => selectedParticipants.has(member.id)).map((member) => <label key={member.id} className="flex min-h-12 items-center justify-between rounded-xl bg-[#fbf7ee] px-4 shadow-[inset_0_0_0_1px_rgba(80,64,42,.10)]"><span className="text-sm">{member.name}</span><span className="flex items-center gap-1"><input type="text" inputMode="decimal" value={customPercentages[member.id] ?? ''} onChange={(event) => { const raw = normalizePercentageInput(event.target.value); setCustomPercentages((previous) => ({ ...previous, [member.id]: raw === '' ? 0 : Number(raw) })); }} className="w-16 bg-transparent text-right text-base outline-none" aria-label={`${member.name} percentage`} /><span className="text-sm text-[#857a6a]">%</span></span></label>)}
            </div>
          )}
        </div>

        <div className="quick-entry-submit-wrap">
          {error && <div className="quick-entry-submit-error" role="alert" aria-live="assertive">{error}</div>}
          <button type="submit" className="mt-8 min-h-12 w-full rounded-2xl bg-slate-900 px-5 text-base font-semibold text-white shadow-md shadow-slate-900/20 transition-all duration-200 active:scale-[0.98] active:opacity-80">Save Entry</button>
        </div>
      </form>
    </section>
  );
};

class QuickEntryErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Quick Entry render error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7efdf] p-6 text-[#17243a]">
          <div className="w-full max-w-xl rounded-2xl bg-[#fbf7ee] p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-2xl font-normal">Quick Entry</h2>
            <p className="mt-5 text-[#766957]">Quick Entry could not be opened safely. Please return to Ledger and try again.</p>
            <button type="button" onClick={() => this.setState({ hasError: false })} className="mt-5 rounded-xl bg-[#17243a] px-4 py-3 text-sm text-white">Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const QuickEntry: React.FC<QuickEntryProps> = (props) => (
  <QuickEntryErrorBoundary>
    <QuickEntryContent {...props} />
  </QuickEntryErrorBoundary>
);

export default QuickEntry;
