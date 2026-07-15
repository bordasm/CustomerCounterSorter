import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma-client.js";
import { sortByDistanceFromBudapest } from "../geo/sort-by-distance.js";
import type { CustomerWithCoordinates } from "../geo/sort-by-distance.js";

export async function customersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/customers/count", async () => {
    const count = await prisma.customer.count();
    return { count };
  });

  app.get("/customers/by-distance", async () => {
    const customers = await prisma.customer.findMany();

    const withCoordinates: CustomerWithCoordinates[] = customers.map(
      (customer) => ({
        id: customer.id,
        name: customer.name,
        telepules: customer.telepules,
        lat: customer.lat === null ? null : customer.lat.toNumber(),
        lon: customer.lon === null ? null : customer.lon.toNumber(),
        budget: customer.budget,
        note: customer.note,
      }),
    );

    return sortByDistanceFromBudapest(withCoordinates);
  });
}
