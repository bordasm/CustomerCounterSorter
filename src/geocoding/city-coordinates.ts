import type { Coordinates } from "../geo/coordinates.js";

export const CITY_COORDINATES: ReadonlyMap<string, Coordinates> = new Map([
  ["budapest", { lat: 47.4979, lon: 19.0402 }],
  ["vienna", { lat: 48.2082, lon: 16.3738 }],
  ["munich", { lat: 48.1351, lon: 11.582 }],
  ["milan", { lat: 45.4642, lon: 9.19 }],
  ["barcelona", { lat: 41.3851, lon: 2.1734 }],
  ["lyon", { lat: 45.764, lon: 4.8357 }],
  ["krakow", { lat: 50.0647, lon: 19.945 }],
  ["prague", { lat: 50.0755, lon: 14.4378 }],
  ["lisbon", { lat: 38.7223, lon: -9.1393 }],
  ["amsterdam", { lat: 52.3676, lon: 4.9041 }],
  ["stockholm", { lat: 59.3293, lon: 18.0686 }],
  ["ljubljana", { lat: 46.0569, lon: 14.5058 }],
  ["bucharest", { lat: 44.4268, lon: 26.1025 }],
  ["dublin", { lat: 53.3498, lon: -6.2603 }],
  ["copenhagen", { lat: 55.6761, lon: 12.5683 }],
]);
