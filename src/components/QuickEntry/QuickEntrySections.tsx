import React from 'react';

import {
  AllocationMode,
  TransportJourneyType,
  TransportMode,
} from '../../core/domain';

import { DatePicker } from './DatePicker';

const normalizePercentageInput = (value: string) => value.replace(/^0+(?=\d)/, '');

export interface QuickEntryMember {
  id: string;
  name: string;
}

interface QuickEntryTransportSectionProps {
  transportMode: TransportMode;
  journeyType: TransportJourneyType;
  openDatePicker: string | null;
  setOpenDatePicker: (value: string | null) => void;
  outboundDate: string;
  setOutboundDate: (value: string) => void;
  returnDate: string;
  setReturnDate: (value: string) => void;
  tripDateBounds: { minDate?: string; maxDate?: string };
  setTransportMode: (value: TransportMode) => void;
  setJourneyType: (value: TransportJourneyType) => void;
}

export const QuickEntryTransportSection: React.FC<QuickEntryTransportSectionProps> = ({
  transportMode,
  journeyType,
  openDatePicker,
  setOpenDatePicker,
  outboundDate,
  setOutboundDate,
  returnDate,
  setReturnDate,
  tripDateBounds,
  setTransportMode,
  setJourneyType,
}) => (
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
            <button
              key={value}
              type="button"
              onClick={() => {
                setTransportMode(value);
                setJourneyType('one_way');
                setReturnDate('');
              }}
              aria-pressed={transportMode === value}
              className={`quick-entry-transport-button ${transportMode === value ? 'is-selected' : ''}`}
            >
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
              <button
                type="button"
                onClick={() => setJourneyType('one_way')}
                aria-pressed={journeyType === 'one_way'}
                className={`quick-entry-journey-button ${journeyType === 'one_way' ? 'is-selected' : ''}`}
              >
                One Way
              </button>
              <DatePicker
                pickerId="transport-outbound"
                openPickerId={openDatePicker}
                onOpenPicker={setOpenDatePicker}
                value={outboundDate}
                onChange={(value) => {
                  setOutboundDate(value);
                  if (returnDate && returnDate < value) setReturnDate('');
                }}
                label="Outbound"
                required
                popoverAlign="right"
                minDate={tripDateBounds.minDate}
                maxDate={tripDateBounds.maxDate}
              />
            </div>
            <div className="quick-entry-journey-option">
              <button
                type="button"
                onClick={() => setJourneyType('round_trip')}
                aria-pressed={journeyType === 'round_trip'}
                className={`quick-entry-journey-button ${journeyType === 'round_trip' ? 'is-selected' : ''}`}
              >
                Round Trip
              </button>
              <DatePicker
                pickerId="transport-return"
                openPickerId={openDatePicker}
                onOpenPicker={setOpenDatePicker}
                value={returnDate}
                onChange={setReturnDate}
                label="Return"
                required={journeyType === 'round_trip'}
                minDate={outboundDate || tripDateBounds.minDate}
                maxDate={tripDateBounds.maxDate}
                openMonthValue={outboundDate || tripDateBounds.minDate}
              />
            </div>
          </div>
        </div>
      )}

      {transportMode !== 'flight' && (
        <div className="quick-entry-journey-field quick-entry-journey-field-nonflight">
          <span>Date</span>
          <div className="quick-entry-transport-dates">
            <DatePicker
              pickerId="transport-outbound"
              openPickerId={openDatePicker}
              onOpenPicker={setOpenDatePicker}
              value={outboundDate}
              onChange={(value) => {
                setOutboundDate(value);
                if (returnDate && returnDate < value) setReturnDate('');
              }}
              label="Outbound"
              required
              minDate={tripDateBounds.minDate}
              maxDate={tripDateBounds.maxDate}
            />
          </div>
        </div>
      )}
    </div>
  </div>
);

interface QuickEntryPrepaidSectionProps {
  openDatePicker: string | null;
  setOpenDatePicker: (value: string | null) => void;
  usageStart: string;
  setUsageStart: (value: string) => void;
  usageEnd: string;
  setUsageEnd: (value: string) => void;
  tripDateBounds: { minDate?: string; maxDate?: string };
}

export const QuickEntryPrepaidSection: React.FC<QuickEntryPrepaidSectionProps> = ({
  openDatePicker,
  setOpenDatePicker,
  usageStart,
  setUsageStart,
  usageEnd,
  setUsageEnd,
  tripDateBounds,
}) => (
  <div className="quick-entry-prepaid-section">
    <div className="quick-entry-prepaid-dates">
      <DatePicker
        pickerId="prepaid-usage-start"
        openPickerId={openDatePicker}
        onOpenPicker={setOpenDatePicker}
        value={usageStart}
        onChange={(value) => {
          setUsageStart(value);
          if (usageEnd && usageEnd < value) setUsageEnd('');
        }}
        label="Usage Start"
        required
        minDate={tripDateBounds.minDate}
        maxDate={tripDateBounds.maxDate}
      />
      <DatePicker
        pickerId="prepaid-usage-end"
        openPickerId={openDatePicker}
        onOpenPicker={setOpenDatePicker}
        value={usageEnd}
        onChange={setUsageEnd}
        label="Usage End"
        required
        minDate={usageStart || tripDateBounds.minDate}
        maxDate={tripDateBounds.maxDate}
        openMonthValue={usageStart || tripDateBounds.minDate}
      />
    </div>
  </div>
);

interface QuickEntryAllocationSectionProps {
  allocationMode: AllocationMode;
  setAllocationMode: (value: AllocationMode) => void;
  targetTripHasPreset: boolean;
  presetPercentages?: Record<string, number>;
  members: QuickEntryMember[];
  selectedParticipants: Set<string>;
  customPercentages: Record<string, number>;
  toggleParticipant: (id: string) => void;
  setCustomPercentages: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export const QuickEntryAllocationSection: React.FC<QuickEntryAllocationSectionProps> = ({
  allocationMode,
  setAllocationMode,
  targetTripHasPreset,
  presetPercentages,
  members,
  selectedParticipants,
  customPercentages,
  toggleParticipant,
  setCustomPercentages,
}) => (
  <div className="quick-entry-participants-section">
    <span className="quick-entry-section-label">Participants</span>
    <div className="quick-entry-allocation-mode">
      {([
        ['equal', 'Equal Split'],
        ['preset_percentage', 'Preset Percentage'],
        ['custom_percentage', 'Custom Percentage'],
      ] as const).map(([value, label]) => {
        const disabled = value === 'preset_percentage' && !targetTripHasPreset;
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => setAllocationMode(value)}
            aria-pressed={allocationMode === value}
            className={`quick-entry-allocation-mode-button ${allocationMode === value ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
          >
            {label}
          </button>
        );
      })}
    </div>

    {allocationMode === 'preset_percentage' && presetPercentages && (
      <div className="quick-entry-preset-info">
        Using this journey's preset allocation:
        {Object.entries(presetPercentages)
          .filter(([id, percentage]) => members.some((member) => member.id === id) && Number(percentage) > 0)
          .map(([id, percentage]) => `${members.find((member) => member.id === id)?.name ?? id} ${percentage}%`)
          .join(' · ')}
      </div>
    )}

    {allocationMode !== 'preset_percentage' && (
      <div className="quick-entry-participants-grid">
        {members.map((member) => {
          const selected = selectedParticipants.has(member.id);
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => toggleParticipant(member.id)}
              aria-pressed={selected}
              className={`quick-entry-participant-button ${selected ? 'is-selected' : ''}`}
            >
              {member.name}
              {allocationMode === 'custom_percentage' && selected && (
                <span className="quick-entry-participant-percentage">
                  {customPercentages[member.id] ?? 0}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    )}

    {allocationMode === 'custom_percentage' && (
      <div className="quick-entry-custom-percentages">
        {members
          .filter((member) => selectedParticipants.has(member.id))
          .map((member) => (
            <label key={member.id} className="quick-entry-custom-percentage">
              <span>{member.name}</span>
              <span className="quick-entry-custom-percentage-value">
                <input
                  type="text"
                  inputMode="decimal"
                  value={customPercentages[member.id] ?? ''}
                  onChange={(event) => {
                    const raw = normalizePercentageInput(event.target.value);
                    setCustomPercentages((previous) => ({
                      ...previous,
                      [member.id]: raw === '' ? 0 : Number(raw),
                    }));
                  }}
                  aria-label={`${member.name} percentage`}
                />
                <span>%</span>
              </span>
            </label>
          ))}
      </div>
    )}
  </div>
);

