import React from 'react';
import { createPortal } from 'react-dom';

import { LedgerEntry, TravelSegment } from '../../core/domain';

export const QuickEntrySuccessModal: React.FC = () => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="quick-entry-success-backdrop" role="presentation">
      <div className="quick-entry-success-modal" role="status" aria-live="polite">
        <div className="quick-entry-success-check">
          <span>✓</span>
        </div>
        <strong>Recorded</strong>
        <span>Your record has been saved.</span>
      </div>
    </div>,
    document.body,
  );
};

export interface PendingSegmentSwitch {
  tripId: string;
  entry: LedgerEntry;
  currentSegmentId: string;
  nextSegment: TravelSegment;
}

export const QuickEntrySegmentSwitchModal: React.FC<{
  pendingSegmentSwitch: PendingSegmentSwitch;
  saveEntry: (tripId: string, entry: LedgerEntry, segmentId: string) => void;
  onClose: () => void;
}> = ({ pendingSegmentSwitch, saveEntry, onClose }) => {
  const { tripId, entry, currentSegmentId, nextSegment } = pendingSegmentSwitch;
  const destinationLabel =
    nextSegment.destinations
      .map((destination) => destination.city || destination.country)
      .filter(Boolean)
      .join(' · ') || 'next segment';

  const continueWith = (segmentId: string) => {
    onClose();
    saveEntry(tripId, entry, segmentId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="segment-switch-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-[#fbf7ee] p-5 text-[#17243a] shadow-2xl">
        <p className="text-xs uppercase tracking-[0.16em] text-[#857a6a]">Journey handoff</p>
        <h3 id="segment-switch-title" className="mt-2 text-xl font-medium">
          Switch to {destinationLabel}?
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#766957]">
          No keeps this entry in the current segment. You’ll be asked again next time until you switch.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => continueWith(currentSegmentId)}
            className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-[#17243a]"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => continueWith(nextSegment.id)}
            className="min-h-12 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};
