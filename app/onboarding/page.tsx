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
            <p className="publicQuoteTitle">Welcome to AI AutoQuote</p>
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
  const trialDaysRemaining = getTrialDaysRemaining(subscription) ?? 0;
  const trialQuotesRemaining = getTrialQuotesRemaining(subscription) ?? 0;

  return (
    <main className="onboardingShell">
      <section className="onboardingCard">
        <div className="onboardingHero">
          <p className="eyebrow">AI AutoQuote</p>
          <h1 className="onboardingTitle">Your 14-day free trial has started.</h1>
          <p className="onboardingLead">
            You&apos;re on the Professional plan with full access, no charge today.
          </p>
        </div>

        <section className="onboardingStep onboardingStep--highlight">
          <div className="onboardingStepHeader">
            <span className="onboardingStepNumber">1</span>
            <div>
              <h2>Confirm your trial</h2>
              <p className="muted">
                Trial ends: {subscription?.trialEndsAt?.toLocaleDateString() ?? "Not set"}. You have{" "}
                {subscription?.trialQuoteCap ?? 25} quotes to use during your trial.
              </p>
            </div>
          </div>
          <div className="trialOverview">
            <div className="detailCard">
              <span>Plan</span>
              <strong>{subscription?.plan.name ?? "Professional"}</strong>
            </div>
            <div className="detailCard">
              <span>Trial time remaining</span>
              <strong>
                {trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"}
              </strong>
            </div>
            <div className="detailCard">
              <span>Trial quotes remaining</span>
              <strong>{trialQuotesRemaining} remaining</strong>
            </div>
          </div>
        </section>

        <section className="onboardingStep" id="step-2">
          <div className="onboardingStepHeader">
            <span className="onboardingStepNumber">2</span>
            <div>
              <h2>Business profile</h2>
              <p className="muted">
                Business name is pre-filled from signup. Website URL and About us are used later on shareable quote pages.
              </p>
            </div>
          </div>

          <form className="onboardingForm" action="/api/onboarding/complete" method="post">
            <input type="hidden" name="action" value="save" />
            <input type="hidden" name="next" value="/onboarding#step-3" />

            <label className="field">
              <span>Business name</span>
              <input name="companyName" defaultValue={context.company.name} required />
            </label>
            <label className="field">
              <span>Website URL</span>
              <input
                name="websiteUrl"
                type="url"
                placeholder="https://yourshop.com"
                defaultValue={context.company.websiteUrl ?? ""}
              />
            </label>
            <label className="field">
              <span>About us</span>
              <textarea
                name="aboutUs"
                rows={4}
                placeholder="A short description of your jewelry business."
                defaultValue={context.company.aboutUs ?? ""}
              />
            </label>

            <div className="buttonRow">
              <button className="button primary" type="submit">
                Save and continue
              </button>
              <Link className="button secondary" href="#step-3">
                Skip for now
              </Link>
            </div>
          </form>
        </section>

        <section className="onboardingStep" id="step-3">
          <div className="onboardingStepHeader">
            <span className="onboardingStepNumber">3</span>
            <div>
              <h2>Create your first quote</h2>
              <p className="muted">
                You&apos;re all set. Create your first quote to mark onboarding complete and enter the dashboard.
              </p>
            </div>
          </div>

          <div className="onboardingStepActions">
            <form action="/api/onboarding/complete" method="post">
              <input type="hidden" name="action" value="finish" />
              <input type="hidden" name="next" value="/quotes/new" />
              <input type="hidden" name="companyName" value={context.company.name} />
              <input type="hidden" name="websiteUrl" value={context.company.websiteUrl ?? ""} />
              <input type="hidden" name="aboutUs" value={context.company.aboutUs ?? ""} />
              <button className="button primary button--lg" type="submit">
                Create my first quote
              </button>
            </form>

            <form action="/api/onboarding/complete" method="post">
              <input type="hidden" name="action" value="finish" />
              <input type="hidden" name="next" value="/" />
              <input type="hidden" name="companyName" value={context.company.name} />
              <input type="hidden" name="websiteUrl" value={context.company.websiteUrl ?? ""} />
              <input type="hidden" name="aboutUs" value={context.company.aboutUs ?? ""} />
              <button className="button secondary button--lg" type="submit">
                Explore the dashboard
              </button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
