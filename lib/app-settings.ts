import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const ADMIN_SETTING_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "cad_cost_per_quote",
  "master_gold_per_oz",
  "master_platinum_per_oz",
  "master_platinum_labor_pct",
  "master_silver_per_oz",
  "master_gold_wastage_pct",
  "master_center_diamond_per_ct",
  "master_fancy_center_diamond_per_ct",
  "master_round_side_diamond_per_ct",
  "master_fancy_side_diamond_per_ct",
  "master_gemstone_per_ct",
  "master_center_setting_per_ct",
  "master_round_side_setting_per_stone",
  "master_fancy_side_setting_per_stone",
  "master_wax_per_piece",
  "master_polishing_per_piece"
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];

const SECRET_SETTING_KEYS = new Set<AdminSettingKey>([
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY"
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

export function isAdminSettingKey(key: string): key is AdminSettingKey {
  return ADMIN_SETTING_KEYS.includes(key as AdminSettingKey);
}

export function normalizeAdminSettingKey(key: string): AdminSettingKey {
  if (!isAdminSettingKey(key)) {
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

export async function resolveRuntimeSetting(key: string, fallback?: string | null) {
  if (isAdminSettingKey(key)) {
    const stored = await getRuntimeSetting(key);
    if (stored && stored.trim().length > 0) {
      return stored;
    }
  }

  const envValue = process.env[key]?.trim();
  if (envValue) {
    return envValue;
  }

  return fallback?.trim() || null;
}

export async function getSettingValue(key: string): Promise<number | null> {
  const resolved = await resolveRuntimeSetting(key);
  if (!resolved) return null;
  const parsed = Number.parseFloat(resolved);
  return Number.isFinite(parsed) ? parsed : null;
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
    where: { key: { in: [...ADMIN_SETTING_KEYS] } },
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
      maskedValue: isSecretSettingKey(key) ? maskValue(rawValue) : rawValue || "Not set",
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
    case "STRIPE_SECRET_KEY":
      return "Stripe secret key";
    case "STRIPE_WEBHOOK_SECRET":
      return "Stripe webhook secret";
    case "RESEND_API_KEY":
      return "Resend API key";
    case "RESEND_FROM_EMAIL":
      return "Resend sender email";
    case "cad_cost_per_quote":
      return "CAD cost per quote ($)";
    case "master_gold_per_oz": return "Gold spot price ($/oz)";
    case "master_platinum_per_oz": return "Platinum price ($/oz)";
    case "master_platinum_labor_pct": return "Platinum labor (%)";
    case "master_silver_per_oz": return "Silver price ($/oz)";
    case "master_gold_wastage_pct": return "Gold wastage / labor (%)";
    case "master_center_diamond_per_ct": return "Standard center diamond ($/ct)";
    case "master_fancy_center_diamond_per_ct": return "Fancy center diamond ($/ct)";
    case "master_round_side_diamond_per_ct": return "Round side diamond ($/ct)";
    case "master_fancy_side_diamond_per_ct": return "Fancy side diamond ($/ct)";
    case "master_gemstone_per_ct": return "Color stone / gemstone ($/ct)";
    case "master_center_setting_per_ct": return "Center setting labor ($/ct)";
    case "master_round_side_setting_per_stone": return "Round side setting labor ($/stone)";
    case "master_fancy_side_setting_per_stone": return "Fancy side setting labor ($/stone)";
    case "master_wax_per_piece": return "Wax / rhodium labor ($/piece)";
    case "master_polishing_per_piece": return "Polishing labor ($/piece)";
  }
}

export function getSettingHelpText(key: AdminSettingKey) {
  switch (key) {
    case "OPENAI_API_KEY":
      return "Used for AI analysis and moderation requests.";
    case "OPENAI_MODEL":
      return "Controls the default model used for jewelry analysis.";
    case "STRIPE_SECRET_KEY":
      return "Used for Stripe checkout and portal sessions.";
    case "STRIPE_WEBHOOK_SECRET":
      return "Used to verify incoming Stripe webhooks.";
    case "RESEND_API_KEY":
      return "Used to send transactional and authentication emails via Resend.";
    case "RESEND_FROM_EMAIL":
      return "Sender address (e.g. quotes@everyfacets.com or onboarding@resend.dev).";
    case "cad_cost_per_quote":
      return "Configurable flat fee CAD cost snapshotted on every quote creation.";
    case "master_gold_per_oz": return "Base pure-gold market price used for 10K, 14K, and 18K calculations.";
    case "master_platinum_per_oz": return "Base platinum price before platinum labor is applied.";
    case "master_platinum_labor_pct": return "Labor percentage added to platinum only. Default: 40%.";
    case "master_silver_per_oz": return "Flat silver price with no additional labor. Default: $300/oz.";
    case "master_gold_wastage_pct": return "Wastage/labor factor applied to gold alloys.";
    case "master_center_diamond_per_ct": return "Default price per carat for standard-shape center diamonds.";
    case "master_fancy_center_diamond_per_ct": return "Default price per carat for non-standard center diamonds.";
    case "master_round_side_diamond_per_ct": return "Default round side-diamond material price per total carat.";
    case "master_fancy_side_diamond_per_ct": return "Default fancy side-diamond material price per total carat.";
    case "master_gemstone_per_ct": return "Lab color-stone/gemstone price per total carat.";
    case "master_center_setting_per_ct": return "Center-stone setting labor per carat; no setting-type selection is required.";
    case "master_round_side_setting_per_stone": return "Labor for each round side stone.";
    case "master_fancy_side_setting_per_stone": return "Labor for each fancy side stone.";
    case "master_wax_per_piece": return "Wax and rhodium labor charged per quantity/piece.";
    case "master_polishing_per_piece": return "Polishing labor charged per quantity/piece.";
  }
}
