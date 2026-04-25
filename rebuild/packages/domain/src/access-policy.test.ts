import { describe, expect, it } from "vitest";
import {
  buildEntitlements,
  buildGymMembershipContext,
  getSubscriptionAccessState,
} from "./access-policy";

describe("access policy", () => {
  it("classifies active subscriptions correctly", () => {
    const state = getSubscriptionAccessState({
      status: "active",
      renewAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(state.accessTier).toBe("active");
    expect(state.isActive).toBe(true);
    expect(state.isGracePeriod).toBe(false);
  });

  it("classifies expired active subscriptions in grace period", () => {
    const state = getSubscriptionAccessState({
      status: "active",
      renewAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(state.accessTier).toBe("grace");
    expect(state.isGracePeriod).toBe(true);
  });

  it("builds coach context with publishing enabled only for active owner subscriptions", () => {
    const context = buildGymMembershipContext({
      gymId: 7,
      gymName: "Ryxen Performance",
      role: "coach",
      status: "active",
      ownerSubscription: {
        planId: "pro",
        status: "active",
        renewAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(context.canCoachManage).toBe(true);
    expect(context.canAthletesUseApp).toBe(true);
    expect(context.athleteBenefits.tier).toBe("pro");
  });

  it("builds entitlements for coaches with active gym access", () => {
    const gymContext = buildGymMembershipContext({
      gymId: 9,
      gymName: "Ryxen Club",
      role: "owner",
      status: "active",
      ownerSubscription: {
        planId: "pro",
        status: "active",
        renewAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const entitlements = buildEntitlements({
      subscription: {
        planId: "pro",
        status: "active",
        renewAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      gymContexts: [gymContext],
    });

    expect(entitlements).toContain("athlete_app");
    expect(entitlements).toContain("coach_portal");
    expect(entitlements).toContain("advanced_analytics");
    expect(entitlements).toContain("athlete_pro");
  });
});
