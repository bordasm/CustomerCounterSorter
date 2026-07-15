import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/db/prisma-client.js";
import { resolveCity } from "../src/geocoding/resolve-city.js";

interface SeedCustomer {
  name: string;
  budget: number;
  location: {
    city: string;
    countryCode: string;
  };
  note: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedFilePath = path.join(__dirname, "..", "docs", "seed-customers.json");

async function main(): Promise<void> {
  const raw = readFileSync(seedFilePath, "utf-8");
  const customers = JSON.parse(raw) as SeedCustomer[];

  const upserts = customers.map((customer) => {
    const coordinates = resolveCity(customer.location.city);

    if (coordinates === null) {
      console.warn(
        `[seed] no coordinates found for city "${customer.location.city}" (customer: ${customer.name})`,
      );
    }

    return prisma.customer.upsert({
      where: { name: customer.name },
      update: {
        telepules: customer.location.city,
        lat: coordinates?.lat ?? null,
        lon: coordinates?.lon ?? null,
        budget: customer.budget,
        note: customer.note,
      },
      create: {
        name: customer.name,
        telepules: customer.location.city,
        lat: coordinates?.lat ?? null,
        lon: coordinates?.lon ?? null,
        budget: customer.budget,
        note: customer.note,
      },
    });
  });

  await prisma.$transaction(upserts);

  console.log(`[seed] upserted ${customers.length} customers`);
}

main()
  .catch((error: unknown) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
