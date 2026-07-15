import { describe, expect, it } from "vitest";
import { BUDAPEST } from "./coordinates.js";
import { haversineDistanceKm } from "./haversine.js";

describe("haversineDistanceKm", () => {
  it("returns ~214 km for Budapest to Vienna", () => {
    const vienna = { lat: 48.2082, lon: 16.3738 };

    const distance = haversineDistanceKm(BUDAPEST, vienna);

    expect(distance).not.toBeNull();
    expect(distance as number).toBeGreaterThan(212);
    expect(distance as number).toBeLessThan(216);
  });

  it("returns 0 km for the same point", () => {
    expect(haversineDistanceKm(BUDAPEST, BUDAPEST)).toBe(0);
  });

  it("returns a finite distance for antipodal points", () => {
    const antipode = { lat: -BUDAPEST.lat, lon: BUDAPEST.lon - 180 };

    const distance = haversineDistanceKm(BUDAPEST, antipode);

    expect(distance).not.toBeNull();
    expect(Number.isFinite(distance as number)).toBe(true);
  });

  it("returns null when either coordinate is null", () => {
    expect(haversineDistanceKm(BUDAPEST, null)).toBeNull();
    expect(haversineDistanceKm(null, BUDAPEST)).toBeNull();
    expect(haversineDistanceKm(null, null)).toBeNull();
  });
});
