"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button className="signOutBtn" onClick={() => signOut({ callbackUrl: "/signin" })}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">
        logout
      </span>
      Sign out
    </button>
  );
}
