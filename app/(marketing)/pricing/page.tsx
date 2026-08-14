"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanCode } from "@/lib/subscription-plans";

const PLAN_META = {
  starter: {
    name: "Starter",
    price: 49,
    audience: "Solo jewelers and occasional quoting",
    highlights: ["100 quotes / month", "1-pass AI estimate", "Fixed pricing profile", "1 seat", "Standard email support"],
    badge: null,
    cta: "Start free trial",
    ctaHref: "/signup?plan=starter",
    featured: false
  },
  professional: {
    name: "Professional",
    price: 99,
    audience: "Growing shops quoting every day",
    highlights: ["500 quotes / month", "Full 3-pass AI", "Editable pricing profile", "Custom branded PDFs", "Full quote history", "Up to 5 seats"],
    badge: "Most popular",
    cta: "Start free trial",
    ctaHref: "/signup?plan=professional",
    featured: true
  },
  enterprise: {
    name: "Enterprise",
    price: 199,
    audience: "High-volume and multi-location jewelers",
    highlights: ["2,500 quotes / month", "3-pass AI + manual override", "White-label templates", "Unlimited role-based seats", "Manufacturing orders", "Branded customer links"],
    badge: null,
    cta: "Contact us",
    ctaHref: "mailto:sales@azzureautoquote.com",
    featured: false
  }
} as const satisfies Record<
  PlanCode,
  {
    name: string;
    price: number;
    audience: string;
    highlights: readonly string[];
    badge: string | null;
    cta: string;
    ctaHref: string;
    featured: boolean;
  }
>;

const FEATURE_ROWS = [
  { section: "Core quoting", feature: "Quotes per month", starter: "100", professional: "500", enterprise: "2,500" },
  { section: "Core quoting", feature: "AI image analysis", starter: "1-pass", professional: "Full 3-pass", enterprise: "Full 3-pass + override" },
  { section: "Core quoting", feature: "Real-time metal pricing", starter: true, professional: true, enterprise: true },
  { section: "Core quoting", feature: "PDF quote generation", starter: true, professional: true, enterprise: true },
  { section: "Customisation", feature: "Custom pricing & margins", starter: false, professional: true, enterprise: true },
  { section: "Customisation", feature: "Branded PDF output", starter: false, professional: true, enterprise: true },
  { section: "Customisation", feature: "Quote image history", starter: false, professional: true, enterprise: true },
  { section: "Storage", feature: "Image / quote storage", starter: "Not persisted", professional: "S3 + full history", enterprise: "S3 + retention controls" },
  { section: "Team", feature: "User seats", starter: "1", professional: "5", enterprise: "Unlimited" },
  { section: "Team", feature: "Overage quotes", starter: false, professional: "$0.25/quote", enterprise: "Custom rate" },
  { section: "Enterprise", feature: "Manufacturing orders", starter: false, professional: false, enterprise: true },
  { section: "Enterprise", feature: "Shareable customer quote links", starter: false, professional: false, enterprise: true },
  { section: "Enterprise", feature: "Support", starter: "Email", professional: "Priority email", enterprise: "Dedicated" }
] as const;

const FAQ_ITEMS = [
  {
    question: "Do I need a credit card to start the trial?",
    answer: "Yes. The card is collected at signup, but you will not be charged until day 15."
  },
  {
    question: "What happens when my trial ends?",
    answer: "Your account converts to your selected billing plan. You can downgrade or cancel before day 14."
  },
  {
    question: "Can I change plans later?",
    answer: "Yes. You can switch plans any time from billing settings, and changes take effect immediately."
  },
  {
    question: "What counts as a quote?",
    answer: "Each photo analysis plus price generation counts as one quote."
  },
  {
    question: "Is my customer's data kept private?",
    answer: "Yes. Data is isolated per business and never shared across companies."
  },
  {
    question: "How do manufacturing orders work?",
    answer: "Enterprise customers can submit a finalized quote directly to Azzure for manufacturing."
  }
] as const;

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function FeatureCell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return <span className={value ? "featureMark featureMark--yes" : "featureMark featureMark--no"}>{value ? "Yes" : "No"}</span>;
  }

  return <span>{value}</span>;
}

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="pricingShell">
      <section className="pricingHero">
        <p className="eyebrow">Simple pricing. Powerful quoting.</p>
        <h1 className="pricingTitle">14-day free trial on every plan. No setup fees.</h1>
        <p className="pricingLead">
          Start with the plan that matches your shop today, compare features side by side, and move into
          checkout only when you are ready to collect a card.
        </p>

      </section>

      <section className="pricingCards">
        {(Object.keys(PLAN_META) as PlanCode[]).map((code) => {
          const plan = PLAN_META[code];
          return (
            <article key={code} className={plan.featured ? "pricingCard pricingCard--featured" : "pricingCard"}>
              {plan.badge ? <span className="pricingBadge">{plan.badge}</span> : null}
              <div className="pricingCardTop">
                <p className="pricingCardName">{plan.name}</p>
                <p className="pricingCardPrice">
                  {formatPrice(plan.price)} <span>/ month</span>
                </p>
                <p className="muted small">{plan.audience}</p>
              </div>

              <ul className="pricingFeatureList" aria-label={`${plan.name} features`}>
                {plan.highlights.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>

              {plan.ctaHref.startsWith("mailto:") ? (
                <a className={plan.featured ? "button primary button--lg" : "button secondary button--lg"} href={plan.ctaHref}>
                  {plan.cta}
                </a>
              ) : (
                <Link
                  className={plan.featured ? "button primary button--lg" : "button secondary button--lg"}
                  href={plan.ctaHref}
                >
                  {plan.cta}
                </Link>
              )}
              <p className="pricingFootnote">14-day free trial - Card required - Cancel anytime</p>
            </article>
          );
        })}
      </section>

      <section className="pricingTableCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Feature comparison</p>
            <h2>Compare every plan in one view</h2>
          </div>
        </div>

        <div className="tableShell pricingTableShell">
          <table className="featureTable">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Starter</th>
                <th>Professional</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={`${row.section}-${row.feature}`}>
                  <th scope="row">
                    <span className="featureSection">{row.section}</span>
                    <span>{row.feature}</span>
                  </th>
                  <td>
                    <FeatureCell value={row.starter} />
                  </td>
                  <td>
                    <FeatureCell value={row.professional} />
                  </td>
                  <td>
                    <FeatureCell value={row.enterprise} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pricingFaq">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Frequently asked</p>
            <h2>Answers before you start the trial</h2>
          </div>
        </div>

        <div className="faqList">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <article key={item.question} className={isOpen ? "faqItem isOpen" : "faqItem"}>
                <button className="faqTrigger" type="button" onClick={() => setOpenFaq(isOpen ? null : index)}>
                  <span>{item.question}</span>
                  <span aria-hidden="true">{isOpen ? "-" : "+"}</span>
                </button>
                {isOpen ? <p className="faqAnswer">{item.answer}</p> : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
