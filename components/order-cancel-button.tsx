"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast-provider";

type OrderCancelButtonProps = {
  orderId: string;
};

export default function OrderCancelButton({ orderId }: OrderCancelButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function cancelOrder() {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Unable to cancel order.");
      }

      router.refresh();
      setConfirm(false);
      showToast({
        message: "Order cancellation requested.",
        variant: "success"
      });
    } catch {
      showToast({ message: "We couldn't cancel this order. Try again.", variant: "error", autoDismiss: false });
    } finally {
      setLoading(false);
    }
  }

  if (!confirm) {
    return (
      <button className="button destructive button--sm" type="button" onClick={() => setConfirm(true)}>
        Cancel order
      </button>
    );
  }

  return (
    <div className="inlineConfirm">
      <p>Cancel this order? This cannot be undone.</p>
      <div className="buttonRow">
        <button className="button secondary button--sm" type="button" onClick={() => setConfirm(false)}>
          Keep order
        </button>
        <button className="button destructive button--sm" type="button" onClick={cancelOrder} disabled={loading}>
          {loading ? "Cancelling..." : "Cancel order"}
        </button>
      </div>
    </div>
  );
}
