import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BlockedIpManager, IpBlockButton } from "@/components/admin-ip-access-controls";
import InternalAdminShell from "@/components/internal-admin-shell";
import { normalizeIpAddress } from "@/lib/ip-access";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LogsView = "activity" | "sign-ins" | "blocked";
type SearchParams = Promise<{ view?: string; q?: string }>;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

function getHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function getMetadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function formatRole(role: string | null) {
  if (!role) return "User";
  return role.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    PAGE_VIEW: "Page viewed",
    SIGN_IN: "Signed in",
    SIGN_OUT: "Signed out",
    IP_BLOCKED: "IP blocked",
    IP_UNBLOCKED: "IP unblocked",
    BLOCKED_IP_ATTEMPT: "Blocked request",
    COMPANY_SWITCHED: "Company switched",
    COMPANY_CONTEXT_EXITED: "Company context exited",
    COMPANY_CREATED: "Company created",
    MEMBERSHIP_CREATED: "Member added",
    ROLE_UPDATED: "Role updated",
    COMPANY_UPDATED: "Company updated",
    ACCOUNT_APPROVED: "Account approved",
    ACCOUNT_SUSPENDED: "Account suspended",
    ACCOUNT_DECLINED: "Account declined",
    PRICING_TIER_UPDATED: "Pricing tier updated",
    CK_CUSTOMER_VERIFIED: "CK customer verified",
    CK_VERIFICATION_REVOKED: "CK verification revoked",
    CK_ORDER_ID_ASSIGNED: "CK order assigned",
    ORDER_COMPLETED: "Order completed",
    PASSWORD_RESET_REQUESTED: "Password reset requested",
    PASSWORD_RESET_COMPLETED: "Password reset completed",
    EMAIL_VERIFICATION_REQUESTED: "Verification requested",
    EMAIL_VERIFIED: "Email verified",
    SIGN_UP: "Signed up"
  };

  return labels[action] || formatRole(action);
}

function getActionTone(action: string) {
  if (action === "BLOCKED_IP_ATTEMPT" || action === "IP_BLOCKED" || action.includes("SUSPENDED") || action.includes("DECLINED")) {
    return "danger";
  }
  if (action === "SIGN_IN" || action === "EMAIL_VERIFIED" || action.includes("APPROVED") || action.includes("COMPLETED")) {
    return "success";
  }
  if (action === "PAGE_VIEW") return "neutral";
  return "info";
}

function getRequestIp(headerStore: Awaited<ReturnType<typeof headers>>) {
  return normalizeIpAddress(
    headerStore.get("cf-connecting-ip") ||
      headerStore.get("x-forwarded-for") ||
      headerStore.get("x-real-ip")
  );
}

export default async function AdminLogsPage({ searchParams }: { searchParams?: SearchParams }) {
  const context = await getInternalAdminContext();
  if (!context) redirect("/signin");

  requireAdminRouteAccess("/admin/logs", context.user.adminRole);

  const params = searchParams ? await searchParams : undefined;
  const view: LogsView = params?.view === "sign-ins" || params?.view === "blocked" ? params.view : "activity";
  const query = params?.q?.trim().slice(0, 100) || "";
  const since24Hours = getHoursAgo(24);
  const requestHeaders = await headers();
  const currentIp = getRequestIp(requestHeaders);

  const searchWhere: Prisma.AuditLogWhereInput = query
    ? {
        OR: [
          { action: { contains: query, mode: "insensitive" } },
          { ipAddress: { contains: query, mode: "insensitive" } },
          { targetId: { contains: query, mode: "insensitive" } },
          { actorUser: { is: { email: { contains: query, mode: "insensitive" } } } },
          { actorUser: { is: { name: { contains: query, mode: "insensitive" } } } },
          { company: { is: { name: { contains: query, mode: "insensitive" } } } }
        ]
      }
    : {};

  const [activityLogs, totalEvents, events24h, distinctUsers, blockedIps] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        AND: [view === "sign-ins" ? { action: "SIGN_IN" } : {}, searchWhere]
      },
      orderBy: { createdAt: "desc" },
      take: 250,
      include: {
        actorUser: {
          select: { id: true, email: true, name: true, isInternalAdmin: true, adminRole: true }
        },
        company: { select: { id: true, name: true, slug: true } }
      }
    }),
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { createdAt: { gte: since24Hours } } }),
    prisma.auditLog.findMany({
      where: { actorUserId: { not: null } },
      distinct: ["actorUserId"],
      select: { actorUserId: true }
    }),
    prisma.blockedIp.findMany({
      orderBy: { createdAt: "desc" },
      include: { blockedBy: { select: { name: true, email: true } } }
    })
  ]);

  const blockedIpSet = new Set(blockedIps.map((entry) => entry.ipAddress));
  const uniqueIpCount = new Set(activityLogs.map((log) => log.ipAddress).filter(Boolean)).size;

  return (
    <InternalAdminShell
      title="Security Logs"
      description="Investigate account activity, review login clients, and stop access from suspicious IP addresses."
      navItems={getInternalAdminNav("/admin/logs", context.user.adminRole)}
      adminName={context.user.name || context.user.email}
      actions={
        <Link className="button secondary button--sm" href="/admin/team">
          <span className="material-symbols-outlined" aria-hidden="true">badge</span>
          Admin Team
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Audit Events</span>
          <strong>{totalEvents}</strong>
          <p className="muted small">Recorded security and account events.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Last 24 Hours</span>
          <strong>{events24h}</strong>
          <p className="muted small">Activity recorded since yesterday.</p>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Active Identities</span>
          <strong>{distinctUsers.length}</strong>
          <p className="muted small">Users represented in the audit trail.</p>
        </article>
        <article className="statCard statCard--admin statCard--security">
          <span className="eyebrow">Blocked IPs</span>
          <strong>{blockedIps.length}</strong>
          <p className="muted small">Addresses currently denied access.</p>
        </article>
      </section>

      <nav className="logsViewTabs" aria-label="Log views">
        <Link className={view === "activity" ? "active" : ""} href="/admin/logs?view=activity">
          <span className="material-symbols-outlined" aria-hidden="true">timeline</span>
          Activity
        </Link>
        <Link className={view === "sign-ins" ? "active" : ""} href="/admin/logs?view=sign-ins">
          <span className="material-symbols-outlined" aria-hidden="true">login</span>
          Sign-ins
        </Link>
        <Link className={view === "blocked" ? "active" : ""} href="/admin/logs?view=blocked">
          <span className="material-symbols-outlined" aria-hidden="true">gpp_bad</span>
          Blocked IPs
          {blockedIps.length > 0 ? <span className="logsTabCount">{blockedIps.length}</span> : null}
        </Link>
      </nav>

      {view === "blocked" ? (
        <section className="card logsPanel">
          <div className="sectionHeader">
            <div>
              <span className="eyebrow">Access Control</span>
              <h2>Blocked IP addresses</h2>
              <p className="muted">Blocked addresses receive a 403 response across customer and admin routes.</p>
            </div>
          </div>
          <BlockedIpManager
            currentIp={currentIp}
            blockedIps={blockedIps.map((entry) => ({
              id: entry.id,
              ipAddress: entry.ipAddress,
              reason: entry.reason,
              createdAt: formatDate(entry.createdAt),
              blockedByName: entry.blockedBy?.name || entry.blockedBy?.email || "Former admin"
            }))}
          />
        </section>
      ) : (
        <section className="card logsPanel">
          <div className="sectionHeader logsSectionHeader">
            <div>
              <span className="eyebrow">{view === "sign-ins" ? "Authentication" : "Audit Trail"}</span>
              <h2>{view === "sign-ins" ? "Successful sign-ins" : "User activity"}</h2>
              <p className="muted">
                {view === "sign-ins"
                  ? "Account, tenant, client, and network details for successful sessions."
                  : "Page access and important account changes across the platform."}
              </p>
            </div>
            <span className="logsResultCount">{activityLogs.length} shown · {uniqueIpCount} IPs</span>
          </div>

          <form method="get" className="logsSearchForm">
            <input type="hidden" name="view" value={view} />
            <label className="logsSearchField">
              <span className="material-symbols-outlined" aria-hidden="true">search</span>
              <span className="srOnly">Search logs</span>
              <input
                name="q"
                defaultValue={query}
                placeholder="Search user, email, IP, event, tenant, or route"
              />
            </label>
            <button className="button primary button--sm" type="submit">Search</button>
            {query ? <Link className="button secondary button--sm" href={`/admin/logs?view=${view}`}>Clear</Link> : null}
          </form>

          <div className="tableShell">
            <table className="dataTable logsTable">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">User</th>
                  <th scope="col">Accessed</th>
                  <th scope="col">IP address</th>
                  <th scope="col">Client</th>
                  <th scope="col">Time</th>
                  <th scope="col"><span className="srOnly">IP action</span></th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="emptyState">
                        <strong>No matching events</strong>
                        <p className="muted small">New account activity will appear here automatically.</p>
                      </div>
                    </td>
                  </tr>
                ) : activityLogs.map((log) => {
                  const metadataEmail = getMetadataValue(log.metadata, "email");
                  const metadataRole = getMetadataValue(log.metadata, "role");
                  const path = getMetadataValue(log.metadata, "path") || log.targetId;
                  const affectedIp = getMetadataValue(log.metadata, "blockedIpAddress") || getMetadataValue(log.metadata, "unblockedIpAddress");
                  const userEmail = log.actorUser?.email ?? metadataEmail ?? "System event";
                  const userName = log.actorUser?.name || userEmail;
                  const role = log.actorUser?.adminRole || metadataRole;
                  const displayTarget = affectedIp || path || log.company?.name || log.targetType || "Platform";
                  const canBlock = Boolean(log.ipAddress && normalizeIpAddress(log.ipAddress));

                  return (
                    <tr key={log.id}>
                      <td>
                        <span className={`badge logsBadge logsBadge--${getActionTone(log.action)}`}>
                          {formatAction(log.action)}
                        </span>
                        <p className="muted small logsEventType">{log.action}</p>
                      </td>
                      <td>
                        <strong>{userName}</strong>
                        <p className="muted small">{role ? formatRole(role) : userEmail}</p>
                      </td>
                      <td className="logsTargetCell">
                        {log.company ? <Link href={`/admin/tenants/${log.company.id}`}>{displayTarget}</Link> : <strong>{displayTarget}</strong>}
                        <p className="muted small">{log.company?.name || log.targetType || "Security"}</p>
                      </td>
                      <td>
                        <code>{log.ipAddress || "Unknown"}</code>
                        {log.ipAddress && blockedIpSet.has(log.ipAddress) ? <span className="logsInlineStatus">blocked</span> : null}
                      </td>
                      <td className="logsClientCell">
                        <span title={log.userAgent || undefined}>{log.userAgent || "Unknown client"}</span>
                      </td>
                      <td className="logsTimeCell">{formatDate(log.createdAt)}</td>
                      <td className="logsActionCell">
                        {canBlock && log.ipAddress ? (
                          <IpBlockButton
                            ipAddress={log.ipAddress}
                            isBlocked={blockedIpSet.has(log.ipAddress)}
                            isCurrentIp={currentIp === log.ipAddress}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </InternalAdminShell>
  );
}
