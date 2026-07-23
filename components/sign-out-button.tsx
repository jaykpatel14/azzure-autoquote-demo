"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button className="button secondary" onClick={() => signOut({ callbackUrl: "/signin" })}>
      Sign out
    </button>
  );
}
