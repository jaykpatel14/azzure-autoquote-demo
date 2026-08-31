"use client";

import { useEffect, useMemo, useState } from "react";

type HardwareCompany = {
  id: string;
  name: string;
  slug: string;
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
      textColor: "#b91c1c",
      background: "rgba(239, 68, 68, 0.08)",
      borderColor: "rgba(239, 68, 68, 0.22)"
    };
  }

  if (!lastSeenAt) {
    return {
      label: "No heartbeat yet",
      detail: "Waiting for first kiosk ping",
      dot: "◌",
      textColor: "#b45309",
      background: "rgba(245, 158, 11, 0.08)",
      borderColor: "rgba(245, 158, 11, 0.22)"
    };
  }

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMins = diffMs / 60000;

  if (diffMins <= 3) {
    return {
      label: `Online · ${formatRelativeTime(lastSeenAt)}`,
      detail: "Heartbeat is current",
      dot: "●",
      textColor: "#047857",
      background: "rgba(16, 185, 129, 0.08)",
      borderColor: "rgba(16, 185, 129, 0.22)"
    };
  }

  if (diffMins <= 10) {
    return {
      label: `Recent · ${formatRelativeTime(lastSeenAt)}`,
      detail: "Heartbeat lagging a little",
      dot: "◔",
      textColor: "#b45309",
      background: "rgba(245, 158, 11, 0.08)",
      borderColor: "rgba(245, 158, 11, 0.22)"
    };
  }

  return {
    label: `Offline · ${formatRelativeTime(lastSeenAt)}`,
    detail: "Heartbeat has gone stale",
    dot: "○",
    textColor: "#6b7280",
    background: "rgba(107, 114, 128, 0.08)",
    borderColor: "rgba(107, 114, 128, 0.22)"
  };
}

function getLifecycleLabel(device: HardwareDevice) {
  const isHeartbeatLive = Boolean(device.showroomDevice?.isActive && getHeartbeatStatus(device.showroomDevice.lastSeenAt, device.showroomDevice.isActive).label.startsWith("Online"));

  if (device.status === "DEACTIVATED") {
    return "Deactivated";
  }

  if (device.status === "ACTIVATED") {
    return "Activated";
  }

  if (isHeartbeatLive) {
    return "Live kiosk";
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
  const [heartbeatBusyId, setHeartbeatBusyId] = useState<string | null>(null);

  const companyLabel = useMemo(() => {
    const map = new Map(companies.map((company) => [company.id, company]));
    return (id: string | null) => (id ? map.get(id)?.name || "Unassigned" : "Unassigned");
  }, [companies]);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshDevices();
    }, 10000);

    const initialRefresh = window.setTimeout(() => {
      void refreshDevices();
    }, 0);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialRefresh);
    };
  }, []);

  async function createDevice(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");

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
      setSerialNumber("");
      setDeviceType("KIOSK");
      setCompanyId("");
      setOrderId("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register device.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateDevice(id: string) {
    if (!confirm("Deactivate this device? The kiosk will stop working on the next heartbeat.")) return;

    try {
      const response = await fetch(`/api/admin/hardware/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to deactivate device.");
      }

      setDevices((current) =>
        current.map((device) =>
          device.id === id
            ? { ...device, status: "DEACTIVATED", deactivatedAt: new Date().toISOString(), showroomDevice: device.showroomDevice ? { ...device.showroomDevice, isActive: false } : device.showroomDevice }
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

      setDevices((current) =>
        current.map((device) =>
          device.id === id && device.showroomDevice
            ? {
                ...device,
                showroomDevice: {
                  ...device.showroomDevice,
                  lastSeenAt: data.lastSeenAt || new Date().toISOString(),
                  lastSeenIp: data.lastSeenIp ?? device.showroomDevice.lastSeenIp,
                  isActive: true
                  }
                }
            : device
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh heartbeat.");
    } finally {
      setHeartbeatBusyId(null);
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
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="AZQ-2026-00147" />
          </label>
          <label className="field">
            <span>Device type</span>
            <select value={deviceType} onChange={(e) => setDeviceType(e.target.value === "PRINTER" ? "PRINTER" : "KIOSK")}>
              <option value="KIOSK">Kiosk</option>
              <option value="PRINTER">Printer</option>
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
            <span>Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Front entrance kiosk" />
          </label>
          {error ? <p style={{ color: "#fca5a5", margin: 0, gridColumn: "1 / -1" }}>{error}</p> : null}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button className="button primary" type="submit" disabled={saving}>
              {saving ? "Registering…" : "Register new device"}
            </button>
          </div>
        </form>
      </section>

      <section className="card stack">
        <div className="sectionHeader">
          <div>
            <h3 style={{ marginBottom: 4 }}>Registered hardware</h3>
            <p className="muted">Azzure inventory, activation state, and linked showroom screen.</p>
          </div>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          {devices.length === 0 ? (
            <div className="emptyState">
              <strong>No hardware devices yet.</strong>
              <p className="muted">Register a kiosk above to start the shipping workflow.</p>
            </div>
          ) : devices.map((device) => (
            <article
              key={device.id}
              style={{
                padding: 18,
                borderRadius: 16,
                border: "1px solid #dbe4f0",
                background: "#ffffff",
                boxShadow: "0 10px 28px rgba(15, 23, 42, 0.04)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>{device.serialNumber}</strong>
                    <span className="badge">{device.deviceType}</span>
                    <span className="badge" style={{ background: device.status === "ACTIVATED" ? "rgba(16,185,129,0.15)" : device.status === "DEACTIVATED" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)", color: device.status === "ACTIVATED" ? "#10b981" : device.status === "DEACTIVATED" ? "#f87171" : "#f59e0b" }}>
                      {device.status}
                    </span>
                    {device.status === "PRE_PROVISIONED" && device.showroomDevice?.isActive ? (
                      <span className="badge" style={{ background: "rgba(14,165,233,0.15)", color: "#0284c7" }}>
                        Live kiosk
                      </span>
                    ) : null}
                  </div>
                  <p style={{ margin: "8px 0 0", color: "#475569" }}>
                    Assigned to: <strong style={{ color: "#0f172a" }}>{companyLabel(device.companyId)}</strong>
                    {device.orderId ? ` · Order ${device.orderId}` : ""}
                    {device.notes ? ` · ${device.notes}` : ""}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#475569" }}>
                    Lifecycle: <strong style={{ color: "#0f172a" }}>{getLifecycleLabel(device)}</strong>
                    {device.status === "PRE_PROVISIONED"
                      ? " · This serial exists in inventory; it becomes fully activated after the kiosk completes the showroom activation flow."
                      : ""}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#475569" }}>
                    Created {formatDate(device.createdAt)} · Shipped {formatDate(device.shippedAt)} · Activated {formatDate(device.activatedAt)}
                  </p>
                  {device.showroomDevice ? (
                    <>
                      <p style={{ margin: "4px 0 0", color: "#475569" }}>
                        Linked showroom screen: <strong style={{ color: "#0f172a" }}>{device.showroomDevice.deviceName}</strong> · Last seen {formatRelativeTime(device.showroomDevice.lastSeenAt)}
                      </p>
                      <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                        Heartbeat: <strong style={{ color: "#0f172a" }}>{getHeartbeatStatus(device.showroomDevice.lastSeenAt, device.showroomDevice.isActive).label}</strong>
                        {device.showroomDevice.lastSeenIp ? ` · IP ${device.showroomDevice.lastSeenIp}` : ""}
                      </div>
                    </>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                      <button
                        className="button secondary button--sm"
                        type="button"
                        onClick={() => heartbeatDevice(device.id)}
                        disabled={heartbeatBusyId === device.id}
                      >
                        {heartbeatBusyId === device.id ? "Pinging…" : "Heartbeat now"}
                      </button>
                    </>
                  ) : null}
                  {device.status !== "DEACTIVATED" ? (
                    <button className="button secondary button--sm" type="button" onClick={() => deactivateDevice(device.id)}>
                      Deactivate
                    </button>
                  ) : (
                    <span className="badge" style={{ background: "rgba(239,68,68,0.12)", color: "#b91c1c" }}>Deactivated</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
