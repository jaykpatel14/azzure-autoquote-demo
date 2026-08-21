import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      database: "up",
      durationMs: Date.now() - startedAt
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: "down",
        durationMs: Date.now() - startedAt
      },
      { status: 503 }
    );
  }
}
