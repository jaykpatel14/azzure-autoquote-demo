import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getActiveShowroom, safeBrandColor } from "@/lib/showroom";
import { getSettingValue } from "@/lib/app-settings";
import ShowroomKiosk from "./showroom-kiosk";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";

export const dynamic = "force-dynamic";

async function resolveOrCreateShowroomSession(companyId: string) {
  let activeSession = await prisma.showroomSession.findFirst({
    where: { companyId, isActive: true },
    include: {
      company: {
        include: {
          subscription: {
            include: { plan: true }
          }
        }
      }
    }
  });
  if (!activeSession) {
    const newToken = `sr_${companyId.slice(-8)}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    activeSession = await prisma.showroomSession.create({
      data: { companyId, token: newToken, isActive: true },
      include: {
        company: {
          include: {
            subscription: {
              include: { plan: true }
            }
          }
        }
      }
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
      <div className="showroomInactive" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0e12", color: "#f3f4f6" }}>
        <div style={{ textAlign: "center", maxWidth: 460, padding: 32 }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Kiosk Inactive</h1>
          <p style={{ color: "#9ca3af", marginBottom: 24 }}>This showroom tablet session is not active. Please sign in to activate your showroom kiosk.</p>
          <Link href="/signin" className="button primary">Sign In to Activate</Link>
        </div>
      </div>
    );
  }

  // Enforce Ultra Plan requirement for Showroom Mode
  const subscription = session.company.subscription;
  const planId = subscription ? resolvePlanId(subscription.plan, subscription.status) : "plan_starter";
  const features = getFeaturesForPlan(planId);

  if (!features.canUseShowroomMode) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at top, #1e1b2e 0%, #0a0a0f 100%)", color: "#f3f4f6", padding: 24 }}>
        <div style={{ maxWidth: 540, background: "rgba(255, 255, 255, 0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(201, 168, 76, 0.3)", borderRadius: 20, padding: 40, textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
          <span style={{ display: "inline-block", background: "linear-gradient(135deg, #c9a84c, #e2c974)", color: "#111", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 999, marginBottom: 16 }}>
            Enterprise Plan Feature
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 14, color: "#fff", letterSpacing: "-0.02em" }}>
            Unlock In-Store Tablet Kiosk Mode
          </h1>
          <p style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
            Turn this tablet into an interactive, customer-facing showroom kiosk with your bespoke branding, photo upload, and instant estimate generation.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/settings/billing?upgrade=enterprise" style={{ background: "linear-gradient(135deg, #c9a84c, #dfc674)", color: "#000", fontWeight: 600, padding: "12px 24px", borderRadius: 10, textDecoration: "none" }}>
              Upgrade to Enterprise
            </Link>
            <Link href="/quotes/new" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 500, padding: "12px 24px", borderRadius: 10, textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" }}>
              Back to Dashboard
            </Link>
          </div>
        </div>
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
        backgroundColor: safeBrandColor(session.company.showroomBackgroundColor),
        backgroundMediaUrl: session.company.showroomBackgroundMediaKey ? `/api/showroom/background?token=${encodeURIComponent(session.token)}` : null,
        backgroundMediaType: session.company.showroomBackgroundMediaType,
        overlayColor: session.company.showroomOverlayColor,
        overlayOpacity: session.company.showroomOverlayOpacity,
        textColor: session.company.showroomTextColor,
        backgroundFit: session.company.showroomBackgroundFit,
        backgroundPosition: session.company.showroomBackgroundPosition,
        panelOpacity: session.company.showroomPanelOpacity,
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
