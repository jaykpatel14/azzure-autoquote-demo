import { redirect } from "next/navigation";

export default async function CancelSubscriptionPage() {
  redirect("/settings/billing/cancel");
}
