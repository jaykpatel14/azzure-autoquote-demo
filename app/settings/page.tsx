import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CompanySwitcher from "@/components/company-switcher";
import SignOutButton from "@/components/sign-out-button";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getCurrentUsagePeriod, getUsageRemaining, getUsageWarningMessage } from "@/lib/billing";
import { syncStripeCheckoutSession } from "@/lib/billing-webhooks";
import { hasMinimumRole } from "@/lib/tenant";

type SettingsPageProps = {
  searchParams?: Promise<{
    billing?: string;
    session_id?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (!hasMinimumRole(context.membership.role, "ADMIN")) {
    redirect("/");
  }

  if (params?.billing === "success" && params.session_id) {
    await syncStripeCheckoutSession(params.session_id, {
      expectedCompanyId: context.company.id
    });
    redirect("/settings");
  }

  const [usagePeriod, billingPlans] = await Promise.all([
    getCurrentUsagePeriod(context.company.id),
    prisma.plan.findMany({
      where: { code: { in: ["professional", "enterprise"] } },
      orderBy: { monthlyPriceCents: "asc" }
    })
  ]);

  const subscription = context.company.subscription;
  const warning = usagePeriod ? getUsageWarningMessage(usagePeriod) : null;
  const remaining = usagePeriod ? getUsageRemaining(usagePeriod) : null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Azzure AutoQuote</div>
        <Link className="navItem" href="/">New Estimate</Link>
        <Link className="navItem" href="/settings">Settings</Link>
        <CompanySwitcher />
        <SignOutButton />
      </aside>
      <main className="main">
        <h1 className="heading">Company Settings</h1>
        <section className="card">
          <h2>MVP Settings</h2>
          <p className="muted">
            The database already contains a company pricing profile. Billing is now controlled
            from Stripe, and the app uses the database subscription state for enforcement.
          </p>
        </section>

        <section className="card">
          <h2>Billing</h2>
          {subscription ? (
            <div className="stack">
              <p className="muted">
                Current plan: <strong>{subscription.plan.name}</strong>
              </p>
              <p className="muted">
                Status: <strong>{subscription.status.toLowerCase()}</strong>
              </p>
              <p className="muted">
                Billing period:{" "}
                <strong>
                  {subscription.currentPeriodStart.toLocaleDateString()} to{" "}
                  {subscription.currentPeriodEnd.toLocaleDateString()}
                </strong>
              </p>
              <p className="muted">
                Monthly limit: <strong>{subscription.plan.monthlyLimit}</strong> estimates
              </p>
              {usagePeriod ? (
                <div className="status">
                  {remaining !== null ? (
                    <p className="muted">
                      Usage: {usagePeriod.used} used, {usagePeriod.reserved} reserved, {remaining} remaining
                    </p>
                  ) : null}
                  {warning ? <p className="muted">{warning}</p> : null}
                </div>
              ) : (
                <p className="muted">
                  No active usage period is open right now. Billing sync should create one at the
                  start of the current subscription cycle.
                </p>
              )}
              <form action="/api/billing/portal" method="post">
                <button className="button" type="submit" disabled={!subscription.stripeCustomerId}>
                  Manage billing in Stripe
                </button>
              </form>
              {!subscription.stripeCustomerId ? (
                <p className="muted">
                  The billing portal becomes available after the first Stripe checkout session.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="muted">This company does not have a subscription record yet.</p>
          )}
        </section>

        <section className="card">
          <h2>Plans</h2>
          <div className="stack">
            {billingPlans.map((plan) => (
              <form key={plan.id} action="/api/billing/checkout" method="post" className="status">
                <p className="muted">
                  <strong>{plan.name}</strong> - ${(plan.monthlyPriceCents / 100).toFixed(2)}/month for {plan.monthlyLimit} estimates
                  {plan.isConfigurable ? " - configurable" : ""}
                </p>
                <input type="hidden" name="planCode" value={plan.code} />
                <button className="button primary" type="submit" disabled={!plan.stripePriceId}>
                  {subscription?.plan.code === plan.code ? "Manage / switch" : `Choose ${plan.name}`}
                </button>
                {!plan.stripePriceId ? (
                  <p className="muted">Stripe price id not configured for this plan yet.</p>
                ) : null}
              </form>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
