"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AccountStatus = "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED";

type AccountStatusResponse = {
  accountStatus?: AccountStatus;
};

export default function AccountStatusPoller() {
  const router = useRouter();
  const [status, setStatus] = useState<AccountStatus>("PENDING_APPROVAL");

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const response = await fetch("/api/account/status", { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as AccountStatusResponse;
      if (cancelled) return;

      const nextStatus = data.accountStatus ?? "PENDING_APPROVAL";
      setStatus(nextStatus);

      if (nextStatus === "APPROVED") {
        router.replace("/");
      }

      if (nextStatus === "SUSPENDED") {
        router.replace("/suspended");
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router]);

  return <p className="muted small">Current status: {status.toLowerCase().replaceAll("_", " ")}</p>;
}
