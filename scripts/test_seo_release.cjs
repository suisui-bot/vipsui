/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test runner installs an in-memory TypeScript require hook. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('typescript');
const Module = require('node:module');

// Exercise the real TypeScript helpers without bundling Next's server-only marker into a standalone test.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS, esModuleInterop:true}}).outputText, filename);
};
const originalLoad = Module._load;
Module._load = function(request, parent, main) {
  if (request === 'server-only') return {};
  if (request.startsWith('.') && parent && fs.existsSync(path.resolve(path.dirname(parent.filename), request + '.ts'))) request = path.resolve(path.dirname(parent.filename), request + '.ts');
  return originalLoad.call(this, request, parent, main);
};
const seo = require(path.resolve('app/lib/seo-catalog.ts'));
const { categoryProducts } = require(path.resolve('app/lib/catalog-listing.ts'));
const index = require(path.resolve('app/data/productIndex.json'));
const report = require(path.resolve('docs/seo-catalog-build.json'));
const originalNavigation = require(path.resolve('app/data/internalLinks.json')).products;
assert.equal(index.length, 66176);
assert.equal(Object.keys(seo.seoProducts).length, index.length);
const slugs = new Set(), titles = new Set(), descriptions = new Set();
let eligible = 0;
for (const p of index) {
  assert.ok(!slugs.has(p.slug)); slugs.add(p.slug);
  const fields = seo.productSeo(p), meta = seo.productMetadata(p), schema = seo.productJsonLd(p);
  assert.ok(fields.name && !fields.name.includes(p.productNumber));
  assert.ok(fields.title.length <= 60 && fields.description.length <= 160);
  assert.ok(!titles.has(fields.title), p.slug); titles.add(fields.title);
  assert.ok(!descriptions.has(fields.description), p.slug); descriptions.add(fields.description);
  assert.equal(meta.alternates.canonical, `https://vipsui.vercel.app/product/${p.slug}`);
  assert.equal(schema['@type'], 'Product');
  assert.equal(schema.name, fields.name);
  assert.equal(schema.productID, p.productNumber);
  for (const missing of ['brand', 'material', 'offers', 'aggregateRating', 'review']) assert.equal(schema[missing], undefined);
  if (p.coverImage) assert.ok(schema.image.includes(p.coverImage));
  if (fields.indexable) eligible++;
  const related = seo.catalogRelated(p, originalNavigation[p.slug] || null);
  assert.equal(related.relatedProducts.length, 6);
  assert.equal(new Set(related.relatedProducts.map(r => r.href)).size, 6);
  for (const r of related.relatedProducts) {
    assert.notEqual(r.href, `/product/${p.slug}`);
    assert.ok(seo.productsBySlug.has(r.href.slice('/product/'.length)));
  }
}
assert.equal(eligible, report.eligibleProducts);
assert.equal(seo.seoCategories.length, 28);
assert.equal(new Set(seo.seoCategories.map(c => c.title)).size, 28);
assert.equal(new Set(seo.seoCategories.map(c => c.description)).size, 28);
for (const c of seo.seoCategories) {
  assert.ok(c.name && c.title.length <= 60 && c.description.length <= 160 && c.intro.split(/\s+/).length >= 300);
  assert.equal(categoryProducts(c).length, report.categoryCounts[c.path]);
}
for (const [file, hash] of Object.entries(report.sourceHashes)) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hash, file);
}
assert.equal(seo.paginationPage('0'), null);
assert.equal(seo.paginationPage(['2']), null);
assert.equal(seo.paginationPage('2'), 2);
assert.equal(seo.paginationPage(undefined), 1);
assert.ok(!seo.jsonLd({x:'</script>'}).includes('</script>'));
console.log(JSON.stringify({passed:true, products:slugs.size, uniqueTitles:titles.size, uniqueDescriptions:descriptions.size,
  eligibleProducts:eligible, categories:28, recommendationTargets:index.length*6, originalHashes:'unchanged'}));
