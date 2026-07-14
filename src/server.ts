import Fastify from "fastify";
import { customersRoutes } from "./routes/customers.js";

const app = Fastify({ logger: true });

await app.register(customersRoutes);

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exitCode = 1;
});
