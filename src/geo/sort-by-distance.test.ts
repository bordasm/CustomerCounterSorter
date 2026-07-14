import { describe, expect, it } from "vitest";
import { sortByDistanceFromBudapest } from "./sort-by-distance.js";
import type { CustomerWithCoordinates } from "./sort-by-distance.js";

const customers: CustomerWithCoordinates[] = [
  {
    id: 1,
    name: "Vienna Customer",
    telepules: "Vienna",
    lat: 48.2082,
    lon: 16.3738,
    budget: null,
    note: null,
  },
  {
    id: 2,
    name: "Budapest Customer",
    telepules: "Budapest",
    lat: 47.4979,
    lon: 19.0402,
    budget: null,
    note: null,
  },
  {
    id: 3,
    name: "Unknown City Zeta",
    telepules: "Atlantis",
    lat: null,
    lon: null,
    budget: null,
    note: null,
  },
  {
    id: 4,
    name: "Unknown City Alpha",
    telepules: "Atlantis",
    lat: null,
    lon: null,
    budget: null,
    note: null,
  },
];

describe("sortByDistanceFromBudapest", () => {
  it("orders customers ascending by distance, Budapest first, unknowns last", () => {
    const result = sortByDistanceFromBudapest(customers);
    expect(result.map((c) => c.name)).toEqual([
      "Budapest Customer",
      "Vienna Customer",
      "Unknown City Alpha",
      "Unknown City Zeta",
    ]);
  });

  it("assigns 0 km distance to Budapest and rounds to 1 decimal", () => {
    const result = sortByDistanceFromBudapest(customers);
    const budapestCustomer = result.find((c) => c.name === "Budapest Customer")!;
    expect(budapestCustomer.distanceKm).toBe(0);
    const viennaCustomer = result.find((c) => c.name === "Vienna Customer")!;
    expect(viennaCustomer.distanceKm!).toBeGreaterThan(210);
    expect(viennaCustomer.distanceKm!).toBeLessThan(220);
  });

  it("breaks ties among unknown-distance customers by name", () => {
    const result = sortByDistanceFromBudapest(customers);
    const unknowns = result
      .filter((c) => c.distanceKm === null)
      .map((c) => c.name);
    expect(unknowns).toEqual(["Unknown City Alpha", "Unknown City Zeta"]);
  });
});
