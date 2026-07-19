import productsData from "./products.json";
import type { CatalogProduct } from "./catalog";

const productBySlug = new Map((productsData as CatalogProduct[]).map((product) => [product.slug, product]));

export function getProductBySlug(slug: string) {
  return productBySlug.get(slug);
}
