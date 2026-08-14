import { ADMIN_SETTING_KEYS, listRuntimeSettings } from "@/lib/app-settings";

export async function getAdminPlatformSettings() {
  const settings = await listRuntimeSettings();

  return {
    settings,
    secretSettings: settings.filter((setting) => setting.secret),
    publicSettings: settings.filter((setting) => !setting.secret),
    editableKeys: ADMIN_SETTING_KEYS
  };
}
