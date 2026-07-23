import SignInForm from "@/components/sign-in-form";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; verified?: string }>;
}) {
  const params = await searchParams;

  return (
    <SignInForm
      initialEmail={params.email || ""}
      verified={Boolean(params.verified)}
    />
  );
}
