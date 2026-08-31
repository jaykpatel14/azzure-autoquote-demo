"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useMemo } from "react";

const MOBILE_ANGLE_SLOTS = [
  { id: "top_face" as const, title: "1. Top / Face View", badge: "Primary", desc: "Anchors shape & carat weight", icon: "diamond" },
  { id: "side_profile" as const, title: "2. Side Profile", badge: "Gallery", desc: "Prongs & under-gallery basket", icon: "filter_hdr" },
  { id: "angle_view" as const, title: "3. 3/4 Perspective", badge: "Angle", desc: "Shank & side stones", icon: "view_in_ar" },
  { id: "tag_receipt" as const, title: "4. Tag / Certificate", badge: "Ground Truth", desc: "Printed carat weight & purity", icon: "receipt_long" }
];

type MobileAngleKey = (typeof MOBILE_ANGLE_SLOTS)[number]["id"];

function MobileUploadInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";
  const token = searchParams.get("token") || "";

  const [slotFiles, setSlotFiles] = useState<Record<MobileAngleKey, File | null>>({
    top_face: null,
    side_profile: null,
    angle_view: null,
    tag_receipt: null
  });
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const slotPreviews = useMemo(() => {
    return {
      top_face: slotFiles.top_face ? URL.createObjectURL(slotFiles.top_face) : null,
      side_profile: slotFiles.side_profile ? URL.createObjectURL(slotFiles.side_profile) : null,
      angle_view: slotFiles.angle_view ? URL.createObjectURL(slotFiles.angle_view) : null,
      tag_receipt: slotFiles.tag_receipt ? URL.createObjectURL(slotFiles.tag_receipt) : null
    };
  }, [slotFiles]);

  const files = useMemo(() => {
    return [slotFiles.top_face, slotFiles.side_profile, slotFiles.angle_view, slotFiles.tag_receipt].filter(Boolean) as File[];
  }, [slotFiles]);

  function handleBatchFiles(newFiles: File[]) {
    setError("");
    setSlotFiles((current) => {
      const next = { ...current };
      const slots: MobileAngleKey[] = ["top_face", "side_profile", "angle_view", "tag_receipt"];
      let incomingIdx = 0;
      for (const slot of slots) {
        if (!next[slot] && incomingIdx < newFiles.length) {
          next[slot] = newFiles[incomingIdx];
          incomingIdx++;
        }
      }
      if (incomingIdx === 0 && newFiles.length > 0) {
        newFiles.slice(0, 4).forEach((file, idx) => {
          if (slots[idx]) next[slots[idx]] = file;
        });
      }
      return next;
    });
  }

  function handleSlotFile(slot: MobileAngleKey, file: File) {
    setError("");
    setSlotFiles((prev) => ({ ...prev, [slot]: file }));
  }

  function removeSlotFile(slot: MobileAngleKey) {
    setSlotFiles((prev) => ({ ...prev, [slot]: null }));
  }

  async function handleUpload() {
    if (!files.length) {
      setError("Please select at least one photo.");
      return;
    }
    if (!sessionId) {
      setError("Invalid or expired session. Please scan the QR code again.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("token", token);
      MOBILE_ANGLE_SLOTS.forEach((slot) => {
        const file = slotFiles[slot.id];
        if (file) {
          formData.append("files", file);
          formData.append("angles", slot.id);
        }
      });

      const response = await fetch("/api/showroom/mobile-upload", {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send photos to the kiosk.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photos.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #090e17 0%, #111a2e 100%)",
      color: "#ffffff",
      fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
      padding: "24px 16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{
        maxWidth: 480,
        width: "100%",
        background: "rgba(18, 26, 44, 0.85)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(201, 168, 76, 0.25)",
        borderRadius: 20,
        padding: "28px 20px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
        textAlign: "center"
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "rgba(201, 168, 76, 0.15)",
          color: "#d9b85f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: 30
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 30 }}>diamond</span>
        </div>

        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: "0 0 8px", color: "#ffffff" }}>
          Multi-Angle Phone Upload
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: "0 0 20px", lineHeight: 1.4 }}>
          Snap photos into each tagged angle slot. Face and side views ensure highest AI quotation accuracy.
        </p>

        {success ? (
          <div style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: 16,
            padding: "28px 20px",
            marginTop: 12
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#10b981", display: "block", marginBottom: 12 }}>
              check_circle
            </span>
            <strong style={{ fontSize: "1.125rem", color: "#ffffff", display: "block", marginBottom: 6 }}>
              {files.length} Photo{files.length === 1 ? "" : "s"} Sent to Kiosk!
            </strong>
            <p style={{ fontSize: "0.875rem", color: "#cbd5e1", margin: 0, lineHeight: 1.4 }}>
              Look at the showroom screen — your reference angles have been loaded and tagged into your quote workspace.
            </p>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 20
            }}>
              {MOBILE_ANGLE_SLOTS.map((slot) => {
                const previewSrc = slotPreviews[slot.id];
                return (
                  <div
                    key={slot.id}
                    style={{
                      background: previewSrc ? "rgba(201, 168, 76, 0.1)" : "rgba(255, 255, 255, 0.04)",
                      border: previewSrc ? "1px solid rgba(201, 168, 76, 0.6)" : "1px dashed rgba(201, 168, 76, 0.3)",
                      borderRadius: 14,
                      padding: "12px 10px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: 140,
                      position: "relative"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ffffff", textAlign: "left" }}>
                        {slot.title}
                      </span>
                      <span style={{
                        fontSize: "0.625rem",
                        padding: "2px 5px",
                        borderRadius: 4,
                        background: slot.id === "top_face" ? "rgba(201, 168, 76, 0.3)" : "rgba(255, 255, 255, 0.1)",
                        color: slot.id === "top_face" ? "#d9b85f" : "#94a3b8",
                        fontWeight: 600
                      }}>
                        {slot.badge}
                      </span>
                    </div>

                    {previewSrc ? (
                      <div style={{ position: "relative", width: "100%", height: 74, borderRadius: 8, overflow: "hidden", marginTop: "auto" }}>
                        <img src={previewSrc} alt={slot.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                          type="button"
                          onClick={() => removeSlotFile(slot.id)}
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: "rgba(0, 0, 0, 0.8)",
                            border: "none",
                            color: "#ffffff",
                            fontSize: 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", marginTop: "auto" }}>
                        <p style={{ fontSize: "0.6875rem", color: "#94a3b8", margin: "0 0 8px", lineHeight: 1.2 }}>
                          {slot.desc}
                        </p>
                        <label style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                          padding: "6px 8px",
                          background: "rgba(201, 168, 76, 0.15)",
                          border: "1px solid rgba(201, 168, 76, 0.35)",
                          borderRadius: 8,
                          color: "#d9b85f",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleSlotFile(slot.id, file);
                            }}
                          />
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>photo_camera</span>
                          Snap Angle
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "rgba(255, 255, 255, 0.06)",
                borderRadius: 10,
                color: "#cbd5e1",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: "pointer"
              }}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    if (selected.length) handleBatchFiles(selected);
                  }}
                />
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#d9b85f" }}>photo_library</span>
                Choose Multiple from Photo Library
              </label>
            </div>

            {error ? (
              <p style={{ color: "#ef4444", fontSize: "0.8125rem", margin: "0 0 16px" }}>{error}</p>
            ) : null}

            <button
              type="button"
              disabled={uploading || files.length === 0}
              onClick={handleUpload}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: 12,
                background: files.length > 0 ? "linear-gradient(135deg, #d9b85f 0%, #b8933b 100%)" : "rgba(255, 255, 255, 0.1)",
                color: files.length > 0 ? "#0f172a" : "#64748b",
                fontWeight: 700,
                fontSize: "0.95rem",
                border: "none",
                cursor: files.length > 0 && !uploading ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: files.length > 0 ? "0 4px 14px rgba(217, 184, 95, 0.35)" : "none",
                transition: "all 0.2s ease"
              }}
            >
              {uploading ? (
                <>
                  <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 20 }}>sync</span>
                  Sending to Kiosk Screen…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
                  Send {files.length ? `${files.length} Photo${files.length === 1 ? "" : "s"}` : "Photos"} to Screen
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ShowroomMobileUploadPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#ffffff" }}>Loading upload workspace…</div>}>
      <MobileUploadInner />
    </Suspense>
  );
}
