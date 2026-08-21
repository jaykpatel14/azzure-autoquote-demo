import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { getInternalAdminUsers } from "@/src/services/admin-team";
import { AdminCreateUserModal } from "@/components/admin-create-user-modal";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

function formatRoleLabel(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Administrator";
    case "OPERATIONS_MANAGER":
      return "Operations & Orders";
    case "ESTIMATOR_ADMIN":
      return "Estimator Admin";
    case "SUPPORT_ADMIN":
      return "Support Specialist";
    default:
      return role.replace("_", " ");
  }
}

export default async function AdminTeamPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const users = await getInternalAdminUsers();

  return (
    <InternalAdminShell
      title="Backend Staff & Admin Users"
      description="Manage internal staff accounts who can work on customer orders, dispatch manufacturing jobs, and audit quotes."
      navItems={getInternalAdminNav("/admin/team")}
      adminName={context.user.name || context.user.email}
      actions={
        <AdminCreateUserModal />
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Backend Staff</span>
          <strong>{users.length}</strong>
          <p className="muted small">Active internal administrators.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Operations Roles</span>
          <strong>{users.filter(u => u.adminRole === "OPERATIONS_MANAGER").length}</strong>
          <p className="muted small">Staff handling customer orders.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Super Admins</span>
          <strong>{users.filter(u => u.adminRole === "SUPER_ADMIN").length}</strong>
          <p className="muted small">Full system permissions.</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Internal Staff Roster</h2>
            <p className="muted">These users can log in to the admin console and manage orders, quotes, and tenants.</p>
          </div>
        </div>

        <div className="tableShell">
          <table className="dataTable">
            <thead>
              <tr>
                <th scope="col">Staff Member</th>
                <th scope="col">Role & Access</th>
                <th scope="col">Source</th>
                <th scope="col">Created</th>
                <th scope="col" style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name || "Staff Member"}</strong>
                    <p className="muted small">{user.email}</p>
                  </td>
                  <td>
                    <span className="badge" style={{ background: user.adminRole === "SUPER_ADMIN" ? "#FEF3C7" : "#EFF6FF", color: user.adminRole === "SUPER_ADMIN" ? "#92400E" : "#1D4ED8" }}>
                      {formatRoleLabel(user.adminRole)}
                    </span>
                  </td>
                  <td>
                    {user.isEnvConfigured ? (
                      <span className="badge" style={{ background: "#F1F5F9", color: "#475569" }}>Env Configured</span>
                    ) : (
                      <span className="badge" style={{ background: "#DCFCE7", color: "#166534" }}>Database</span>
                    )}
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    {user.id !== context.user.id && !user.isEnvConfigured ? (
                      <form action={`/api/admin/team/${user.id}`} method="post" style={{ display: "inline" }}>
                        <button
                          type="submit"
                          className="button destructive"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          Revoke Access
                        </button>
                      </form>
                    ) : (
                      <span className="muted small">{user.id === context.user.id ? "Current Session" : "Protected"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </InternalAdminShell>
  );
}
