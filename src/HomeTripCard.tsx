import React from 'react';
import { Calendar, ChevronRight, List as ListIcon, MapPin } from 'lucide-react';
import { Trip } from './core/domain';
import { getTripDestinations } from './core/travelSegment';
import { formatTripDate, getTripLocalSummary } from './homeHelpers';
import { useTripCover } from './hooks/useTripCover';

const TripCoverImage: React.FC<{ trip: Trip }> = ({ trip }) => {
  const src = useTripCover(trip.coverImage);

  if (!src) {
    return (
      <span className="vela-trip-cover-placeholder" aria-hidden="true">
        <img src="/favicon.svg" alt="" />
      </span>
    );
  }

  return <img src={src} alt="" />;
};

interface HomeTripCardProps {
  trip: Trip;
  compact?: boolean;
  onNavigate: () => void;
  onOpenLists: () => void;
}

export const HomeTripCard: React.FC<HomeTripCardProps> = ({
  trip,
  compact = false,
  onNavigate,
  onOpenLists,
}) => {
  if (compact) {
    return (
      <div className="vela-trip-row">
        <button
          className="vela-trip-row-main"
          type="button"
          onClick={onNavigate}
        >
          <TripCoverImage trip={trip} />
          <span className="vela-trip-row-copy">
            <strong>{trip.title}</strong>
            <small>
              {getTripDestinations(trip).join(' · ') || 'Destination not set'} ·{' '}
              {formatTripDate(trip)}
            </small>
            <em>{getTripLocalSummary(trip) || 'No payments yet'}</em>
          </span>
        </button>
        <button
          className="vela-list-shortcut"
          type="button"
          onClick={onOpenLists}
        >
          <ListIcon size={13} /> List
        </button>
        <ChevronRight className="vela-trip-row-chevron" size={17} />
      </div>
    );
  }

  const [firstTitle, ...restTitle] = trip.title.split(' · ');
  const remainingTitle = restTitle.join(' · ');

  return (
    <div className="vela-current-card">
      <button
        className="vela-current-main"
        type="button"
        onClick={onNavigate}
      >
        <span className="vela-current-copy">
          <span className="vela-current-label">
            CURRENT TRIP <i />
          </span>
          <strong className="vela-current-title">
            <span>{firstTitle} ·</span> <em>{remainingTitle}</em>
          </strong>
          <span className="vela-destination">
            <MapPin size={12} />
            {getTripDestinations(trip).join(' · ') || 'Choose a destination'}
          </span>
          <span className="vela-date">
            <Calendar size={13} />
            {formatTripDate(trip)}
          </span>
          <span className="vela-summary">
            {getTripLocalSummary(trip) || 'Your travel record starts here.'}
          </span>
        </span>
        <span className="vela-current-image">
          <TripCoverImage trip={trip} />
        </span>
      </button>
      <button
        className="vela-current-list"
        type="button"
        onClick={onOpenLists}
      >
        <ListIcon size={13} /> List
      </button>
    </div>
  );
};
