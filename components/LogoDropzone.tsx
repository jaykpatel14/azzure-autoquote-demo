"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";

type LogoDropzoneProps = {
  initialLogoUrl?: string | null;
  companyName: string;
  canUseLogo: boolean;
};

export default function LogoDropzone({
  initialLogoUrl,
  companyName,
  canUseLogo
}: LogoDropzoneProps) {
  const [logoUrl, setLogoUrl] = useState<string>(initialLogoUrl ?? "");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFile(file: File) {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, SVG, or WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image file size must be under 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setLogoUrl(e.target.result);
      }
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!canUseLogo) return;
    setIsDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (!canUseLogo) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  return (
    <div className="logoUploadContainer">
      <input type="hidden" name="logoUrl" value={logoUrl} />

      <div className="field">
        <span className="fieldLabel">Store Logo</span>
        
        {canUseLogo ? (
          <div
            className={`logoDropzone${isDragging ? " isDragging" : ""}${logoUrl ? " hasLogo" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload store logo"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/svg+xml, image/webp"
              onChange={onFileChange}
              style={{ display: "none" }}
            />

            {logoUrl ? (
              <div className="logoPreviewInner">
                <img src={logoUrl} alt="Store logo preview" className="logoPreviewImage" />
                <div className="logoPreviewOverlay">
                  <span>Click or drop new file to replace</span>
                </div>
              </div>
            ) : (
              <div className="logoDropzonePrompt">
                <div className="logoUploadIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <strong>Drag &amp; drop your logo here, or browse</strong>
                <p className="muted small">Supports PNG, JPG, SVG, or WEBP up to 5 MB</p>
              </div>
            )}
          </div>
        ) : (
          <div className="logoLockedBox">
            <p className="muted small">
              Upload your store logo on the Professional, Enterprise, or Ultra plan. Ultra subscribers unlock full Showroom &amp; Kiosk branding customization.
            </p>
          </div>
        )}

        {logoUrl && canUseLogo ? (
          <div className="logoActionRow">
            <button
              type="button"
              className="button secondary button--sm"
              onClick={(e) => {
                e.stopPropagation();
                setLogoUrl("");
              }}
            >
              Remove Logo
            </button>
            <span className="muted small">Shown in quote PDFs, public share links, and showroom mode.</span>
          </div>
        ) : null}

        {error ? <p className="fieldError">{error}</p> : null}
      </div>

      {/* Live Preview Card */}
      <div className="logoLivePreviewBox">
        <span className="eyebrow">Live Preview in Customer View</span>
        <div className="logoLivePreviewCanvas">
          {logoUrl ? (
            <img className="companyLogoPreview" src={logoUrl} alt={companyName} />
          ) : (
            <strong className="companyNameFallback">{companyName}</strong>
          )}
          <span className="quotePreviewPill">Official Estimate</span>
        </div>
      </div>
    </div>
  );
}
