import { NextResponse } from "next/server";
import { saveMobileUploads, getMobileUploads, clearMobileUploads, type UploadedMobileFile } from "@/lib/mobile-upload-store";
import { hasAllowedImageSignature } from "@/lib/security";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const files = getMobileUploads(sessionId);
  if (!files || files.length === 0) {
    return NextResponse.json({ pending: true, files: [] });
  }

  // Clear once retrieved so it does not re-trigger
  clearMobileUploads(sessionId);

  return NextResponse.json({
    pending: false,
    files
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const sessionId = String(form.get("sessionId") || "").trim();
    const token = String(form.get("token") || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const uploadedFiles: UploadedMobileFile[] = [];
    const entries = form.getAll("files");

    for (const entry of entries) {
      if (entry instanceof File && entry.size > 0) {
        if (!ALLOWED_TYPES.has(entry.type) || entry.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File "${entry.name}" exceeds 10 MB limit or is not a JPG/PNG/WEBP.` },
            { status: 400 }
          );
        }

        const buffer = Buffer.from(await entry.arrayBuffer());
        if (!hasAllowedImageSignature(buffer, entry.type)) {
          return NextResponse.json(
            { error: `File "${entry.name}" is not a valid image file.` },
            { status: 400 }
          );
        }

        uploadedFiles.push({
          name: entry.name,
          type: entry.type,
          dataUrl: `data:${entry.type};base64,${buffer.toString("base64")}`
        });
      }
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: "Please select at least one photo to upload." }, { status: 400 });
    }

    saveMobileUploads(sessionId, token, uploadedFiles);

    return NextResponse.json({
      success: true,
      count: uploadedFiles.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mobile upload failed." },
      { status: 500 }
    );
  }
}
