import { randomUUID } from "node:crypto";
import { getActiveShowroom, safeBrandColor } from "@/lib/showroom";
import { getSettingValue } from "@/lib/app-settings";
import ShowroomKiosk from "./showroom-kiosk";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function resolveOrCreateShowroomSession(companyId: string) {
  let activeSession = await prisma.showroomSession.findFirst({
    where: { companyId, isActive: true },
    include: { company: true }
  });
  if (!activeSession) {
    const newToken = `sr_${companyId.slice(-8)}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    activeSession = await prisma.showroomSession.create({
      data: { companyId, token: newToken, isActive: true },
      include: { company: true }
    });
  }
  return activeSession;
}

export default async function ShowroomPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token || "";
  let session = token ? await getActiveShowroom(token) : null;

  if (!session) {
    // Fallback: If no token or invalid token, check if user is authenticated to a company
    const context = await getAuthenticatedCompanyContext().catch(() => null);
    if (context?.company) {
      session = await resolveOrCreateShowroomSession(context.company.id);
    }
  }

  if (!session) {
    return (
      <div className="showroomInactive">
        <h1>This kiosk is not active.</h1>
        <p>Please see a team member.</p>
      </div>
    );
  }

  const cadCost = (await getSettingValue("cad_cost_per_quote")) ?? 0;
  return (
    <ShowroomKiosk
      token={session.token}
      branding={{
        companyName: session.company.name,
        logoUrl: session.company.logoUrl,
        primaryColor: safeBrandColor(session.company.primaryColor),
        aboutUs: session.company.aboutUs
      }}
      pricing={{
        cadCost,
        customerMarginPct: session.company.customerMarginPct ?? 0,
        pricingTier: session.company.pricingTier
      }}
    />
  );
}
