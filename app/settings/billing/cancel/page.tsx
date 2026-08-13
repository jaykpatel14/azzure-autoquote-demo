import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageBilling, getAuthenticatedCompanyContext } from "@/lib/company";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

export default async function CancelSubscriptionPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const subscription = context.company.subscription;
  if (!subscription || subscription.status === "CANCELED") {
    redirect("/settings/billing");
  }

  if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
    redirect("/settings/billing");
  }

  return (
    <div className="onboardingShell">
      <main className="onboardingCard cancelFlow">
        <div className="onboardingHero">
          <p className="eyebrow">Billing</p>
          <h1 className="onboardingTitle">Cancel your subscription</h1>
          <p className="onboardingLead">
            Your plan will remain active until the current billing period ends. After that, quote creation
            and billing-managed features will stop until you choose a plan again.
          </p>
        </div>

        <section className="onboardingStep onboardingStep--highlight">
          <div className="onboardingStepHeader">
            <span className="onboardingStepNumber">1</span>
            <div>
              <p className="eyebrow">Current plan</p>
              <h2>{subscription.plan.name}</h2>
              <p className="muted">
                Status: {subscription.status.toLowerCase()}
                {subscription.cancelAtPeriodEnd ? " - cancel already scheduled" : ""}
              </p>
              <p className="muted small">
                Billing period ends on {subscription.currentPeriodEnd.toLocaleDateString()}.
              </p>
            </div>
          </div>
        </section>

        <section className="onboardingStep">
          <div className="onboardingStepHeader">
            <span className="onboardingStepNumber">2</span>
            <div>
              <p className="eyebrow">What happens next</p>
              <h2>Cancellation happens at the end of the period</h2>
              <p className="muted">
                We set Stripe to cancel at period end so you keep access until the paid time you have already
                covered expires. If you change your mind, you can reactivate from Stripe or ask support.
              </p>
            </div>
          </div>
          <div className="trialOverview">
            <div className="detailCard">
              <span>Access window</span>
              <strong>Until {subscription.currentPeriodEnd.toLocaleDateString()}</strong>
            </div>
            <div className="detailCard">
              <span>Plan fee</span>
              <strong>{formatCurrency(subscription.plan.monthlyPriceCents / 100)}</strong>
            </div>
            <div className="detailCard">
              <span>Billing state</span>
              <strong>{subscription.cancelAtPeriodEnd ? "Pending cancellation" : "Active"}</strong>
            </div>
          </div>
        </section>

        <section className="onboardingStep">
          <div className="onboardingStepHeader">
            <span className="onboardingStepNumber">3</span>
            <div>
              <p className="eyebrow">Confirm</p>
              <h2>Submit the cancellation request</h2>
              <p className="muted">
                We&apos;ll update Stripe immediately and record the change in the tenant audit log.
              </p>
            </div>
          </div>

          <form className="onboardingForm" action="/api/subscription/cancel" method="post">
            <input type="hidden" name="returnTo" value="/settings/billing?billing=canceled" />
            <label className="field">
              <span>Optional reason</span>
              <textarea
                name="reason"
                rows={4}
                placeholder="Tell us why you are cancelling, or leave this blank."
              />
            </label>
            <div className="onboardingStepActions">
              <button className="button destructive button--lg" type="submit">
                Cancel at period end
              </button>
              <Link className="button secondary button--lg" href="/settings/billing">
                Keep plan
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
