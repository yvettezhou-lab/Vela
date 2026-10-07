import React from 'react';

import { LedgerEntry } from '../../core/domain';
import { AmountKeypad } from './AmountKeypad';

const LEDGER_CURRENCIES = [
  'CNY',
  'MYR',
  'SGD',
  'THB',
  'IDR',
  'PHP',
  'JPY',
  'KRW',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'HKD',
  'ARS',
  'AFN',
  'ALL',
  'DZD',
  'BRL',
  'KHR',
  'CAD',
  'CZK',
  'DKK',
  'EGP',
  'HUF',
  'ISK',
  'INR',
  'ILS',
  'JOD',
  'KZT',
  'LAK',
  'MVR',
  'MXN',
  'MNT',
  'MAD',
  'MMK',
  'NPR',
  'NZD',
  'NOK',
  'PLN',
  'RUB',
  'SAR',
  'ZAR',
  'TWD',
  'LKR',
  'SEK',
  'CHF',
  'TRY',
  'AED',
  'VND',
];

interface QuickEntryAmountSectionProps {
  isDomesticTrip: boolean;
  currency: string;
  amount: string;
  evaluatedAmount: number | null;
  isIncome: boolean;
  changeCurrency: (value: string) => void;
  setAmount: (value: string) => void;
}

export const QuickEntryAmountSection: React.FC<QuickEntryAmountSectionProps> = ({
  isDomesticTrip,
  currency,
  amount,
  evaluatedAmount,
  isIncome,
  changeCurrency,
  setAmount,
}) => (
  <div className="quick-entry-primary-field">
    <span>Amount</span>
    {evaluatedAmount !== null &&
      Number.isFinite(evaluatedAmount) &&
      evaluatedAmount !== 0 && (
        <small className={`quick-entry-amount-preview ${isIncome ? 'is-income' : ''}`}>
          {isIncome ? 'Income' : 'Total'}{' '}
          {Math.abs(evaluatedAmount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}
        </small>
      )}
    <div className="quick-entry-amount-control">
      {isDomesticTrip && currency.toUpperCase() === 'CNY' ? null : (
        <select
          value={currency}
          onChange={(event) => changeCurrency(event.currentTarget.value)}
          aria-label="Currency"
        >
          {LEDGER_CURRENCIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      )}
      <AmountKeypad value={amount} onChange={setAmount} />
    </div>
  </div>
);

interface QuickEntryCnySectionProps {
  cnyEquivalent: string;
  normalizedCurrency: string;
  deferCny: boolean;
  fxRate: number | null;
  cnyEquivalentComposingRef: React.MutableRefObject<boolean>;
  cnyManualRef: React.MutableRefObject<boolean>;
  setCnyEquivalent: (value: string) => void;
  setDeferCny: React.Dispatch<React.SetStateAction<boolean>>;
}

export const QuickEntryCnySection: React.FC<QuickEntryCnySectionProps> = ({
  cnyEquivalent,
  normalizedCurrency,
  deferCny,
  fxRate,
  cnyEquivalentComposingRef,
  cnyManualRef,
  setCnyEquivalent,
  setDeferCny,
}) => (
  <div className="quick-entry-cny-equivalent-field">
    <label className="block">
      <span>CNY Equivalent</span>
      <input
        type="text"
        inputMode="decimal"
        value={cnyEquivalent}
        readOnly={normalizedCurrency === 'CNY'}
        onCompositionStart={() => {
          cnyEquivalentComposingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          cnyEquivalentComposingRef.current = false;
          if (normalizedCurrency !== 'CNY') {
            cnyManualRef.current = true;
            setCnyEquivalent(event.currentTarget.value);
          }
        }}
        onChange={(event) => {
          if (normalizedCurrency !== 'CNY') {
            cnyManualRef.current = true;
            if (!cnyEquivalentComposingRef.current) {
              setCnyEquivalent(event.currentTarget.value);
            }
          }
        }}
        className="quick-entry-cny-equivalent-input"
        placeholder={deferCny ? 'Later' : fxRate ? 'Auto' : 'Enter manually'}
        aria-label="CNY Equivalent"
      />
      {normalizedCurrency !== 'CNY' && (
        <button
          type="button"
          onClick={() => {
            setDeferCny((value) => !value);
            if (!deferCny) setCnyEquivalent('');
          }}
          className={`quick-entry-defer-cny ${deferCny ? 'is-deferred' : ''}`}
        >
          {deferCny ? '✓ Enter CNY later' : 'Enter CNY later'}
        </button>
      )}
    </label>
  </div>
);

interface QuickEntryRefundOption {
  entry: LedgerEntry;
  remaining: number;
}

interface QuickEntryRefundSectionProps {
  refundOf: string;
  refundOptions: QuickEntryRefundOption[];
  categories: Array<{ id: string; name: string }>;
  setRefundOf: (value: string) => void;
}

export const QuickEntryRefundSection: React.FC<QuickEntryRefundSectionProps> = ({
  refundOf,
  refundOptions,
  categories,
  setRefundOf,
}) => (
  <div className="quick-entry-refund-row">
    <label className="quick-entry-refund-field">
      <span>Refund for</span>
      <select
        value={refundOf}
        onChange={(event) => setRefundOf(event.target.value)}
        required
        aria-label="Refund for"
      >
        <option value="">Select expense</option>
        {refundOptions.map(({ entry, remaining }) => (
          <option key={entry.id} value={entry.id}>
            {new Date(
              entry.paidAt ??
                ('paymentDate' in entry ? entry.paymentDate : entry.createdAt),
            ).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}{' '}
            · {categories.find((category) => category.id === entry.categoryId)?.name ?? 'Expense'} · ¥
            {remaining.toFixed(2).replace(/\.00$/, '')} remaining
          </option>
        ))}
      </select>
    </label>
  </div>
);
