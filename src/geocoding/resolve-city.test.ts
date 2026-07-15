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
    expect(resolveCity("Krakow")).toEqual(resolveCity("Kraków"));
    expect(resolveCity("krakow")).not.toBeNull();
  });

  it("resolves Budapest and its district variants to the capital", () => {
    const capital = resolveCity("Budapest");

    expect(capital).not.toBeNull();
    expect(resolveCity("Budapest V")).toEqual(capital);
    expect(resolveCity("budapest, 5. kerulet")).toEqual(capital);
  });

  it("returns null for a city missing from the reference table", () => {
    expect(resolveCity("Atlantis")).toBeNull();
  });
});
