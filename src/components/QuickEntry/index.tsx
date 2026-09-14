import React, { useEffect, useState } from 'react';
import { useVelaStore } from '../../store/useVelaStore';
import { TRANSPORT_CATEGORY_ID } from '../../core/validation';
import {
  AllocationMode,
  FlightType,
  Allocation,
  LedgerEntry,
} from '../../core/domain';
import { Plane, Calendar, CreditCard, Users, Check, X } from 'lucide-react';

const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `entry_${Math.random().toString(36).slice(2, 11)}`;

const toDateTimestamp = (value: string) => {
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
};

export interface QuickEntryProps {
  onClose?: () => void;
}

export const QuickEntry: React.FC<QuickEntryProps> = ({ onClose }) => {
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const addLedgerEntry = useVelaStore((state) => state.addLedgerEntry);

  const [entryType, setEntryType] = useState<
    'standard' | 'flight' | 'prepaid_multi_day'
  >('standard');
  const [amount, setAmount] = useState<number | ''>('');
  const [currency, setCurrency] = useState('CNY');
  const [cnyEquivalent, setCnyEquivalent] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [payerId, setPayerId] = useState('');

  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [outboundDate, setOutboundDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [usageStart, setUsageStart] = useState('');
  const [usageEnd, setUsageEnd] = useState('');
  const [flightType, setFlightType] = useState<FlightType>('one_way');

  const [allocationMode, setAllocationMode] =
    useState<AllocationMode>('equal');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(
    new Set(),
  );
  const [customPercentages, setCustomPercentages] = useState<
    Record<string, number>
  >({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTrip) return;
    setCategoryId((current) =>
      current && currentTrip.categories.some((c) => c.id === current)
        ? current
        : currentTrip.categories[0]?.id ?? '',
    );
    setAccountId((current) =>
      current && currentTrip.accounts.some((a) => a.id === current)
        ? current
        : currentTrip.accounts[0]?.id ?? '',
    );
    setPayerId((current) =>
      current && currentTrip.members.some((m) => m.id === current)
        ? current
        : currentTrip.members[0]?.id ?? '',
    );
    setCurrency(currentTrip.localCurrency);
    setSelectedParticipants((current) => {
      const validIds = new Set(currentTrip.members.map((m) => m.id));
      const retained = Array.from(current).filter((id) => validIds.has(id));
      return new Set(retained.length ? retained : currentTrip.members.map((m) => m.id));
    });
  }, [currentTrip]);

  const buildAllocations = (cnyTotal: number): Allocation[] => {
    const participantIds = Array.from(selectedParticipants);
    if (participantIds.length === 0) {
      throw new Error('Please select at least one participant.');
    }

    const allocations: Allocation[] = participantIds.map((memberId) => ({
      memberId,
      amount: 0,
      ...(allocationMode === 'custom_percentage'
        ? { percentage: customPercentages[memberId] ?? 0 }
        : {}),
    }));

    if (allocationMode === 'equal') {
      const baseCents = Math.floor((cnyTotal * 100) / participantIds.length);
      allocations.forEach((allocation) => {
        allocation.amount = baseCents / 100;
      });
    } else {
      const percentageTotal = allocations.reduce(
        (sum, allocation) => sum + (allocation.percentage ?? 0),
        0,
      );
      if (Math.abs(percentageTotal - 100) > 0.01) {
        throw new Error('Custom percentages must equal 100%.');
      }
      allocations.forEach((allocation) => {
        const percentage = allocation.percentage ?? 0;
        allocation.amount = Math.floor((cnyTotal * percentage) * 100 / 100) / 100;
      });
    }

    const allocatedCents = allocations.reduce(
      (sum, allocation) => sum + Math.round(allocation.amount * 100),
      0,
    );
    const targetCents = Math.round(cnyTotal * 100);
    const diffCents = targetCents - allocatedCents;
    allocations[0].amount =
      Math.round((allocations[0].amount * 100 + diffCents)) / 100;

    return allocations;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      const originalAmount = Number(amount);
      const cnyTotal = cnyEquivalent === '' ? originalAmount : Number(cnyEquivalent);

      if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
        throw new Error('Amount must be greater than 0.');
      }
      if (!Number.isFinite(cnyTotal) || cnyTotal <= 0) {
        throw new Error('CNY Equivalent must be greater than 0.');
      }
      if (!payerId) throw new Error('Payer is required.');
      if (!accountId) throw new Error('Payment account is required.');
      if (entryType !== 'flight' && !categoryId) {
        throw new Error('Category is required.');
      }

      const allocations = buildAllocations(cnyTotal);
      const now = Date.now();
      const baseData = {
        id: `entry_${generateId()}`,
        categoryId: entryType === 'flight' ? TRANSPORT_CATEGORY_ID : categoryId,
        originalAmount,
        originalCurrency: currency,
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
          if (returnTimestamp < outbound) {
            throw new Error('Return date cannot be before outbound date.');
          }
          finalEntry = {
            ...baseData,
            entryType: 'flight',
            flightType: 'round_trip',
            outboundDate: outbound,
            returnDate: returnTimestamp,
          };
        } else {
          finalEntry = {
            ...baseData,
            entryType: 'flight',
            flightType: 'one_way',
            outboundDate: outbound,
          };
        }
      } else {
        const payment = toDateTimestamp(paymentDate);
        const start = toDateTimestamp(usageStart);
        const end = toDateTimestamp(usageEnd);
        if (!Number.isFinite(payment)) throw new Error('Payment date is required.');
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          throw new Error('Usage dates are required.');
        }
        if (end < start) throw new Error('Usage end cannot be before usage start.');
        finalEntry = {
          ...baseData,
          entryType: 'prepaid_multi_day',
          paymentDate: payment,
          usageStart: start,
          usageEnd: end,
        };
      }

      if (!currentTrip) throw new Error('No active trip found.');
      addLedgerEntry(currentTrip.id, finalEntry);
      setAmount('');
      setCnyEquivalent('');
      alert('Entry saved successfully!');
      onClose?.();
    } catch (submissionError: unknown) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : String(submissionError),
      );
    }
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!currentTrip) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard /> Quick Entry
          </h2>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close Quick Entry">
              <X size={20} />
            </button>
          )}
        </div>
        <p className="mt-6 text-gray-500">
          No active trip found. Please create or select a planning or traveling trip first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard /> Quick Entry
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close Quick Entry">
            <X size={20} />
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="flex gap-4 mb-6">
        <button type="button" onClick={() => setEntryType('standard')} className={`flex-1 py-2 px-4 rounded-md border ${entryType === 'standard' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>Standard</button>
        <button type="button" onClick={() => setEntryType('flight')} className={`flex-1 py-2 px-4 rounded-md border flex justify-center items-center gap-2 ${entryType === 'flight' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-200 text-gray-700'}`}><Plane size={18} /> Flight</button>
        <button type="button" onClick={() => setEntryType('prepaid_multi_day')} className={`flex-1 py-2 px-4 rounded-md border flex justify-center items-center gap-2 ${entryType === 'prepaid_multi_day' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-200 text-gray-700'}`}><Calendar size={18} /> Prepaid Multi-day</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <div className="flex">
              <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-20 p-2 border border-r-0 rounded-l-md bg-gray-50" aria-label="Currency" />
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} className="flex-1 p-2 border rounded-r-md" placeholder="0.00" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNY Equivalent</label>
            <input type="number" min="0.01" step="0.01" value={cnyEquivalent} onChange={(e) => setCnyEquivalent(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 border rounded-md" placeholder="Same as amount for CNY" />
          </div>
        </div>

        {entryType !== 'flight' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full p-2 border rounded-md" required>
              {currentTrip.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
        )}

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          {entryType === 'standard' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-2 border rounded-md" required />
            </div>
          )}

          {entryType === 'flight' && (
            <div className="space-y-4">
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2"><input type="radio" checked={flightType === 'one_way'} onChange={() => setFlightType('one_way')} /> One Way</label>
                <label className="flex items-center gap-2"><input type="radio" checked={flightType === 'round_trip'} onChange={() => setFlightType('round_trip')} /> Round Trip</label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Outbound Date</label>
                  <input type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} className="w-full p-2 border rounded-md" required />
                </div>
                {flightType === 'round_trip' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
                    <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full p-2 border rounded-md" required />
                  </div>
                )}
              </div>
            </div>
          )}

          {entryType === 'prepaid_multi_day' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-2 border rounded-md" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage Start</label>
                  <input type="date" value={usageStart} onChange={(e) => setUsageStart(e.target.value)} className="w-full p-2 border rounded-md" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage End</label>
                  <input type="date" value={usageEnd} onChange={(e) => setUsageEnd(e.target.value)} className="w-full p-2 border rounded-md" required />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Who Paid?</label>
            <select value={payerId} onChange={(e) => setPayerId(e.target.value)} className="w-full p-2 border rounded-md" required>
              {currentTrip.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Account</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full p-2 border rounded-md" required>
              {currentTrip.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Users size={18} /> Participants &amp; Split</label>
            <select value={allocationMode} onChange={(e) => setAllocationMode(e.target.value as AllocationMode)} className="p-1 text-sm border rounded">
              <option value="equal">Equal Split</option>
              <option value="custom_percentage">Custom %</option>
            </select>
          </div>

          <div className="space-y-2">
            {currentTrip.members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <button type="button" onClick={() => toggleParticipant(member.id)} aria-pressed={selectedParticipants.has(member.id)} className={`w-5 h-5 rounded border flex items-center justify-center ${selectedParticipants.has(member.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {selectedParticipants.has(member.id) && <Check size={14} className="text-white" />}
                </button>
                <span className="flex-1 text-sm">{member.name}</span>
                {allocationMode === 'custom_percentage' && selectedParticipants.has(member.id) && (
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100" step="0.01" value={customPercentages[member.id] ?? ''} onChange={(e) => setCustomPercentages((previous) => ({ ...previous, [member.id]: e.target.value === '' ? 0 : Number(e.target.value) }))} className="w-16 p-1 text-sm border rounded text-right" placeholder="0" aria-label={`${member.name} percentage`} />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="w-full py-3 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-700 transition">Save Entry</button>
      </form>
    </div>
  );
};

export default QuickEntry;
