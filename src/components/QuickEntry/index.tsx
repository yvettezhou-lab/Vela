import React, { Component, ErrorInfo, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  QuickEntryCategoryNoteSection,
  QuickEntryEntryTypeSection,
  QuickEntryPayerAccountSection,
  QuickEntryPlanningSection,
  QuickEntryStatisticsToggle,
  QuickEntrySubmitSection,
} from './QuickEntryFormSections';

import {
  AllocationMode,
  LedgerEntry,
  TravelSegment,
  TransportJourneyType,
  TransportMode,
} from '../../core/domain';
import { buildAllocationsByMode } from '../../core/allocation';
import { getTripPrimaryCurrency } from '../../core/travelSegment';
import {
  getLastUsedIds,
  getNearestTrips,
  getRefundOptions,
  getTripDateBounds,
  isDomesticTrip,
} from './quickEntryHelpers';
import { useVelaStore } from '../../store/useVelaStore';

import './styles.css';
import { evaluateAmountExpression } from './AmountKeypad';
import {
  QuickEntryAmountSection,
  QuickEntryCnySection,
  QuickEntryRefundSection,
} from './QuickEntryMoneySections';
import {
  QuickEntrySegmentSwitchModal,
  QuickEntrySuccessModal,
} from './QuickEntryOverlays';
import {
  QuickEntryAllocationSection,
  QuickEntryPrepaidSection,
  QuickEntryTransportSection,
} from './QuickEntrySections';
import {
  buildQuickEntryBaseData,
  buildQuickEntry,
  generateEntryId,
  getSegmentHandoff,
} from './quickEntrySubmission';

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

const formatCny = (value: number) =>
  Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '';



export interface QuickEntryProps {
  onClose?: () => void;
  editTripId?: string;
  initialEntry?: LedgerEntry | null;
}

const QuickEntryContent: React.FC<QuickEntryProps> = ({ onClose, editTripId, initialEntry }) => {
  const trips = useVelaStore((state) => state.trips);
  const addLedgerEntry = useVelaStore((state) => state.addLedgerEntry);
  const updateLedgerEntry = useVelaStore((state) => state.updateLedgerEntry);
  const deleteLedgerEntry = useVelaStore((state) => state.deleteLedgerEntry);
  const isEditing = Boolean(initialEntry);
  const {
    eligibleTrips,
    currentTrip,
    tripChoices,
  } = getNearestTrips(trips);
  // Journey context
  const [targetTripId, setTargetTripId] = useState('');
  const [openDatePicker, setOpenDatePicker] = useState<string | null>(null);
  const targetTrip = eligibleTrips.find((trip) => trip.id === targetTripId) ?? null;
  const domesticTrip = isDomesticTrip(targetTrip);

  // Entry identity and amount
  const [entryType, setEntryType] = useState<'standard' | 'transport' | 'prepaid_multi_day'>('standard');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [cnyEquivalent, setCnyEquivalent] = useState('');
  const [deferCny, setDeferCny] = useState(false);

  // Classification and settlement
  const [categoryId, setCategoryId] = useState('');
  const [refundOf, setRefundOf] = useState('');
  const [includeInCost, setIncludeInCost] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('equal');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [customPercentages, setCustomPercentages] = useState<Record<string, number>>({});

  // Notes and dates
  const [note, setNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayValue);
  const [paidAtDate, setPaidAtDate] = useState(todayValue);
  const [paidAtTime, setPaidAtTime] = useState(currentTimeValue);
  const [paidEditorOpen, setPaidEditorOpen] = useState(false);
  const [outboundDate, setOutboundDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [usageStart, setUsageStart] = useState('');
  const [usageEnd, setUsageEnd] = useState('');

  // Transport
  const [transportMode, setTransportMode] = useState<TransportMode>('flight');
  const [journeyType, setJourneyType] = useState<TransportJourneyType>('one_way');

  // UI / async state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pendingSegmentSwitch, setPendingSegmentSwitch] = useState<{
    tripId: string;
    entry: LedgerEntry;
    currentSegmentId: string;
    nextSegment: TravelSegment;
  } | null>(null);
  const [fxRate, setFxRate] = useState<number | null>(null);

  const cnyEquivalentComposingRef = useRef(false);
  const cnyManualRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const changeCurrency = (nextCurrency: string) => {
    cnyManualRef.current = false;
    setCnyEquivalent('');
    setCurrency(nextCurrency);
  };

  useEffect(() => {
    const defaultTripId = currentTrip?.id ?? nearestTrips[0]?.id ?? '';
    setTargetTripId((current) =>
      editTripId ??
      (current && eligibleTrips.some((trip) => trip.id === current) ? current : defaultTripId),
    );
  }, [trips, editTripId]);

  const accounts = useMemo(() => {
    const activeAccounts =
      targetTrip?.accounts?.filter((account) => account.archived !== true) ?? [];
    const lastUsedAt = getLastUsedIds(targetTrip, 'accountId');
    return [...activeAccounts].sort(
      (a, b) => (lastUsedAt.get(b.id) ?? 0) - (lastUsedAt.get(a.id) ?? 0),
    );
  }, [targetTrip]);
  const activeMembers = targetTrip?.members?.filter((member) => member.archived !== true) ?? [];
  const members = activeMembers;
  const payerOptions = useMemo(() => {
    const lastUsedAt = new Map<string, number>();
    trips.forEach((trip) => {
      const tripLastUsed = getLastUsedIds(trip, 'payerId');
      tripLastUsed.forEach((timestamp, memberId) => {
        lastUsedAt.set(
          memberId,
          Math.max(lastUsedAt.get(memberId) ?? 0, timestamp),
        );
      });
    });
    return [...members].sort(
      (a, b) => (lastUsedAt.get(b.id) ?? 0) - (lastUsedAt.get(a.id) ?? 0),
    );
  }, [members, trips]);
  const categories = useMemo(
    () => targetTrip?.categories?.filter((category) => category.archived !== true) ?? [],
    [targetTrip]
  );

  const evaluatedAmount = useMemo(() => evaluateAmountExpression(amount), [amount]);
  const normalizedCurrency = currency.trim().toUpperCase();
  const isIncome = evaluatedAmount !== null && evaluatedAmount < 0;
  const isRefundCategory = categoryId === 'cat_refund';
  const visibleCategories = categories.filter((category) =>
    isIncome
      ? category.id === 'cat_income' || category.id === 'cat_refund'
      : category.id !== 'cat_income' && category.id !== 'cat_refund',
  );
  const refundOptions = useMemo(
    () => getRefundOptions(targetTrip, initialEntry),
    [targetTrip, initialEntry],
  );

  useEffect(() => {
    if (isIncome) {
      if (categoryId !== 'cat_income' && categoryId !== 'cat_refund') {
        setCategoryId('cat_income');
      }
      return;
    }

    if (categoryId === 'cat_income' || categoryId === 'cat_refund') {
      const expenseCategory = categories.find(
        (category) => category.id !== 'cat_income' && category.id !== 'cat_refund',
      );
      setCategoryId(expenseCategory?.id ?? '');
      setRefundOf('');
      return;
    }

    if (refundOf) setRefundOf('');
  }, [isIncome, categoryId, categories, refundOf]);

  const tripDateBounds = getTripDateBounds(targetTrip);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  useEffect(() => {
    if (!initialEntry || !targetTrip || targetTrip.id !== editTripId) return;
    setEntryType(initialEntry.entryType);
    setAmount(
      String(
        initialEntry.entryDirection === 'income' || initialEntry.isRefund
          ? -initialEntry.originalAmount
          : initialEntry.originalAmount,
      ),
    );
    cnyManualRef.current = true;
    setCurrency(initialEntry.originalCurrency);
    setCnyEquivalent(String(initialEntry.cnyEquivalent));
    setDeferCny(initialEntry.isPending);
    setCategoryId(
      initialEntry.entryDirection === 'income'
        ? initialEntry.isRefund
          ? 'cat_refund'
          : 'cat_income'
        : initialEntry.categoryId,
    );
    setRefundOf(initialEntry.refundOf ?? '');
    setIncludeInCost(initialEntry.includeInCost);
    setAccountId(initialEntry.accountId);
    setNote(initialEntry.note ?? '');
    setPayerId(initialEntry.payerId);
    setAllocationMode(initialEntry.allocationMode);
    setSelectedParticipants(new Set(initialEntry.allocations.map((allocation) => allocation.memberId)));
    setCustomPercentages(
      Object.fromEntries(
        initialEntry.allocations.map((allocation) => [
          allocation.memberId,
          allocation.percentage ?? 0,
        ]),
      ),
    );
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
    setAccountId((current) =>
      current && accounts.some((account) => account.id === current)
        ? current
        : accounts[0]?.id ?? '',
    );
    setPayerId((current) =>
      current && members.some((member) => member.id === current)
        ? current
        : members[0]?.id ?? '',
    );
    const lastUsedCurrency = [...targetTrip.ledger]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((entry) => entry.originalCurrency?.trim().toUpperCase())
      .find(Boolean);
    cnyManualRef.current = false;
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
  }, [normalizedCurrency]);

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

  const buildAllocations = (cnyTotal: number) => {
    let participantIds: string[];
    let percentages: Record<string, number> | undefined;

    if (allocationMode === 'preset_percentage') {
      if (!targetTrip?.allocationRules?.percentages) throw new Error('This journey has no preset allocation rule yet.');
      percentages = { ...targetTrip.allocationRules.percentages };
      participantIds = Object.keys(percentages).filter((id) => members.some((member) => member.id === id) && Number(percentages![id]) > 0);
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

    return buildAllocationsByMode(cnyTotal, participantIds, allocationMode, percentages);
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
      const cnyTotal =
        deferCny
          ? 0
          : cnyEquivalent === ''
            ? originalAmount
            : Math.abs(Number(cnyEquivalent));

      if (
        originalAmount === null ||
        !Number.isFinite(originalAmount) ||
        originalAmount <= 0
      ) {
        throw new Error('Amount must be a valid non-zero amount.');
      }
      if (!deferCny && (!Number.isFinite(cnyTotal) || cnyTotal <= 0)) {
        throw new Error('CNY Equivalent must be greater than 0.');
      }
      if (!payerId) throw new Error(isIncomeEntry ? 'Receiver is required.' : 'Payer is required.');
      if (!accountId) throw new Error('Payment account is required.');
      if (entryType !== 'transport' && !categoryId) {
        throw new Error('Category is required.');
      }
      if (
        isIncomeEntry &&
        categoryId !== 'cat_income' &&
        categoryId !== 'cat_refund'
      ) {
        throw new Error('Income entries must use Income or Refund category.');
      }
      if (
        !isIncomeEntry &&
        (categoryId === 'cat_income' || categoryId === 'cat_refund')
      ) {
        throw new Error('Expense entries cannot use Income or Refund category.');
      }
      if (categoryId === 'cat_refund' && !refundOf) {
        throw new Error('Refund must be linked to an expense.');
      }
      if (
        categoryId === 'cat_refund' &&
        !refundOptions.some(
          (option) =>
            option.entry.id === refundOf &&
            cnyTotal <= option.remaining + 0.001,
        )
      ) {
        throw new Error('Refund exceeds the remaining refundable amount.');
      }

      const allocations = buildAllocations(cnyTotal);
      const paidAt = toPaidTimestamp(paidAtDate, paidAtTime);
      if (!Number.isFinite(paidAt)) {
        throw new Error('Paid date and time are required.');
      }
      const paidDateOnly = toDateTimestamp(paidAtDate);
      if (!Number.isFinite(paidDateOnly)) {
        throw new Error('Paid date is required.');
      }

      const now = Date.now();
      const baseData = buildQuickEntryBaseData({
        initialEntry,
        categoryId,
        originalAmount,
        currency,
        cnyTotal,
        includeInCost,
        isIncomeEntry,
        refundOf,
        deferCny,
        payerId,
        accountId,
        note,
        allocationMode,
        allocations,
        paidAt,
        now,
      });

      const finalEntry = buildQuickEntry({
        entryType,
        baseData,
        paidDateOnly,
        paymentDate,
        outboundDate,
        returnDate,
        usageStart,
        usageEnd,
        transportMode,
        journeyType,
        toDateTimestamp,
      });

      if (!targetTrip) throw new Error('Journey is required.');

      const { currentSegment, nextSegment } = getSegmentHandoff({
        targetTrip,
        entry: finalEntry,
        toDateValue,
      });

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
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : String(submissionError),
      );
    }
  };

  if (!eligibleTrips.length) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7efdf] p-6 text-[#17243a]">
        <div className="w-full max-w-xl rounded-2xl bg-[#fbf7ee] p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-normal">Quick Entry</h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Quick Entry"
                className="grid min-h-12 min-w-12 items-center justify-center rounded-full"
              >
                <X size={22} />
              </button>
            )}
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
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Entry"
            className="vela-quick-close grid min-h-12 min-w-12 place-items-center rounded-full text-[#17243a]"
          >
            <X size={23} strokeWidth={1.7} />
          </button>
        )}
      </header>

      <form onSubmit={handleSubmit} className="quick-entry-form">
        <QuickEntryPlanningSection
          tripChoices={tripChoices}
          targetTripId={targetTripId}
          paidEditorOpen={paidEditorOpen}
          paidAtDate={paidAtDate}
          paidAtTime={paidAtTime}
          setTargetTripId={setTargetTripId}
          setPaidEditorOpen={setPaidEditorOpen}
          setPaidAtDate={setPaidAtDate}
          setPaymentDate={setPaymentDate}
          setPaidAtTime={setPaidAtTime}
          formatPaidTimestamp={formatPaidTimestamp}
          toPaidTimestamp={toPaidTimestamp}
        />

        <QuickEntryEntryTypeSection entryType={entryType} setEntryType={setEntryType} />

        <div className="quick-entry-primary-row">
          <QuickEntryAmountSection
            isDomesticTrip={isDomesticTrip}
            currency={currency}
            amount={amount}
            evaluatedAmount={evaluatedAmount}
            isIncome={isIncome}
            changeCurrency={changeCurrency}
            setAmount={setAmount}
          />

          <QuickEntryPayerAccountSection
            isIncome={isIncome}
            payerId={payerId}
            accountId={accountId}
            payerOptions={payerOptions}
            accounts={accounts}
            setPayerId={setPayerId}
            setAccountId={setAccountId}
          />
        </div>

        {!domesticTrip && (
          <QuickEntryCnySection
            cnyEquivalent={cnyEquivalent}
            normalizedCurrency={normalizedCurrency}
            deferCny={deferCny}
            fxRate={fxRate}
            cnyEquivalentComposingRef={cnyEquivalentComposingRef}
            cnyManualRef={cnyManualRef}
            setCnyEquivalent={setCnyEquivalent}
            setDeferCny={setDeferCny}
          />
        )}

        <QuickEntryCategoryNoteSection
          categoryId={categoryId}
          note={note}
          visibleCategories={visibleCategories}
          categories={categories}
          setCategoryId={setCategoryId}
          setIncludeInCost={setIncludeInCost}
          setNote={setNote}
        />

        {isRefundCategory && (
          <QuickEntryRefundSection
            refundOf={refundOf}
            refundOptions={refundOptions}
            categories={categories}
            setRefundOf={setRefundOf}
          />
        )}

        {entryType === 'transport' && (
          <QuickEntryTransportSection
            transportMode={transportMode}
            journeyType={journeyType}
            openDatePicker={openDatePicker}
            setOpenDatePicker={setOpenDatePicker}
            outboundDate={outboundDate}
            setOutboundDate={setOutboundDate}
            returnDate={returnDate}
            setReturnDate={setReturnDate}
            tripDateBounds={tripDateBounds}
            setTransportMode={setTransportMode}
            setJourneyType={setJourneyType}
          />
        )}

        {entryType === 'prepaid_multi_day' && (
          <QuickEntryPrepaidSection
            openDatePicker={openDatePicker}
            setOpenDatePicker={setOpenDatePicker}
            usageStart={usageStart}
            setUsageStart={setUsageStart}
            usageEnd={usageEnd}
            setUsageEnd={setUsageEnd}
            tripDateBounds={tripDateBounds}
          />
        )}

        <QuickEntryAllocationSection
          allocationMode={allocationMode}
          setAllocationMode={setAllocationMode}
          targetTripHasPreset={Boolean(targetTrip?.allocationRules?.percentages)}
          presetPercentages={targetTrip?.allocationRules?.percentages}
          members={members}
          selectedParticipants={selectedParticipants}
          customPercentages={customPercentages}
          toggleParticipant={toggleParticipant}
          setCustomPercentages={setCustomPercentages}
        />


        <QuickEntryStatisticsToggle
          includeInCost={includeInCost}
          setIncludeInCost={setIncludeInCost}
        />

        <QuickEntrySubmitSection
          isEditing={isEditing}
          error={error}
          handleDeleteEntry={handleDeleteEntry}
        />
        {success && <QuickEntrySuccessModal />}
      </form>

      {pendingSegmentSwitch && (
        <QuickEntrySegmentSwitchModal
          pendingSegmentSwitch={pendingSegmentSwitch}
          saveEntry={saveEntry}
          onClose={() => setPendingSegmentSwitch(null)}
        />
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
