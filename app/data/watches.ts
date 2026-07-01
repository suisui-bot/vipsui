export type WatchProduct = {
  slug: string;
  productNumber: string;
  name: string;
  brand: string;
  category: "Classic" | "Sport" | "Dress";
  image: string;
  sourceImage: string;
  priceLabel: string;
  description: string;
  tagline: string;
  specs: string[];
};

export const watchProducts: WatchProduct[] = [
  {
    slug: "cartier-panthere-22mm",
    productNumber: "VS-2201",
    name: "Cartier Panthère 22mm",
    brand: "Cartier",
    category: "Classic",
    image: "/products/cartier-panthere-22mm.jpg",
    sourceImage: "https://photo.yupoo.com/1688dafan/cacbeacc4a/medium.jpg",
    priceLabel: "Private collection",
    description:
      "A sculptural quartz timepiece featuring a polished steel case, crystal mirror, and a graceful silhouette suited for evening dressing.",
    tagline: "Signature elegance in a compact profile",
    specs: ["22 × 30mm case", "Quartz movement", "316L steel bracelet", "Crystal mirror"],
  },
  {
    slug: "cartier-panthere-22mm-elite",
    productNumber: "VS-2202",
    name: "Cartier Panthère 22mm Elite",
    brand: "Cartier",
    category: "Classic",
    image: "/products/cartier-panthere-22mm-elite.jpg",
    sourceImage: "https://photo.yupoo.com/1688dafan/845bf53380/medium.jpg",
    priceLabel: "Limited release",
    description:
      "Refined and bold, this edition balances high-gloss detailing with a crisp, modern wrist presence.",
    tagline: "Quiet luxury with a pronounced presence",
    specs: ["22 × 30mm case", "Quartz movement", "Steel shell casing", "Water-resistant finish"],
  },
  {
    slug: "cartier-panthere-27x37mm",
    productNumber: "VS-2737",
    name: "Cartier Panthère 27 × 37mm",
    brand: "Cartier",
    category: "Dress",
    image: "/products/cartier-panthere-27x37mm.jpg",
    sourceImage: "https://photo.yupoo.com/1688dafan/82dc276ff6/medium.jpg",
    priceLabel: "Maison edition",
    description:
      "A refined dress watch with a larger canvas that makes every hour feel ceremonial and precise.",
    tagline: "Bespoke dress watch geometry",
    specs: ["27 × 37mm case", "Quartz movement", "Steel bracelet", "Crisp crystal face"],
  },
  {
    slug: "cartier-panthere-27x37mm-aurum",
    productNumber: "VS-2738",
    name: "Cartier Panthère 27 × 37mm Aurum",
    brand: "Cartier",
    category: "Dress",
    image: "/products/cartier-panthere-27x37mm-aurum.jpg",
    sourceImage: "https://photo.yupoo.com/1688dafan/4fd979c64b/medium.jpg",
    priceLabel: "Collector's piece",
    description:
      "An authoritative presence for formal occasions, crafted with radiant metals and an unmistakably polished finish.",
    tagline: "A confident statement for black-tie evenings",
    specs: ["27 × 37mm case", "Quartz movement", "Polished steel execution", "Signature mirror finish"],
  },
  {
    slug: "cartier-panthere-22mm-sculpture",
    productNumber: "VS-2210",
    name: "Cartier Panthère 22mm Sculpture",
    brand: "Cartier",
    category: "Sport",
    image: "/products/cartier-panthere-22mm-sculpture.jpg",
    sourceImage: "https://photo.yupoo.com/1688dafan/9766686617/medium.jpg",
    priceLabel: "Signature edition",
    description:
      "Designed for the modern connoisseur who wants the sharpness of a sport watch with the elegance of a couture accessory.",
    tagline: "Sport-forward yet impeccably tailored",
    specs: ["22 × 30mm case", "Quartz movement", "Steel bracelet", "High-shine mirror"],
  },
  {
    slug: "cartier-panthere-27x37mm-heritage",
    productNumber: "VS-2740",
    name: "Cartier Panthère 27 × 37mm Heritage",
    brand: "Cartier",
    category: "Sport",
    image: "/products/cartier-panthere-27x37mm-heritage.jpg",
    sourceImage: "https://photo.yupoo.com/1688dafan/2b2a1a5d9e/medium.jpg",
    priceLabel: "Private preview",
    description:
      "A heritage-inspired profile that captures the energy of the maison with a contemporary wrist feel.",
    tagline: "A modern heirloom with attitude",
    specs: ["27 × 37mm case", "Quartz movement", "Steel shell casing", "Crystal face"],
  },
];

export function getProductBySlug(slug: string) {
  return watchProducts.find((product) => product.slug === slug);
}
