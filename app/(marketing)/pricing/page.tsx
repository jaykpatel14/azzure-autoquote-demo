"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanCode } from "@/lib/subscription-plans";

const PLAN_META = {
  starter: {
    name: "Starter",
    price: 49,
    audience: "Solo jewelers & occasional quoting",
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
    badge: "Most Popular",
    cta: "Start free trial",
    ctaHref: "/signup?plan=professional",
    featured: true
  },
  enterprise: {
    name: "Enterprise",
    price: 199,
    audience: "High-volume & multi-location jewelers",
    highlights: ["2,500 quotes / month", "3-pass AI + manual override", "White-label templates", "Unlimited role-based seats", "Manufacturing orders", "Branded customer links"],
    badge: null,
    cta: "Contact us",
    ctaHref: "mailto:sales@azzureautoquote.com",
    featured: false
  },
  ultra: {
    name: "Ultra",
    price: 399,
    audience: "Showrooms, tablet WOW kiosks & luxury studios",
    highlights: [
      "10,000 quotes / month",
      "Photorealistic 3D Concept Generation",
      "In-Store Tablet / WOW Showroom Mode",
      "Custom Store Logo & Showroom Branding",
      "Manufacturing order dispatch",
      "White-label customer links & PDFs"
    ],
    badge: "Flagship Studio",
    cta: "Start free trial",
    ctaHref: "/signup?plan=ultra",
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

type FeatureRow = {
  feature: string;
  starter: string | boolean;
  professional: string | boolean;
  enterprise: string | boolean;
  ultra: string | boolean;
};

type FeatureCategory = {
  category: string;
  items: FeatureRow[];
};

const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    category: "Core Quoting Engine",
    items: [
      { feature: "Quotes per month", starter: "100", professional: "500", enterprise: "2,500", ultra: "10,000" },
      { feature: "AI image analysis", starter: "1-pass", professional: "Full 3-pass", enterprise: "Full 3-pass + override", ultra: "3-Pass + 3D Concept AI" },
      { feature: "Real-time metal pricing", starter: true, professional: true, enterprise: true, ultra: true },
      { feature: "PDF quote generation", starter: true, professional: true, enterprise: true, ultra: true }
    ]
  },
  {
    category: "Customization & Branding",
    items: [
      { feature: "Custom pricing & margins", starter: false, professional: true, enterprise: true, ultra: true },
      { feature: "Branded PDF output", starter: false, professional: true, enterprise: true, ultra: true },
      { feature: "Quote image history", starter: false, professional: true, enterprise: true, ultra: true }
    ]
  },
  {
    category: "Storage & Team Seats",
    items: [
      { feature: "Image / quote storage", starter: "Not persisted", professional: "S3 + full history", enterprise: "S3 + retention controls", ultra: "S3 + full retention" },
      { feature: "User seats", starter: "1", professional: "5", enterprise: "Unlimited", ultra: "Unlimited" },
      { feature: "Overage quotes", starter: false, professional: "$0.25/quote", enterprise: "Custom rate", ultra: "Custom rate" }
    ]
  },
  {
    category: "Manufacturing & Enterprise Features",
    items: [
      { feature: "Manufacturing orders [Staging]", starter: false, professional: false, enterprise: true, ultra: true },
      { feature: "Shareable customer quote links", starter: false, professional: false, enterprise: true, ultra: true }
    ]
  },
  {
    category: "Ultra Studio & Showroom Kiosk",
    items: [
      { feature: "Photorealistic 3D Concept Generation", starter: false, professional: false, enterprise: false, ultra: true },
      { feature: "In-Store Tablet / WOW Showroom Mode", starter: false, professional: false, enterprise: false, ultra: true },
      { feature: "Store Logo & Showroom Branding", starter: false, professional: false, enterprise: false, ultra: true },
      { feature: "Support SLA", starter: "Email", professional: "Priority email", enterprise: "Dedicated", ultra: "24/7 Dedicated Concierge" }
    ]
  }
];

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
    answer: "Each photo analysis or text concept synthesis plus price generation counts as one quote."
  },
  {
    question: "Is my customer's data kept private?",
    answer: "Yes. Data is isolated per business and never shared across companies."
  },
  {
    question: "How do manufacturing orders work?",
    answer: "Enterprise and Ultra customers can submit a finalized quote directly to manufacturing."
  }
] as const;

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function FeatureCell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return <span className={value ? "featureMark featureMark--yes" : "featureMark featureMark--no"}>{value ? "✓" : "—"}</span>;
  }

  return <span>{value}</span>;
}

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <main className="pricingShell">
      <section className="pricingHero">
        <p className="eyebrow" style={{ color: "var(--color-primary)" }}>Plans &amp; Pricing</p>
        <h1 className="pricingTitle">Simple pricing that scales with your quoting volume</h1>
        <p className="pricingLead">
          Start with the plan that matches your shop today, compare features side by side, and move into
          checkout only when you are ready to collect a card.
        </p>
      </section>

      {/* ── 4-Column Balanced Pricing Grid ── */}
      <section className="pricingCards">
        {(Object.keys(PLAN_META) as PlanCode[]).map((code) => {
          const plan = PLAN_META[code];
          return (
            <article key={code} className={plan.featured ? "pricingCard pricingCard--featured" : "pricingCard"}>
              {plan.badge ? <span className="pricingBadge">{plan.badge}</span> : null}
              <div>
                <div className="pricingCardTop">
                  <p className="pricingTrial">14-Day Free Trial</p>
                  <h2 className="pricingCardName">{plan.name}</h2>
                  <div className="pricingCardPrice">
                    {formatPrice(plan.price)} <span>/ month</span>
                  </div>
                  <p className="muted small">{plan.audience}</p>
                </div>

                <ul className="pricingFeatureList" aria-label={`${plan.name} features`}>
                  {plan.highlights.map((feature: string) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>

              <div>
                {plan.ctaHref.startsWith("mailto:") ? (
                  <a className={plan.featured ? "button primary button--lg" : "button secondary button--lg"} style={{ width: "100%" }} href={plan.ctaHref}>
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    className={plan.featured ? "button primary button--lg" : "button secondary button--lg"}
                    style={{ width: "100%" }}
                    href={plan.ctaHref}
                  >
                    {plan.cta}
                  </Link>
                )}
                <p className="pricingFootnote" style={{ marginTop: 12 }}>14-day free trial · Card required · Cancel anytime</p>
              </div>
            </article>
          );
        })}
      </section>

      {/* ── Grouped Feature Comparison Table ── */}
      <section className="pricingTableCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow" style={{ color: "var(--color-primary)" }}>Feature Comparison</p>
            <h2>Compare every plan in one view</h2>
          </div>
        </div>

        <div className="pricingTableShell">
          <table className="featureTable">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Feature</th>
                <th style={{ width: "17%" }}>Starter</th>
                <th style={{ width: "17%" }}>Professional</th>
                <th style={{ width: "17%" }}>Enterprise</th>
                <th style={{ width: "17%" }}>Ultra</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_CATEGORIES.map((cat) => (
                <>
                  <tr key={cat.category}>
                    <td colSpan={5} className="featureCategoryHeader">
                      {cat.category}
                    </td>
                  </tr>
                  {cat.items.map((row) => (
                    <tr key={row.feature}>
                      <th scope="row" style={{ fontWeight: 500 }}>
                        {row.feature}
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
                      <td>
                        <FeatureCell value={row.ultra} />
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section className="pricingFaq">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow" style={{ color: "var(--color-primary)" }}>Frequently Asked</p>
            <h2>Answers before you start your trial</h2>
          </div>
        </div>

        <div className="faqList">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <article key={item.question} className={isOpen ? "faqItem isOpen" : "faqItem"}>
                <button className="faqTrigger" type="button" onClick={() => setOpenFaq(isOpen ? null : index)}>
                  <span>{item.question}</span>
                  <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
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
