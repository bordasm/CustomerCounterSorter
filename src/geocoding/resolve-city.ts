import type { Coordinates } from "../geo/coordinates.js";
import { CITY_COORDINATES } from "./city-coordinates.js";

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const BUDAPEST_VARIANT = /^budapest(?:$|[\s,.-])/;

function normalizeCityName(city: string): string {
  return city
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .trim()
    .toLowerCase();
}

export function resolveCity(city: string): Coordinates | null {
  const normalized = normalizeCityName(city);

  if (BUDAPEST_VARIANT.test(normalized)) {
    return CITY_COORDINATES.get("budapest") ?? null;
  }

  return CITY_COORDINATES.get(normalized) ?? null;
}
