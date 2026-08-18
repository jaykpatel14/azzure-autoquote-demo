"use client";
import { useState } from "react";

export default function ShowroomSettingsActions({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken); const [busy, setBusy] = useState(false);
  const url = token && typeof window !== "undefined" ? `${window.location.origin}/showroom?token=${token}` : token ? `/showroom?token=${token}` : "";
  async function activate() { setBusy(true); const res = await fetch("/api/showroom/sessions", { method: "POST" }); const body = await res.json(); setBusy(false); if (res.ok) setToken(body.token); }
  async function revoke() { if (!confirm("Revoke the current kiosk link and generate a new one?")) return; await activate(); }
  return <div className="stack">
    <div className="statusBanner"><strong>Status: {token ? "Active" : "Not active"}</strong></div>
    {token ? <><label className="field"><span>Kiosk URL</span><input readOnly value={url} onFocus={e => e.currentTarget.select()} /></label><div className="buttonRow"><button className="button secondary" type="button" onClick={() => navigator.clipboard.writeText(url)}>Copy link</button><a className="button primary" href={url} target="_blank" rel="noreferrer">Open kiosk</a><button className="button danger" type="button" disabled={busy} onClick={revoke}>Revoke & generate new link</button></div></> : <button className="button primary" type="button" disabled={busy} onClick={activate}>{busy ? "Activating…" : "Activate Showroom Mode"}</button>}
  </div>;
}
