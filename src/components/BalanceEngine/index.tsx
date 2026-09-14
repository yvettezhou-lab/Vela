import React from 'react';
import { ArrowRight, Scale } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import {
  calculateGroupBalance,
  calculateSettlements,
} from '../../core/calculations';

export const BalanceEngine: React.FC = () => {
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());

  if (!currentTrip) {
    return (
      <section className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-8">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Scale size={22} /> Balance &amp; Settlement
        </h2>
        <p className="mt-6 text-gray-500">
          No active trip found. Please create or select a planning or traveling trip first.
        </p>
      </section>
    );
  }

  const balances = calculateGroupBalance(currentTrip);
  const settlements = calculateSettlements(balances);
  const memberName = (memberId: string) =>
    currentTrip.members.find((member) => member.id === memberId)?.name ?? memberId;
  const formatCny = (amount: number) => `${amount.toFixed(2)} CNY`;

  return (
    <section className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-8 space-y-8">
      <header>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Scale size={22} /> Balance &amp; Settlement
        </h2>
        <p className="mt-1 text-sm text-gray-500">{currentTrip.title}</p>
      </header>

      <section aria-labelledby="member-balances-heading">
        <div className="flex items-center justify-between mb-3">
          <h3 id="member-balances-heading" className="text-lg font-semibold">
            Member Balances
          </h3>
          <span className="text-xs text-gray-500">CNY</span>
        </div>

        <div className="overflow-hidden border rounded-lg">
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500">
            <span>Member</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Owed</span>
            <span className="text-right">Net</span>
          </div>
          {balances.map((balance) => (
            <div
              key={balance.memberId}
              className="grid grid-cols-4 gap-2 px-4 py-3 border-t text-sm"
            >
              <span className="font-medium truncate">{memberName(balance.memberId)}</span>
              <span className="text-right">{formatCny(balance.paid)}</span>
              <span className="text-right">{formatCny(balance.owed)}</span>
              <span
                className={`text-right font-semibold ${
                  balance.net > 0 ? 'text-green-700' : balance.net < 0 ? 'text-red-700' : 'text-gray-600'
                }`}
              >
                {formatCny(balance.net)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="settlement-plan-heading">
        <h3 id="settlement-plan-heading" className="text-lg font-semibold mb-3">
          Settlement Plan
        </h3>

        {settlements.length === 0 ? (
          <div className="p-4 border rounded-lg bg-gray-50 text-sm text-gray-600">
            No transfers are required. The group is settled.
          </div>
        ) : (
          <div className="space-y-3">
            {settlements.map((settlement, index) => (
              <div
                key={`${settlement.fromMemberId}-${settlement.toMemberId}-${index}`}
                className="flex items-center justify-between gap-4 p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-medium truncate">
                    {memberName(settlement.fromMemberId)}
                  </span>
                  <ArrowRight size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="font-medium truncate">
                    {memberName(settlement.toMemberId)}
                  </span>
                </div>
                <span className="font-semibold whitespace-nowrap">
                  {formatCny(settlement.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
};

export default BalanceEngine;
