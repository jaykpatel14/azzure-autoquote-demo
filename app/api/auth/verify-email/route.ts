import { NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/auth-tokens";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const user = await consumeEmailVerificationToken(token);
  if (!user) {
    return NextResponse.redirect(new URL("/verify-email?error=invalid", url.origin));
  }

  return NextResponse.redirect(new URL(`/signin?verified=1&email=${encodeURIComponent(user.email)}`, url.origin));
}
