export type SupportedCurrency = "USD" | "CAD";

export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = ["USD", "CAD"] as const;

export const DEFAULT_USD_TO_CAD_RATE = 1.36;

/**
 * Returns the active USD to CAD exchange rate.
 * Configurable via USD_TO_CAD_RATE environment variable.
 */
export function getUsdToCadRate(): number {
  if (typeof process !== "undefined" && process.env?.USD_TO_CAD_RATE) {
    const parsed = parseFloat(process.env.USD_TO_CAD_RATE);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_USD_TO_CAD_RATE;
}

/**
 * Converts a monetary amount between USD and CAD.
 */
export function convertCurrency(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
  rate: number = getUsdToCadRate()
): number {
  if (isNaN(amount) || amount === 0) return 0;
  if (from === to) return amount;

  if (from === "USD" && to === "CAD") {
    return Math.round(amount * rate * 100) / 100;
  }

  if (from === "CAD" && to === "USD") {
    return Math.round((amount / rate) * 100) / 100;
  }

  return amount;
}

/**
 * Formats a monetary amount into a clean, localized currency string.
 * e.g., $1,250.00 USD or $1,700.00 CAD
 */
export function formatCurrency(
  value: number,
  currency: SupportedCurrency = "USD",
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number; showCode?: boolean }
): string {
  const numValue = Number(value ?? 0);
  const maxDigits = options?.maximumFractionDigits ?? 2;
  const minDigits = options?.minimumFractionDigits ?? (Number.isInteger(numValue) ? 0 : 2);

  const locale = currency === "CAD" ? "en-CA" : "en-US";
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits
  }).format(numValue);

  if (options?.showCode) {
    return `${formatted} ${currency}`;
  }

  return formatted;
}

/**
 * Helper to convert USD baseline values to target currency (USD or CAD) and format.
 */
export function formatMoneyWithFx(
  usdAmount: number,
  targetCurrency: SupportedCurrency = "USD",
  fxRate: number = getUsdToCadRate(),
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number; showCode?: boolean }
): string {
  const converted = targetCurrency === "CAD" ? convertCurrency(usdAmount, "USD", "CAD", fxRate) : usdAmount;
  return formatCurrency(converted, targetCurrency, options);
}

/**
 * Short label with symbol for currency badges / selectors.
 */
export function getCurrencyLabel(currency: SupportedCurrency): string {
  return currency === "CAD" ? "CAD (CA$)" : "USD ($)";
}
