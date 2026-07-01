import catalogData from "./yupooCatalog.json";

export type CatalogProduct = {
  id: string;
  slug: string;
  productNumber: string;
  name: string;
  brand: string;
  category: string;
  size: string;
  movement: string;
  description: string;
  specs: string[];
  cover: string;
  images: string[];
  photoCount: number;
  sourceUrl: string;
  searchText: string;
};

export type Catalog = {
  source: string;
  generatedAt: string;
  stats: {
    totalBrands: number;
    totalCategories: number;
    totalAlbums: number;
    estimatedProducts: number;
    failedAlbums: number;
  };
  brands: string[];
  categories: string[];
  categoryTree: Array<{
    id: string;
    name: string;
    href: string;
    children: Array<{ id: string; name: string; href: string }>;
  }>;
  products: CatalogProduct[];
  failures: Array<{ album_id: string; error: string }>;
};

export const catalog = catalogData as Catalog;
export const catalogProducts = catalog.products;
export const catalogBrands = catalog.brands;
export const catalogCategories = catalog.categories;

export function getProductBySlug(slug: string) {
  return catalogProducts.find((product) => product.slug === slug);
}

export function proxiedImage(url: string) {
  if (url.startsWith("/")) {
    return url;
  }

  return `/api/yupoo-image?url=${encodeURIComponent(url)}`;
}
