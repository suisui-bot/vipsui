import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const productIndexPath = path.join(root, "app", "data", "productIndex.json");
const catalogPath = path.join(root, "app", "data", "catalog.json");
const shardsDir = path.join(root, "public", "product-shards");
const watchesTopCategory = "高端腕表";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value), "utf8");
}

function isWatch(product) {
  return Array.isArray(product.categoryPath) && product.categoryPath[0] === watchesTopCategory;
}

function hasVerifiedPricingInputs(product) {
  return (
    product.verifiedYupooImageMatch === true &&
    product.validSupplierNumericCode === true &&
    typeof product.matchedYupooNumericCode === "string" &&
    /^\d{7,8}$/.test(product.matchedYupooNumericCode) &&
    Number(product.supplierCostRMB) > 0
  );
}

function safeProduct(product) {
  if (!isWatch(product) || hasVerifiedPricingInputs(product)) return product;
  return {
    ...product,
    internalPrice: null,
    publicPriceLabel: "Price on Request",
    pricingStatus: "needs_review",
    pricingSource: "unverified_no_yupoo_match",
    matchConfidence: product.matchConfidence === "source_numeric_code" ? "unverified" : product.matchConfidence,
    pricingCalculatedAt: undefined,
  };
}

const productIndex = readJson(productIndexPath);
const updatedByAlbum = new Map();
let totalWatches = 0;
let revertedWatches = 0;
let verifiedKept = 0;

const nextProductIndex = productIndex.map((product) => {
  if (!isWatch(product)) return product;
  totalWatches += 1;
  const next = safeProduct(product);
  updatedByAlbum.set(product.albumId, next);
  if (next.publicPriceLabel === "Price on Request") revertedWatches += 1;
  else verifiedKept += 1;
  return next;
});
writeJson(productIndexPath, nextProductIndex);

let shardProductsTouched = 0;
for (const file of fs.readdirSync(shardsDir).filter((item) => item.endsWith(".json"))) {
  const filePath = path.join(shardsDir, file);
  const products = readJson(filePath);
  const nextProducts = products.map((product) => {
    if (!isWatch(product)) return product;
    shardProductsTouched += 1;
    return safeProduct(product);
  });
  writeJson(filePath, nextProducts);
}

const catalog = readJson(catalogPath);
catalog.stats = {
  ...catalog.stats,
  watchProductsPriced: verifiedKept,
  watchProductsNeedingPriceReview: revertedWatches,
  watchPricingCalculatedAt: undefined,
  watchPricingSafetyResetAt: new Date().toISOString(),
};
writeJson(catalogPath, catalog);

console.log(
  JSON.stringify(
    {
      totalWatches,
      revertedWatches,
      verifiedPricedKept: verifiedKept,
      shardProductsTouched,
      nonWatchesModified: 0,
    },
    null,
    2,
  ),
);
