"use client";

import { useState, useEffect, useCallback } from "react";

type ShowroomDeviceItem = {
  id: string;
  deviceName: string;
  platform: string;
  lastSeenAt: string;
  isActive: boolean;
  registeredAt: string;
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getOnlineStatus(lastSeenAt: string, isActive: boolean) {
  if (!isActive) {
    return {
      dot: "○",
      color: "#6b7280",
      label: "Deactivated"
    };
  }

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMins = diffMs / 60000;

  if (diffMins <= 3) {
    return {
      dot: "●",
      color: "#10b981",
      label: `Online (${formatRelativeTime(lastSeenAt)})`
    };
  }

  if (diffMins <= 10) {
    return {
      dot: "◑",
      color: "#f59e0b",
      label: `Recent (${formatRelativeTime(lastSeenAt)})`
    };
  }

  return {
    dot: "○",
    color: "#9ca3af",
    label: `Offline (${formatRelativeTime(lastSeenAt)})`
  };
}

export default function ShowroomDevicesTab({
  showroomToken
}: {
  showroomToken: string | null;
}) {
  const [devices, setDevices] = useState<ShowroomDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rename modal state
  const [renamingDevice, setRenamingDevice] = useState<ShowroomDeviceItem | null>(null);
  const [newName, setNewName] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // Deactivate modal state
  const [deactivatingDevice, setDeactivatingDevice] = useState<ShowroomDeviceItem | null>(null);
  const [savingDeactivate, setSavingDeactivate] = useState(false);

  // Copy URL state
  const [copiedUrl, setCopiedUrl] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/showroom/devices");
      if (!res.ok) throw new Error("Failed to load registered devices.");
      const data = await res.json();
      setDevices(data.devices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingDevice || !newName.trim() || savingRename) return;

    setSavingRename(true);
    try {
      const res = await fetch(`/api/showroom/devices/${renamingDevice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName: newName.trim() })
      });
      if (!res.ok) throw new Error("Failed to rename device.");
      setRenamingDevice(null);
      await fetchDevices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename device.");
    } finally {
      setSavingRename(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingDevice || savingDeactivate) return;

    setSavingDeactivate(true);
    try {
      const res = await fetch(`/api/showroom/devices/${deactivatingDevice.id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to deactivate device.");
      setDeactivatingDevice(null);
      await fetchDevices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deactivate device.");
    } finally {
      setSavingDeactivate(false);
    }
  };

  const showroomUrl =
    typeof window !== "undefined" && showroomToken
      ? `${window.location.origin}/showroom?token=${showroomToken}`
      : "";

  const handleCopyUrl = () => {
    if (!showroomUrl) return;
    navigator.clipboard.writeText(showroomUrl).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <section className="card stack">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Physical Displays</span>
            <h2>Registered Showroom Devices</h2>
            <p className="muted">
              Manage in-store touchscreen kiosks, Android TV displays, and showroom tablets linked to your account.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="muted">Loading registered devices…</p>
        ) : error ? (
          <p style={{ color: "#ef4444" }}>{error}</p>
        ) : devices.length === 0 ? (
          <div className="emptyState">
            <strong>No showroom devices registered yet.</strong>
            <p className="muted">
              Open your showroom URL on a kiosk or Android TV display to link your first screen.
            </p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            {devices.map((device) => {
              const status = getOnlineStatus(device.lastSeenAt, device.isActive);
              return (
                <div
                  key={device.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    flexWrap: "wrap",
                    gap: 16
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ color: status.color, fontSize: "1.1rem" }}>{status.dot}</span>
                      <strong style={{ fontSize: "1.05rem", color: "#f8fafc" }}>{device.deviceName}</strong>
                      <span style={{ color: status.color, fontSize: "0.875rem", fontWeight: 500 }}>
                        {status.label}
                      </span>
                    </div>
                    <p className="muted small" style={{ margin: 0 }}>
                      {device.platform.toUpperCase()} · Registered {formatDate(device.registeredAt)}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {device.isActive ? (
                      <>
                        <button
                          className="button secondary button--sm"
                          type="button"
                          onClick={() => {
                            setRenamingDevice(device);
                            setNewName(device.deviceName);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          className="button secondary button--sm"
                          type="button"
                          style={{ color: "#fca5a5" }}
                          onClick={() => setDeactivatingDevice(device)}
                        >
                          Deactivate
                        </button>
                      </>
                    ) : (
                      <span className="badge" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>
                        Deactivated
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* How to add a new device section */}
      <section className="card stack">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Setup &amp; Pairing (~10 min)</span>
            <h3>Setting up your Android TV Kiosk</h3>
            <p className="muted">
              Turn any 32&quot; Android 15 touchscreen TV or tablet into an automated luxury quote kiosk.
            </p>
          </div>
        </div>

        <ol style={{ color: "#cbd5e1", lineHeight: 1.6, paddingLeft: 20, margin: "0 0 16px" }}>
          <li>On your Android TV, open Google Play Store → install <strong>Fully Kiosk Browser</strong>.</li>
          <li>Set <strong>Start URL</strong> to your Showroom Kiosk URL below.</li>
          <li>On first boot, the screen prompts &quot;Setting up this kiosk&quot; — enter a location name (e.g. <em>Front Entrance</em>).</li>
          <li>In Fully Kiosk settings, turn on <strong>Kiosk Mode</strong> (lock task) and <strong>Keep Screen On</strong>.</li>
          <li>Set Screensaver URL to your showroom screensaver link with a 90s delay.</li>
        </ol>

        {showroomUrl ? (
          <div>
            <label className="field">
              <span>Your Showroom Kiosk URL</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" readOnly value={showroomUrl} style={{ background: "rgba(0,0,0,0.3)" }} />
                <button className="button primary" type="button" onClick={handleCopyUrl} style={{ whiteSpace: "nowrap" }}>
                  {copiedUrl ? "Copied!" : "Copy URL"}
                </button>
              </div>
            </label>
          </div>
        ) : (
          <p className="muted">Showroom mode is not active. Enable Showroom Kiosk above to generate a URL.</p>
        )}
      </section>

      {/* Rename Modal */}
      {renamingDevice ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#12141a",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.8)"
            }}
          >
            <h3 style={{ margin: "0 0 12px", color: "#fff" }}>Rename Showroom Screen</h3>
            <form onSubmit={handleSaveRename} className="stack">
              <label className="field">
                <span>Screen Name</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Front Entrance"
                  maxLength={64}
                  required
                  autoFocus
                />
              </label>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setRenamingDevice(null)}
                  disabled={savingRename}
                >
                  Cancel
                </button>
                <button className="button primary" type="submit" disabled={savingRename}>
                  {savingRename ? "Saving…" : "Save Name"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Deactivate Confirmation Modal */}
      {deactivatingDevice ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#12141a",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.8)"
            }}
          >
            <h3 style={{ margin: "0 0 12px", color: "#f87171" }}>Deactivate Device?</h3>
            <p className="muted" style={{ margin: "0 0 20px", lineHeight: 1.5 }}>
              This will immediately disconnect <strong>{deactivatingDevice.deviceName}</strong>. The screen will be
              blocked and will need to be registered again before it can be used.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="button secondary"
                type="button"
                onClick={() => setDeactivatingDevice(null)}
                disabled={savingDeactivate}
              >
                Cancel
              </button>
              <button
                className="button primary"
                type="button"
                style={{ background: "#ef4444", borderColor: "#dc2626" }}
                onClick={handleConfirmDeactivate}
                disabled={savingDeactivate}
              >
                {savingDeactivate ? "Deactivating…" : "Deactivate Screen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
