import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateAndStoreQuotePdf } from "@/src/services/quote-pdf";

export const runtime = "nodejs";

const paramsSchema = z.object({
  token: z.string().min(1)
});

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

// Public, unauthenticated PDF for a shared quote — same trust model as
// /q/[token]/image: the random publicShareToken itself is the credential.
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const quote = await prisma.quote.findUnique({
      where: { publicShareToken: parsed.data.token },
      select: { id: true, companyId: true, quoteNumber: true, customerName: true, sharedAt: true }
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    }

    const expiresAt = quote.sharedAt ? new Date(quote.sharedAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
    if (!expiresAt || expiresAt <= new Date()) {
      return NextResponse.json({ error: "Quote link expired." }, { status: 404 });
    }

    const result = await generateAndStoreQuotePdf({
      quoteId: quote.id,
      companyId: quote.companyId,
      customerNameFallback: quote.customerName
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error.userMessage }, { status: result.error.statusCode });
    }

    return new NextResponse(new Uint8Array(result.data.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.data.quoteNumber}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate PDF." },
      { status: 500 }
    );
  }
}
