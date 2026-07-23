import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { consumePasswordResetToken } from "@/lib/auth-tokens";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const passwordHash = hashPassword(input.password);
    const updatedUser = await consumePasswordResetToken(input.token, passwordHash);

    if (!updatedUser) {
      return NextResponse.json({ error: "That reset link is invalid or expired." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reset password." },
      { status: 400 }
    );
  }
}
