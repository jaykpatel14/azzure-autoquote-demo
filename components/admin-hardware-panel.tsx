"use client";

import { useMemo, useState } from "react";

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

  const companyLabel = useMemo(() => {
    const map = new Map(companies.map((company) => [company.id, company]));
    return (id: string | null) => (id ? map.get(id)?.name || "Unassigned" : "Unassigned");
  }, [companies]);

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
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 18, color: "#fff" }}>{device.serialNumber}</strong>
                    <span className="badge">{device.deviceType}</span>
                    <span className="badge" style={{ background: device.status === "ACTIVATED" ? "rgba(16,185,129,0.15)" : device.status === "DEACTIVATED" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)", color: device.status === "ACTIVATED" ? "#10b981" : device.status === "DEACTIVATED" ? "#f87171" : "#f59e0b" }}>
                      {device.status}
                    </span>
                  </div>
                  <p className="muted small" style={{ margin: "8px 0 0" }}>
                    Assigned to: <strong style={{ color: "#fff" }}>{companyLabel(device.companyId)}</strong>
                    {device.orderId ? ` · Order ${device.orderId}` : ""}
                    {device.notes ? ` · ${device.notes}` : ""}
                  </p>
                  <p className="muted small" style={{ margin: "4px 0 0" }}>
                    Created {formatDate(device.createdAt)} · Shipped {formatDate(device.shippedAt)} · Activated {formatDate(device.activatedAt)}
                  </p>
                  {device.showroomDevice ? (
                    <p className="muted small" style={{ margin: "4px 0 0" }}>
                      Linked showroom screen: <strong style={{ color: "#fff" }}>{device.showroomDevice.deviceName}</strong> · Last seen {formatRelativeTime(device.showroomDevice.lastSeenAt)}
                    </p>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {device.status !== "DEACTIVATED" ? (
                    <button className="button secondary button--sm" type="button" onClick={() => deactivateDevice(device.id)}>
                      Deactivate
                    </button>
                  ) : (
                    <span className="badge" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>Deactivated</span>
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
