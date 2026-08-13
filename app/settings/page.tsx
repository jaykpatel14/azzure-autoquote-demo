import { redirect } from "next/navigation";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const query = new URLSearchParams();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        query.set(key, value);
      } else if (Array.isArray(value) && value[0]) {
        query.set(key, value[0]);
      }
    }
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  redirect(`/settings/billing${suffix}`);
}
