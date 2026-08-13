import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { Session } from "next-auth";
import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const authMock = vi.hoisted(() => vi.fn<() => Promise<Session | null>>());
const cookiesMock = vi.hoisted(() => vi.fn(async () => ({
  get: vi.fn(() => undefined),
  set: vi.fn()
})));
const providerFactoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("@/lib/ai/provider-factory", () => ({
  getJewelryAnalysisProvider: providerFactoryMock
}));

import { POST as analyzeImage } from "@/app/api/analyze/route";

type CompanyFixture = {
  companyId: string;
  userId: string;
  email: string;
};

const createdCompanies: string[] = [];
const createdUsers: string[] = [];

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

async function createCompanyFixture(
  subscriptionStatus: SubscriptionStatus = "TRIALING",
  usageLimit = 10,
  role: "CUSTOMER" | "OWNER" | "ADMIN" | "ESTIMATOR" | "VIEWER" = "CUSTOMER"
): Promise<CompanyFixture> {
  const companyId = `company_${randomUUID().slice(0, 8)}`;
  const userId = `user_${randomUUID().slice(0, 8)}`;
  const email = `${userId}@example.test`;
  const slug = `analysis-${randomUUID().slice(0, 8)}`;
  const { start, end } = currentMonthRange();
  const starterPlan = await prisma.plan.findUniqueOrThrow({
    where: { code: "starter" }
  });

  await prisma.company.create({
    data: {
      id: companyId,
      name: `Analysis Company ${slug}`,
      slug,
      quoteSequence: 0,
      pricingProfile: { create: {} }
    }
  });

  await prisma.user.create({
    data: {
      id: userId,
      email,
      name: "Analysis Owner",
      passwordHash: "password-hash",
      emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z"),
      sessionVersion: 0,
      memberships: {
        create: {
          companyId,
          role
        }
      }
    }
  });

  await prisma.usagePeriod.create({
    data: {
      companyId,
      periodStart: start,
      periodEnd: end,
      limit: usageLimit
    }
  });

  await prisma.subscription.create({
    data: {
      companyId,
      planId: starterPlan.id,
      status: subscriptionStatus,
      currentPeriodStart: start,
      currentPeriodEnd: end
    }
  });

  createdCompanies.push(companyId);
  createdUsers.push(userId);
  return { companyId, userId, email };
}

function mockSession(companyFixture: CompanyFixture, sessionVersion = 0): Session {
  return {
    user: {
      id: companyFixture.userId,
      name: "Analysis Owner",
      email: companyFixture.email,
      image: null,
      sessionVersion
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };
}

function buildImage() {
  return new File([Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06])], "ring.jpg", {
    type: "image/jpeg"
  });
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBeTruthy();
});

beforeEach(() => {
  authMock.mockReset();
  providerFactoryMock.mockReset();
  cookiesMock.mockReset();
  cookiesMock.mockResolvedValue({
    get: vi.fn(() => undefined),
    set: vi.fn()
  });
});

afterAll(async () => {
  await prisma.company.deleteMany({
    where: {
      id: { in: createdCompanies }
    }
  });

  await prisma.user.deleteMany({
    where: {
      id: { in: createdUsers }
    }
  });

  await prisma.$disconnect();
});

describe("analysis route integration", () => {
  test("runs moderation and three review calls with transient retry handling", async () => {
    const company = await createCompanyFixture();
    authMock.mockResolvedValue(mockSession(company));

    const analyzeCalls = new Map<number, number>();
    const provider = {
      name: "mock-openai",
      model: "mock-model",
      modelVersion: "mock-model-version",
      promptVersion: "mock-prompt-v1",
      moderateImage: vi.fn().mockResolvedValue({
        model: "omni-moderation-latest",
        flagged: false,
        rawResponse: { flagged: false }
      }),
      analyzeImage: vi.fn(async ({ attemptNumber }: { attemptNumber: number }) => {
        const callCount = (analyzeCalls.get(attemptNumber) ?? 0) + 1;
        analyzeCalls.set(attemptNumber, callCount);

        if (attemptNumber === 2 && callCount === 1) {
          const transient = Object.assign(new Error("temporary upstream error"), {
            status: 503,
            code: "server_error"
          });
          throw transient;
        }

        const outputs = {
          1: {
            jewelry_type: "ring",
            selected_metal: "14K",
            metal_weight_grams: 5.0,
            center_diamond_weight_ct: 1.0,
            side_diamond_total_weight_ct: 0.4,
            side_diamond_quantity: 10,
            center_shape: "round",
            confidence: "low",
            assumptions: ["Visible prongs may affect weight."]
          },
          2: {
            jewelry_type: "ring",
            selected_metal: "14K",
            metal_weight_grams: 6.0,
            center_diamond_weight_ct: 1.2,
            side_diamond_total_weight_ct: 0.5,
            side_diamond_quantity: 12,
            center_shape: "round",
            confidence: "medium",
            assumptions: ["Hidden gallery is estimated."]
          },
          3: {
            jewelry_type: "ring",
            selected_metal: "14K",
            metal_weight_grams: 7.0,
            center_diamond_weight_ct: 1.4,
            side_diamond_total_weight_ct: 0.6,
            side_diamond_quantity: 14,
            center_shape: "round",
            confidence: "high",
            assumptions: ["Pavé density may vary."]
          }
        } as const;

        const output = outputs[attemptNumber as 1 | 2 | 3];
        return {
          responseId: `resp_${attemptNumber}_${callCount}`,
          output,
          latencyMs: 15,
          retryCount: 0,
          usage: {
            inputTokens: 100 + attemptNumber,
            outputTokens: 20 + attemptNumber,
            totalTokens: 120 + attemptNumber
          },
          rawResponse: { id: `resp_${attemptNumber}_${callCount}` }
        };
      })
    };
    providerFactoryMock.mockReturnValue(provider);

    const response = await analyzeImage(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.append("image", buildImage());
          form.append("metalType", "14K");
          return form;
        })()
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      analysisId: string;
      jewelryType: string;
      selectedMetal: string;
      metalWeightGrams: number;
      centerDiamondCarats: number;
      sideDiamondCarats: number;
      sideDiamondQuantity: number;
      centerShape?: string;
      confidence: string;
      assumptions: string[];
      notes: string;
    };

    expect(payload.jewelryType).toBe("ring");
    expect(payload.selectedMetal).toBe("14K");
    expect(payload.metalWeightGrams).toBe(6);
    expect(payload.centerDiamondCarats).toBe(1.2);
    expect(payload.sideDiamondCarats).toBe(0.5);
    expect(payload.sideDiamondQuantity).toBe(12);
    expect(payload.centerShape).toBe("round");
    expect(payload.confidence).toBe("medium");
    expect(payload.assumptions).toHaveLength(3);
    expect(payload.notes).toContain("Assumptions");

    const analysis = await prisma.aiAnalysis.findUniqueOrThrow({
      where: { id: payload.analysisId }
    });

    const attempts = await prisma.aiAttempt.findMany({
      where: { analysisId: payload.analysisId },
      orderBy: { attemptNumber: "asc" }
    });
    const usage = await prisma.usagePeriod.findFirstOrThrow({
      where: { companyId: company.companyId }
    });

    expect(analysis.status).toBe("COMPLETED");
    expect(analysis.provider).toBe("mock-openai");
    expect(analysis.modelVersion).toBe("mock-model-version");
    expect(analysis.promptVersion).toBe("mock-prompt-v1");
    expect(analysis.moderationFlagged).toBe(false);
    expect(Number(analysis.metalWeightGrams)).toBe(6);
    expect(Number(analysis.centerDiamondCarats)).toBe(1.2);
    expect(Number(analysis.sideDiamondCarats)).toBe(0.5);
    expect(analysis.jewelryType).toBe("ring");

    expect(attempts).toHaveLength(3);
    expect(attempts[1].retryCount).toBe(1);
    expect(attempts[1].responseId).toContain("resp_2");
    expect(attempts[1].promptTokens).toBe(102);
    expect(attempts[1].completionTokens).toBe(22);
    expect(attempts[1].totalTokens).toBe(122);

    expect(usage.used).toBe(1);
    expect(usage.reserved).toBe(0);
    expect(provider.moderateImage).toHaveBeenCalledTimes(1);
    expect(provider.analyzeImage).toHaveBeenCalledTimes(4);
  });

  test("rejects moderated images before review calls run", async () => {
    const company = await createCompanyFixture();
    authMock.mockResolvedValue(mockSession(company));

    const provider = {
      name: "mock-openai",
      model: "mock-model",
      modelVersion: "mock-model-version",
      promptVersion: "mock-prompt-v1",
      moderateImage: vi.fn().mockResolvedValue({
        model: "omni-moderation-latest",
        flagged: true,
        rawResponse: { flagged: true }
      }),
      analyzeImage: vi.fn()
    };
    providerFactoryMock.mockReturnValue(provider);

    const response = await analyzeImage(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.append("image", buildImage());
          form.append("metalType", "14K");
          return form;
        })()
      })
    );

    expect(response.status).toBe(422);
    expect(provider.analyzeImage).not.toHaveBeenCalled();

    const analysis = await prisma.aiAnalysis.findFirst({
      where: { companyId: company.companyId },
      orderBy: { createdAt: "desc" }
    });
    const usage = await prisma.usagePeriod.findFirstOrThrow({
      where: { companyId: company.companyId }
    });

    expect(analysis?.status).toBe("FAILED");
    expect(usage.used).toBe(0);
    expect(usage.reserved).toBe(0);
  });

  test.each(["PAST_DUE", "CANCELED"] as const)(
    "rejects %s subscriptions before usage is reserved",
    async (status) => {
      const company = await createCompanyFixture(status);
      authMock.mockResolvedValue(mockSession(company));

      const provider = {
        name: "mock-openai",
        model: "mock-model",
        modelVersion: "mock-model-version",
        promptVersion: "mock-prompt-v1",
        moderateImage: vi.fn(),
        analyzeImage: vi.fn()
      };
      providerFactoryMock.mockReturnValue(provider);

      const response = await analyzeImage(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          body: (() => {
            const form = new FormData();
            form.append("image", buildImage());
            form.append("metalType", "14K");
            return form;
          })()
        })
      );

      expect(response.status).toBe(402);
      expect(provider.moderateImage).not.toHaveBeenCalled();
      expect(provider.analyzeImage).not.toHaveBeenCalled();

      const usage = await prisma.usagePeriod.findFirstOrThrow({
        where: { companyId: company.companyId }
      });

      expect(usage.used).toBe(0);
      expect(usage.reserved).toBe(0);
    }
  );

  test("keeps the final quota unit safe under concurrent requests", async () => {
    const company = await createCompanyFixture("ACTIVE", 1);
    authMock.mockResolvedValue(mockSession(company));

    const provider = {
      name: "mock-openai",
      model: "mock-model",
      modelVersion: "mock-model-version",
      promptVersion: "mock-prompt-v1",
      moderateImage: vi.fn().mockResolvedValue({
        model: "omni-moderation-latest",
        flagged: false,
        rawResponse: { flagged: false }
      }),
      analyzeImage: vi.fn(async ({ attemptNumber }: { attemptNumber: number }) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          responseId: `resp-${attemptNumber}`,
          output: {
            jewelry_type: "ring",
            selected_metal: "14K",
            metal_weight_grams: 5,
            center_diamond_weight_ct: 1,
            side_diamond_total_weight_ct: 0.4,
            side_diamond_quantity: 10,
            center_shape: "round",
            confidence: "high",
            assumptions: ["Concurrent reservation test."]
          },
          latencyMs: 50,
          retryCount: 0,
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120
          },
          rawResponse: { id: `resp-${attemptNumber}` }
        };
      })
    };
    providerFactoryMock.mockReturnValue(provider);

    const buildRequest = () =>
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.append("image", buildImage());
          form.append("metalType", "14K");
          return form;
        })()
      });

    const [firstResponse, secondResponse] = await Promise.all([
      analyzeImage(buildRequest()),
      analyzeImage(buildRequest())
    ]);

    const statuses = [firstResponse.status, secondResponse.status].sort();
    expect(statuses).toEqual([200, 429]);
    expect(provider.analyzeImage).toHaveBeenCalledTimes(3);

    const usage = await prisma.usagePeriod.findFirstOrThrow({
      where: { companyId: company.companyId }
    });
    expect(usage.used).toBe(1);
    expect(usage.reserved).toBe(0);
  });

  test("rejects viewer roles before reservation and analysis starts", async () => {
    const company = await createCompanyFixture("ACTIVE", 10, "VIEWER");
    authMock.mockResolvedValue(mockSession(company));

    const provider = {
      name: "mock-openai",
      model: "mock-model",
      modelVersion: "mock-model-version",
      promptVersion: "mock-prompt-v1",
      moderateImage: vi.fn(),
      analyzeImage: vi.fn()
    };
    providerFactoryMock.mockReturnValue(provider);

    const response = await analyzeImage(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.append("image", buildImage());
          form.append("metalType", "14K");
          return form;
        })()
      })
    );

    expect(response.status).toBe(403);
    expect(provider.moderateImage).not.toHaveBeenCalled();
    expect(provider.analyzeImage).not.toHaveBeenCalled();

    const usage = await prisma.usagePeriod.findFirstOrThrow({
      where: { companyId: company.companyId }
    });

    expect(usage.used).toBe(0);
    expect(usage.reserved).toBe(0);
  });

  test("releases usage when analysis fails after reservation", async () => {
    const company = await createCompanyFixture("ACTIVE", 10);
    authMock.mockResolvedValue(mockSession(company));

    const provider = {
      name: "mock-openai",
      model: "mock-model",
      modelVersion: "mock-model-version",
      promptVersion: "mock-prompt-v1",
      moderateImage: vi.fn().mockResolvedValue({
        model: "omni-moderation-latest",
        flagged: false,
        rawResponse: { flagged: false }
      }),
      analyzeImage: vi.fn().mockRejectedValue(new Error("upstream failure"))
    };
    providerFactoryMock.mockReturnValue(provider);

    const response = await analyzeImage(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.append("image", buildImage());
          form.append("metalType", "14K");
          return form;
        })()
      })
    );

    expect(response.status).toBe(502);
    expect(provider.moderateImage).toHaveBeenCalledTimes(1);
    expect(provider.analyzeImage).toHaveBeenCalledTimes(1);

    const analysis = await prisma.aiAnalysis.findFirstOrThrow({
      where: { companyId: company.companyId },
      orderBy: { createdAt: "desc" }
    });
    const usage = await prisma.usagePeriod.findFirstOrThrow({
      where: { companyId: company.companyId }
    });

    expect(analysis.status).toBe("FAILED");
    expect(usage.used).toBe(0);
    expect(usage.reserved).toBe(0);
  });
});
