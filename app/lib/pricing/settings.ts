import defaultWatchPricingSettings from "@/data/pricing/default-watch-pricing-settings.json";
import { databaseEnabled, prisma } from "@/app/lib/db/prisma";

export type PaymentFeeModel = "cost_reserve" | "selling_price_percentage";

export type PricingSettings = {
  scope: "watches";
  shippingCostRMB: number;
  packagingCostRMB: number;
  paymentFeePercent: number;
  exchangeRateBufferPercent: number;
  riskReservePercent: number;
  exchangeRateRMBPerUSD: number;
  profitMultiplier: number;
  paymentFeeModel: PaymentFeeModel;
  updatedAt?: string;
};

export type WatchPriceBreakdown = {
  supplierCostRMB: number;
  shippingCostRMB: number;
  packagingCostRMB: number;
  paymentFeePercent: number;
  exchangeRateBufferPercent: number;
  riskReservePercent: number;
  operatingReservePercent: number;
  baseCostRMB: number;
  adjustedCostRMB: number;
  exchangeRateRMBPerUSD: number;
  profitMultiplier: number;
  rawSellingPriceUSD: number;
  finalSellingPriceUSD: number;
  pricingSource: string;
  pricingCalculatedAt: string;
  matchConfidence: string;
};

export const defaultPricingSettings = defaultWatchPricingSettings as PricingSettings;

function finiteNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizePricingSettings(input: Partial<PricingSettings> = {}): PricingSettings {
  return {
    scope: "watches",
    shippingCostRMB: finiteNumber(input.shippingCostRMB, defaultPricingSettings.shippingCostRMB),
    packagingCostRMB: finiteNumber(input.packagingCostRMB, defaultPricingSettings.packagingCostRMB),
    paymentFeePercent: finiteNumber(input.paymentFeePercent, defaultPricingSettings.paymentFeePercent),
    exchangeRateBufferPercent: finiteNumber(input.exchangeRateBufferPercent, defaultPricingSettings.exchangeRateBufferPercent),
    riskReservePercent: finiteNumber(input.riskReservePercent, defaultPricingSettings.riskReservePercent),
    exchangeRateRMBPerUSD: finiteNumber(input.exchangeRateRMBPerUSD, defaultPricingSettings.exchangeRateRMBPerUSD),
    profitMultiplier: finiteNumber(input.profitMultiplier, defaultPricingSettings.profitMultiplier),
    paymentFeeModel: input.paymentFeeModel === "selling_price_percentage" ? "selling_price_percentage" : "cost_reserve",
    updatedAt: input.updatedAt,
  };
}

export function decodeSupplierCostRMB(productNumber: string) {
  const digits = productNumber.replace(/\D/g, "");
  if (digits.length === 6 || digits.length === 7) return Number(digits.slice(2, 5));
  if (digits.length === 8) return Number(digits.slice(2, 6));
  return null;
}

export function roundCustomerPriceUSD(rawSellingPriceUSD: number) {
  const minimum = Math.ceil(rawSellingPriceUSD);
  return Math.ceil((minimum + 1) / 10) * 10 - 1;
}

export function calculateWatchPrice(
  supplierCostRMB: number,
  settings: PricingSettings = defaultPricingSettings,
  options: { pricingSource?: string; matchConfidence?: string; calculatedAt?: string } = {},
): WatchPriceBreakdown {
  const normalized = normalizePricingSettings(settings);
  const baseCostRMB = supplierCostRMB + normalized.shippingCostRMB + normalized.packagingCostRMB;
  const operatingReservePercent =
    (normalized.paymentFeePercent + normalized.exchangeRateBufferPercent + normalized.riskReservePercent) / 100;
  const adjustedCostRMB = baseCostRMB * (1 + operatingReservePercent);
  const rawSellingPriceUSD = (adjustedCostRMB * normalized.profitMultiplier) / normalized.exchangeRateRMBPerUSD;
  const finalSellingPriceUSD = roundCustomerPriceUSD(rawSellingPriceUSD);

  return {
    supplierCostRMB,
    shippingCostRMB: normalized.shippingCostRMB,
    packagingCostRMB: normalized.packagingCostRMB,
    paymentFeePercent: normalized.paymentFeePercent,
    exchangeRateBufferPercent: normalized.exchangeRateBufferPercent,
    riskReservePercent: normalized.riskReservePercent,
    operatingReservePercent,
    baseCostRMB,
    adjustedCostRMB,
    exchangeRateRMBPerUSD: normalized.exchangeRateRMBPerUSD,
    profitMultiplier: normalized.profitMultiplier,
    rawSellingPriceUSD,
    finalSellingPriceUSD,
    pricingSource: options.pricingSource || "source_numeric_code",
    pricingCalculatedAt: options.calculatedAt || new Date().toISOString(),
    matchConfidence: options.matchConfidence || "source_numeric_code",
  };
}

export async function getPricingSettings(): Promise<PricingSettings> {
  if (!databaseEnabled) return normalizePricingSettings(defaultPricingSettings);
  const row = await prisma.pricingSetting.findUnique({ where: { scope: "watches" } });
  if (!row) return normalizePricingSettings(defaultPricingSettings);
  return normalizePricingSettings({
    scope: "watches",
    shippingCostRMB: row.shippingCostRMB,
    packagingCostRMB: row.packagingCostRMB,
    paymentFeePercent: row.paymentFeePercent,
    exchangeRateBufferPercent: row.exchangeRateBufferPercent,
    riskReservePercent: row.riskReservePercent,
    exchangeRateRMBPerUSD: row.exchangeRateRMBPerUSD,
    profitMultiplier: row.profitMultiplier,
    paymentFeeModel: row.paymentFeeModel as PaymentFeeModel,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function updatePricingSettings(input: Partial<PricingSettings>): Promise<PricingSettings> {
  const settings = normalizePricingSettings(input);
  if (!databaseEnabled) return settings;
  const row = await prisma.pricingSetting.upsert({
    where: { scope: "watches" },
    update: {
      shippingCostRMB: settings.shippingCostRMB,
      packagingCostRMB: settings.packagingCostRMB,
      paymentFeePercent: settings.paymentFeePercent,
      exchangeRateBufferPercent: settings.exchangeRateBufferPercent,
      riskReservePercent: settings.riskReservePercent,
      exchangeRateRMBPerUSD: settings.exchangeRateRMBPerUSD,
      profitMultiplier: settings.profitMultiplier,
      paymentFeeModel: settings.paymentFeeModel,
    },
    create: {
      scope: "watches",
      shippingCostRMB: settings.shippingCostRMB,
      packagingCostRMB: settings.packagingCostRMB,
      paymentFeePercent: settings.paymentFeePercent,
      exchangeRateBufferPercent: settings.exchangeRateBufferPercent,
      riskReservePercent: settings.riskReservePercent,
      exchangeRateRMBPerUSD: settings.exchangeRateRMBPerUSD,
      profitMultiplier: settings.profitMultiplier,
      paymentFeeModel: settings.paymentFeeModel,
    },
  });
  return normalizePricingSettings({
    scope: "watches",
    shippingCostRMB: row.shippingCostRMB,
    packagingCostRMB: row.packagingCostRMB,
    paymentFeePercent: row.paymentFeePercent,
    exchangeRateBufferPercent: row.exchangeRateBufferPercent,
    riskReservePercent: row.riskReservePercent,
    exchangeRateRMBPerUSD: row.exchangeRateRMBPerUSD,
    profitMultiplier: row.profitMultiplier,
    paymentFeeModel: row.paymentFeeModel as PaymentFeeModel,
    updatedAt: row.updatedAt.toISOString(),
  });
}
