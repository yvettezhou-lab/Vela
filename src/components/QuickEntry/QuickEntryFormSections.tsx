import React from 'react';

import { X } from 'lucide-react';

interface TripChoice {
  id: string;
  title: string;
  segments?: Array<{
    destinations?: Array<{ city?: string }>;
  }>;
}

export const QuickEntryPlanningSection: React.FC<{
  tripChoices: TripChoice[];
  targetTripId: string;
  paidEditorOpen: boolean;
  paidAtDate: string;
  paidAtTime: string;
  setTargetTripId: (value: string) => void;
  setPaidEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPaidAtDate: (value: string) => void;
  setPaymentDate: (value: string) => void;
  setPaidAtTime: (value: string) => void;
  formatPaidTimestamp: (timestamp: number) => string;
  toPaidTimestamp: (dateValue: string, timeValue: string) => number;
}> = ({
  tripChoices,
  targetTripId,
  paidEditorOpen,
  paidAtDate,
  paidAtTime,
  setTargetTripId,
  setPaidEditorOpen,
  setPaidAtDate,
  setPaymentDate,
  setPaidAtTime,
  formatPaidTimestamp,
  toPaidTimestamp,
}) => (
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
            <input
              type="date"
              value={paidAtDate}
              onChange={(event) => {
                setPaidAtDate(event.target.value);
                setPaymentDate(event.target.value);
              }}
            />
          </label>
          <label className="quick-entry-paid-field">
            <span>Time</span>
            <input
              type="time"
              value={paidAtTime}
              onChange={(event) => setPaidAtTime(event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  </div>
);

export const QuickEntryEntryTypeSection: React.FC<{
  entryType: 'standard' | 'transport' | 'prepaid_multi_day';
  setEntryType: (value: 'standard' | 'transport' | 'prepaid_multi_day') => void;
}> = ({ entryType, setEntryType }) => (
  <div className="quick-entry-entry-type">
    {([
      ['standard', 'Standard'],
      ['transport', 'Transport'],
      ['prepaid_multi_day', 'Prepaid'],
    ] as const).map(([value, label]) => (
      <button
        key={value}
        type="button"
        onClick={() => setEntryType(value)}
        aria-pressed={entryType === value}
        className={`quick-entry-entry-type-button ${entryType === value ? 'is-selected' : ''}`}
      >
        {label}
      </button>
    ))}
  </div>
);

export const QuickEntryPayerAccountSection: React.FC<{
  isIncome: boolean;
  payerId: string;
  accountId: string;
  payerOptions: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  setPayerId: (value: string) => void;
  setAccountId: (value: string) => void;
}> = ({
  isIncome,
  payerId,
  accountId,
  payerOptions,
  accounts,
  setPayerId,
  setAccountId,
}) => (
  <>
    <label className="quick-entry-primary-field">
      <span>{isIncome ? 'Who Received?' : 'Who Paid?'}</span>
      <select
        value={payerId}
        onChange={(event) => setPayerId(event.target.value)}
        aria-label={isIncome ? 'Who Received?' : 'Who Paid?'}
      >
        {payerOptions.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
    </label>

    <label className="quick-entry-primary-field">
      <span>Payment Account</span>
      <select
        value={accountId}
        onChange={(event) => setAccountId(event.target.value)}
        aria-label="Payment Account"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </label>
  </>
);

export const QuickEntryCategoryNoteSection: React.FC<{
  categoryId: string;
  note: string;
  visibleCategories: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; excludeFromStats?: boolean }>;
  setCategoryId: (value: string) => void;
  setIncludeInCost: (value: boolean) => void;
  setNote: (value: string) => void;
}> = ({
  categoryId,
  note,
  visibleCategories,
  categories,
  setCategoryId,
  setIncludeInCost,
  setNote,
}) => (
  <div className="quick-entry-category-note-row">
    <label className="quick-entry-category-field">
      <span>Category</span>
      <select
        value={categoryId}
        onChange={(event) => {
          const next = event.target.value;
          setCategoryId(next);
          setIncludeInCost(
            categories.find((category) => category.id === next)?.excludeFromStats !== true,
          );
        }}
        required
        aria-label="Category"
      >
        {visibleCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </label>

    <label className="quick-entry-note-field">
      <span>Note</span>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={1}
        maxLength={200}
        placeholder="What was this payment for? e.g. Longling dinner"
        aria-label="Note"
      />
    </label>
  </div>
);

export const QuickEntryStatisticsToggle: React.FC<{
  includeInCost: boolean;
  setIncludeInCost: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ includeInCost, setIncludeInCost }) => (
  <div className="quick-entry-cost-compact">
    <span>Include in Statistics</span>
    <button
      type="button"
      role="switch"
      aria-checked={includeInCost}
      onClick={() => setIncludeInCost((value) => !value)}
      className={`quick-entry-cost-switch ${includeInCost ? 'is-on' : ''}`}
      aria-label={
        includeInCost
          ? 'Included in statistics, tap to exclude'
          : 'Excluded from statistics, tap to include'
      }
    >
      <span />
    </button>
  </div>
);

export const QuickEntrySubmitSection: React.FC<{
  isEditing: boolean;
  error: string | null;
  handleDeleteEntry: () => void;
}> = ({ isEditing, error, handleDeleteEntry }) => (
  <div className="quick-entry-submit-wrap">
    {error && (
      <div className="quick-entry-submit-error" role="alert" aria-live="assertive">
        {error}
      </div>
    )}
    <button type="submit" className="quick-entry-submit-button">
      {isEditing ? 'Save Changes' : 'Save Entry'}
    </button>
    {isEditing && (
      <button
        type="button"
        onClick={handleDeleteEntry}
        className="quick-entry-delete-button"
      >
        Delete Entry
      </button>
    )}
  </div>
);
