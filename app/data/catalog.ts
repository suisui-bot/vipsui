import catalogData from "./catalog.json";
import productsData from "./products.json";

export type CatalogProduct = {
  albumId: string;
  slug: string;
  productNumber: string;
  brand: string;
  exactBrand: string;
  collection: string;
  series: string;
  version: string;
  categoryPath: string[];
  exactCategoryName: string;
  coverImage: string;
  galleryImages: string[];
  imageCount: number;
  yupooUrl: string;
  internalPrice: number | null;
  publicPriceLabel: "Price on Request";
  description: string;
  specs: string[];
  size: string;
  movement: string;
  searchText: string;
};

export type CatalogBrand = {
  name: string;
  slug: string;
  productCount: number;
  collections: string[];
};

export type CatalogCollection = {
  brand: string;
  name: string;
  slug: string;
  productCount: number;
  series: string[];
  versions: string[];
};

export type Catalog = {
  source: string;
  generatedAt: string;
  stats: {
    totalBrands: number;
    totalCollections: number;
    totalProducts: number;
    totalImages: number;
    unassignedProducts: number;
    publicCategories: number;
    sourceGroups: number;
    sourceTags: number;
  };
  categoryCounts: Array<{ id: string; path: string[]; albumCount: number }>;
  unassignedAlbumIds: string[];
  brands: CatalogBrand[];
  collections: CatalogCollection[];
  products: CatalogProduct[];
};

export const catalog = catalogData as Catalog;
export const catalogProducts = productsData as CatalogProduct[];
export const catalogBrands = catalog.brands;
export const catalogCollections = catalog.collections;

export function getProductBySlug(slug: string) {
  return catalogProducts.find((product) => product.slug === slug);
}

export function imagePath(url: string) {
  return url;
}
