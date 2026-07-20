import catalogData from "./catalog.json";

type SourceCategory = {
  id: string;
  sourceId: string;
  name: string;
  sourceName: string;
  path: string[];
  children?: SourceCategory[];
};

const catalog = catalogData as { publicCategories: SourceCategory[] };

const exactLabels: Record<string, string> = {
  "高奢女装": "Women",
  "高奢服饰": "Fashion",
  "高奢饰品": "Jewelry",
  "高奢名包": "Bags",
  "高定女鞋": "Shoes",
  "高奢潮鞋": "Sneakers",
  "高奢围巾": "Scarves",
  "高奢腰带": "Belts",
  "高奢墨镜": "Sunglasses",
  "高端腕表": "Watches",
  "高奢男装": "Men",
  "未分组": "New Arrivals",
  "发货实拍": "Ready to Ship",
  "袜子【不退换】": "Socks",
  "手套": "Gloves",
  "未分类": "Uncategorized",
  "男装": "Men",
  "短袖": "Short Sleeves",
  "外套/马甲": "Outerwear & Vests",
  "上衣/长袖": "Tops & Long Sleeves",
  "衬衫": "Shirts",
  "卫衣": "Sweatshirts",
  "裤子": "Pants",
  "裙子": "Skirts",
  "背心/吊带/抹胸": "Tanks & Camisoles",
  "毛衣/开衫": "Knitwear & Cardigans",
  "羽绒服": "Down Jackets",
  "套装": "Sets",
  "皮草/大衣": "Coats",
  "耳钉/耳环": "Earrings",
  "手镯/手链": "Bracelets",
  "项链/腰链/毛衣链": "Necklaces",
  "戒指": "Rings",
  "胸针": "Brooches",
  "发夹/帽子": "Hair Clips & Hats",
  "真金定制合集": "Fine Jewelry",
  "板鞋/运动鞋": "Sneakers",
};

const brandLabels: Array<[RegExp, string]> = [
  [/劳力士|rolex/i, "Rolex"],
  [/欧米茄|omega/i, "Omega"],
  [/卡地亚|cartier/i, "Cartier"],
  [/百达翡丽|patek/i, "Patek Philippe"],
  [/江诗丹顿|vacheron/i, "Vacheron Constantin"],
  [/爱彼|ap|audemars/i, "Audemars Piguet"],
  [/万国|iwc/i, "IWC"],
  [/帝陀|tudor/i, "Tudor"],
  [/宝格丽|bvlgari/i, "Bvlgari"],
  [/香奈儿|chanel/i, "Chanel"],
  [/迪奥|dior/i, "Dior"],
  [/路易威登|louis vuitton|lv/i, "Louis Vuitton"],
  [/爱马仕|hermes|hermès/i, "Hermes"],
  [/古驰|gucci/i, "Gucci"],
  [/缪缪|miumiu|miu miu/i, "Miu Miu"],
  [/普拉达|prada/i, "Prada"],
  [/巴黎世家|balenciaga/i, "Balenciaga"],
  [/圣罗兰|ysl|yves saint laurent/i, "Saint Laurent"],
  [/赛琳|塞琳|celine/i, "Celine"],
  [/罗意威|loewe/i, "Loewe"],
  [/芬迪|fendi/i, "Fendi"],
  [/葆蝶家|bottega|bv/i, "Bottega Veneta"],
  [/巴宝莉|burberry/i, "Burberry"],
  [/华伦天奴|valentino/i, "Valentino"],
  [/纪梵希|givenchy/i, "Givenchy"],
  [/梵克雅宝|van cleef/i, "Van Cleef & Arpels"],
  [/蒂芙尼|tiffany/i, "Tiffany & Co."],
  [/克罗心|chrome hearts/i, "Chrome Hearts"],
  [/浪琴/i, "Longines"],
  [/积家/i, "Jaeger-LeCoultre"],
  [/百年灵/i, "Breitling"],
  [/沛纳海/i, "Panerai"],
  [/肖邦/i, "Chopard"],
  [/宇舶/i, "Hublot"],
  [/伯爵/i, "Piaget"],
  [/宝玑/i, "Breguet"],
  [/法兰克穆勒/i, "Franck Muller"],
  [/理查德·米勒/i, "Richard Mille"],
];

const productTerms: Array<[RegExp, string]> = [
  [/高跟/g, "Heels"],
  [/平底鞋|平底/g, "Flats"],
  [/拖鞋|（半）拖鞋/g, "Slippers"],
  [/凉鞋/g, "Sandals"],
  [/靴子/g, "Boots"],
  [/皮鞋/g, "Leather Shoes"],
  [/乐福鞋/g, "Loafers"],
  [/休闲/g, "Casual Shoes"],
  [/围巾\/斗篷/g, "Scarves & Capes"],
  [/腰带/g, "Belts"],
  [/墨镜|🕶️/g, "Sunglasses"],
  [/表|⌚️/g, "Watches"],
  [/骨头/g, "Bone"],
];

const navOrder = ["高端腕表", "高奢名包", "高定女鞋", "高奢饰品", "高奢女装", "高奢男装", "高奢围巾", "高奢腰带", "高奢墨镜"];

export function displayLabel(value = "") {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (exactLabels[trimmed]) return exactLabels[trimmed];

  for (const [pattern, label] of brandLabels) {
    if (pattern.test(trimmed)) {
      let suffix = trimmed;
      for (const [termPattern, termLabel] of productTerms) {
        suffix = suffix.replace(termPattern, ` ${termLabel}`);
      }
      suffix = suffix
        .replace(pattern, "")
        .replace(/[.（）()【】🇨🇦]+/g, " ")
        .replace(/[\u4e00-\u9fff]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (suffix.toLowerCase().includes(label.toLowerCase())) {
        return label;
      }
      return suffix ? `${label} ${suffix}` : label;
    }
  }

  let translated = trimmed;
  for (const [pattern, label] of productTerms) {
    translated = translated.replace(pattern, ` ${label}`);
  }
  return translated
    .replace(/[.（）()【】]+/g, " ")
    .replace(/[\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function displayPath(path: string[] = []) {
  return path.map(displayLabel).filter(Boolean).join(" / ");
}

export function pathKey(path: string[] = []) {
  return path.join(">");
}

export function topNavigationCategories() {
  const source = catalog.publicCategories || [];
  return [...source]
    .filter((category) => navOrder.includes(category.name))
    .sort((a, b) => navOrder.indexOf(a.name) - navOrder.indexOf(b.name));
}

export function categoryByName(name: string) {
  return (catalog.publicCategories || []).find((category) => category.name === name);
}

export const heroCategoryNames = [
  "高端腕表",
  "高奢名包",
  "高定女鞋",
  "高奢饰品",
  "高奢女装",
  "高奢墨镜",
];
