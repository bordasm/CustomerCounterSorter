import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "./haversine.js";

const BUDAPEST = { lat: 47.4979, lon: 19.0402 };
const VIENNA = { lat: 48.2082, lon: 16.3738 };

describe("haversineDistanceKm", () => {
  it("returns the known distance between Budapest and Vienna", () => {
    const distance = haversineDistanceKm(BUDAPEST, VIENNA);
    expect(distance).not.toBeNull();
    expect(distance!).toBeGreaterThan(210);
    expect(distance!).toBeLessThan(220);
  });

  it("returns 0 for identical coordinates", () => {
    expect(haversineDistanceKm(BUDAPEST, BUDAPEST)).toBe(0);
  });

  it("returns null when either coordinate is missing", () => {
    expect(haversineDistanceKm(BUDAPEST, null)).toBeNull();
    expect(haversineDistanceKm(null, VIENNA)).toBeNull();
    expect(haversineDistanceKm(null, null)).toBeNull();
  });
});
