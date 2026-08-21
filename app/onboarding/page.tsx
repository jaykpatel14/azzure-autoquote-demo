import Link from "next/link";
import { redirect } from "next/navigation";
import { syncStripeCheckoutSession } from "@/lib/billing-webhooks";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { getAuthenticatedCompanyContext } from "@/lib/company";

type OnboardingPageProps = {
  searchParams?: Promise<{
    session_id?: string;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined;

  if (params?.session_id) {
    await syncStripeCheckoutSession(params.session_id);
  }

  const context = await getAuthenticatedCompanyContext();
  if (context?.company.subscription?.onboardingComplete) {
    redirect("/");
  }

  if (!context) {
    return (
      <main className="publicQuoteShell onboardingPublicShell">
        <article className="publicQuoteCard card onboardingPublicCard">
          <header className="publicQuoteHeader">
            <p className="publicQuoteTitle">Welcome to Azzure AI Quote</p>
            <p className="publicQuoteBlurb">
              Your 14-day free trial has started. Sign in to finish the guided setup and move into your workspace.
            </p>
          </header>

          <section className="publicQuoteBody">
            <div className="emptyState">
              <strong>Trial confirmed</strong>
              <p className="muted">
                We have your checkout record. Sign in with the same account you created during signup to continue.
              </p>
            </div>

            <div className="publicQuoteActions">
              <Link className="button primary publicQuoteButton" href="/signin?next=/onboarding">
                Sign in to continue
              </Link>
              <Link className="button secondary publicQuoteButton" href="/pricing">
                Review pricing
              </Link>
            </div>
          </section>
        </article>
      </main>
    );
  }

  const subscription = context.company.subscription;
  const trialDaysRemaining = getTrialDaysRemaining(subscription) ?? 14;
  const trialQuotesRemaining = getTrialQuotesRemaining(subscription) ?? 25;
  const planName = subscription?.plan.name ?? "Professional";
  const trialEndDate = subscription?.trialEndsAt
    ? subscription.trialEndsAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : subscription?.currentPeriodEnd
    ? subscription.currentPeriodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "14 days after activation";

  return (
    <main className="onboardingShell">
      <div className="onboardingContainer">
        {/* Brand Header */}
        <header className="onboardingHero">
          <div className="onboardingBrandBadge">
            <span className="onboardingDiamondIcon">✦</span>
            <span>AZZURE AI QUOTE</span>
          </div>
          <h1 className="onboardingTitle">Your 14-Day Free Trial Has Started</h1>
          <p className="onboardingLead">
            Welcome to your intelligent jewelry pricing workspace. Let&apos;s get your showroom and studio configured in just 2 minutes.
          </p>
        </header>

        <section className="onboardingCard">
          {/* STEP 1: Trial Confirmation Banner */}
          <div className="onboardingStep onboardingStep--active">
            <div className="onboardingStepHeader">
              <div className="onboardingStepBadge">1</div>
              <div className="onboardingStepTitleGroup">
                <h2>Confirm Your Trial Tier</h2>
                <p className="muted">
                  Full <strong>{planName}</strong> features enabled with no charge during your 14-day evaluation.
                </p>
              </div>
            </div>

            <div className="trialStatusBanner">
              <div className="trialMetricCard">
                <span className="trialMetricLabel">Active Tier</span>
                <strong className="trialMetricValue">{planName}</strong>
                <span className="trialMetricSub">14-Day Free Trial</span>
              </div>
              <div className="trialMetricCard">
                <span className="trialMetricLabel">Trial Time Remaining</span>
                <strong className="trialMetricValue">{trialDaysRemaining} Days</strong>
                <span className="trialMetricSub">Renews {trialEndDate}</span>
              </div>
              <div className="trialMetricCard">
                <span className="trialMetricLabel">Included Estimates</span>
                <strong className="trialMetricValue">{trialQuotesRemaining} Quotes</strong>
                <span className="trialMetricSub">Full calculation engine</span>
              </div>
            </div>
          </div>

          {/* STEP 2: Store Identity & Profile */}
          <div className="onboardingStep" id="step-2">
            <div className="onboardingStepHeader">
              <div className="onboardingStepBadge">2</div>
              <div className="onboardingStepTitleGroup">
                <h2>Store Profile & Branding</h2>
                <p className="muted">
                  Customize your business information. These details will appear on your customer-facing quotes and PDFs.
                </p>
              </div>
            </div>

            <form className="onboardingForm" action="/api/onboarding/complete" method="post">
              <input type="hidden" name="action" value="save" />
              <input type="hidden" name="next" value="/onboarding#step-3" />

              <div className="formGroup">
                <label className="formLabel">
                  <span>Business / Jewelry Store Name <strong className="requiredMark">*</strong></span>
                  <input
                    className="formInput"
                    name="companyName"
                    defaultValue={context.company.name}
                    placeholder="e.g. Diamond District Fine Jewelry"
                    required
                  />
                </label>
              </div>

              <div className="formGroup">
                <label className="formLabel">
                  <span>Website URL</span>
                  <input
                    className="formInput"
                    name="websiteUrl"
                    type="url"
                    placeholder="https://yourjewelrystore.com"
                    defaultValue={context.company.websiteUrl ?? ""}
                  />
                </label>
              </div>

              <div className="formGroup">
                <label className="formLabel">
                  <span>About Your Store & Specialty</span>
                  <textarea
                    className="formTextarea"
                    name="aboutUs"
                    rows={3}
                    placeholder="e.g. Bespoke bridal engagement rings, GIA-certified diamonds, and fine handcrafted jewelry."
                    defaultValue={context.company.aboutUs ?? ""}
                  />
                </label>
              </div>

              <div className="onboardingFormActions">
                <button className="button primary" type="submit">
                  Save Store Details
                </button>
                <Link className="button secondary" href="#step-3">
                  Skip for now
                </Link>
              </div>
            </form>
          </div>

          {/* STEP 3: Complete & Launch */}
          <div className="onboardingStep" id="step-3">
            <div className="onboardingStepHeader">
              <div className="onboardingStepBadge">3</div>
              <div className="onboardingStepTitleGroup">
                <h2>Ready to Generate Quotes</h2>
                <p className="muted">
                  Your workspace is ready. Generate your first live quote or proceed directly to your jeweler dashboard.
                </p>
              </div>
            </div>

            <div className="onboardingLaunchActions">
              <form action="/api/onboarding/complete" method="post" className="launchForm">
                <input type="hidden" name="action" value="finish" />
                <input type="hidden" name="next" value="/quotes/new" />
                <input type="hidden" name="companyName" value={context.company.name} />
                <input type="hidden" name="websiteUrl" value={context.company.websiteUrl ?? ""} />
                <input type="hidden" name="aboutUs" value={context.company.aboutUs ?? ""} />
                <button className="button primary button--lg launchPrimaryBtn" type="submit">
                  <span className="btnIcon">💎</span>
                  <span>Create My First Quote</span>
                </button>
              </form>

              <form action="/api/onboarding/complete" method="post" className="launchForm">
                <input type="hidden" name="action" value="finish" />
                <input type="hidden" name="next" value="/" />
                <input type="hidden" name="companyName" value={context.company.name} />
                <input type="hidden" name="websiteUrl" value={context.company.websiteUrl ?? ""} />
                <input type="hidden" name="aboutUs" value={context.company.aboutUs ?? ""} />
                <button className="button secondary button--lg launchSecondaryBtn" type="submit">
                  Explore Dashboard &amp; Settings
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
