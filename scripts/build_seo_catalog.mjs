import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';

const index = JSON.parse(fs.readFileSync('app/data/productIndex.json'));
const categorySource = process.argv[2] || 'app/data/seoCategories.json';
const categories = JSON.parse(fs.readFileSync(categorySource)).map(p => ({
  name: p.category_name || p.name, path: p.url || p.path, category: p.category, subcategory: p.subcategory,
  title: p.seo_title || p.title, description: p.meta_description || p.description, intro: p.intro_content || p.intro,
}));
const rules = [
  [/乐福鞋|\bloafers?\b/i, 'Loafers', 'Shoes', 'loafers'],
  [/运动鞋|板鞋|\bsneakers?\b/i, 'Sneakers', 'Shoes', 'sneakers'],
  [/靴子|短靴|长靴|\bboots?\b/i, 'Boots', 'Shoes', 'boots'],
  [/凉鞋|\bsandals?\b/i, 'Sandals', 'Shoes', 'sandals'],
  [/高跟|\bheels?\b/i, 'Heels', 'Shoes', 'heels'],
  [/拖鞋|\bslippers?\b/i, 'Slippers', 'Shoes', null],
  [/平底鞋|\bflats\b/i, 'Flats', 'Shoes', null],
  [/旅行袋|旅行包|\btravel bag\b|\bduff[el]+\b/i, 'Travel Bag', 'Bags', null],
  [/双肩包|背包|\bbackpack\b/i, 'Backpack', 'Bags', null],
  [/钱包|钱夹|卡包|\bwallets?\b|\bcard holder\b/i, 'Wallet', 'Bags', 'wallets'],
  [/托特|\btote\b/i, 'Tote Bag', 'Bags', 'tote-bags'],
  [/斜挎|斜跨|\bcrossbody\b/i, 'Crossbody Bag', 'Bags', 'crossbody-bags'],
  [/腋下包|单肩包|\bshoulder bag\b/i, 'Shoulder Bag', 'Bags', 'shoulder-bags'],
  [/迷你包|\bmini bag\b/i, 'Mini Bag', 'Bags', 'mini-bags'],
  [/手提包|手袋|\bhandbags?\b/i, 'Handbag', 'Bags', 'handbags'],
  [/墨镜|太阳镜|\bsunglasses\b/i, 'Sunglasses', 'Accessories', 'sunglasses'],
  [/围巾|丝巾|\bscar[fv]e?s?\b/i, 'Scarf', 'Accessories', 'scarves'],
  [/腰带|皮带|\bbelts?\b/i, 'Belt', 'Accessories', 'belts'],
  [/手镯|手链|\bbracelets?\b|\bbangle\b/i, 'Bracelet', 'Accessories', 'bracelets'],
  [/耳钉|耳环|\bearrings?\b/i, 'Earrings', 'Accessories', 'jewelry'],
  [/项链|\bnecklaces?\b/i, 'Necklace', 'Accessories', 'jewelry'],
  [/戒指|\brings?\b/i, 'Ring', 'Accessories', 'jewelry'],
  [/胸针|\bbrooch\b/i, 'Brooch', 'Accessories', 'jewelry'],
  [/手套|\bgloves\b/i, 'Gloves', 'Accessories', null],
  [/袜子|\bsocks\b/i, 'Socks', 'Accessories', null],
  [/短袖|长袖|衬衫|衬衣|上衣|毛衣|针织衫|T恤|开衫|卫衣|裤子|裙子|连衣裙|外套|马甲|背心|吊带|羽绒服|大衣|套装|\b(shirt|sweater|cardigan|jacket|trousers|dress|skirt|hoodie|coat|polo)\b/i, 'Clothing', 'Clothing', null],
  [/腕表|手表|\bwatches?\b/i, 'Wristwatch', 'Watches', null],
];
const garmentRules = [
  [/连衣裙|\bdress\b/i, 'Dress'], [/T恤|\bt-shirt\b/i, 'T-Shirt'], [/\bpolo\b/i, 'Polo Top'], [/衬衫|衬衣|\bshirt\b/i, 'Shirt'],
  [/针织衫|\bknit top\b/i, 'Knit Top'],
  [/开衫|\bcardigan\b/i, 'Cardigan'], [/毛衣|\bsweater\b/i, 'Sweater'],
  [/卫衣|\bhoodie\b|\bsweatshirt\b/i, 'Sweatshirt'], [/裤子|长裤|\btrousers\b|\bpants\b/i, 'Pants'],
  [/裙子|半裙|\bskirt\b/i, 'Skirt'], [/大衣|\bcoat\b/i, 'Coat'],
  [/马甲|\bvest\b/i, 'Vest'], [/外套|\bjacket\b/i, 'Jacket'],
  [/短袖|上衣|长袖|背心|吊带|\btop\b/i, 'Top'], [/套装|\bset\b/i, 'Clothing Set'],
];
const roots = [
  [/高端腕表/, 'Watches', 'Wristwatch'], [/高奢名包/, 'Bags', 'Bag'],
  [/高定女鞋|高奢潮鞋/, 'Shoes', 'Shoes'], [/高奢女装/, 'Clothing', "Women's Clothing"],
  [/高奢男装/, 'Clothing', "Men's Clothing"], [/高奢服饰/, 'Clothing', 'Clothing'],
  [/高奢饰品/, 'Accessories', 'Jewelry'], [/高奢围巾/, 'Accessories', 'Scarf'],
  [/高奢腰带/, 'Accessories', 'Belt'], [/高奢墨镜/, 'Accessories', 'Sunglasses'],
];
const derived = {};
const protectedHashes = {};
const bySlug = new Map(index.map(p => [p.slug, p]));
assert.equal(bySlug.size, index.length, 'Duplicate original slug');
const numbers = new Set();
let detailCount = 0;
for (const file of fs.readdirSync('public/product-shards').filter(f => f.endsWith('.json')).sort()) {
  const bytes = fs.readFileSync(path.join('public/product-shards', file));
  protectedHashes[`public/product-shards/${file}`] = createHash('sha256').update(bytes).digest('hex');
  for (const p of JSON.parse(bytes)) {
    detailCount++;
    assert.ok(bySlug.has(p.slug), `Unmatched detail: ${p.slug}`);
    assert.equal(bySlug.get(p.slug).albumId, p.albumId, `Mismatched product ID: ${p.slug}`);
    assert.ok(!derived[p.slug], `Duplicate detail: ${p.slug}`);
    assert.ok(!numbers.has(p.productNumber), 'Duplicate reference');
    numbers.add(p.productNumber);
    // Only merchandise types and source category labels are translated; never material, mechanism or performance claims.
    const originalPath = (p.categoryPath || []).join(' ');
    const caption = (p.searchText || '').normalize('NFKC').replace(p.productNumber, '').slice(0, 180);
    const root = roots.find(([re]) => re.test(originalPath));
    const categoryRule = rules.find(([re, , category]) => re.test(originalPath) && (!root || category === root[1]));
    const captionRule = rules.find(([re, , category]) => re.test(caption) && (!root || category === root[1]));
    const rule = categoryRule || captionRule;
    const category = root?.[1] || rule?.[2] || 'Uncategorized';
    let name = rule?.[1] || root?.[2] || 'Fashion & Lifestyle Item';
    const subcategories = new Set(rule?.[3] ? [rule[3]] : []);
    if (category === 'Accessories') {
      if (name === 'Scarf') subcategories.add('scarves');
      if (name === 'Belt') subcategories.add('belts');
      if (name === 'Sunglasses') subcategories.add('sunglasses');
      if (name === 'Jewelry') subcategories.add('jewelry');
    }
    if (category === 'Clothing') {
      const garment = garmentRules.find(([re]) => re.test(originalPath)) || garmentRules.find(([re]) => re.test(caption));
      if (garment) name = garment[1];
      if (/高奢女装/.test(originalPath)) { subcategories.add('women-clothing'); name = `Women's ${name.replace(/^Women's /, '')}`; }
      if (/高奢男装/.test(originalPath)) { subcategories.add('men-clothing'); name = `Men's ${name.replace(/^Men's /, '')}`; }
    }
    if (category === 'Watches') {
      const evidence = `${originalPath} ${caption}`;
      if (/女表|女士|女款|\bwomen'?s\b/i.test(evidence)) { subcategories.add('womens-watches'); name = "Women's Wristwatch"; }
      if (/男表|男士|男款|\bmen'?s\b/i.test(evidence)) { subcategories.add('mens-watches'); name = "Men's Wristwatch"; }
      if (/镂空|\bskeleton\b/i.test(evidence)) { subcategories.add('skeleton-watches'); name = 'Skeleton-Style Wristwatch'; }
      if (/经典|\bclassic\b/i.test(evidence)) subcategories.add('classic-watches');
    }
    derived[p.slug] = { reference: p.productNumber, name, category, subcategories: [...subcategories], basis: categoryRule || root ? 'source_category' : rule ? 'source_caption_item_type' : 'unknown' };
  }
}
assert.equal(detailCount, index.length);
for (const file of ['app/data/productIndex.json','app/data/catalog.json']) {
  protectedHashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const allowedKeys = new Set(categories.map(c => `${c.category}/${c.subcategory || ''}`));
for (const p of Object.values(derived)) p.subcategories = p.subcategories.filter(s => allowedKeys.has(`${p.category}/${s}`));
fs.writeFileSync('app/data/seoProducts.json', JSON.stringify(derived));
fs.writeFileSync('app/data/seoCategories.json', JSON.stringify(categories));
const counts = Object.fromEntries(categories.map(c => [c.path, index.filter(p => {
  const seo = derived[p.slug];
  return seo.category === c.category && (!c.subcategory || seo.subcategories.includes(c.subcategory));
}).length]));
const origin = 'https://vipsui.vercel.app';
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const urlset = urls => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${escape(u)}</loc></url>`).join('')}</urlset>\n`;
fs.mkdirSync('public/sitemaps', {recursive:true});
const pageUrls = [origin+'/', origin+'/shop', ...categories.filter(c => counts[c.path] > 0 && c.category !== 'Uncategorized').map(c => origin+c.path)];
fs.writeFileSync('public/sitemaps/pages.xml', urlset(pageUrls));
const eligible = index.filter(p => derived[p.slug].basis !== 'unknown' && p.coverImage);
const parts = ['pages.xml'];
for (let start=0; start<eligible.length; start+=40000) {
  const filename = `products-${start / 40000 + 1}.xml`;
  fs.writeFileSync(`public/sitemaps/${filename}`, urlset(eligible.slice(start,start+40000).map(p => `${origin}/product/${p.slug}`)));
  parts.push(filename);
}
fs.writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${parts.map(f => `<sitemap><loc>${origin}/sitemaps/${f}</loc></sitemap>`).join('')}</sitemapindex>\n`);
const summary = { products: index.length, details: detailCount, uniqueSlugs: bySlug.size, eligibleProducts: eligible.length,
  unknownTypeProducts: Object.values(derived).filter(p => p.basis === 'unknown').length,
  missingCoverProducts: index.filter(p => !p.coverImage).length, withheldFromSitemap: index.length-eligible.length,
  categoryCounts:counts, sourceHashes:protectedHashes,
  namingPolicy:'Source-declared merchandise type only. No copied unapproved AI visual descriptions, authenticity, material, color or performance assertions. Reference distinguishes otherwise indistinguishable listings.' };
fs.writeFileSync('docs/seo-catalog-build.json', JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,sourceHashes:undefined},null,2));
