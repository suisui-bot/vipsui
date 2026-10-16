import "server-only";
import { catalogProducts } from "../data/catalog";
import { seoProducts, type SeoCategory } from "./seo-catalog";

export function categoryProducts(category: SeoCategory) {
  return catalogProducts.filter(p => {
    const entry = seoProducts[p.slug];
    return entry?.category === category.category && (!category.subcategory || entry.subcategories.includes(category.subcategory));
  });
}
