import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const read = async (file) => JSON.parse(await readFile(file, "utf8"));
const data = await read("app/data/internalLinks.json");
const memberships = await read("app/data/seoCategoryMemberships.json");
const report = await read("docs/internal-links-application-report.json");
const index = await read("app/data/productIndex.json");
const bySlug = new Map(index.map((p) => [p.slug, p]));
const byId = new Map(index.map((p) => [p.albumId, p]));
assert.equal(index.length, 66176);
assert.equal(Object.keys(data.products).length, 9470);
assert.equal(report.relatedProductLinks, 56820);
let edges = 0;
for (const [slug, links] of Object.entries(data.products)) {
  assert.equal(bySlug.get(slug).albumId, links.productId);
  assert.equal(links.relatedProducts.length, 6);
  assert.equal(new Set(links.relatedProducts.map((p) => p.href)).size, 6);
  for (const link of links.relatedProducts) {
    assert.ok(link.href.startsWith("/product/"));
    const target = bySlug.get(link.href.slice("/product/".length));
    assert.ok(target);
    assert.notEqual(target.slug, slug);
    assert.equal(target.productNumber, link.productNumber);
    edges += 1;
  }
  for (const link of [...links.relatedCategories, ...links.relatedSubcategories]) {
    const url = new URL(link.href, "http://localhost");
    assert.equal(url.pathname, "/shop");
    const key = [url.searchParams.get("seoCategory"), url.searchParams.get("seoSubcategory")].filter(Boolean).join("/");
    assert.ok(memberships.members[key].includes(links.productId));
    assert.ok(memberships.members[key].every((id) => byId.has(id)));
  }
}
for (const [key, ids] of Object.entries(memberships.members)) {
  assert.equal(new Set(ids).size, ids.length, key);
  assert.ok(memberships.labels[key]);
}
for (const [file, expected] of Object.entries(report.sourceHashes)) {
  const hash = createHash("sha256").update(await readFile(file)).digest("hex");
  assert.equal(hash, expected, `${file} must retain original images/pricing/content`);
}
assert.equal(edges, 56820);
console.log("PASS: 9,470 mapped pages, 56,820 existing product targets, category memberships and original data hashes.");
