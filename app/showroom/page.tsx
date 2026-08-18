import { getActiveShowroom, safeBrandColor } from "@/lib/showroom";
import { getSettingValue } from "@/lib/app-settings";
import ShowroomKiosk from "./showroom-kiosk";

export const dynamic = "force-dynamic";

export default async function ShowroomPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token || "";
  const session = await getActiveShowroom(token);
  if (!session) return <div className="showroomInactive"><h1>This kiosk is not active.</h1><p>Please see a team member.</p></div>;
  const cadCost = (await getSettingValue("cad_cost_per_quote")) ?? 0;
  return (
    <ShowroomKiosk
      token={token}
      branding={{ companyName: session.company.name, logoUrl: session.company.logoUrl, primaryColor: safeBrandColor(session.company.primaryColor), aboutUs: session.company.aboutUs }}
      pricing={{ cadCost, customerMarginPct: session.company.customerMarginPct ?? 0, pricingTier: session.company.pricingTier }}
    />
  );
}
