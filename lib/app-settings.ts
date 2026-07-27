import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const ADMIN_SETTING_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "METALS_DEV_API_KEY",
  "METALS_DEV_BASE_URL",
  "METALS_DEV_CURRENCY",
  "METALS_DEV_UNIT",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];

const SECRET_SETTING_KEYS = new Set<AdminSettingKey>([
  "OPENAI_API_KEY",
  "METALS_DEV_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
]);

type StoredSetting = {
  key: AdminSettingKey;
  value: string;
  updatedAt: Date | null;
  updatedByUserId: string | null;
};

type UpsertSettingInput = {
  key: AdminSettingKey;
  value: string;
  updatedByUserId?: string | null;
};

type SettingSnapshot = StoredSetting & {
  maskedValue: string;
  secret: boolean;
  source: "database" | "env" | "default";
};

function getEncryptionKey() {
  const secret = process.env.APP_SETTINGS_ENCRYPTION_KEY?.trim();
  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

function encryptValue(value: string) {
  const key = getEncryptionKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_SETTINGS_ENCRYPTION_KEY is not configured.");
    }

    return `plain:${value}`;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["enc:v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(
    ":"
  );
}

function decryptValue(storedValue: string) {
  if (storedValue.startsWith("plain:")) {
    return storedValue.slice("plain:".length);
  }

  if (!storedValue.startsWith("enc:v1:")) {
    return storedValue;
  }

  const key = getEncryptionKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_SETTINGS_ENCRYPTION_KEY is not configured.");
    }

    return storedValue;
  }

  const [, , ivValue, tagValue, encryptedValue] = storedValue.split(":");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted setting payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

function maskValue(value: string) {
  if (!value) {
    return "Not set";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function isSecretSettingKey(key: string): key is AdminSettingKey {
  return SECRET_SETTING_KEYS.has(key as AdminSettingKey);
}

export function normalizeAdminSettingKey(key: string): AdminSettingKey {
  if (!ADMIN_SETTING_KEYS.includes(key as AdminSettingKey)) {
    throw new Error(`Unsupported admin setting key: ${key}`);
  }

  return key as AdminSettingKey;
}

export async function getRuntimeSetting(key: AdminSettingKey) {
  const record = await prisma.appSetting.findUnique({ where: { key } });
  if (!record) {
    return null;
  }

  return decryptValue(record.value);
}

export async function resolveRuntimeSetting(key: AdminSettingKey, fallback?: string | null) {
  const stored = await getRuntimeSetting(key);
  if (stored && stored.trim().length > 0) {
    return stored;
  }

  const envValue = process.env[key]?.trim();
  if (envValue) {
    return envValue;
  }

  return fallback?.trim() || null;
}

export async function upsertRuntimeSetting({ key, value, updatedByUserId }: UpsertSettingInput) {
  const normalizedKey = normalizeAdminSettingKey(key);
  const storedValue = isSecretSettingKey(normalizedKey) ? encryptValue(value) : value.trim();

  return prisma.appSetting.upsert({
    where: { key: normalizedKey },
    create: {
      key: normalizedKey,
      value: storedValue,
      updatedByUserId: updatedByUserId ?? null
    },
    update: {
      value: storedValue,
      updatedByUserId: updatedByUserId ?? null
    }
  });
}

export async function listRuntimeSettings() {
  const records = (await prisma.appSetting.findMany({
    orderBy: { key: "asc" }
  })).map(({ key, value, updatedAt, updatedByUserId }) => ({
    key: normalizeAdminSettingKey(key),
    value,
    updatedAt,
    updatedByUserId
  }));

  return ADMIN_SETTING_KEYS.map((key) => {
    const record = records.find((entry) => entry.key === key);
    const rawValue = record ? decryptValue(record.value) : process.env[key]?.trim() || "";

    return {
      key,
      value: rawValue,
      maskedValue: maskValue(rawValue),
      secret: isSecretSettingKey(key),
      source: record ? ("database" as const) : rawValue ? ("env" as const) : ("default" as const),
      updatedAt: record?.updatedAt ?? null,
      updatedByUserId: record?.updatedByUserId ?? null
    } satisfies SettingSnapshot;
  });
}

export function getSettingLabel(key: AdminSettingKey) {
  switch (key) {
    case "OPENAI_API_KEY":
      return "OpenAI API key";
    case "OPENAI_MODEL":
      return "OpenAI model";
    case "METALS_DEV_API_KEY":
      return "Metals.dev API key";
    case "METALS_DEV_BASE_URL":
      return "Metals.dev base URL";
    case "METALS_DEV_CURRENCY":
      return "Metals.dev currency";
    case "METALS_DEV_UNIT":
      return "Metals.dev unit";
    case "STRIPE_SECRET_KEY":
      return "Stripe secret key";
    case "STRIPE_WEBHOOK_SECRET":
      return "Stripe webhook secret";
  }
}

export function getSettingHelpText(key: AdminSettingKey) {
  switch (key) {
    case "OPENAI_API_KEY":
      return "Used for AI analysis and moderation requests.";
    case "OPENAI_MODEL":
      return "Controls the default model used for jewelry analysis.";
    case "METALS_DEV_API_KEY":
      return "Used to fetch live metal spot prices.";
    case "METALS_DEV_BASE_URL":
      return "Override only if Metals.dev changes its API base.";
    case "METALS_DEV_CURRENCY":
      return "Defaults to USD.";
    case "METALS_DEV_UNIT":
      return "Defaults to toz.";
    case "STRIPE_SECRET_KEY":
      return "Used for Stripe checkout and portal sessions.";
    case "STRIPE_WEBHOOK_SECRET":
      return "Used to verify incoming Stripe webhooks.";
  }
}
