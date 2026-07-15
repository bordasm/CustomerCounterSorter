import { describe, expect, it } from "vitest";
import type { CustomerWithCoordinates } from "./sort-by-distance.js";
import { sortByDistanceFromBudapest } from "./sort-by-distance.js";

function customer(
  overrides: Partial<CustomerWithCoordinates>,
): CustomerWithCoordinates {
  return {
    id: 1,
    name: "Name",
    telepules: "City",
    lat: null,
    lon: null,
    budget: null,
    note: null,
    ...overrides,
  };
}

describe("sortByDistanceFromBudapest", () => {
  it("places Budapest customers first at 0 km", () => {
    const budapest = customer({
      id: 1,
      name: "Anna",
      lat: 47.4979,
      lon: 19.0402,
    });
    const vienna = customer({
      id: 2,
      name: "Lena",
      lat: 48.2082,
      lon: 16.3738,
    });

    const [first, second] = sortByDistanceFromBudapest([vienna, budapest]);

    expect(first.name).toBe("Anna");
    expect(first.distanceKm).toBe(0);
    expect(second.name).toBe("Lena");
    expect(second.distanceKm).toBeGreaterThan(0);
  });

  it("sorts unknown-coordinate customers last with distanceKm null", () => {
    const known = customer({
      id: 1,
      name: "Zoe",
      lat: 47.4979,
      lon: 19.0402,
    });
    const unknown = customer({ id: 2, name: "Aaron", lat: null, lon: null });

    const result = sortByDistanceFromBudapest([unknown, known]);

    expect(result.map((c) => c.name)).toEqual(["Zoe", "Aaron"]);
    expect(result[1].distanceKm).toBeNull();
  });

  it("breaks ties by name ascending", () => {
    const a = customer({
      id: 1,
      name: "Zeta",
      lat: 47.4979,
      lon: 19.0402,
    });
    const b = customer({
      id: 2,
      name: "Alpha",
      lat: 47.4979,
      lon: 19.0402,
    });
    const unknownB = customer({ id: 3, name: "Beta", lat: null, lon: null });
    const unknownA = customer({ id: 4, name: "Aaron", lat: null, lon: null });

    const result = sortByDistanceFromBudapest([a, b, unknownB, unknownA]);

    expect(result.map((c) => c.name)).toEqual([
      "Alpha",
      "Zeta",
      "Aaron",
      "Beta",
    ]);
  });

  it("rounds distanceKm to one decimal place", () => {
    const vienna = customer({
      id: 1,
      name: "Lena",
      lat: 48.2082,
      lon: 16.3738,
    });

    const [result] = sortByDistanceFromBudapest([vienna]);

    expect(result.distanceKm).toBe(214);
  });
});
