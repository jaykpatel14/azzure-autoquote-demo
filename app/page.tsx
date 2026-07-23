import Link from "next/link";
import { redirect } from "next/navigation";
import QuoteCalculator from "@/components/QuoteCalculator";
import CompanySwitcher from "@/components/company-switcher";
import SignOutButton from "@/components/sign-out-button";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { hasMinimumRole } from "@/lib/tenant";

export default async function HomePage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const canEdit = hasMinimumRole(context.membership.role, "ESTIMATOR");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Azzure AutoQuote</div>
        <Link className="navItem" href="/">New Estimate</Link>
        <Link className="navItem" href="/quotes">Quote History</Link>
        <Link className="navItem" href="/settings">Settings</Link>
        <CompanySwitcher />
        <SignOutButton />
      </aside>
      <main className="main">
        <h1 className="heading">New Jewelry Estimate</h1>
        <QuoteCalculator canEdit={canEdit} />
      </main>
    </div>
  );
}
