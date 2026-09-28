"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/toast-provider";

type BlockedIpRow = {
  id: string;
  ipAddress: string;
  reason: string | null;
  createdAt: string;
  blockedByName: string;
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || "The request could not be completed.";
}

export function IpBlockButton({ ipAddress, isBlocked, isCurrentIp }: { ipAddress: string; isBlocked: boolean; isCurrentIp: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function blockIp() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/logs/blocked-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipAddress, reason: "Blocked from the activity log" })
      });
      if (!response.ok) throw new Error(await readError(response));

      showToast({ message: `${ipAddress} is now blocked.`, variant: "success" });
      router.refresh();
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Unable to block this IP address.",
        variant: "error",
        autoDismiss: false
      });
    } finally {
      setLoading(false);
    }
  }

  if (isBlocked) {
    return <span className="badge logsBadge logsBadge--danger">Blocked</span>;
  }

  return (
    <button
      className="button secondary button--sm logsIconButton"
      type="button"
      onClick={blockIp}
      disabled={loading || isCurrentIp}
      title={isCurrentIp ? "Your current IP address cannot be blocked" : `Block ${ipAddress}`}
      aria-label={`Block IP address ${ipAddress}`}
    >
      <span className="material-symbols-outlined" aria-hidden="true">block</span>
      {loading ? "Blocking" : "Block"}
    </button>
  );
}

export function BlockedIpManager({ blockedIps, currentIp }: { blockedIps: BlockedIpRow[]; currentIp: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [ipAddress, setIpAddress] = useState("");
  const [reason, setReason] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/logs/blocked-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipAddress, reason })
      });
      if (!response.ok) throw new Error(await readError(response));

      showToast({ message: `${ipAddress.trim()} is now blocked.`, variant: "success" });
      setIpAddress("");
      setReason("");
      router.refresh();
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Unable to block this IP address.",
        variant: "error",
        autoDismiss: false
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function unblockIp(row: BlockedIpRow) {
    setLoadingId(row.id);
    try {
      const response = await fetch("/api/admin/logs/blocked-ips", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id })
      });
      if (!response.ok) throw new Error(await readError(response));

      showToast({ message: `${row.ipAddress} can access the app again.`, variant: "success" });
      router.refresh();
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Unable to unblock this IP address.",
        variant: "error",
        autoDismiss: false
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="logsBlockLayout">
      <form className="logsBlockForm" onSubmit={submitBlock}>
        <div className="field">
          <label htmlFor="blocked-ip-address">IP address</label>
          <input
            id="blocked-ip-address"
            value={ipAddress}
            onChange={(event) => setIpAddress(event.target.value)}
            placeholder="203.0.113.42 or 2001:db8::1"
            autoComplete="off"
            required
          />
          {currentIp ? <span className="hint">Your current address is {currentIp} and cannot be blocked here.</span> : null}
        </div>
        <div className="field">
          <label htmlFor="blocked-ip-reason">Reason</label>
          <input
            id="blocked-ip-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Suspicious login attempts"
            maxLength={300}
          />
        </div>
        <button className="button destructive" type="submit" disabled={submitting}>
          <span className="material-symbols-outlined" aria-hidden="true">block</span>
          {submitting ? "Blocking..." : "Block IP"}
        </button>
      </form>

      <div className="tableShell">
        <table className="dataTable logsTable">
          <thead>
            <tr>
              <th scope="col">IP address</th>
              <th scope="col">Reason</th>
              <th scope="col">Blocked by</th>
              <th scope="col">Blocked on</th>
              <th scope="col"><span className="srOnly">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {blockedIps.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="emptyState emptyState--compact">
                    <strong>No blocked IP addresses</strong>
                    <p className="muted small">Addresses blocked from login or activity records will appear here.</p>
                  </div>
                </td>
              </tr>
            ) : blockedIps.map((row) => (
              <tr key={row.id}>
                <td><code>{row.ipAddress}</code></td>
                <td>{row.reason || <span className="muted">No reason provided</span>}</td>
                <td>{row.blockedByName}</td>
                <td>{row.createdAt}</td>
                <td className="logsActionCell">
                  <button
                    className="button secondary button--sm"
                    type="button"
                    onClick={() => unblockIp(row)}
                    disabled={loadingId === row.id}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">lock_open</span>
                    {loadingId === row.id ? "Unblocking" : "Unblock"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
