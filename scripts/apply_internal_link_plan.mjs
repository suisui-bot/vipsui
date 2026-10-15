import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const planPath = process.argv[2];
if (!planPath) throw new Error("Usage: node scripts/apply_internal_link_plan.mjs <internal_link_plan.json>");
const root = process.cwd();
const planBytes = await readFile(planPath);
const plan = JSON.parse(planBytes);
const indexPath = path.join(root, "app/data/productIndex.json");
const indexBytes = await readFile(indexPath);
const index = JSON.parse(indexBytes);
const byId = new Map(index.map((p) => [p.albumId, p]));
if (byId.size !== index.length) throw new Error("Duplicate original product IDs");
const sourceHashes = { "app/data/productIndex.json": hash(indexBytes) };
const needed = new Map();
for (const row of plan.products) {
  for (const id of [row.product_id, ...row.related_products.map((p) => p.product_id)]) {
    const item = byId.get(id);
    if (!item) throw new Error(`Missing original product ${id}`);
    const shard = item.slug.match(/^wecatalog-(\d+)/)?.[1].slice(0, 3) || "misc";
    if (!needed.has(shard)) needed.set(shard, new Set());
    needed.get(shard).add(id);
  }
}
for (const [shard, ids] of needed) {
  const file = `public/product-shards/${shard}.json`;
  const bytes = await readFile(path.join(root, file));
  sourceHashes[file] = hash(bytes);
  const details = new Map(JSON.parse(bytes).map((p) => [p.albumId, p]));
  for (const id of ids) {
    const detail = details.get(id);
    if (!detail || detail.slug !== byId.get(id).slug) throw new Error(`List/detail mismatch for ${id}`);
  }
}
const products = {};
const memberships = { labels: {}, members: {} };
for (const row of plan.products) {
  const item = byId.get(row.product_id);
  const rootKey = row.category;
  const subKey = row.subcategory ? `${rootKey}/${row.subcategory}` : null;
  for (const key of [rootKey, subKey].filter(Boolean)) {
    memberships.labels[key] = key === rootKey ? rootKey : subLabel(row.subcategory);
    (memberships.members[key] ||= []).push(item.albumId);
  }
  const seen = new Set([item.albumId]);
  const relatedProducts = row.related_products.map((p) => {
    const other = byId.get(p.product_id);
    if (!other || seen.has(other.albumId)) throw new Error(`Duplicate/missing related product for ${item.slug}`);
    seen.add(other.albumId);
    return { href: `/product/${other.slug}`, label: p.link_text, productNumber: other.productNumber, category: p.category };
  });
  if (relatedProducts.length < 3 || relatedProducts.length > 6) throw new Error("Invalid recommendation count");
  products[item.slug] = {
    productId: item.albumId,
    label: row.related_category[0]?.link_text || row.category,
    relatedProducts,
    relatedCategories: [{ href: categoryHref(row.category), label: row.category }],
    relatedSubcategories: row.subcategory ? [{ href: categoryHref(row.category, row.subcategory), label: subLabel(row.subcategory) }] : [],
  };
}
for (const [file, before] of Object.entries(sourceHashes)) {
  if (hash(await readFile(path.join(root, file))) !== before) throw new Error(`Original data changed: ${file}`);
}
await save("app/data/internalLinks.json", { sourcePlanSha256: hash(planBytes), products });
await save("app/data/seoCategoryMemberships.json", memberships);
await save("docs/internal-links-application-report.json", {
  sourcePlanSha256: hash(planBytes), originalProductCount: index.length,
  mappedProductCount: Object.keys(products).length,
  relatedProductLinks: Object.values(products).reduce((n, p) => n + p.relatedProducts.length, 0),
  sourceHashes, originalDataUnchanged: true,
  unimplementedGuideLinksExcluded: true, productUrlMigrationEnabled: false,
  relatedProductUrls: "Existing /product/[slug] routes; future keyword routes not enabled",
  categoryUrls: "Existing /shop with seoCategory / seoSubcategory filters",
  productsOutsidePlan: index.length - Object.keys(products).length,
});
console.log(`Mapped ${Object.keys(products).length} products; ${index.length} original records unchanged.`);

function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function subLabel(value) {
  const special = { "mens-watches": "Men's Watches", "womens-watches": "Women's Watches", "men-clothing": "Men's Clothing", "women-clothing": "Women's Clothing", "skeleton-watches": "Skeleton Style Watches" };
  return special[value] || value.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
}
function categoryHref(category, subcategory) {
  const params = new URLSearchParams({ seoCategory: category });
  if (subcategory) params.set("seoSubcategory", subcategory);
  return `/shop?${params}`;
}
async function save(file, data) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), JSON.stringify(data) + "\n");
}
