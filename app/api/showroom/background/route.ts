import { NextResponse } from "next/server";
import { getActiveShowroom } from "@/lib/showroom";
import { loadShowroomBackgroundFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const session = await getActiveShowroom(token);
  const key = session?.company.showroomBackgroundMediaKey;
  const contentType = session?.company.showroomBackgroundMediaType;
  if (!key || !contentType) return NextResponse.json({ error: "Background not found." }, { status: 404 });

  const buffer = await loadShowroomBackgroundFromS3(key);
  if (!buffer) return NextResponse.json({ error: "Background not found." }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=300"
    }
  });
}
