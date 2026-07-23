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
      <div className="muted">
        <strong>{context.company.name}</strong>
        <div>{context.membership.role}</div>
      </div>
    );
  }

  return (
    <form action="/api/company/switch" method="post" className="companySwitcher">
      <div className="muted">
        <strong>{context.company.name}</strong>
        <div>{context.membership.role}</div>
      </div>
      <label className="field">
        <span>Switch company</span>
        <select name="companyId" defaultValue={context.company.id}>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name} - {company.role}
            </option>
          ))}
        </select>
      </label>
      <button className="button secondary" type="submit">
        Switch
      </button>
    </form>
  );
}
