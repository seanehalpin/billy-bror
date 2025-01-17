import type { ResolvedEntryDocument, Location } from "@/types/entry";
import type { User } from "@/types/user";

const dateOptions: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

/**
 * Process entries for poop and pee chart
 */
export function processEntriesForPoopPeeChart(
  entries: ResolvedEntryDocument[],
) {
  const dailyStats = entries.reduce(
    (acc, entry) => {
      const date = new Date(entry.startTime).toISOString().split("T")[0];
      if (!acc[date]) {
        acc[date] = {
          outsidePoops: 0,
          outsidePees: 0,
          insidePoops: 0,
          insidePees: 0,
        };
      }

      const isOutside = entry.mode === "auto" || entry.location === "outside";
      const poops = entry.poops || 0;
      const pees = entry.pees || 0;

      if (isOutside) {
        acc[date].outsidePoops += poops;
        acc[date].outsidePees += pees;
      } else {
        acc[date].insidePoops += poops;
        acc[date].insidePees += pees;
      }

      return acc;
    },
    {} as Record<
      string,
      {
        outsidePoops: number;
        outsidePees: number;
        insidePoops: number;
        insidePees: number;
      }
    >,
  );

  return Object.entries(dailyStats)
    .map(([date, stats]) => ({
      date,
      displayDate: new Date(date).toLocaleDateString("no-NO", dateOptions),
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Process entries for trips chart
 */
export function processEntriesForTripsChart(entries: ResolvedEntryDocument[]) {
  const dailyTrips = entries
    .filter((entry) => entry.location === "outside")
    .reduce(
      (acc, entry) => {
        const date = new Date(entry.startTime).toISOString().split("T")[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  return Object.entries(dailyTrips)
    .map(([date, trips]) => ({
      date,
      displayDate: new Date(date).toLocaleDateString("no-NO", dateOptions),
      trips,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Process entries for stat cards
 */
export function calculateStats(entries: ResolvedEntryDocument[]): {
  totalTrips: number;
  totalPoops: number;
  totalPees: number;
  averageTripsPerDay: number;
  mostCommonLocation: string;
  longestTrip: number;
  successRate: number;
  outdoorPercentage: number;
  averageTripDuration: number;
  topWalkers: Array<{ user: User; trips: number }>;
} {
  if (entries.length === 0) {
    return {
      totalTrips: 0,
      totalPoops: 0,
      totalPees: 0,
      averageTripsPerDay: 0,
      mostCommonLocation: "N/A",
      longestTrip: 0,
      successRate: 0,
      outdoorPercentage: 0,
      averageTripDuration: 0,
      topWalkers: [],
    };
  }

  const outdoorTrips = entries.filter(
    (entry) => entry.location === "outside" && entry.endTime,
  );
  const tripsWithToiletVisits = entries.filter(
    (entry) => entry.poops || entry.pees,
  );
  const outdoorTripsWithToiletVisits = outdoorTrips.filter(
    (entry) => entry.poops || entry.pees,
  );

  const totalTrips = entries.length;
  const totalOutsideTrips = outdoorTrips.length;
  const totalPoops = entries.reduce(
    (sum, entry) => sum + (entry.poops || 0),
    0,
  );
  const totalPees = entries.reduce((sum, entry) => sum + (entry.pees || 0), 0);
  const tripsWithWalkers = outdoorTrips.filter((entry) => entry?.users?.length);

  const days = new Set(
    entries.map(
      (entry) => new Date(entry.startTime).toISOString().split("T")[0],
    ),
  ).size;
  const averageTripsPerDay = totalOutsideTrips / days;

  const locationCounts = entries.reduce(
    (acc, entry) => {
      const location = entry.mode === "auto" ? "outside" : entry.location;
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    },
    {} as Record<Location, number>,
  );

  const mostCommonLocation =
    Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  const longestTrip = entries.reduce((longest, entry) => {
    if (entry.endTime) {
      const duration =
        (new Date(entry.endTime).getTime() -
          new Date(entry.startTime).getTime()) /
        60000;
      return Math.max(longest, duration);
    }
    return longest;
  }, 0);

  const successRate =
    tripsWithToiletVisits.length === 0
      ? 1
      : outdoorTripsWithToiletVisits.length / tripsWithToiletVisits.length;

  const outdoorPercentage = totalOutsideTrips / totalTrips;

  const totalDuration = outdoorTrips.reduce((sum, entry) => {
    if (entry.endTime) {
      return (
        sum +
        (new Date(entry.endTime).getTime() -
          new Date(entry.startTime).getTime()) /
          60000
      );
    }
    return sum;
  }, 0);
  const averageTripDuration = totalDuration / totalOutsideTrips;

  // Sort walkers by number of trips
  const topWalkers = Object.entries(
    tripsWithWalkers.reduce(
      (acc, entry) => {
        if (entry.users && entry.endTime) {
          const startTime = new Date(entry.startTime).getTime();
          const endTime = new Date(entry.endTime).getTime();
          const tripDurationInMinutes = (endTime - startTime) / 60000;
          // Only count trips that are 3+ minutes long
          if (tripDurationInMinutes >= 3) {
            for (const user of entry.users) {
              if (!acc[user.email]) {
                acc[user.email] = { user, trips: 0 };
              }
              acc[user.email].trips += 1;
            }
          }
        }
        return acc;
      },
      {} as Record<string, { user: User; trips: number }>,
    ),
  )
    .sort((a, b) => b[1].trips - a[1].trips)
    .map(([, value]) => value)
    .slice(0, 5); // Get top 5 walkers

  return {
    totalTrips: totalOutsideTrips,
    totalPoops,
    totalPees,
    averageTripsPerDay,
    mostCommonLocation,
    longestTrip,
    successRate,
    outdoorPercentage,
    averageTripDuration,
    topWalkers,
  };
}
