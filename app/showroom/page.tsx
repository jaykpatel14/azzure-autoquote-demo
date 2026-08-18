import { getActiveShowroom, safeBrandColor } from "@/lib/showroom";
import { getSettingValue } from "@/lib/app-settings";
import ShowroomKiosk from "./showroom-kiosk";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ShowroomPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token || "";
  let session = token ? await getActiveShowroom(token) : null;

  if (!session) {
    // Fallback: If no token or invalid token, check if user is authenticated to a company
    const context = await getAuthenticatedCompanyContext().catch(() => null);
    if (context?.company) {
      let activeSession = await prisma.showroomSession.findFirst({
        where: { companyId: context.company.id, isActive: true },
        include: { company: true }
      });
      if (!activeSession) {
        // Auto-create an active session for the authenticated company
        const newToken = `sr_${context.company.id.slice(-8)}_${Math.random().toString(36).slice(2, 10)}`;
        activeSession = await prisma.showroomSession.create({
          data: { companyId: context.company.id, token: newToken, isActive: true },
          include: { company: true }
        });
      }
      session = activeSession;
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
