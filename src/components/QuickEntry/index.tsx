import { getSegmentsByDate, getLedgerEntryDate, getTripPrimaryCurrency } from '../../core/travelSegment';
import React, { Component, ErrorInfo, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import { TRANSPORT_CATEGORY_ID } from '../../core/validation';
import { Allocation, AllocationMode, LedgerEntry, TravelSegment, TransportMode, TransportJourneyType } from '../../core/domain';

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
const currentTimeValue = () => {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
const toPaidTimestamp = (dateValue: string, timeValue: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) return NaN;
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isFinite(date.getTime()) ? date.getTime() : NaN;
};
const paidParts = (timestamp: number) => {
  const date = new Date(timestamp);
  return {
    date: toDateValue(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
};
const formatPaidTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : 'Select date & time';
};
const normalizePercentageInput = (value: string) => value.replace(/^0+(?=\d)/, '');
const formatCny = (value: number) => (Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '');
const evaluateAmountExpression = (input: string): number | null => {
  const expression = input.replace(/\s+/g, '');
  if (!expression || !/^[0-9.+*/()\-]+$/.test(expression)) return null;
  let index = 0;
  const parseNumber = (): number | null => {
    const start = index;
    while (index < expression.length && /[0-9.]/.test(expression[index])) index += 1;
    if (start === index) return null;
    const value = Number(expression.slice(start, index));
    return Number.isFinite(value) ? value : null;
  };
  const parseFactor = (): number | null => {
    let sign = 1;
    while (expression[index] === '+' || expression[index] === '-') {
      if (expression[index] === '-') sign *= -1;
      index += 1;
    }
    let value: number | null;
    if (expression[index] === '(') {
      index += 1;
      value = parseExpression();
      if (expression[index] !== ')') return null;
      index += 1;
    } else {
      value = parseNumber();
    }
    return value === null ? null : sign * value;
  };
  const parseTerm = (): number | null => {
    let value = parseFactor();
    if (value === null) return null;
    while (expression[index] === '*' || expression[index] === '/') {
      const op = expression[index++];
      const rhs = parseFactor();
      if (rhs === null || (op === '/' && rhs === 0)) return null;
      value = op === '*' ? value * rhs : value / rhs;
      if (!Number.isFinite(value)) return null;
    }
    return value;
  };
  function parseExpression(): number | null {
    let value = parseTerm();
    if (value === null) return null;
    while (expression[index] === '+' || expression[index] === '-') {
      const op = expression[index++];
      const rhs = parseTerm();
      if (rhs === null) return null;
      value = op === '+' ? value + rhs : value - rhs;
      if (!Number.isFinite(value)) return null;
    }
    return value;
  }
  const result = parseExpression();
  return result !== null && index === expression.length && Number.isFinite(result) ? result : null;
};

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  pickerId: string;
  openPickerId: string | null;
  onOpenPicker: (pickerId: string | null) => void;
  openMonthValue?: string;
  minDate?: string;
  maxDate?: string;
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

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, label, required, pickerId, openPickerId, onOpenPicker, openMonthValue, minDate, maxDate }) => {
  const selectedDate = parseDateValue(value);
  const open = openPickerId === pickerId;
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const monthCells = getMonthCells(viewMonth);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!pickerRef.current?.contains(target)) onOpenPicker(null);
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [open, onOpenPicker]);
  useEffect(() => {
    if (!open) return;
    const base = parseDateValue(value) ?? parseDateValue(openMonthValue ?? '') ?? parseDateValue(minDate ?? '') ?? new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, value, openMonthValue, minDate]);

  const today = toDateValue(new Date());
  const selectedValue = selectedDate ? toDateValue(selectedDate) : '';

  const openPicker = () => {
    if (open) {
      onOpenPicker(null);
      return;
    }
    const base = parseDateValue(value) ?? parseDateValue(openMonthValue ?? '') ?? new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    onOpenPicker(pickerId);
  };

  const chooseDate = (date: Date) => {
    onChange(toDateValue(date));
    onOpenPicker(null);
  };

  return (
    <div ref={pickerRef} className={`trip-date-picker quick-entry-date-picker${label === 'Return' || label === 'Usage End' ? ' quick-entry-date-picker-end' : ''}${label === 'Usage Start' || label === 'Usage End' ? ' quick-entry-date-picker-above' : ''}`}>
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
              const outOfRange = (minDate && dateValue < minDate) || (maxDate && dateValue > maxDate);
              return (
                <button key={dateValue} type="button" onClick={() => !outOfRange && chooseDate(date)} disabled={Boolean(outOfRange)} aria-label={dateValue} aria-pressed={selected} className={`trip-date-day ${selected ? 'selected' : isToday ? 'today' : ''}${outOfRange ? ' disabled' : ''}`}>
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
  editTripId?: string;
  initialEntry?: LedgerEntry | null;
}

const FALLBACK_ACCOUNTS = [
  { id: 'default-account-cash', name: 'Cash' },
  { id: 'default-account-credit-card', name: 'Credit Card' },
];
const LEDGER_CURRENCIES = ['CNY', 'MYR', 'SGD', 'THB', 'IDR', 'PHP', 'JPY', 'KRW', 'USD', 'EUR', 'GBP', 'AUD', 'HKD', 'ARS', 'AFN', 'ALL', 'DZD', 'BRL', 'KHR', 'CAD', 'CZK', 'DKK', 'EGP', 'HUF', 'ISK', 'INR', 'ILS', 'JOD', 'KZT', 'LAK', 'MVR', 'MXN', 'MNT', 'MAD', 'MMK', 'NPR', 'NZD', 'NOK', 'PLN', 'RUB', 'SAR', 'ZAR', 'TWD', 'LKR', 'SEK', 'CHF', 'TRY', 'AED', 'VND'];

const QuickEntryContent: React.FC<QuickEntryProps> = ({ onClose, editTripId, initialEntry }) => {
  const trips = useVelaStore((state) => state.trips);
  const addLedgerEntry = useVelaStore((state) => state.addLedgerEntry);
  const updateLedgerEntry = useVelaStore((state) => state.updateLedgerEntry);
  const deleteLedgerEntry = useVelaStore((state) => state.deleteLedgerEntry);
  const commonCategories = useVelaStore((state) => state.commonCategories);
  const isEditing = Boolean(initialEntry);
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
  const isDomesticTrip = Boolean(targetTrip?.segments?.length) && targetTrip.segments.every((segment) => segment.destinations?.length > 0 && segment.destinations.every((destination) => ['china', '中国'].includes(destination.country.trim().toLowerCase())));
  const [entryType, setEntryType] = useState<'standard' | 'transport' | 'prepaid_multi_day'>('standard');
    const [amount, setAmount] = useState('');
  const [refundOf, setRefundOf] = useState('');
  const [amountPadOpen, setAmountPadOpen] = useState(false);
  const [currency, setCurrency] = useState('CNY');
  const [cnyEquivalent, setCnyEquivalent] = useState('');
  const [deferCny, setDeferCny] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [includeInCost, setIncludeInCost] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [payerId, setPayerId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayValue);
  const [paidAtDate, setPaidAtDate] = useState(todayValue);
  const [paidAtTime, setPaidAtTime] = useState(currentTimeValue);
  const [paidEditorOpen, setPaidEditorOpen] = useState(false);
  const [outboundDate, setOutboundDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [usageStart, setUsageStart] = useState('');
  const [usageEnd, setUsageEnd] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('flight');
  const [journeyType, setJourneyType] = useState<TransportJourneyType>('one_way');
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('equal');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [customPercentages, setCustomPercentages] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pendingSegmentSwitch, setPendingSegmentSwitch] = useState<{
    tripId: string;
    entry: LedgerEntry;
    currentSegmentId: string;
    nextSegment: TravelSegment;
  } | null>(null);
  const [fxRate, setFxRate] = useState<number | null>(null);
  const currencyComposingRef = useRef(false);
  const amountComposingRef = useRef(false);
  const cnyEquivalentComposingRef = useRef(false);
  const cnyManualRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const defaultTripId = currentTrip?.id ?? nearestTrips[0]?.id ?? '';
    setTargetTripId((current) => editTripId ?? (current && eligibleTrips.some((trip) => trip.id === current) ? current : defaultTripId));
  }, [trips]);

  const activeAccounts = targetTrip?.accounts?.filter((account) => account.archived !== true) ?? [];
  const accounts = useMemo(() => {
    const source = activeAccounts.length ? activeAccounts : FALLBACK_ACCOUNTS;
    const lastUsedAt = new Map<string, number>();
    (targetTrip?.ledger ?? []).forEach((entry) => {
      if (!entry.accountId) return;
      lastUsedAt.set(entry.accountId, Math.max(lastUsedAt.get(entry.accountId) ?? 0, entry.createdAt ?? 0));
    });
    return [...source].sort((a, b) => (lastUsedAt.get(b.id) ?? 0) - (lastUsedAt.get(a.id) ?? 0));
  }, [activeAccounts, targetTrip]);
  const activeMembers = targetTrip?.members?.filter((member) => member.archived !== true) ?? [];
  const members = activeMembers;
  const payerFrequency = useMemo(() => {
    const counts = new Map<string, number>();
    trips.forEach((trip) => (trip.ledger ?? []).forEach((entry) => counts.set(entry.payerId, (counts.get(entry.payerId) ?? 0) + 1)));
    return [...members].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [members, trips]);
  const categories = (() => {
    const tripCategories = targetTrip?.categories?.filter((category) => category.archived !== true) ?? [];
    if (!tripCategories.length || !commonCategories?.length) return tripCategories;
    const commonOrder = new Map(commonCategories.filter((category) => category.archived !== true).map((category, index) => [category.name.trim().toLowerCase(), index]));
    const builtIns = [
      { id: 'cat_income', name: 'Income', type: 'income' },
      { id: 'cat_refund', name: 'Refund', type: 'income' },
    ];
    const withBuiltIns = [...tripCategories, ...builtIns.filter((builtIn) => !tripCategories.some((category) => category.id === builtIn.id))];
    return [...withBuiltIns].sort((a, b) => {
      const ai = commonOrder.get(a.name.trim().toLowerCase());
      const bi = commonOrder.get(b.name.trim().toLowerCase());
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return 0;
    });
  })();

  const evaluatedAmount = useMemo(() => evaluateAmountExpression(amount), [amount]);
  const isIncome = evaluatedAmount !== null && evaluatedAmount < 0;
  const isRefundCategory = categoryId === 'cat_refund';
  const visibleCategories = categories.filter((category) => isIncome ? (category.id === 'cat_income' || category.id === 'cat_refund') : category.id !== 'cat_income' && category.id !== 'cat_refund');
  const refundOptions = useMemo(() => {
    if (!targetTrip) return [];
    return targetTrip.ledger.filter((entry) => entry.entryDirection !== 'income' && !entry.isRefund).map((entry) => {
      const refunded = targetTrip.ledger.filter((item) => item.isRefund && item.refundOf === entry.id).reduce((sum, item) => sum + item.cnyEquivalent, 0);
      const current = initialEntry?.refundOf === entry.id ? initialEntry.cnyEquivalent : 0;
      return { entry, remaining: Math.max(0, entry.cnyEquivalent - refunded + current) };
    }).filter((item) => item.remaining > 0.001);
  }, [targetTrip, initialEntry]);

  useEffect(() => {
    if (isIncome) {
      if (categoryId !== 'cat_income' && categoryId !== 'cat_refund') setCategoryId('cat_income');
    } else if (categoryId === 'cat_income' || categoryId === 'cat_refund') {
      const expenseCategory = categories.find((category) => category.id !== 'cat_income' && category.id !== 'cat_refund');
      setCategoryId(expenseCategory?.id ?? '');
      setRefundOf('');
    }
  }, [isIncome]);

  useEffect(() => {
    if (categoryId !== 'cat_refund') setRefundOf('');
  }, [categoryId]);

  const tripDateBounds = (() => {
    if (!targetTrip?.segments?.length) return { minDate: undefined as string | undefined, maxDate: undefined as string | undefined };
    const starts = targetTrip.segments.map((segment) => segment.startDate).filter(Number.isFinite);
    const ends = targetTrip.segments.map((segment) => segment.endDate).filter(Number.isFinite);
    if (!starts.length || !ends.length) return { minDate: undefined as string | undefined, maxDate: undefined as string | undefined };
    return { minDate: toDateValue(new Date(Math.min(...starts))), maxDate: toDateValue(new Date(Math.max(...ends))) };
  })();

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  useEffect(() => {
    if (!initialEntry || !targetTrip || targetTrip.id !== editTripId) return;
    setEntryType(initialEntry.entryType);
    setAmount(String((initialEntry.entryDirection === 'income' || initialEntry.isRefund) ? -initialEntry.originalAmount : initialEntry.originalAmount));
    setCurrency(initialEntry.originalCurrency);
    setCnyEquivalent(String(initialEntry.cnyEquivalent));
    setDeferCny(initialEntry.isPending);
    setCategoryId(initialEntry.entryDirection === 'income' ? (initialEntry.isRefund ? 'cat_refund' : 'cat_income') : initialEntry.categoryId);
    setRefundOf(initialEntry.refundOf ?? '');
    setIncludeInCost(initialEntry.includeInCost);
    setAccountId(initialEntry.accountId);
    setNote(initialEntry.note ?? '');
    setPayerId(initialEntry.payerId);
    setAllocationMode(initialEntry.allocationMode);
    setSelectedParticipants(new Set(initialEntry.allocations.map((allocation) => allocation.memberId)));
    setCustomPercentages(Object.fromEntries(initialEntry.allocations.map((allocation) => [allocation.memberId, allocation.percentage ?? 0])));
    const legacyPaidAt = initialEntry.paidAt
      ?? ('paymentDate' in initialEntry ? initialEntry.paymentDate : undefined)
      ?? ('outboundDate' in initialEntry ? initialEntry.outboundDate : undefined)
      ?? initialEntry.createdAt;
    const initialPaid = paidParts(legacyPaidAt);
    setPaidAtDate(initialPaid.date);
    setPaidAtTime(initialPaid.time);
    setPaymentDate(initialPaid.date);
    if (initialEntry.entryType === 'standard' || initialEntry.entryType === 'prepaid_multi_day') {
      setPaymentDate(toDateValue(new Date(initialEntry.paymentDate)));
    }
    if (initialEntry.entryType === 'prepaid_multi_day') {
      setUsageStart(toDateValue(new Date(initialEntry.usageStart)));
      setUsageEnd(toDateValue(new Date(initialEntry.usageEnd)));
    }
    if (initialEntry.entryType === 'transport') {
      setTransportMode(initialEntry.transportMode);
      setJourneyType(initialEntry.journeyType);
      setOutboundDate(toDateValue(new Date(initialEntry.outboundDate)));
      if (initialEntry.journeyType === 'round_trip') setReturnDate(toDateValue(new Date(initialEntry.returnDate)));
    }
  }, [initialEntry, targetTrip, editTripId]);

  useEffect(() => {
    if (!targetTrip) return;
    if (initialEntry && targetTrip.id === editTripId) return;
    setCategoryId((current) => {
      if (current && categories.some((category) => category.id === current)) return current;
      const nextCategoryId = categories[0]?.id ?? '';
      const defaultCategory = categories.find((category) => category.id === nextCategoryId);
      setIncludeInCost(defaultCategory?.excludeFromStats !== true);
      return nextCategoryId;
    });
    setAccountId((current) => current && accounts.some((account) => account.id === current) ? current : accounts[0]?.id ?? '');
    setPayerId((current) => current && members.some((member) => member.id === current) ? current : members[0]?.id ?? '');
    const lastUsedCurrency = [...targetTrip.ledger]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((entry) => entry.originalCurrency?.trim().toUpperCase())
      .find(Boolean);
    setCurrency(lastUsedCurrency || getTripPrimaryCurrency(targetTrip));
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
    const numericAmount = evaluateAmountExpression(amount);
    if (numericAmount === null || !Number.isFinite(numericAmount) || numericAmount === 0 || !fxRate) {
      if (!amount) setCnyEquivalent('');
      return;
    }
    setCnyEquivalent(formatCny(Math.abs(numericAmount) * fxRate));
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
      const totalCents = Math.round(cnyTotal * 100);
      const baseCents = Math.floor(totalCents / participantIds.length);
      const remainderCents = totalCents - (baseCents * participantIds.length);
      allocations.forEach((allocation, index) => {
        allocation.amount = (baseCents + (index < remainderCents ? 1 : 0)) / 100;
      });
    } else {
      // Allocate in cents so rounded participant amounts always add up exactly
      // to the CNY total. Any leftover cents go to the largest fractional
      // remainders, avoiding the 1-cent-per-person rounding drift.
      const totalCents = Math.round(cnyTotal * 100);
      const centParts = allocations.map((allocation, index) => {
        const percentage = allocation.percentage ?? 0;
        const exactCents = totalCents * percentage / 100;
        const baseCents = Math.floor(exactCents);
        return { index, baseCents, remainder: exactCents - baseCents };
      });
      let remainingCents = totalCents - centParts.reduce((sum, part) => sum + part.baseCents, 0);
      centParts
        .slice()
        .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
        .forEach((part) => {
          if (remainingCents > 0) {
            part.baseCents += 1;
            remainingCents -= 1;
          }
        });
      centParts.forEach((part) => {
        allocations[part.index].amount = part.baseCents / 100;
      });
    }

    return allocations;
  };

  useEffect(() => {
    if (!error) return;
    formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [error]);

  const saveEntry = (tripId: string, entry: LedgerEntry, segmentId?: string) => {
    if (isEditing) {
      updateLedgerEntry(tripId, entry.id, segmentId ? { ...entry, segmentId } : entry);
      setError(null);
      onClose?.();
      return;
    }
    addLedgerEntry(tripId, segmentId ? { ...entry, segmentId } : entry);
    setAmount('');
    setCnyEquivalent('');
    setNote('');
    const freshNow = Date.now();
    const freshPaid = paidParts(freshNow);
    setPaidAtDate(freshPaid.date);
    setPaidAtTime(freshPaid.time);
    setPaidEditorOpen(false);
    setError(null);
    setSuccess(true);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccess(false), 1800);
  };

  const handleDeleteEntry = () => {
    if (!initialEntry || !targetTrip) return;
    const confirmed = window.confirm('Delete this ledger entry?');
    if (!confirmed) return;
    deleteLedgerEntry(targetTrip.id, initialEntry.id);
    onClose?.();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const rawAmount = evaluateAmountExpression(amount);
      const isIncomeEntry = rawAmount !== null && rawAmount < 0;
      const originalAmount = rawAmount === null ? null : Math.abs(rawAmount);
      const cnyTotal = deferCny ? 0 : (cnyEquivalent === '' ? originalAmount : Math.abs(Number(cnyEquivalent)));
      if (originalAmount === null || !Number.isFinite(originalAmount) || originalAmount <= 0) throw new Error('Amount must be a valid non-zero amount.');
      if (!deferCny && (!Number.isFinite(cnyTotal) || cnyTotal <= 0)) throw new Error('CNY Equivalent must be greater than 0.');
      if (!payerId) throw new Error(isIncomeEntry ? 'Receiver is required.' : 'Payer is required.');
      if (!accountId) throw new Error('Payment account is required.');
      if (entryType !== 'transport' && !categoryId) throw new Error('Category is required.');
      if (isIncomeEntry && categoryId !== 'cat_income' && categoryId !== 'cat_refund') throw new Error('Income entries must use Income or Refund category.');
      if (!isIncomeEntry && (categoryId === 'cat_income' || categoryId === 'cat_refund')) throw new Error('Expense entries cannot use Income or Refund category.');
      if (categoryId === 'cat_refund' && !refundOf) throw new Error('Refund must be linked to an expense.');
      if (categoryId === 'cat_refund' && !refundOptions.some((option) => option.entry.id === refundOf && cnyTotal <= option.remaining + 0.001)) throw new Error('Refund exceeds the remaining refundable amount.');

      const allocations = buildAllocations(cnyTotal);
      const paidAt = toPaidTimestamp(paidAtDate, paidAtTime);
      if (!Number.isFinite(paidAt)) throw new Error('Paid date and time are required.');
      const paidDateOnly = toDateTimestamp(paidAtDate);
      if (!Number.isFinite(paidDateOnly)) throw new Error('Paid date is required.');
      const now = Date.now();
      const baseData = {
        id: initialEntry?.id ?? `entry_${generateId()}`,
        categoryId: entryType === 'transport' ? TRANSPORT_CATEGORY_ID : categoryId,
        originalAmount,
        originalCurrency: currency.trim().toUpperCase(),
        cnyEquivalent: cnyTotal,
        includeInCost,
        entryDirection: isIncomeEntry ? 'income' : 'expense',
        isRefund: categoryId === 'cat_refund',
        ...(categoryId === 'cat_refund' && refundOf ? { refundOf } : {}),
        isPending: deferCny,
        payerId,
        accountId,
        ...(note.trim() ? { note: note.trim() } : {}),
        allocationMode,
        allocations,
        createdAt: initialEntry?.createdAt ?? now,
        updatedAt: now,
        paidAt,
      };

      let finalEntry: LedgerEntry;
      if (entryType === 'standard') {
        const date = toDateTimestamp(paymentDate);
        if (!Number.isFinite(date)) throw new Error('Payment date is required.');
        finalEntry = { ...baseData, entryType: 'standard', paymentDate: paidDateOnly };
      } else if (entryType === 'transport') {
        const outbound = toDateTimestamp(outboundDate);
        if (!Number.isFinite(outbound)) throw new Error('Outbound date is required.');
        if (journeyType === 'round_trip') {
          if (transportMode === 'long_distance_bus') throw new Error('Long-distance bus tickets are one-way only.');
          const returnTimestamp = toDateTimestamp(returnDate);
          if (!Number.isFinite(returnTimestamp)) throw new Error('Return date is required.');
          if (returnTimestamp < outbound) throw new Error('Return date cannot be before outbound date.');
          finalEntry = { ...baseData, entryType: 'transport', transportMode, journeyType: 'round_trip', outboundDate: outbound, returnDate: returnTimestamp, paymentDate: paidDateOnly };
        } else {
          finalEntry = { ...baseData, entryType: 'transport', transportMode, journeyType: 'one_way', outboundDate: outbound, paymentDate: paidDateOnly };
        }
      } else {
        const payment = toDateTimestamp(paymentDate);
        const start = toDateTimestamp(usageStart);
        const end = toDateTimestamp(usageEnd);
        if (!Number.isFinite(payment)) throw new Error('Payment date is required.');
        if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Usage dates are required.');
        if (end < start) throw new Error('Usage end cannot be before usage start.');
        finalEntry = { ...baseData, entryType: 'prepaid_multi_day', paymentDate: paidDateOnly, usageStart: start, usageEnd: end };
      }

      if (!targetTrip) throw new Error('Journey is required.');

      const contextDate = getLedgerEntryDate(finalEntry);
      const daySegments = getSegmentsByDate(targetTrip.segments, contextDate);
      const sameDayEntries = targetTrip.ledger
        .filter((entry) => {
          const entryDate = getLedgerEntryDate(entry);
          return Number.isFinite(entryDate) && toDateValue(new Date(entryDate)) === toDateValue(new Date(contextDate));
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      const lastSegmentId = sameDayEntries.find((entry) => entry.segmentId)?.segmentId;
      const currentSegmentIndex = lastSegmentId
        ? daySegments.findIndex((segment) => segment.id === lastSegmentId)
        : 0;
      const safeCurrentIndex = currentSegmentIndex >= 0 ? currentSegmentIndex : 0;
      const currentSegment = daySegments[safeCurrentIndex];
      const nextSegment = daySegments[safeCurrentIndex + 1];

      if (currentSegment && nextSegment) {
        setPendingSegmentSwitch({
          tripId: targetTrip.id,
          entry: finalEntry,
          currentSegmentId: currentSegment.id,
          nextSegment,
        });
        return;
      }

      saveEntry(targetTrip.id, finalEntry, currentSegment?.id);
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
          <h2 className="text-[34px] font-normal leading-none">{isEditing ? 'Edit Entry' : 'Quick Entry'}</h2>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="Close Quick Entry" className="vela-quick-close grid min-h-12 min-w-12 place-items-center rounded-full text-[#17243a]"><X size={23} strokeWidth={1.7} /></button>}
      </header>

      <form onSubmit={handleSubmit} className={`quick-entry-form${amountPadOpen ? ' amount-keypad-open' : ''}`}>
        <div className="quick-entry-planning-row">
          {tripChoices.slice(0, 3).map((trip) => {
            const destinations = (trip.segments ?? [])
              .flatMap((segment) => segment.destinations ?? [])
              .map((destination) => destination.city?.trim())
              .filter(Boolean)
              .slice(0, 2);
            const label = destinations.join(' · ') || trip.title;
            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => setTargetTripId(trip.id)}
                aria-pressed={targetTripId === trip.id}
                className={`quick-entry-planning-trip ${targetTripId === trip.id ? 'is-selected' : ''}`}
               
              >
                <span className="block truncate">{label}</span>
              </button>
            );
          })}

          <div className="quick-entry-planning-paid">
            <button
              type="button"
              onClick={() => setPaidEditorOpen((open) => !open)}
              className="quick-entry-planning-paid-button"
              aria-expanded={paidEditorOpen}
              aria-label="Edit paid date and time"
            >
              <strong>{formatPaidTimestamp(toPaidTimestamp(paidAtDate, paidAtTime))}</strong>
            </button>
            {paidEditorOpen && (
              <div className="quick-entry-paid-popover">
                <label className="quick-entry-paid-field">
                  <span>Date</span>
                  <input type="date" value={paidAtDate} onChange={(event) => { setPaidAtDate(event.target.value); setPaymentDate(event.target.value); }} />
                </label>
                <label className="quick-entry-paid-field">
                  <span>Time</span>
                  <input type="time" value={paidAtTime} onChange={(event) => setPaidAtTime(event.target.value)} />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="quick-entry-entry-type">
          {([
            ['standard', 'Standard'],
            ['transport', 'Transport'],
            ['prepaid_multi_day', 'Prepaid'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setEntryType(value)} aria-pressed={entryType === value} className={`quick-entry-entry-type-button ${entryType === value ? 'is-selected' : ''}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="quick-entry-primary-row">
          <div className="quick-entry-primary-field">
            <span>Amount</span>
            {evaluatedAmount !== null && Number.isFinite(evaluatedAmount) && evaluatedAmount !== 0 && <small className={`quick-entry-amount-preview ${isIncome ? 'is-income' : ''}`}>{isIncome ? 'Income' : 'Total'} {Math.abs(evaluatedAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</small>}
            <div
              className="quick-entry-amount-control"
              onPointerDown={(event) => {
                event.preventDefault();
                setAmountPadOpen(true);
              }}
              onClick={() => setAmountPadOpen(true)}
              role="button"
              tabIndex={0}
              aria-label="Open amount keypad"
            >
              {isDomesticTrip && currency.toUpperCase() === 'CNY' ? null : (
                <select value={currency} onChange={(event) => setCurrency(event.currentTarget.value)} aria-label="Currency">
                  {LEDGER_CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              )}
              <input
                type="text"
                inputMode="none"
                autoComplete="off"
                readOnly
                value={amount}
                tabIndex={-1}
                onCompositionStart={() => { amountComposingRef.current = true; }}
                onCompositionEnd={(event) => { amountComposingRef.current = false; setAmount(event.currentTarget.value); }}
                onChange={(event) => { if (!amountComposingRef.current) setAmount(event.currentTarget.value); }}
                placeholder="0.00"
                required
                aria-label="Amount"
              />
            </div>

          <label className="quick-entry-primary-field">
            <span>{isIncome ? 'Who Received?' : 'Who Paid?'}</span>
            <select value={payerId} onChange={(event) => setPayerId(event.target.value)} aria-label="Who Paid?">
              {payerFrequency.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>

          <label className="quick-entry-primary-field">
            <span>Payment Account</span>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} aria-label="Payment Account">
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        </div>

        {amountPadOpen && typeof document !== 'undefined' && createPortal(
          <div className="quick-entry-amount-keypad" role="dialog" aria-label="Amount keypad">
            <div className="quick-entry-amount-keypad-grid">
              {[
                ['C', 'clear', 'quick-entry-amount-keypad-action'],
                ['⌫', 'backspace', 'quick-entry-amount-keypad-action'],
                ['÷', '/', 'quick-entry-amount-keypad-operator'],
                ['×', '*', 'quick-entry-amount-keypad-operator'],
                ['7', '7', ''],
                ['8', '8', ''],
                ['9', '9', ''],
                ['−', '-', 'quick-entry-amount-keypad-operator'],
                ['4', '4', ''],
                ['5', '5', ''],
                ['6', '6', ''],
                ['＋', '+', 'quick-entry-amount-keypad-operator'],
                ['1', '1', ''],
                ['2', '2', ''],
                ['3', '3', ''],
                ['=', 'equals', 'quick-entry-amount-keypad-equals'],
                ['0', '0', 'quick-entry-amount-keypad-zero'],
                ['.', '.', ''],
                ['Done', 'done', 'quick-entry-amount-keypad-done'],
              ].map(([label, value, extraClass]) => (
                <button
                  key={label}
                  type="button"
                  className={extraClass}
                  onClick={() => {
                    if (value === 'clear') {
                      setAmount('');
                      return;
                    }
                    if (value === 'backspace') {
                      setAmount((current) => current.slice(0, -1));
                      return;
                    }
                    if (value === 'done') {
                      setAmountPadOpen(false);
                      return;
                    }
                    if (value === 'equals') {
                      setAmount((current) => {
                        const result = evaluateAmountExpression(current);
                        return result === null ? current : String(Number(result.toFixed(2)));
                      });
                      return;
                    }
                    if (value === '.') {
                      setAmount((current) => {
                        const currentNumber = current.split(/[+*/-]/).pop() ?? '';
                        return currentNumber.includes('.') ? current : current + '.';
                      });
                      return;
                    }
                    setAmount((current) => {
                      if (['+', '-', '*', '/'].includes(value)) {
                        if (!current) return value === '-' ? '-' : current;
                        if (/[+*/-]$/.test(current)) return current;
                      }
                      return current + value;
                    });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

        {!isDomesticTrip && (
          <div className="quick-entry-cny-equivalent-field">
            <label className="block">
              <span>CNY Equivalent</span>
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
                className="quick-entry-cny-equivalent-input"
                placeholder={deferCny ? 'Later' : (fxRate ? 'Auto' : 'Enter manually')}
                aria-label="CNY Equivalent"
              />
              {currency.trim().toUpperCase() !== 'CNY' && <button type="button" onClick={() => { setDeferCny(v => !v); if (!deferCny) setCnyEquivalent(''); }} className={`quick-entry-defer-cny ${deferCny ? 'is-deferred' : ''}`}>{deferCny ? '✓ Enter CNY later' : 'Enter CNY later'}</button>}
            </label>
          </div>
        )}

        <div className="quick-entry-category-note-row">
          <label className="quick-entry-category-field">
            <span>Category</span>
            <select value={categoryId} onChange={(event) => { const next = event.target.value; setCategoryId(next); setIncludeInCost(categories.find((category) => category.id === next)?.excludeFromStats !== true); }} required aria-label="Category">
              {visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="quick-entry-note-field">
            <span>Note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={1} maxLength={200} placeholder="What was this payment for? e.g. Longling dinner" aria-label="Note" />
          </label>
        </div>

        {isRefundCategory && <div className="quick-entry-refund-row">
          <label className="quick-entry-refund-field">
            <span>Refund for</span>
            <select value={refundOf} onChange={(event) => setRefundOf(event.target.value)} required aria-label="Refund for">
              <option value="">Select expense</option>
              {refundOptions.map(({ entry, remaining }) => <option key={entry.id} value={entry.id}>{new Date(entry.paidAt ?? ('paymentDate' in entry ? entry.paymentDate : entry.createdAt)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {targetTrip?.categories.find((category) => category.id === entry.categoryId)?.name ?? 'Expense'} · ¥{remaining.toFixed(2).replace(/\.00$/, '')} remaining</option>)}
            </select>
          </label>
        </div>}

{entryType === 'transport' && (
          <div className="quick-entry-transport-section">
            <div className="quick-entry-transport-layout">
              <div className="quick-entry-transport-field">
                <span>Transport</span>
                <div className="quick-entry-transport-options">
                  {([
                    ['flight', '✈️ Flight'],
                    ['train', '🚄 Train'],
                    ['long_distance_bus', '🚌 Coach'],
                    ['ferry', '⛴️ Ferry'],
                  ] as const).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => { setTransportMode(value); setJourneyType('one_way'); setReturnDate(''); }} aria-pressed={transportMode === value} className={`quick-entry-transport-button ${transportMode === value ? 'is-selected' : ''}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {transportMode === 'flight' && (
                <div className="quick-entry-journey-field">
                  <div className="quick-entry-journey-head">
                    <span>Journey</span>
                    <span>Date</span>
                  </div>
                  <div className="quick-entry-journey-options">
                    <div className="quick-entry-journey-option">
                      <button type="button" onClick={() => setJourneyType('one_way')} aria-pressed={journeyType === 'one_way'} className={`quick-entry-journey-button ${journeyType === 'one_way' ? 'is-selected' : ''}`}>One Way</button>
                      <DatePicker pickerId="transport-outbound" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={outboundDate} onChange={(value) => { setOutboundDate(value); if (returnDate && returnDate < value) setReturnDate(''); }} label="Outbound" required minDate={tripDateBounds.minDate} maxDate={tripDateBounds.maxDate} />
                    </div>
                    <div className="quick-entry-journey-option">
                      <button type="button" onClick={() => setJourneyType('round_trip')} aria-pressed={journeyType === 'round_trip'} className={`quick-entry-journey-button ${journeyType === 'round_trip' ? 'is-selected' : ''}`}>Round Trip</button>
                      <DatePicker pickerId="transport-return" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={returnDate} onChange={setReturnDate} label="Return" required={journeyType === 'round_trip'} minDate={outboundDate || tripDateBounds.minDate} maxDate={tripDateBounds.maxDate} openMonthValue={outboundDate || tripDateBounds.minDate} />
                    </div>
                  </div>
                </div>
              )}

              {transportMode !== 'flight' && (
                <div className="quick-entry-journey-field quick-entry-journey-field-nonflight">
                  <span>Date</span>
                  <div className="quick-entry-transport-dates">
                    <DatePicker pickerId="transport-outbound" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={outboundDate} onChange={(value) => { setOutboundDate(value); if (returnDate && returnDate < value) setReturnDate(''); }} label="Outbound" required minDate={tripDateBounds.minDate} maxDate={tripDateBounds.maxDate} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {entryType === 'prepaid_multi_day' && (
          <div className="quick-entry-prepaid-section">
            <div className="quick-entry-prepaid-dates">
              <DatePicker pickerId="prepaid-usage-start" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={usageStart} onChange={(value) => { setUsageStart(value); if (usageEnd && usageEnd < value) setUsageEnd(''); }} label="Usage Start" required minDate={tripDateBounds.minDate} maxDate={tripDateBounds.maxDate} />
              <DatePicker pickerId="prepaid-usage-end" openPickerId={openDatePicker} onOpenPicker={setOpenDatePicker} value={usageEnd} onChange={setUsageEnd} label="Usage End" required minDate={usageStart || tripDateBounds.minDate} maxDate={tripDateBounds.maxDate} openMonthValue={usageStart || tripDateBounds.minDate} />
            </div>
          </div>
        )}

        <div className="quick-entry-participants-section">
          <span className="quick-entry-section-label">Participants</span>
            <div className="quick-entry-allocation-mode">
              {([
                ['equal', 'Equal Split'],
                ['preset_percentage', 'Preset Percentage'],
                ['custom_percentage', 'Custom Percentage'],
              ] as const).map(([value, label]) => {
                const disabled = value === 'preset_percentage' && !targetTrip?.allocationRules?.percentages;
                return <button key={value} type="button" disabled={disabled} onClick={() => setAllocationMode(value)} aria-pressed={allocationMode === value} className={`quick-entry-allocation-mode-button ${allocationMode === value ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}>{label}</button>;
              })}
            </div>
          {allocationMode === 'preset_percentage' && targetTrip?.allocationRules?.percentages && (
            <div className="quick-entry-preset-info">
              Using this journey's preset allocation:{Object.entries(targetTrip.allocationRules.percentages)
                .filter(([id, percentage]) => members.some((member) => member.id === id) && Number(percentage) > 0)
                .map(([id, percentage]) => `${members.find((member) => member.id === id)?.name ?? id} ${percentage}%`)
                .join(' · ')}
            </div>
          )}
          {allocationMode !== 'preset_percentage' && <div className="quick-entry-participants-grid">
            {members.map((member) => {
              const selected = selectedParticipants.has(member.id);
              return (
                <button key={member.id} type="button" onClick={() => toggleParticipant(member.id)} aria-pressed={selected} className={`quick-entry-participant-button ${selected ? 'is-selected' : ''}`}>
                  {member.name}
                  {allocationMode === 'custom_percentage' && selected && <span className="quick-entry-participant-percentage">{customPercentages[member.id] ?? 0}%</span>}
                </button>
              );
            })}
          </div>}
          {allocationMode === 'custom_percentage' && (
            <div className="quick-entry-custom-percentages">
              {members.filter((member) => selectedParticipants.has(member.id)).map((member) => <label key={member.id} className="quick-entry-custom-percentage"><span>{member.name}</span><span className="quick-entry-custom-percentage-value"><input type="text" inputMode="decimal" value={customPercentages[member.id] ?? ''} onChange={(event) => { const raw = normalizePercentageInput(event.target.value); setCustomPercentages((previous) => ({ ...previous, [member.id]: raw === '' ? 0 : Number(raw) })); }} aria-label={`${member.name} percentage`} /><span>%</span></span></label>)}
            </div>
          )}
        </div>

        <div className="quick-entry-cost-compact">
          <span>Include in Statistics</span>
          <button type="button" role="switch" aria-checked={includeInCost} onClick={() => setIncludeInCost((value) => !value)} className={`quick-entry-cost-switch ${includeInCost ? 'is-on' : ''}`} aria-label={includeInCost ? 'Included in statistics, tap to exclude' : 'Excluded from statistics, tap to include'}>
            <span />
          </button>
        </div>

        <div className="quick-entry-submit-wrap">
          {error && <div className="quick-entry-submit-error" role="alert" aria-live="assertive">{error}</div>}
          <button type="submit" className="quick-entry-submit-button">{isEditing ? 'Save Changes' : 'Save Entry'}</button>
          {isEditing && (
            <button type="button" onClick={handleDeleteEntry} className="quick-entry-delete-button">
              Delete Entry
            </button>
          )}
        </div>
        {success && typeof document !== 'undefined' && createPortal(
          <div className="quick-entry-success-backdrop" role="presentation">
            <div className="quick-entry-success-modal" role="status" aria-live="polite">
              <div className="quick-entry-success-check"><span>✓</span></div>
              <strong>Recorded</strong>
              <span>Your record has been saved.</span>
            </div>
          </div>,
          document.body,
        )}
      </form>

      {pendingSegmentSwitch && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="segment-switch-title">
          <div className="w-full max-w-sm rounded-3xl bg-[#fbf7ee] p-5 text-[#17243a] shadow-2xl">
            <p className="text-xs uppercase tracking-[0.16em] text-[#857a6a]">Journey handoff</p>
            <h3 id="segment-switch-title" className="mt-2 text-xl font-medium">Switch to {pendingSegmentSwitch.nextSegment.destinations.map((destination) => destination.city || destination.country).filter(Boolean).join(' · ') || 'next segment'}?</h3>
            <p className="mt-2 text-sm leading-6 text-[#766957]">No keeps this entry in the current segment. You’ll be asked again next time until you switch.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const pending = pendingSegmentSwitch;
                  setPendingSegmentSwitch(null);
                  saveEntry(pending.tripId, pending.entry, pending.currentSegmentId);
                }}
                className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-[#17243a]"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  const pending = pendingSegmentSwitch;
                  setPendingSegmentSwitch(null);
                  saveEntry(pending.tripId, pending.entry, pending.nextSegment.id);
                }}
                className="min-h-12 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
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
