import { calculateCrossTripIntelligence } from '../../utils/crossTripIntelligenceEngine';
import type { Trip } from '../../core/domain';
import './crossTripIntelligence.css';

export const CrossTripIntelligence = ({ trips }: { trips: Trip[] }) => {
  const insight = calculateCrossTripIntelligence(trips);
  if (insight.tripCount === 0) return null;

  return <section className="cross-trip-intelligence">
    <div className="cross-trip-heading"><div><span>TRAVEL INTELLIGENCE</span><h2>Across your journeys</h2></div><small>{insight.tripCount} achieved {insight.tripCount === 1 ? 'journey' : 'journeys'}</small></div>
    <div className="cross-trip-metrics">
      <div><span>TRIPS / YEAR</span><strong>{insight.tripsPerYear.toFixed(1)}</strong></div>
      <div><span>AVG. LENGTH</span><strong>{insight.averageTripLength.toFixed(1)} <em>days</em></strong></div>
      <div><span>AVG. TRIP COST</span><strong>¥{insight.averageTripCostCny.toFixed(0)}</strong><small>CNY equivalent</small></div>
      <div><span>AVG. DAILY COST</span><strong>¥{insight.averageDailyCostCny.toFixed(0)}</strong><small>CNY equivalent</small></div>
    </div>
    {insight.destinations.length > 0 && <div className="cross-trip-destinations"><div className="cross-trip-subheading"><span>DESTINATION PATTERNS</span><small>derived from achieved trips</small></div>{insight.destinations.map((destination) => <div className="cross-trip-destination" key={destination.destination}><div><strong>{destination.destination || 'Unspecified'}</strong><span>{destination.tripCount} {destination.tripCount === 1 ? 'journey' : 'journeys'} · {destination.totalDays} days</span></div><div><strong>{destination.averageTripLength.toFixed(1)} d</strong><span>avg. length</span></div></div>)}</div>}
  </section>;
};

export default CrossTripIntelligence;
