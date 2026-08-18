import { getAuthenticatedCompanyContext } from "@/lib/company";

export default async function CompanySwitcher() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) return null;

  const companies = context.memberships.map((membership) => ({
    id: membership.company.id,
    name: membership.company.name,
    role: membership.role
  }));

  if (companies.length <= 1) {
    return (
      <div className="companyCardSingle">
        <div className="companyInfo">
          <strong className="companyName">{context.company.name}</strong>
          <span className="roleTag">{context.membership.role}</span>
        </div>
      </div>
    );
  }

  return (
    <form action="/api/company/switch" method="post" className="companySwitcher">
      <div className="companyInfo">
        <strong className="companyName">{context.company.name}</strong>
        <span className="roleTag">{context.membership.role}</span>
      </div>
      <div className="companySwitchControls">
        <label className="field">
          <span className="fieldLabel">Active Company</span>
          <select name="companyId" defaultValue={context.company.id} className="companySelect">
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name} ({company.role})
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary button--sm" type="submit">
          Switch
        </button>
      </div>
    </form>
  );
}
