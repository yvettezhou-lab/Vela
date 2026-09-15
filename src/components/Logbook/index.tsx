import { AnnualReflection, TripInsights } from '../../types/logbook';
import { Trip } from '../../core/domain';

interface LogbookViewProps {
  annualReflection: AnnualReflection;
  plannedTrips: Trip[];
  completedTripInsights: TripInsights[];
}

export const LogbookView = ({ annualReflection, plannedTrips, completedTripInsights }: LogbookViewProps) => (
  <main>
    <h1>Logbook</h1>
    <pre>{JSON.stringify({
      annualReflection,
      plannedTrips: plannedTrips.map((trip) => ({
        tripId: trip.id,
        title: trip.title,
        localCurrency: trip.localCurrency,
      })),
      completedTripInsights,
    }, null, 2)}</pre>
  </main>
);

export default LogbookView;
