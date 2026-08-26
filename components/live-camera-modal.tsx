"use client";

import { useEffect, useRef, useState } from "react";

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
}

export default function LiveCameraModal({
  isOpen,
  onClose,
  onCapture,
  title = "Take Reference Photo"
}: LiveCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Stop camera tracks helper
  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  // Check available camera devices
  useEffect(() => {
    if (!isOpen) return;
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoDevices.length > 1);
      }).catch(() => {});
    }
  }, [isOpen]);

  // Start camera stream when modal opens or facingMode changes
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }

    let isMounted = true;

    async function startCamera() {
      stopStream();

      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Live camera is not supported in this browser. Please use the choose file option.");
        }

        let stream: MediaStream;
        try {
          // Attempt high-res capture with requested facingMode
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
        } catch (exactError) {
          // Fallback to any available video stream
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setIsInitializing(false);
      } catch (err: any) {
        if (!isMounted) return;
        setIsInitializing(false);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setCameraError("Camera access was denied. Please allow camera permissions in your browser or kiosk settings.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setCameraError("No camera found on this device.");
        } else {
          setCameraError(err.message || "Unable to access camera.");
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopStream();
    };
  }, [isOpen, facingMode]);

  function handleSnap() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw the current video frame onto canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedDataUrl(dataUrl);
  }

  function handleRetake() {
    setCapturedDataUrl(null);
  }

  function handleModalClose() {
    stopStream();
    setCapturedDataUrl(null);
    setCameraError(null);
    onClose();
  }

  function handleConfirm() {
    if (!capturedDataUrl) return;

    // Convert dataUrl to File
    const arr = capturedDataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });

    handleModalClose();
    onCapture(file);
  }

  function handleFallbackFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      handleModalClose();
      onCapture(selected[0]);
    }
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  if (!isOpen) return null;

  return (
    <div
      className="showroomModalBackdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(8px)"
      }}
      onClick={handleModalClose}
    >
      <div
        className="showroomModalCard"
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 24,
          padding: 24,
          maxWidth: 580,
          width: "100%",
          color: "#f8fafc",
          position: "relative",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="material-symbols-outlined" style={{ color: "#38bdf8", fontSize: 24 }}>photo_camera</span>
            <strong style={{ fontSize: "1.15rem", color: "#f8fafc" }}>{title}</strong>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#cbd5e1",
              cursor: "pointer"
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Viewfinder / Captured Preview Area */}
        <div
          style={{
            position: "relative",
            width: "100%",
            borderRadius: 16,
            overflow: "hidden",
            background: "#020617",
            aspectRatio: "4/3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #1e293b"
          }}
        >
          {cameraError ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 44, color: "#f87171", marginBottom: 12 }}>
                no_photography
              </span>
              <p style={{ color: "#fca5a5", fontSize: "0.95rem", margin: "0 0 16px" }}>{cameraError}</p>
              <label className="button primary button--md" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFallbackFileInput}
                  style={{ display: "none" }}
                />
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder_open</span>
                Choose Photo from Device
              </label>
            </div>
          ) : capturedDataUrl ? (
            <img
              src={capturedDataUrl}
              alt="Captured jewelry preview"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: facingMode === "user" ? "scaleX(-1)" : "none"
                }}
              />
              {isInitializing ? (
                <div style={{ position: "absolute", inset: 0, background: "rgba(2, 6, 23, 0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 36, color: "#38bdf8" }}>videocam</span>
                  <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Starting camera viewfinder…</span>
                </div>
              ) : null}

              {/* Jewelry focus frame guide */}
              <div
                style={{
                  position: "absolute",
                  inset: "15%",
                  border: "2px dashed rgba(56, 189, 248, 0.6)",
                  borderRadius: 16,
                  pointerEvents: "none",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.25)"
                }}
              />
            </>
          )}
        </div>

        {/* Controls Toolbar */}
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {capturedDataUrl ? (
            <>
              <button
                type="button"
                className="button secondary button--md"
                onClick={handleRetake}
                style={{ flex: 1, padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>replay</span>
                Retake
              </button>
              <button
                type="button"
                className="button primary button--md"
                onClick={handleConfirm}
                style={{ flex: 1, padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#0284c7" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                Use This Photo
              </button>
            </>
          ) : !cameraError ? (
            <>
              {hasMultipleCameras ? (
                <button
                  type="button"
                  className="button secondary button--sm"
                  onClick={toggleCamera}
                  title="Flip Camera"
                  style={{ width: 44, height: 44, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>flip_camera_ios</span>
                </button>
              ) : <div style={{ width: 44 }} />}

              {/* Central Shutter Button */}
              <button
                type="button"
                onClick={handleSnap}
                disabled={isInitializing}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#ffffff",
                  border: "4px solid #38bdf8",
                  cursor: isInitializing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 20px rgba(56, 189, 248, 0.4)",
                  transition: "transform 0.15s ease",
                  transform: "scale(1)"
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#0284c7" }} />
              </button>

              {/* Choose file fallback */}
              <label
                className="button secondary button--sm"
                style={{ width: 44, height: 44, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", cursor: "pointer" }}
                title="Choose file from device"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFallbackFileInput}
                  style={{ display: "none" }}
                />
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>folder</span>
              </label>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
