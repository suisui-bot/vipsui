import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const appDataDir = path.join(root, "app", "data");
const publicShardsDir = path.join(root, "public", "product-shards");
const pricingDataDir = path.join(root, "data", "pricing");
const settingsPath = path.join(pricingDataDir, "default-watch-pricing-settings.json");
const watchesTopCategory = "高端腕表";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value, pretty = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, pretty ? 2 : 0), "utf8");
}

function clean(value) {
  return String(value || "").trim();
}

function decodeSupplierCostRMB(productNumber) {
  const digits = clean(productNumber).replace(/\D/g, "");
  if (digits.length === 6 || digits.length === 7) return Number(digits.slice(2, 5));
  if (digits.length === 8) return Number(digits.slice(2, 6));
  return null;
}

function roundCustomerPriceUSD(rawSellingPriceUSD) {
  const minimum = Math.ceil(rawSellingPriceUSD);
  return Math.ceil((minimum + 1) / 10) * 10 - 1;
}

function calculatePrice(product, settings, calculatedAt) {
  const supplierCostRMB = decodeSupplierCostRMB(product.productNumber);
  if (!supplierCostRMB || supplierCostRMB <= 0) return null;

  const baseCostRMB = supplierCostRMB + settings.shippingCostRMB + settings.packagingCostRMB;
  const operatingReservePercent =
    (settings.paymentFeePercent + settings.exchangeRateBufferPercent + settings.riskReservePercent) / 100;
  const adjustedCostRMB = baseCostRMB * (1 + operatingReservePercent);
  const rawSellingPriceUSD = (adjustedCostRMB * settings.profitMultiplier) / settings.exchangeRateRMBPerUSD;
  const finalSellingPriceUSD = roundCustomerPriceUSD(rawSellingPriceUSD);

  return {
    supplierCostRMB,
    shippingCostRMB: settings.shippingCostRMB,
    packagingCostRMB: settings.packagingCostRMB,
    paymentFeePercent: settings.paymentFeePercent,
    exchangeRateBufferPercent: settings.exchangeRateBufferPercent,
    riskReservePercent: settings.riskReservePercent,
    operatingReservePercent,
    baseCostRMB,
    adjustedCostRMB,
    exchangeRateRMBPerUSD: settings.exchangeRateRMBPerUSD,
    profitMultiplier: settings.profitMultiplier,
    rawSellingPriceUSD,
    finalSellingPriceUSD,
    pricingSource: "source_numeric_code",
    pricingCalculatedAt: calculatedAt,
    matchConfidence: "source_numeric_code",
  };
}

function isWatch(product) {
  return Array.isArray(product.categoryPath) && product.categoryPath[0] === watchesTopCategory;
}

function publicPricingFields(product, breakdown) {
  if (!breakdown) {
    return {
      ...product,
      pricingStatus: "needs_review",
      pricingSource: product.pricingSource || "unpriced",
      publicPriceLabel: product.publicPriceLabel || "Price on Request",
    };
  }
  return {
    ...product,
    internalPrice: breakdown.finalSellingPriceUSD,
    publicPriceLabel: `$${breakdown.finalSellingPriceUSD}`,
    pricingStatus: "priced",
    pricingSource: breakdown.pricingSource,
    priceLocked: Boolean(product.priceLocked),
    pricingCalculatedAt: breakdown.pricingCalculatedAt,
    matchConfidence: breakdown.matchConfidence,
  };
}

function shardKey(product) {
  const match = clean(product.productNumber).match(/\d+/);
  return (match ? match[0].slice(0, 3) : "misc") || "misc";
}

const settings = readJson(settingsPath);
const calculatedAt = new Date().toISOString();
const productIndexPath = path.join(appDataDir, "productIndex.json");
const catalogPath = path.join(appDataDir, "catalog.json");
const productIndex = readJson(productIndexPath);
const catalog = readJson(catalogPath);
const shardFiles = fs.readdirSync(publicShardsDir).filter((file) => file.endsWith(".json"));

let totalWatches = 0;
let pricedWatches = 0;
let lockedSkipped = 0;
let needsReview = 0;
let rawPriceViolations = 0;
const breakdowns = [];
const pilot = [];
const updatedByAlbumId = new Map();

for (const product of productIndex) {
  if (!isWatch(product)) continue;
  totalWatches += 1;
  if (product.priceLocked === true) {
    lockedSkipped += 1;
    continue;
  }
  const breakdown = calculatePrice(product, settings, calculatedAt);
  if (!breakdown) {
    needsReview += 1;
    updatedByAlbumId.set(product.albumId, publicPricingFields(product, null));
    continue;
  }
  if (breakdown.finalSellingPriceUSD < breakdown.rawSellingPriceUSD) rawPriceViolations += 1;
  pricedWatches += 1;
  const publicProduct = publicPricingFields(product, breakdown);
  updatedByAlbumId.set(product.albumId, publicProduct);
  const internalRecord = {
    albumId: product.albumId,
    productNumber: product.productNumber,
    sourceUrl: product.yupooUrl || product.sourceUrl,
    categoryPath: product.categoryPath,
    collection: product.collection,
    supplierCostRMB: breakdown.supplierCostRMB,
    shippingCostRMB: breakdown.shippingCostRMB,
    packagingCostRMB: breakdown.packagingCostRMB,
    paymentFeePercent: breakdown.paymentFeePercent,
    exchangeRateBufferPercent: breakdown.exchangeRateBufferPercent,
    riskReservePercent: breakdown.riskReservePercent,
    baseCostRMB: Number(breakdown.baseCostRMB.toFixed(2)),
    adjustedCostRMB: Number(breakdown.adjustedCostRMB.toFixed(2)),
    exchangeRateRMBPerUSD: breakdown.exchangeRateRMBPerUSD,
    profitMultiplier: breakdown.profitMultiplier,
    rawSellingPriceUSD: Number(breakdown.rawSellingPriceUSD.toFixed(2)),
    finalSellingPriceUSD: breakdown.finalSellingPriceUSD,
    pricingSource: breakdown.pricingSource,
    pricingCalculatedAt: breakdown.pricingCalculatedAt,
    matchConfidence: breakdown.matchConfidence,
  };
  breakdowns.push(internalRecord);
  if (pilot.length < 100) pilot.push({
    vipsuiProduct: product.productNumber,
    yupooMatchedProduct: product.yupooUrl || product.sourceUrl || product.albumId,
    ...internalRecord,
  });
}

if (rawPriceViolations > 0) {
  throw new Error(`Pricing validation failed: ${rawPriceViolations} final prices are below raw selling price.`);
}

const nextProductIndex = productIndex.map((product) => updatedByAlbumId.get(product.albumId) || product);
writeJson(productIndexPath, nextProductIndex);

let updatedShardProducts = 0;
for (const file of shardFiles) {
  const filePath = path.join(publicShardsDir, file);
  const products = readJson(filePath);
  const nextProducts = products.map((product) => {
    const updated = updatedByAlbumId.get(product.albumId);
    if (!updated) return product;
    updatedShardProducts += 1;
    return publicPricingFields({ ...product, priceLocked: product.priceLocked }, calculatePrice(product, settings, calculatedAt));
  });
  writeJson(filePath, nextProducts);
}

if (Array.isArray(catalog.categoryCounts)) {
  catalog.stats = {
    ...catalog.stats,
    watchProductsPriced: pricedWatches,
    watchProductsNeedingPriceReview: needsReview,
    watchPricingCalculatedAt: calculatedAt,
  };
  writeJson(catalogPath, catalog);
}

const report = {
  generatedAt: calculatedAt,
  scope: "watches",
  settings,
  totalWatches,
  pilotProducts: pilot.length,
  pricedWatches,
  lockedSkipped,
  needsReview,
  rawPriceViolations,
  updatedProductIndexProducts: updatedByAlbumId.size,
  updatedShardProducts,
};

writeJson(path.join(pricingDataDir, "watch-pricing-pilot-report.json"), { ...report, products: pilot }, true);
writeJson(path.join(pricingDataDir, "watch-price-breakdowns.json"), { ...report, products: breakdowns }, true);

console.log(JSON.stringify(report, null, 2));
