import Link from "next/link";
import { redirect } from "next/navigation";
import TrialBanner from "@/components/trial-banner";
import SettingsTabs from "@/components/settings-tabs";
import TrialSidebarStatus from "@/components/trial-sidebar-status";
import UpgradeModal from "@/components/upgrade-modal";
import WorkspaceShell from "@/components/workspace-shell";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { canManageBilling, getAuthenticatedCompanyContext } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { ensureBasePlans } from "@/lib/plan-bootstrap";
import { getCurrentUsagePeriod, getUsageRemaining, getUsageWarningMessage } from "@/lib/billing";
import { syncStripeCheckoutSession } from "@/lib/billing-webhooks";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getBillingHistory } from "@/src/services/subscriptions";

type BillingSettingsPageProps = {
  searchParams?: Promise<{
    billing?: string;
    session_id?: string;
    upgrade?: string;
    error?: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatPlanPrice(monthlyPriceCents: number) {
  return formatCurrency(monthlyPriceCents / 100);
}

export default async function BillingSettingsPage({ searchParams }: BillingSettingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (params?.billing === "success" && params.session_id) {
    await syncStripeCheckoutSession(params.session_id, {
      expectedCompanyId: context.company.id
    });
    redirect("/settings/billing");
  }

  const usagePeriod = await getCurrentUsagePeriod(context.company.id);
  const subscription = context.company.subscription;
  const billingHistoryResult = await getBillingHistory({ companyId: context.company.id });
  const basePlans = await ensureBasePlans(prisma);
  const availablePlans = Object.values(basePlans).sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents);
  const warning = usagePeriod ? getUsageWarningMessage(usagePeriod) : null;
  const remaining = usagePeriod ? getUsageRemaining(usagePeriod) : null;
  const billingAccess = canManageBilling(context.membership?.role ?? "CUSTOMER");
  const canRequestSubscription = !subscription || subscription.status !== "ACTIVE";
  const effectiveMonthlyLimit =
    subscription?.status === "TRIALING"
      ? subscription.trialQuoteCap
      : subscription?.plan.monthlyLimit ?? basePlans.starter.monthlyLimit;
  const trialDaysRemaining = getTrialDaysRemaining(subscription);
  const trialQuotesRemaining = getTrialQuotesRemaining(subscription);
  const onboardingComplete = subscription?.onboardingComplete ?? true;
  const showUpgradeModal = params?.upgrade === "1" && billingAccess && Boolean(subscription);
  const subscriptionRequestTitle = subscription ? "Choose a subscription" : "Request a subscription";
  const subscriptionRequestDescription = subscription
    ? `Trial accounts are capped at ${effectiveMonthlyLimit} requests. Pick a paid plan to upgrade.`
    : "Choose a plan to create your billing record and start Stripe checkout.";
  const planActionLabel = subscription ? "Choose" : "Request";
  const billingInvoices = "data" in billingHistoryResult ? billingHistoryResult.data.invoices : [];

  return (
    <WorkspaceShell
      title="Subscription billing"
      description="Review your subscription, usage, and billing history."
      navItems={getWorkspaceNav("/settings/billing")}
      banner={
        subscription?.status === "TRIALING" &&
        trialDaysRemaining !== null &&
        trialQuotesRemaining !== null ? (
          <TrialBanner
            companyId={context.company.id}
            daysRemaining={trialDaysRemaining}
            quoteCap={subscription.trialQuoteCap}
            quotesRemaining={trialQuotesRemaining}
          />
        ) : null
      }
      sidebarExtra={
        subscription?.status === "TRIALING" &&
        trialDaysRemaining !== null &&
        trialQuotesRemaining !== null ? (
          <TrialSidebarStatus
            daysRemaining={trialDaysRemaining}
            quoteCap={subscription.trialQuoteCap}
            quotesRemaining={trialQuotesRemaining}
            urgent={trialDaysRemaining <= 3}
          />
        ) : null
      }
      actions={
        <div className="heroActions">
          <Link className="button secondary" href="/quotes/new">
            New estimate
          </Link>
          <Link className="button secondary" href="/quotes">
            Quote history
          </Link>
        </div>
      }
    >
      <SettingsTabs activeHref="/settings/billing" />

      {params?.error ? (
        <div className="errorBanner" style={{ marginBottom: "1rem" }}>
          {params.error}
        </div>
      ) : null}

      {params?.billing === "updated" ? (
        <div className="successBanner" style={{ marginBottom: "1rem" }}>
          Your plan has been updated successfully.
        </div>
      ) : null}

      {params?.billing === "canceled" ? (
        <div className="warningBanner" style={{ marginBottom: "1rem" }}>
          Your subscription cancellation request has been recorded and will take effect at the end of the billing cycle.
        </div>
      ) : null}

      {!onboardingComplete ? (
        <section className="card accentCard onboardingReminder">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Finish setup</p>
              <h2>Complete your onboarding to unlock the rest of the workspace</h2>
              <p className="muted">
                You can review billing now, but quote creation and the workspace homepage stay locked until you
                finish the guided setup.
              </p>
            </div>
            <Link className="button primary" href="/onboarding">
              Continue onboarding
            </Link>
          </div>
        </section>
      ) : null}

      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Usage window</span>
          <strong>{remaining ?? "No usage period"}</strong>
          <p className="muted small">
            {usagePeriod ? `${usagePeriod.used} used, ${usagePeriod.reserved} reserved` : "No active usage period"}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Subscription</span>
          <strong>{subscription?.status.toLowerCase() ?? "inactive"}</strong>
          <p className="muted small">{subscription?.plan.name ?? "No active plan"}</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Account review</span>
          <strong>{context.company.accountStatus.toLowerCase().replaceAll("_", " ")}</strong>
          <p className="muted small">Managed by Azzure</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Company access</span>
          <strong>
            {context.memberships.length} customer account{context.memberships.length === 1 ? "" : "s"}
          </strong>
          <p className="muted small">All company users have the same customer permissions.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Subscription billing</h2>
              <p className="muted">Customers can review their plan, billing status, and usage here.</p>
            </div>
          </div>
          {subscription ? (
            <div className="stack">
              <div className="detailRow">
                <span>Current plan</span>
                <strong>{subscription.plan.name}</strong>
              </div>
              <div className="detailRow">
                <span>Status</span>
                <strong>{subscription.status.toLowerCase()}</strong>
              </div>
              {subscription.status === "PAST_DUE" ? (
                <div className="warningBanner">
                  Your last payment failed. Update your payment method to avoid losing access.
                </div>
              ) : null}
              <div className="detailRow">
                <span>Trial / cancellation</span>
                <strong>
                  {subscription.status === "TRIALING"
                    ? `${trialDaysRemaining ?? 0} days left`
                    : subscription.cancelAtPeriodEnd
                      ? "Cancels at period end"
                      : "Active"}
                </strong>
              </div>
              <div className="detailRow">
                <span>Billing period</span>
                <strong>
                  {subscription.currentPeriodStart.toLocaleDateString()} to{" "}
                  {subscription.currentPeriodEnd.toLocaleDateString()}
                </strong>
              </div>
              <div className="detailRow">
                <span>Monthly limit</span>
                <strong>{subscription.plan.monthlyLimit}</strong>
              </div>
              {usagePeriod ? (
                <div className="usageMeter" aria-label="Usage meter">
                  <div className="usageMeterTrack">
                    <div
                      className="usageMeterFill"
                      style={{
                        width: `${Math.min(100, ((usagePeriod.used + usagePeriod.reserved) / usagePeriod.limit) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="muted small">
                    {usagePeriod.used} used, {usagePeriod.reserved} reserved, {remaining} remaining
                  </p>
                  {warning ? <p className="warningBanner">{warning}</p> : null}
                </div>
              ) : (
                <div className="emptyState">
                  <strong>No active usage period</strong>
                  <p className="muted">
                    Billing sync should create one at the start of the current subscription cycle.
                  </p>
                </div>
              )}
              {billingAccess ? (
                <>
                  <div className="buttonRow">
                    <Link className="button secondary" href="/settings/billing?upgrade=1">
                      Change plan
                    </Link>
                    <Link className="button secondary" href="/settings/billing/cancel">
                      Cancel plan
                    </Link>
                    <form action="/api/billing/portal" method="post">
                      <button className="button primary" type="submit" disabled={!subscription.stripeCustomerId}>
                        Manage billing in Stripe
                      </button>
                    </form>
                  </div>
                  {!subscription.stripeCustomerId ? (
                    <p className="muted small">
                      The billing portal becomes available after the first Stripe checkout session.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="muted small">
                  Billing changes are restricted to billing managers. You can still review usage.
                </p>
              )}
            </div>
          ) : (
            <div className="emptyState">
              <strong>No subscription record yet</strong>
              <p className="muted">Choose a plan to activate billing and usage enforcement.</p>
            </div>
          )}
          {canRequestSubscription && billingAccess ? (
            <div className="stack">
              <div className="sectionHeader" style={{ marginTop: "1rem" }}>
                <div>
                  <h3>{subscriptionRequestTitle}</h3>
                  <p className="muted">{subscriptionRequestDescription}</p>
                </div>
              </div>
              {availablePlans.length > 0 ? (
                <div className="pricingGrid">
                  {availablePlans.map((plan) => (
                    <form key={plan.id} action="/api/billing/checkout" method="post" className="detailCard">
                      <input type="hidden" name="planCode" value={plan.code} />
                      <span>{plan.name}</span>
                      <strong>{formatPlanPrice(plan.monthlyPriceCents)} / month</strong>
                      <p className="muted small">{plan.monthlyLimit} requests per billing period.</p>
                      <button className="button primary" type="submit">
                        {planActionLabel} {plan.name}
                      </button>
                    </form>
                  ))}
                </div>
              ) : (
                <div className="emptyState">
                  <strong>No subscription plans available</strong>
                  <p className="muted">
                    No Stripe-enabled plans are configured yet. Please contact support.
                  </p>
                </div>
              )}
            </div>
          ) : canRequestSubscription ? (
            <div className="emptyState">
              <strong>Billing access restricted</strong>
              <p className="muted">A billing manager needs to choose or upgrade the subscription plan.</p>
            </div>
          ) : null}
        </article>

        <article className="card accentCard">
          <div className="sectionHeader">
            <div>
              <h2>Automatic quote pricing</h2>
              <p className="muted">Azzure manages the internal pricing inputs. Your workspace shows only approved selling prices.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Billing history</h2>
            <p className="muted">Recent Stripe invoices for this company.</p>
          </div>
        </div>
        {billingInvoices.length > 0 ? (
          <div className="historyList">
            {billingInvoices.map((invoice) => (
              <div key={invoice.id} className="historyRow historyRow--invoice">
                <div>
                  <strong>
                    {invoice.number ? `Invoice ${invoice.number}` : "Invoice"} · {invoice.planName ?? "Subscription"}
                  </strong>
                  <p className="muted small">
                    {invoice.createdAt.toLocaleDateString()} · {invoice.status}
                  </p>
                </div>
                <div className="historyRowActions">
                  <strong>{formatCurrency(invoice.amountPaid)}</strong>
                  {invoice.hostedInvoiceUrl ? (
                    <a className="textLink" href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                      Receipt
                    </a>
                  ) : invoice.invoicePdf ? (
                    <a className="textLink" href={invoice.invoicePdf} target="_blank" rel="noreferrer">
                      Receipt
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <strong>No billing history yet</strong>
            <p className="muted">Stripe invoices will appear here after the first billing cycle closes.</p>
          </div>
        )}
      </section>

      {showUpgradeModal && subscription ? (
        <UpgradeModal
          currentPlanCode={subscription.plan.code}
          currentPlanName={subscription.plan.name}
          currentPeriodEnd={subscription.currentPeriodEnd.toLocaleDateString()}
          plans={availablePlans.map((plan) => ({
            code: plan.code,
            name: plan.name,
            price: formatPlanPrice(plan.monthlyPriceCents),
            monthlyLimit: plan.monthlyLimit
          }))}
        />
      ) : null}
    </WorkspaceShell>
  );
}
