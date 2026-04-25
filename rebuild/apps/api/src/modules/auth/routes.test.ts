import { createHash } from "node:crypto";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

describe("auth routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches pending memberships when signup is confirmed", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: "athlete@ryxen.app",
            name: "Athlete",
            password_hash: "hashed-password",
            code_hash: hashCode("123456"),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 22,
            email: "athlete@ryxen.app",
            name: "Athlete",
            is_admin: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    vi.doMock("../../lib/db", () => ({
      pool: { query },
    }));
    vi.doMock("../../lib/auth", () => ({
      loadCurrentUser: vi.fn(),
      requireAuthenticatedUser: vi.fn(),
      signCompatibleToken: vi.fn(async () => "signed-token"),
      toPublicUser: vi.fn((user: { id: number; email: string; name: string | null; is_admin: boolean | null }) => ({
        id: String(user.id),
        email: user.email,
        name: user.name,
        isAdmin: !!user.is_admin,
      })),
    }));

    const { registerAuthRoutes } = await import("./routes");
    const app = Fastify();
    await registerAuthRoutes(app);

    const response = await app.inject({
      method: "POST",
      url: "/signup/confirm",
      payload: {
        email: "ATHLETE@RYXEN.APP",
        code: "123456",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().token).toBe("signed-token");

    const attachCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("WITH matched AS"),
    );
    expect(attachCall).toBeTruthy();
    expect(attachCall?.[1]).toEqual([22, "athlete@ryxen.app"]);

    await app.close();
  });

  it("attaches pending memberships when an invited athlete signs in", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: 33,
            email: "invited@ryxen.app",
            name: "Invited Athlete",
            is_admin: false,
            password_hash: "stored-hash",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    vi.doMock("bcryptjs", () => ({
      default: {
        compare: vi.fn(async () => true),
        hash: vi.fn(async () => "hashed"),
      },
    }));
    vi.doMock("../../lib/db", () => ({
      pool: { query },
    }));
    vi.doMock("../../lib/auth", () => ({
      loadCurrentUser: vi.fn(),
      requireAuthenticatedUser: vi.fn(),
      signCompatibleToken: vi.fn(async () => "signed-token"),
      toPublicUser: vi.fn((user: { id: number; email: string; name: string | null; is_admin: boolean | null }) => ({
        id: String(user.id),
        email: user.email,
        name: user.name,
        isAdmin: !!user.is_admin,
      })),
    }));

    const { registerAuthRoutes } = await import("./routes");
    const app = Fastify();
    await registerAuthRoutes(app);

    const response = await app.inject({
      method: "POST",
      url: "/signin",
      payload: {
        email: "INVITED@RYXEN.APP",
        password: "secret123",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe("invited@ryxen.app");

    const attachCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("WITH matched AS"),
    );
    expect(attachCall).toBeTruthy();
    expect(attachCall?.[1]).toEqual([33, "invited@ryxen.app"]);

    await app.close();
  });

  it("rate limits repeated sign-in attempts", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [],
    });

    vi.doMock("../../lib/db", () => ({
      pool: { query },
    }));
    vi.doMock("bcryptjs", () => ({
      default: {
        compare: vi.fn(async () => false),
        hash: vi.fn(async () => "hashed"),
      },
    }));
    vi.doMock("../../lib/auth", () => ({
      loadCurrentUser: vi.fn(),
      requireAuthenticatedUser: vi.fn(),
      signCompatibleToken: vi.fn(async () => "signed-token"),
      toPublicUser: vi.fn(),
    }));

    const { registerAuthRoutes } = await import("./routes");
    const app = Fastify();
    await registerAuthRoutes(app);

    let response = null;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await app.inject({
        method: "POST",
        url: "/signin",
        payload: {
          email: "athlete@ryxen.app",
          password: "wrong-password",
        },
      });
    }

    expect(response?.statusCode).toBe(429);
    expect(response?.json()).toEqual({
      error: "Muitas tentativas. Tente novamente em instantes.",
    });

    await app.close();
  });
});
