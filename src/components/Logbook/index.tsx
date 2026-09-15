import { useMemo } from 'react';
import { useVelaStore } from '../../store/useVelaStore';
import { generateAnnualReflection, generateTripInsights } from '../../utils/reflectionEngine';

export const LogbookView = () => {
  const trips = useVelaStore((state) => state.trips);
  const currentYear = new Date().getFullYear();

  const achieveTrips = useMemo(
    () => trips.filter((trip) => trip.status === 'achieve'),
    [trips],
  );
  const planningTrips = useMemo(
    () => trips.filter((trip) => trip.status === 'planning'),
    [trips],
  );

  const annualData = useMemo(
    () => generateAnnualReflection(achieveTrips, currentYear),
    [achieveTrips, currentYear],
  );

  const completedInsights = useMemo(
    () => achieveTrips.map(generateTripInsights),
    [achieveTrips],
  );

  return (
    <main>
      <h1>Logbook</h1>
      <pre>{JSON.stringify({
        annualReflection: annualData,
        plannedTrips: planningTrips.map((trip) => ({
          tripId: trip.id,
          title: trip.title,
          localCurrency: trip.localCurrency,
        })),
        completedTripInsights: completedInsights,
      }, null, 2)}</pre>
    </main>
  );
};

export default LogbookView;
