import type { Coordinates } from "./coordinates.js";
import { haversineDistanceKm } from "./haversine.js";

export interface CustomerWithCoordinates {
  id: number;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

export interface CustomerWithDistance extends CustomerWithCoordinates {
  distanceKm: number | null;
}

const BUDAPEST: Coordinates = { lat: 47.4979, lon: 19.0402 };

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function sortByDistanceFromBudapest(
  customers: CustomerWithCoordinates[],
): CustomerWithDistance[] {
  const withDistance: CustomerWithDistance[] = customers.map((customer) => {
    const coordinates: Coordinates | null =
      customer.lat !== null && customer.lon !== null
        ? { lat: customer.lat, lon: customer.lon }
        : null;
    const distanceKm = haversineDistanceKm(BUDAPEST, coordinates);

    return {
      ...customer,
      distanceKm: distanceKm === null ? null : roundToOneDecimal(distanceKm),
    };
  });

  return withDistance.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) {
      return a.name.localeCompare(b.name);
    }
    if (a.distanceKm === null) {
      return 1;
    }
    if (b.distanceKm === null) {
      return -1;
    }
    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    return a.name.localeCompare(b.name);
  });
}
