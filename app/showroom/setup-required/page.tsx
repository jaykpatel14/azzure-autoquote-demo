import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ShowroomSetupRequiredPage({
  searchParams
}: {
  searchParams: Promise<{ serial?: string }>;
}) {
  const { serial = "" } = await searchParams;

  return (
    <div className="showroomInactive" style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <h1>Setup required</h1>
        <p style={{ color: "#9ca3af", lineHeight: 1.6 }}>
          This kiosk cannot complete setup because the serial number is missing, unknown, or deactivated.
        </p>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Serial: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{serial || "—"}</span>
        </p>
        <Link className="button primary" href="/signin">
          Sign in to manage hardware
        </Link>
      </div>
    </div>
  );
}
