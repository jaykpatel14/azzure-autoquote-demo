"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function MobileUploadInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";
  const token = searchParams.get("token") || "";

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const previews = files.map((file) => URL.createObjectURL(file));

  function handleFileSelection(newFiles: File[]) {
    setError("");
    const combined = [...files, ...newFiles].slice(0, 3);
    setFiles(combined);
  }

  function removeFile(indexToRemove: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
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
      files.forEach((file) => {
        formData.append("files", file);
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
        maxWidth: 440,
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
          fontSize: 28
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 30 }}>smartphone</span>
        </div>

        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: "0 0 8px", color: "#ffffff" }}>
          Upload to Showroom Screen
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: "0 0 24px", lineHeight: 1.4 }}>
          Snap a photo or select up to 3 inspiration images from your phone to send directly to the kiosk.
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
              Photos Sent Successfully!
            </strong>
            <p style={{ fontSize: "0.875rem", color: "#cbd5e1", margin: 0, lineHeight: 1.4 }}>
              Look at the showroom screen — your reference photos have been loaded into your quote workspace.
            </p>
          </div>
        ) : (
          <>
            {/* Camera & Library Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <label style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "16px 12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px dashed rgba(201, 168, 76, 0.4)",
                borderRadius: 12,
                cursor: "pointer",
                color: "#e2e8f0",
                fontSize: "0.8125rem",
                fontWeight: 600
              }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    if (selected.length) handleFileSelection(selected);
                  }}
                />
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#d9b85f" }}>photo_camera</span>
                Take Photo
              </label>

              <label style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "16px 12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px dashed rgba(201, 168, 76, 0.4)",
                borderRadius: 12,
                cursor: "pointer",
                color: "#e2e8f0",
                fontSize: "0.8125rem",
                fontWeight: 600
              }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    if (selected.length) handleFileSelection(selected);
                  }}
                />
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#d9b85f" }}>photo_library</span>
                Photo Library
              </label>
            </div>

            {/* Thumbnail previews */}
            {previews.length > 0 ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${previews.length}, 1fr)`,
                gap: 10,
                marginBottom: 20
              }}>
                {previews.map((src, idx) => (
                  <div key={src} style={{ position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: "1" }}>
                    <img src={src} alt={`Selected ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "rgba(0, 0, 0, 0.75)",
                        border: "none",
                        color: "#ffffff",
                        fontSize: 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

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
                  Sending to Screen…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send_to_mobile</span>
                  Send {files.length ? `(${files.length}) ` : ""}to Kiosk Screen
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function MobileUploadPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#fff" }}>Loading mobile upload...</div>}>
      <MobileUploadInner />
    </Suspense>
  );
}
