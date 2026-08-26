import { NextResponse, type NextRequest } from "next/server";
import { resolveAzzureKioskTarget } from "@/lib/azzure-devices";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const serial = url.searchParams.get("serial") || "";

  if (!serial) {
    return NextResponse.redirect(new URL("/showroom/setup-required", request.url));
  }

  const resolved = await resolveAzzureKioskTarget(serial).catch(() => null);
  if (!resolved || resolved.status === "missing") {
    return NextResponse.redirect(new URL(`/showroom/setup-required?serial=${encodeURIComponent(serial)}`, request.url));
  }

  if (resolved.status === "activated") {
    return NextResponse.redirect(
      new URL(`/showroom?token=${encodeURIComponent(String(resolved.showroomToken))}&serial=${encodeURIComponent(String(resolved.serial))}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL(`/showroom/setup?serial=${encodeURIComponent(String(resolved.serial))}&token=${encodeURIComponent(String(resolved.showroomToken))}`, request.url)
  );
}
