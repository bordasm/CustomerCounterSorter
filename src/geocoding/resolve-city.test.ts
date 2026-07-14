import { describe, expect, it } from "vitest";
import { resolveCity } from "./resolve-city.js";

describe("resolveCity", () => {
  it("resolves an exact known city name", () => {
    expect(resolveCity("Vienna")).toEqual({ lat: 48.2082, lon: 16.3738 });
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(resolveCity("  vIENNA  ")).toEqual({ lat: 48.2082, lon: 16.3738 });
  });

  it("is accent-insensitive", () => {
    expect(resolveCity("Krakow")).toEqual({ lat: 50.0647, lon: 19.945 });
    expect(resolveCity("Kraków")).toEqual({ lat: 50.0647, lon: 19.945 });
  });

  it("resolves Budapest district notations to the capital", () => {
    expect(resolveCity("Budapest XI. kerület")).toEqual({
      lat: 47.4979,
      lon: 19.0402,
    });
  });

  it("returns null for an unknown city", () => {
    expect(resolveCity("Atlantis")).toBeNull();
  });
});
