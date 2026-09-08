import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct registration is disabled. Please register via our official trial signup page at /signup to start your 14-day trial with Stripe verification."
    },
    { status: 400 }
  );
}
