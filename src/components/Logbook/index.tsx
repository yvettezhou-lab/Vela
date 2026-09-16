import { AnnualReflection, TripInsights } from '../../types/logbook';
import { Trip } from '../../core/domain';

interface LogbookViewProps {
  annualReflection: AnnualReflection;
  plannedTrips: Trip[];
  tripInsights: TripInsights[];
}

export const LogbookView = ({ annualReflection, plannedTrips, tripInsights }: LogbookViewProps) => (
  <main>
    <h1>Logbook</h1>
    <pre>{JSON.stringify({
      annualReflection,
      plannedTrips: plannedTrips.map((trip) => ({
        tripId: trip.id,
        title: trip.title,
        localCurrency: trip.localCurrency,
      })),
      tripInsights,
    }, null, 2)}</pre>
  </main>
);

export default LogbookView;
