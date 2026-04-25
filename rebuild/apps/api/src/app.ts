import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { assertApiConfig } from "./config";
import { moduleRegistry } from "./module-registry";
import { registerAthleteRoutes } from "./modules/athletes/routes";
import { registerAuthRoutes } from "./modules/auth/routes";
import { registerBillingRoutes } from "./modules/billing/routes";
import { registerCoachRoutes } from "./modules/coach/routes";

export async function buildApp() {
  assertApiConfig();

  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(sensible);
  app.decorateRequest("authUser", null);

  app.get("/health", async () => ({
    ok: true,
    service: "ryxen-rebuild-api",
  }));

  await app.register(registerAuthRoutes, { prefix: "/auth" });
  await app.register(registerBillingRoutes, { prefix: "/billing" });
  await app.register(registerCoachRoutes);
  await app.register(registerAthleteRoutes);

  const implementedModules = new Set(["auth", "athletes", "billing", "gyms", "workouts"]);
  for (const module of moduleRegistry) {
    app.log.info(
      {
        module: module.key,
        status: implementedModules.has(module.key) ? "enabled" : "planned",
      },
      "module status",
    );
  }

  return app;
}
