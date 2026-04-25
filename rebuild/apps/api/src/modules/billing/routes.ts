import type { FastifyInstance } from "fastify";
import {
  billingStatusSchema,
  checkoutIntentSchema,
  checkoutResponseSchema,
  entitlementSnapshotSchema,
} from "@ryxen/contracts";
import {
  requireAdminOrDeveloperUser,
  requireAuthenticatedUser,
} from "../../lib/auth";
import {
  createCheckoutIntent,
  getBillingStatusSnapshot,
  getEntitlementsSnapshot,
  grantMockSubscription,
} from "./repository";

export async function registerBillingRoutes(app: FastifyInstance) {
  app.get("/status", { preHandler: requireAuthenticatedUser }, async (request) =>
    billingStatusSchema.parse(await getBillingStatusSnapshot(request.authUser!.userId)),
  );

  app.get("/entitlements", { preHandler: requireAuthenticatedUser }, async (request) =>
    entitlementSnapshotSchema.parse(await getEntitlementsSnapshot(request.authUser!.userId)),
  );

  app.post("/checkout", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const parsed = checkoutIntentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.flatten(),
      });
    }

    const checkoutInput: {
      userId: number;
      planId: string;
      provider?: string;
      successUrl?: string;
    } = {
      userId: request.authUser!.userId,
      planId: parsed.data.planId,
    };

    if (parsed.data.provider) checkoutInput.provider = parsed.data.provider;
    if (parsed.data.successUrl) checkoutInput.successUrl = parsed.data.successUrl;

    const result = await createCheckoutIntent(checkoutInput);

    if ("error" in result) {
      return reply.status(400).send({ error: result.error });
    }

    return checkoutResponseSchema.parse(result);
  });

  app.post("/mock/activate", { preHandler: requireAdminOrDeveloperUser }, async (request, reply) => {
    const body =
      request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
    const rawPlanId = String(body.planId || "pro").trim();

    try {
      const status = await grantMockSubscription({
        userId: request.authUser!.userId,
        planId: rawPlanId,
        provider: String(body.provider || "mock").trim(),
      });

      return billingStatusSchema.parse(status);
    } catch (error) {
      return reply.status(400).send({
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel ativar o billing mock",
      });
    }
  });
}
