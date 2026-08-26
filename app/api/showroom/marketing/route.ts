import { NextResponse } from "next/server";
import { getActiveShowroom } from "@/lib/showroom";
import { loadShowroomBackgroundFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

type StoredShowroomImage = {
  key: string;
  contentType: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const index = Number.parseInt(url.searchParams.get("index") || "0", 10);

  const session = await getActiveShowroom(token);
  const images = Array.isArray(session?.company.showroomMarketingImages)
    ? (session.company.showroomMarketingImages as StoredShowroomImage[])
    : [];

  const selected = Number.isFinite(index) ? images[index] : undefined;
  if (!selected?.key || !selected.contentType) {
    return NextResponse.json({ error: "Marketing image not found." }, { status: 404 });
  }

  const buffer = await loadShowroomBackgroundFromS3(selected.key);
  if (!buffer) {
    return NextResponse.json({ error: "Marketing image not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": selected.contentType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=300"
    }
  });
}
