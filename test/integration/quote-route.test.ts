import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { calculateQuote } from "@/lib/pricing";

const authMock = vi.hoisted(() => vi.fn<() => Promise<Session | null>>());
const cookiesMock = vi.hoisted(() => vi.fn(async () => ({
  get: vi.fn(() => undefined),
  set: vi.fn()
})));

vi.mock("@/auth", () => ({
  auth: authMock
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

import { POST as createQuote } from "@/app/api/quotes/route";

type CompanyFixture = {
  companyId: string;
  userId: string;
  email: string;
};

const createdCompanies: string[] = [];
const createdUsers: string[] = [];

function makeSlug(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

async function createCompanyFixture(
  overrides: Partial<{
    goldSpotPerOz: number;
    platinumSpotPerOz: number;
    silverSpotPerOz: number;
    cadCharge: number;
    centerSettingPerCarat: number;
    sideSettingPerStone: number;
    sellingMarginDivisor: number;
    finalMultiplier: number;
  }> = {}
): Promise<CompanyFixture> {
  const companyId = `company_${randomUUID().slice(0, 8)}`;
  const userId = `user_${randomUUID().slice(0, 8)}`;
  const email = `${userId}@example.test`;
  const slug = makeSlug("tenant");

  await prisma.company.create({
    data: {
      id: companyId,
      name: `Test Company ${slug}`,
      slug,
      quoteSequence: 0,
      pricingProfile: {
        create: {
          goldSpotPerOz: overrides.goldSpotPerOz ?? 4500,
          platinumSpotPerOz: overrides.platinumSpotPerOz ?? 2000,
          silverSpotPerOz: overrides.silverSpotPerOz ?? 100,
          cadCharge: overrides.cadCharge ?? 25,
          centerSettingPerCarat: overrides.centerSettingPerCarat ?? 15,
          sideSettingPerStone: overrides.sideSettingPerStone ?? 3,
          sellingMarginDivisor: overrides.sellingMarginDivisor ?? 0.7,
          finalMultiplier: overrides.finalMultiplier ?? 2
        }
      }
    }
  });

  await prisma.user.create({
    data: {
      id: userId,
      email,
      name: "Test Owner",
      passwordHash: "password-hash",
      emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z"),
      sessionVersion: 0,
      memberships: {
        create: {
          companyId,
          role: "OWNER"
        }
      }
    }
  });

  createdCompanies.push(companyId);
  createdUsers.push(userId);
  return { companyId, userId, email };
}

async function createAnalysis(companyId: string) {
  return prisma.aiAnalysis.create({
    data: {
      companyId,
      selectedMetal: "14K",
      status: "COMPLETED",
      reviewCount: 3,
      metalWeightGrams: 5,
      centerDiamondCarats: 1,
      sideDiamondCarats: 0.4,
      sideDiamondQuantity: 10,
      confidence: "high",
      notes: "Seed analysis for integration testing."
    }
  });
}

function mockSession(companyFixture: CompanyFixture, sessionVersion = 0): Session {
  return {
    user: {
      id: companyFixture.userId,
      name: "Test Owner",
      email: companyFixture.email,
      image: null,
      sessionVersion
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBeTruthy();
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

describe("quote route integration", () => {
  test("creates a quote with server-calculated pricing for the authenticated company", async () => {
    const company = await createCompanyFixture({
      goldSpotPerOz: 3000,
      cadCharge: 50,
      centerSettingPerCarat: 20,
      sideSettingPerStone: 4,
      sellingMarginDivisor: 0.5,
      finalMultiplier: 1.5
    });
    const analysis = await createAnalysis(company.companyId);
    authMock.mockResolvedValueOnce(mockSession(company));

    const payload = {
      analysisId: analysis.id,
      metalType: "14K",
      metalWeightGrams: 5,
      centerDiamondCarats: 1.2,
      sideDiamondCarats: 0.4,
      sideDiamondQuantity: 12
    } as const;

    const response = await createQuote(
      new Request("http://localhost/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      id: string;
      quoteNumber: string;
      estimatedPrice: number;
    };

    expect(result.quoteNumber).toBe("AQ-000001");

    const savedQuote = await prisma.quote.findUniqueOrThrow({
      where: { id: result.id }
    });

    const expected = calculateQuote(
      {
        metalType: payload.metalType,
        metalWeightGrams: payload.metalWeightGrams,
        centerDiamondCarats: payload.centerDiamondCarats,
        sideDiamondCarats: payload.sideDiamondCarats,
        sideDiamondQuantity: payload.sideDiamondQuantity
      },
      {
        goldSpotPerOz: 3000,
        platinumSpotPerOz: 2000,
        silverSpotPerOz: 100,
        cadCharge: 50,
        centerSettingPerCarat: 20,
        sideSettingPerStone: 4,
        sellingMarginDivisor: 0.5,
        finalMultiplier: 1.5
      }
    );

    expect(savedQuote.companyId).toBe(company.companyId);
    expect(Number(savedQuote.estimatedPrice)).toBe(expected.estimatedFinalPrice);
    expect(Number(savedQuote.metalWeightGrams)).toBe(payload.metalWeightGrams);
    expect(Number(savedQuote.centerDiamondCarats)).toBe(payload.centerDiamondCarats);
    expect(Number(savedQuote.sideDiamondCarats)).toBe(payload.sideDiamondCarats);
    expect(savedQuote.sideDiamondQuantity).toBe(payload.sideDiamondQuantity);
    expect(
      await prisma.company.findUniqueOrThrow({
        where: { id: company.companyId },
        select: { quoteSequence: true }
      })
    ).toEqual({ quoteSequence: 1 });
  });

  test("rejects cross-tenant analysis ids", async () => {
    const companyA = await createCompanyFixture();
    const companyB = await createCompanyFixture();
    const analysisB = await createAnalysis(companyB.companyId);
    authMock.mockResolvedValueOnce(mockSession(companyA));

    const response = await createQuote(
      new Request("http://localhost/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: analysisB.id,
          metalType: "14K",
          metalWeightGrams: 5,
          centerDiamondCarats: 1,
          sideDiamondCarats: 0.4,
          sideDiamondQuantity: 10
        })
      })
    );

    expect(response.status).toBe(404);
    expect(await prisma.quote.count({ where: { companyId: companyA.companyId } })).toBe(0);
  });
});
