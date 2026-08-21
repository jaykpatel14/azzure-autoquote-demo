"use client";

export function AdminThumbImage({
  src,
  alt,
  fallback = "💍"
}: {
  src: string;
  alt: string;
  fallback?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
      onError={(e) => {
        (e.currentTarget as HTMLElement).style.display = "none";
        if (e.currentTarget.parentElement) {
          e.currentTarget.parentElement.innerHTML = `<span class="adminQuoteThumbFallback">${fallback}</span>`;
        }
      }}
    />
  );
}
