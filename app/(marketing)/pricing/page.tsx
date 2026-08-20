"use client";

import Link from "next/link";
import { useState, Fragment } from "react";
import type { PlanCode } from "@/lib/subscription-plans";

const PLAN_META = {
  starter: {
    name: "Starter",
    price: 99,
    audience: "Independent jewelers & small studios",
    highlights: [
      "300 quotes / month",
      "Full 3-pass AI + manual override",
      "Branded PDFs (Logo + brand name)",
      "Complete quote history",
      "Up to 3 user seats"
    ],
    badge: null,
    cta: "Start free trial",
    ctaHref: "/signup?plan=starter",
    featured: false
  },
  professional: {
    name: "Professional",
    price: 199,
    audience: "Growing stores sharing quotes digitally",
    highlights: [
      "1,200 quotes / month",
      "Everything in Starter",
      "Unlimited seats + role-based access",
      "Shareable branded quote links",
      "Custom domain for links (Coming Soon)",
      "Auto-push orders to Custom King (Coming Soon)"
    ],
    badge: "Most Popular",
    cta: "Start free trial",
    ctaHref: "/signup?plan=professional",
    featured: true
  },
  enterprise: {
    name: "Enterprise",
    price: 299,
    audience: "Showrooms & multi-location jewelers",
    highlights: [
      "2,500 quotes / month",
      "Everything in Professional",
      "Photorealistic 3D concept render",
      "In-store tablet mode (kiosk touchscreen)",
      "Full auto-push to Custom King",
      "Photo → 3D print file (Coming Soon)"
    ],
    badge: "Full Experience",
    cta: "Start free trial",
    ctaHref: "/signup?plan=enterprise",
    featured: false
  }
} as const satisfies Record<
  "starter" | "professional" | "enterprise",
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
};

type FeatureCategory = {
  category: string;
  items: FeatureRow[];
};

const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    category: "Core Quoting Engine",
    items: [
      { feature: "Quotes per month", starter: "300", professional: "1,200", enterprise: "2,500" },
      { feature: "AI image analysis", starter: "Full 3-pass + override", professional: "Full 3-pass + override", enterprise: "Full 3-pass + override" },
      { feature: "Real-time spot metal pricing", starter: true, professional: true, enterprise: true },
      { feature: "Branded PDF proposals", starter: "Logo + brand name", professional: "Logo + brand name", enterprise: "Logo + brand name" },
      { feature: "Complete quote history", starter: true, professional: true, enterprise: true }
    ]
  },
  {
    category: "Team & Digital Sharing",
    items: [
      { feature: "User seats", starter: "Up to 3", professional: "Unlimited (Role-based)", enterprise: "Unlimited (Role-based)" },
      { feature: "Shareable public quote links", starter: false, professional: true, enterprise: true },
      { feature: "Custom domain for links", starter: false, professional: "Coming Soon", enterprise: "Coming Soon" },
      { feature: "White-label custom domain", starter: false, professional: "Coming Soon", enterprise: "Coming Soon" }
    ]
  },
  {
    category: "3D Visuals & Showroom Tablet",
    items: [
      { feature: "Photorealistic 3D Concept Render", starter: false, professional: false, enterprise: true },
      { feature: "In-Store Tablet Mode (Kiosk touchscreen)", starter: false, professional: false, enterprise: true },
      { feature: "Photo → 3D print file (3DM, STL, wax)", starter: false, professional: false, enterprise: "Coming Soon" }
    ]
  },
  {
    category: "Custom King Manufacturing Integration",
    items: [
      { feature: "Auto-push orders to Custom King", starter: "Manual handoff", professional: "Coming Soon", enterprise: true },
      { feature: "14-Day Free Trial", starter: "14 days (Pro features)", professional: "14 days", enterprise: "14 days" }
    ]
  }
];

const FAQ_ITEMS = [
  {
    question: "Do I need a credit card to start the trial?",
    answer: "Yes. Every new account starts with a 14-day free trial on the Professional plan (capped at 25 quotes). Your card will not be charged until day 15."
  },
  {
    question: "What happens when my trial ends?",
    answer: "Your account automatically converts to the Professional plan ($199/mo) unless you switch plans or cancel before day 14."
  },
  {
    question: "Can I cancel or switch plans anytime?",
    answer: "Yes. Self-service plan changes and cancellations are available anytime via the Stripe Customer Portal or your billing settings."
  },
  {
    question: "What counts as a quote?",
    answer: "Each completed photo analysis or manual spec quotation with approved live pricing counts as one quote against your monthly allowance."
  },
  {
    question: "How does the pricing tier approval work?",
    answer: "During account onboarding, Azzure assigns a pricing tier (Tier 1 Premium, Tier 2 Standard, Tier 3 Basic) to configure making price markups. The jeweler sees only the approved customer selling price."
  },
  {
    question: "How does Custom King manufacturing integration work?",
    answer: "Manufacturing orders are available to verified Custom King customers. On Enterprise, finalized quotes are submitted directly to Custom King manufacturing automatically."
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
  const [hoveredCol, setHoveredCol] = useState<"starter" | "professional" | "enterprise" | null>(null);

  return (
    <main className="pricingShell">
      <section className="pricingHero">
        <p className="eyebrow" style={{ color: "var(--color-primary)" }}>Plans &amp; Pricing</p>
        <h1 className="pricingTitle">Simple pricing that scales with your custom quoting</h1>
        <p className="pricingLead">
          Start your 14-day free trial on Professional. Compare features side by side and upgrade anytime.
        </p>
      </section>

      {/* ── 3-Column Balanced Pricing Grid ── */}
      <section className="pricingCards">
        {(Object.keys(PLAN_META) as (keyof typeof PLAN_META)[]).map((code) => {
          const plan = PLAN_META[code];
          const isFeatured = plan.featured;
          const isEnterprise = code === "enterprise";
          const cardClass = isFeatured
            ? "pricingCard pricingCard--featured"
            : isEnterprise
            ? "pricingCard pricingCard--enterprise"
            : "pricingCard";
          const badgeClass = isEnterprise ? "pricingBadge pricingBadge--gold" : "pricingBadge";

          return (
            <article
              key={code}
              className={cardClass}
              onMouseEnter={() => setHoveredCol(code)}
              onMouseLeave={() => setHoveredCol(null)}
            >
              {plan.badge ? <span className={badgeClass}>{plan.badge}</span> : null}
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
                <Link
                  className={isFeatured || isEnterprise ? "button primary button--lg" : "button secondary button--lg"}
                  style={{
                    width: "100%",
                    background: isEnterprise ? "#C9A84C" : undefined,
                    borderColor: isEnterprise ? "#C9A84C" : undefined
                  }}
                  href={plan.ctaHref}
                >
                  {plan.cta}
                </Link>
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
            <p className="muted small">Hover over any row or column to highlight details.</p>
          </div>
        </div>

        <div className="pricingTableShell">
          <table className="featureTable">
            <thead>
              <tr>
                <th style={{ width: "37%" }}>Feature</th>
                <th
                  style={{ width: "21%", cursor: "pointer" }}
                  className={hoveredCol === "starter" ? "col-hover" : ""}
                  onMouseEnter={() => setHoveredCol("starter")}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Starter — $99/mo
                </th>
                <th
                  style={{ width: "21%", cursor: "pointer" }}
                  className={hoveredCol === "professional" ? "col-hover" : ""}
                  onMouseEnter={() => setHoveredCol("professional")}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Professional — $199/mo
                </th>
                <th
                  style={{ width: "21%", cursor: "pointer" }}
                  className={hoveredCol === "enterprise" ? "col-hover" : ""}
                  onMouseEnter={() => setHoveredCol("enterprise")}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Enterprise — $299/mo
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_CATEGORIES.map((cat) => (
                <Fragment key={cat.category}>
                  <tr>
                    <td colSpan={4} className="featureCategoryHeader">
                      {cat.category}
                    </td>
                  </tr>
                  {cat.items.map((row) => (
                    <tr key={row.feature} className="featureRow">
                      <th scope="row" style={{ fontWeight: 500 }}>
                        {row.feature}
                      </th>
                      <td
                        className={hoveredCol === "starter" ? "col-hover" : ""}
                        onMouseEnter={() => setHoveredCol("starter")}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        <FeatureCell value={row.starter} />
                      </td>
                      <td
                        className={hoveredCol === "professional" ? "col-hover" : ""}
                        onMouseEnter={() => setHoveredCol("professional")}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        <FeatureCell value={row.professional} />
                      </td>
                      <td
                        className={hoveredCol === "enterprise" ? "col-hover" : ""}
                        onMouseEnter={() => setHoveredCol("enterprise")}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        <FeatureCell value={row.enterprise} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
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
