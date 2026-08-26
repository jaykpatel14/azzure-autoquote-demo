import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeEmailVerificationToken } from "@/lib/auth-tokens";

const verifyOtpSchema = z.object({
  code: z.string().trim().min(4).max(64)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = verifyOtpSchema.parse(body);

    const user = await consumeEmailVerificationToken(code);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired verification code. Please check the code or request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      email: user.email,
      message: "Email verified successfully."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify code." },
      { status: 400 }
    );
  }
}
