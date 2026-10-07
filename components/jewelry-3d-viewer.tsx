"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";

export type Quote3DModelData = {
  id: string;
  meshyTaskId: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | string;
  progress: number;
  glbUrl?: string | null;
  usdzUrl?: string | null;
  objUrl?: string | null;
  fbxUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
};

interface Jewelry3DViewerProps {
  quoteId?: string;
  analysisId?: string;
  imageUrl?: string;
  initialModel?: Quote3DModelData | null;
  onModelUpdated?: (model: Quote3DModelData) => void;
}

export function Jewelry3DViewer({
  quoteId,
  analysisId,
  imageUrl,
  initialModel,
  onModelUpdated
}: Jewelry3DViewerProps) {
  const [model, setModel] = useState<Quote3DModelData | null>(initialModel || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Poll status while in progress
  useEffect(() => {
    if (!model || (model.status !== "IN_PROGRESS" && model.status !== "PENDING")) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/3d/status/${model.meshyTaskId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.model) {
          setModel(data.model);
          if (onModelUpdated) onModelUpdated(data.model);
        }
      } catch (err) {
        console.warn("3D status polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [model, onModelUpdated]);

  async function handleGenerate3D() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/3d/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, analysisId, imageUrl })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate 3D model generation");
      }
      setModel(data.model);
      if (onModelUpdated) onModelUpdated(data.model);
    } catch (err: any) {
      setError(err?.message || "Failed to initiate 3D generation.");
    } finally {
      setLoading(false);
    }
  }

  const glbDownloadUrl = model?.id ? `/api/3d/download/${model.id}?format=glb` : model?.glbUrl;
  const usdzDownloadUrl = model?.id ? `/api/3d/download/${model.id}?format=usdz` : model?.usdzUrl;
  const objDownloadUrl = model?.id ? `/api/3d/download/${model.id}?format=obj` : model?.objUrl;

  return (
    <div className="w-full rounded-xl border border-slate-700/60 bg-slate-900/90 p-4 shadow-xl text-slate-100">
      {/* Model Viewer Script for native 3D WebGL render */}
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"
        strategy="lazyOnload"
      />

      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-200">Interactive 3D Jewelry Mesh</h3>
            <p className="text-xs text-slate-400">Meshy AI Image-to-3D CAD Generation</p>
          </div>
        </div>

        {model?.status === "SUCCEEDED" && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 transition-all focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download 3D Asset
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-lg border border-slate-700 bg-slate-800 p-1 shadow-2xl z-50">
                {glbDownloadUrl && (
                  <a
                    href={glbDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 transition-colors"
                  >
                    <span className="font-medium">Binary GLTF (.GLB)</span>
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">WebGL / Blender</span>
                  </a>
                )}
                {usdzDownloadUrl && (
                  <a
                    href={usdzDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 transition-colors"
                  >
                    <span className="font-medium">Apple AR (.USDZ)</span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">iOS / QuickLook</span>
                  </a>
                )}
                {objDownloadUrl && (
                  <a
                    href={objDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 transition-colors"
                  >
                    <span className="font-medium">Wavefront OBJ (.OBJ)</span>
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">3D CAD / Print</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Container Area */}
      {!model && !loading && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-8 text-center">
          <div className="mb-3 rounded-full bg-indigo-500/10 p-3 text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-300 mb-1">Generate 3D CAD Mesh from Render</p>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            Convert the OpenAI 2D jewelry render into a 360° interactive 3D model file downloadable in GLB, USDZ, and OBJ formats using Meshy AI.
          </p>
          <button
            onClick={handleGenerate3D}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate 3D Model (Meshy AI)
          </button>
        </div>
      )}

      {(loading || model?.status === "IN_PROGRESS" || model?.status === "PENDING") && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/70 p-8 text-center">
          <div className="relative mb-4 flex items-center justify-center">
            <div className="h-14 w-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <span className="absolute text-xs font-semibold text-indigo-400">{model?.progress || 0}%</span>
          </div>
          <p className="text-sm font-medium text-slate-200 mb-1">Constructing 3D Mesh via Meshy AI...</p>
          <p className="text-xs text-slate-400 max-w-xs mb-4">
            Reconstructing hard-surface metallic geometry & gemstone facets. This usually takes 45–90 seconds.
          </p>
          <div className="w-full max-w-xs rounded-full bg-slate-800 h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(model?.progress || 10, 5)}%` }}
            />
          </div>
        </div>
      )}

      {model?.status === "FAILED" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="text-xs font-medium text-red-400 mb-2">
            3D Generation Error: {model.errorMessage || "Failed to generate 3D mesh."}
          </p>
          <button
            onClick={handleGenerate3D}
            className="rounded bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
          >
            Retry 3D Generation
          </button>
        </div>
      )}

      {model?.status === "SUCCEEDED" && model.glbUrl && (
        <div className="relative w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950" style={{ height: "360px" }}>
          {/* @ts-ignore custom element model-viewer */}
          <model-viewer
            src={model.glbUrl}
            ios-src={model.usdzUrl || undefined}
            alt="Jewelry 3D Model"
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            auto-rotate
            shadow-intensity="1.5"
            exposure="1.0"
            style={{ width: "100%", height: "100%", backgroundColor: "#020617" }}
          />
          <div className="absolute bottom-2 left-2 rounded-md bg-slate-900/80 backdrop-blur px-2.5 py-1 text-[11px] text-slate-400 border border-slate-800">
            🖱️ Drag to rotate 360° · Scroll to zoom
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
