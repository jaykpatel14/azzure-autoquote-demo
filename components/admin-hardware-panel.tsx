"use client";

import { useEffect, useMemo, useState } from "react";

type CandidateScreen = {
  id: string;
  companyId: string;
  deviceName: string;
  lastSeenAt: string;
  lastSeenIp: string | null;
  platform: string;
};

type HardwareCompany = {
  id: string;
  name: string;
  slug: string;
  showroomSession?: {
    token: string;
    isActive: boolean;
  } | null;
};

type HardwareDevice = {
  id: string;
  serialNumber: string;
  deviceType: "KIOSK" | "PRINTER";
  status: "PRE_PROVISIONED" | "ACTIVATED" | "DEACTIVATED";
  companyId: string | null;
  orderId: string | null;
  notes: string | null;
  kioskDestination: string;
  shippedAt: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  company?: HardwareCompany | null;
  showroomDevice?: {
    id: string;
    deviceName: string;
    lastSeenAt: string;
    lastSeenIp: string | null;
    isActive: boolean;
  } | null;
  candidateScreens?: CandidateScreen[];
};

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Not yet";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function getHeartbeatStatus(lastSeenAt: string | null, isActive: boolean) {
  if (!isActive) {
    return {
      label: "Deactivated",
      detail: "Heartbeat disabled",
      dot: "○",
      textColor: "#dc2626",
      background: "rgba(239, 68, 68, 0.08)",
      borderColor: "rgba(239, 68, 68, 0.22)"
    };
  }

  if (!lastSeenAt) {
    return {
      label: "Awaiting first ping",
      detail: "Waiting for physical kiosk to connect",
      dot: "◌",
      textColor: "#d97706",
      background: "rgba(245, 158, 11, 0.08)",
      borderColor: "rgba(245, 158, 11, 0.22)"
    };
  }

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMins = diffMs / 60000;

  if (diffMins <= 3) {
    return {
      label: `Online · ${formatRelativeTime(lastSeenAt)}`,
      detail: "Heartbeat is current & verified",
      dot: "●",
      textColor: "#059669",
      background: "rgba(16, 185, 129, 0.08)",
      borderColor: "rgba(16, 185, 129, 0.22)"
    };
  }

  if (diffMins <= 10) {
    return {
      label: `Recent · ${formatRelativeTime(lastSeenAt)}`,
      detail: "Heartbeat lagging slightly",
      dot: "◔",
      textColor: "#d97706",
      background: "rgba(245, 158, 11, 0.08)",
      borderColor: "rgba(245, 158, 11, 0.22)"
    };
  }

  return {
    label: `Offline · ${formatRelativeTime(lastSeenAt)}`,
    detail: "Heartbeat has gone stale",
    dot: "○",
    textColor: "#64748b",
    background: "rgba(100, 116, 139, 0.08)",
    borderColor: "rgba(100, 116, 139, 0.22)"
  };
}

function getLifecycleLabel(device: HardwareDevice) {
  const isHeartbeatLive = Boolean(
    device.showroomDevice?.isActive &&
      getHeartbeatStatus(device.showroomDevice.lastSeenAt, device.showroomDevice.isActive).label.startsWith("Online")
  );

  if (device.status === "DEACTIVATED") {
    return "Deactivated";
  }

  if (device.status === "ACTIVATED") {
    return isHeartbeatLive ? "Active (Online)" : "Activated";
  }

  if (isHeartbeatLive) {
    return "Live Kiosk";
  }

  return "Pre-provisioned";
}

export default function AdminHardwarePanel({
  initialDevices,
  companies
}: {
  initialDevices: HardwareDevice[];
  companies: HardwareCompany[];
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [serialNumber, setSerialNumber] = useState("");
  const [deviceType, setDeviceType] = useState<"KIOSK" | "PRINTER">("KIOSK");
  const [companyId, setCompanyId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [heartbeatBusyId, setHeartbeatBusyId] = useState<string | null>(null);
  const [linkingBusyId, setLinkingBusyId] = useState<string | null>(null);
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

  const companyMap = useMemo(() => {
    return new Map(companies.map((company) => [company.id, company]));
  }, [companies]);

  const companyLabel = useMemo(() => {
    return (id: string | null) => (id ? companyMap.get(id)?.name || "Unassigned" : "Unassigned");
  }, [companyMap]);

  // Suggest next serial on initial load
  useEffect(() => {
    const year = new Date().getFullYear();
    const prefix = `AZQ-${year}-`;
    const serialNumbers = devices
      .map((d) => d.serialNumber)
      .filter((s) => s.startsWith(prefix))
      .map((s) => Number.parseInt(s.split("-")[2] || "0", 10))
      .filter((n) => !Number.isNaN(n));

    const maxNum = serialNumbers.length > 0 ? Math.max(...serialNumbers) : 0;
    setSerialNumber(`${prefix}${String(maxNum + 1).padStart(5, "0")}`);
  }, [devices]);

  async function refreshDevices() {
    try {
      const response = await fetch("/api/admin/hardware");
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.devices) {
        return;
      }

      setDevices(data.devices);
    } catch {
      // Keep the current list if polling fails momentarily.
    }
  }

  // Poll every 5 seconds for real-time heartbeat updates
  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshDevices();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  async function createDevice(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      const response = await fetch("/api/admin/hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber: serialNumber.trim() || undefined,
          deviceType,
          companyId: companyId || undefined,
          orderId: orderId.trim() || undefined,
          notes: notes.trim() || undefined
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to register device.");
      }

      setDevices((current) => [data.device, ...current]);
      setCompanyId("");
      setOrderId("");
      setNotes("");
      setSuccessMsg(`Device ${data.device?.serialNumber || ""} successfully registered.`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register device.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateDevice(id: string) {
    if (!confirm("Deactivate this device? The kiosk will stop functioning on the next heartbeat.")) return;

    try {
      const response = await fetch(`/api/admin/hardware/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to deactivate device.");
      }

      setDevices((current) =>
        current.map((device) =>
          device.id === id
            ? {
                ...device,
                status: "DEACTIVATED",
                deactivatedAt: new Date().toISOString(),
                showroomDevice: device.showroomDevice
                  ? { ...device.showroomDevice, isActive: false }
                  : device.showroomDevice
              }
            : device
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to deactivate device.");
    }
  }

  async function heartbeatDevice(id: string) {
    if (heartbeatBusyId) return;

    setHeartbeatBusyId(id);
    setError("");

    try {
      const response = await fetch(`/api/admin/hardware/${id}/heartbeat`, {
        method: "POST"
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to refresh heartbeat.");
      }

      await refreshDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh heartbeat.");
    } finally {
      setHeartbeatBusyId(null);
    }
  }

  async function linkCandidateScreen(azzureDeviceId: string, showroomDeviceId: string) {
    if (linkingBusyId) return;

    setLinkingBusyId(azzureDeviceId);
    setError("");

    try {
      const response = await fetch(`/api/admin/hardware/${azzureDeviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkShowroomDeviceId: showroomDeviceId })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to link screen.");
      }

      await refreshDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to link screen.");
    } finally {
      setLinkingBusyId(null);
    }
  }

  async function handleRemoteCommand(deviceId: string, deviceName: string, command: string) {
    try {
      const res = await fetch(`/api/showroom/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch remote command.");
      alert(`Success: ${data.message || `Command sent to ${deviceName}.`}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to dispatch remote command.");
    }
  }

  function copySetupUrl(serial: string, token?: string | null) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = token
      ? `${origin}/showroom/setup?serial=${encodeURIComponent(serial)}&token=${encodeURIComponent(token)}`
      : `${origin}/api/resolve?serial=${encodeURIComponent(serial)}`;

    navigator.clipboard.writeText(url).then(() => {
      setCopiedSerial(serial);
      setTimeout(() => setCopiedSerial(null), 2500);
    });
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="card stack">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Hardware Inventory</span>
            <h2>Pre-provisioned Azzure devices</h2>
            <p className="muted">Register each physical kiosk before it ships, then let the serial-based setup flow activate it on first boot.</p>
          </div>
        </div>

        <form onSubmit={createDevice} className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label className="field">
            <span>Serial number</span>
            <input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
              placeholder="AZQ-2026-00003"
              required
            />
          </label>
          <label className="field">
            <span>Device type</span>
            <select value={deviceType} onChange={(e) => setDeviceType(e.target.value === "PRINTER" ? "PRINTER" : "KIOSK")}>
              <option value="KIOSK">Kiosk (Showroom)</option>
              <option value="PRINTER">Printer (Receipt / Label)</option>
            </select>
          </label>
          <label className="field">
            <span>Assign to company</span>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Unassigned</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Order ID</span>
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="ORD-8821" />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>Notes / Location</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Front entrance display" />
          </label>
          {error ? <p style={{ color: "#ef4444", margin: 0, gridColumn: "1 / -1" }}>{error}</p> : null}
          {successMsg ? <p style={{ color: "#10b981", margin: 0, gridColumn: "1 / -1" }}>{successMsg}</p> : null}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button className="button primary" type="submit" disabled={saving}>
              {saving ? "Registering…" : "Register new device"}
            </button>
          </div>
        </form>
      </section>

      <section className="card stack">
        <div className="sectionHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Registered hardware</h3>
            <p className="muted">Live inventory, heartbeat telemetry, and showroom screen pairing.</p>
          </div>
          <button
            className="button secondary button--sm"
            type="button"
            onClick={() => refreshDevices()}
          >
            🔄 Refresh List
          </button>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          {devices.length === 0 ? (
            <div className="emptyState">
              <strong>No hardware devices yet.</strong>
              <p className="muted">Register a kiosk above to start the shipping and verification workflow.</p>
            </div>
          ) : devices.map((device) => {
            const lastSeen = device.showroomDevice?.lastSeenAt || null;
            const isActive = device.status !== "DEACTIVATED" && (device.showroomDevice?.isActive ?? true);
            const hb = getHeartbeatStatus(lastSeen, isActive);
            const showroomToken = device.company?.showroomSession?.token || null;
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const setupUrl = showroomToken
              ? `${origin}/showroom/setup?serial=${encodeURIComponent(device.serialNumber)}&token=${encodeURIComponent(showroomToken)}`
              : `${origin}/api/resolve?serial=${encodeURIComponent(device.serialNumber)}`;

            return (
              <article
                key={device.id}
                style={{
                  padding: 20,
                  borderRadius: 16,
                  border: `1px solid ${device.status === "ACTIVATED" && lastSeen ? "#cbd5e1" : "#e2e8f0"}`,
                  background: "#ffffff",
                  boxShadow: "0 4px 18px rgba(15, 23, 42, 0.04)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 340px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 19, color: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                        {device.serialNumber}
                      </strong>
                      <span className="badge">{device.deviceType}</span>
                      <span
                        className="badge"
                        style={{
                          background:
                            device.status === "ACTIVATED"
                              ? "rgba(16,185,129,0.15)"
                              : device.status === "DEACTIVATED"
                              ? "rgba(239,68,68,0.15)"
                              : "rgba(245,158,11,0.15)",
                          color:
                            device.status === "ACTIVATED"
                              ? "#047857"
                              : device.status === "DEACTIVATED"
                              ? "#dc2626"
                              : "#b45309"
                        }}
                      >
                        {device.status}
                      </span>
                      {device.showroomDevice?.isActive && (
                        <span
                          className="badge"
                          style={{
                            background: hb.background,
                            color: hb.textColor,
                            borderColor: hb.borderColor
                          }}
                        >
                          {hb.dot} {hb.label}
                        </span>
                      )}
                    </div>

                    <p style={{ margin: "8px 0 0", color: "#334155", fontSize: 14 }}>
                      Assigned to: <strong style={{ color: "#0f172a" }}>{companyLabel(device.companyId)}</strong>
                      {device.orderId ? ` · Order #${device.orderId}` : ""}
                      {device.notes ? ` · ${device.notes}` : ""}
                    </p>

                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                      Lifecycle: <strong style={{ color: "#0f172a" }}>{getLifecycleLabel(device)}</strong>
                      {device.status === "PRE_PROVISIONED"
                        ? " · Pre-provisioned in inventory; binds automatically when physical screen boots or links."
                        : ""}
                    </p>

                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                      Created {formatDate(device.createdAt)} · Shipped {formatDate(device.shippedAt)} · Activated {formatDate(device.activatedAt)}
                    </p>

                    {/* Showroom Screen & Heartbeat Status Box */}
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: hb.background,
                        border: `1px solid ${hb.borderColor}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: hb.textColor, fontSize: "1.1rem" }}>{hb.dot}</span>
                          <strong style={{ color: hb.textColor, fontSize: 13 }}>{hb.label}</strong>
                          <span style={{ color: "#64748b", fontSize: 12 }}>({hb.detail})</span>
                        </div>
                        {device.showroomDevice?.lastSeenIp ? (
                          <span style={{ fontSize: 12, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
                            IP: {device.showroomDevice.lastSeenIp}
                          </span>
                        ) : null}
                      </div>

                      {device.showroomDevice ? (
                        <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>
                          Linked screen: <strong style={{ color: "#0f172a" }}>{device.showroomDevice.deviceName}</strong>
                        </p>
                      ) : (
                        <div style={{ marginTop: 4 }}>
                          <p style={{ margin: "0 0 6px", fontSize: 12, color: "#475569" }}>
                            No screen linked yet. Use the setup link below on the physical kiosk or link a detected active screen:
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <code
                              style={{
                                fontSize: 11,
                                padding: "3px 8px",
                                background: "rgba(0,0,0,0.06)",
                                borderRadius: 6,
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                              }}
                            >
                              {setupUrl}
                            </code>
                            <button
                              className="button secondary button--sm"
                              type="button"
                              onClick={() => copySetupUrl(device.serialNumber, showroomToken)}
                              style={{ padding: "3px 8px", fontSize: 11 }}
                            >
                              {copiedSerial === device.serialNumber ? "✓ Copied!" : "📋 Copy Setup Link"}
                            </button>
                            <a
                              href={setupUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="button secondary button--sm"
                              style={{ padding: "3px 8px", fontSize: 11, textDecoration: "none" }}
                            >
                              🔗 Open Screen
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Candidate Unlinked Screens detected for this company */}
                    {!device.showroomDevice && device.candidateScreens && device.candidateScreens.length > 0 ? (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: "rgba(59, 130, 246, 0.06)",
                          border: "1px solid rgba(59, 130, 246, 0.2)"
                        }}
                      >
                        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>
                          💡 Active kiosk screen detected for this company:
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {device.candidateScreens.map((screen) => (
                            <div
                              key={screen.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                background: "#ffffff",
                                padding: "6px 12px",
                                borderRadius: 8,
                                border: "1px solid #e2e8f0"
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: 13, color: "#0f172a" }}>{screen.deviceName}</strong>
                                <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>
                                  Last ping {formatRelativeTime(screen.lastSeenAt)} {screen.lastSeenIp ? `· IP ${screen.lastSeenIp}` : ""}
                                </span>
                              </div>
                              <button
                                className="button primary button--sm"
                                type="button"
                                style={{ padding: "4px 10px", fontSize: 12 }}
                                disabled={linkingBusyId === device.id}
                                onClick={() => linkCandidateScreen(device.id, screen.id)}
                              >
                                {linkingBusyId === device.id ? "Linking…" : "🔗 Link & Verify This Kiosk"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Actions column */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {device.showroomDevice && device.showroomDevice.isActive ? (
                      <>
                        <button
                          className="button secondary button--sm"
                          type="button"
                          title="Force physical screen to refresh and reload latest code"
                          onClick={() => handleRemoteCommand(device.showroomDevice!.id, device.showroomDevice!.deviceName, "reload")}
                          style={{ borderColor: "rgba(59, 130, 246, 0.4)", color: "#2563eb" }}
                        >
                          🔄 Remote Reload
                        </button>
                        <button
                          className="button secondary button--sm"
                          type="button"
                          title="Clear local drafts and cache on physical screen"
                          onClick={() => handleRemoteCommand(device.showroomDevice!.id, device.showroomDevice!.deviceName, "clear_cache")}
                          style={{ borderColor: "rgba(245, 158, 11, 0.4)", color: "#d97706" }}
                        >
                          🧹 Clear Cache
                        </button>
                      </>
                    ) : null}

                    <button
                      className="button secondary button--sm"
                      type="button"
                      onClick={() => heartbeatDevice(device.id)}
                      disabled={heartbeatBusyId === device.id}
                      style={{
                        borderColor: "rgba(16, 185, 129, 0.4)",
                        color: "#059669",
                        fontWeight: 600
                      }}
                    >
                      {heartbeatBusyId === device.id ? "Pinging…" : "💓 Heartbeat now"}
                    </button>

                    {device.status !== "DEACTIVATED" ? (
                      <button className="button secondary button--sm" type="button" onClick={() => deactivateDevice(device.id)}>
                        Deactivate
                      </button>
                    ) : (
                      <span className="badge" style={{ background: "rgba(239,68,68,0.12)", color: "#b91c1c" }}>
                        Deactivated
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

