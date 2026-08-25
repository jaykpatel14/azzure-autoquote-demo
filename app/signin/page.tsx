import SignInForm from "@/components/sign-in-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; verified?: string; next?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const nextTarget = params.next || params.callbackUrl;

  if (session?.user) {
    if (session.user.role === "AZZURE_ADMIN") {
      if (session.user.adminRole === "SALESMAN") {
        redirect(nextTarget || "/admin/sales");
      }
      redirect(nextTarget || "/admin");
    }
    redirect(nextTarget || "/");
  }

  return (
    <SignInForm
      initialEmail={params.email || ""}
      verified={Boolean(params.verified)}
      next={nextTarget}
    />
  );
}
