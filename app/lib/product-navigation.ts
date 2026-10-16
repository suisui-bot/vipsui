import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { CatalogProduct } from "../data/catalog";
import navigationData from "../data/internalLinks.json";

export type NavigationLink = { href: string; label: string };
export type ProductNavigation = {
  productId: string;
  label: string;
  relatedProducts: Array<NavigationLink & { productNumber: string; category: string }>;
  relatedCategories: NavigationLink[];
  relatedSubcategories: NavigationLink[];
};

const navigation = navigationData.products as Record<string, ProductNavigation>;
const shardCache = new Map<string, Promise<Map<string, CatalogProduct>>>();

export function getProductNavigation(slug: string) {
  return navigation[slug] || null;
}

export const getProduct = cache(async (slug: string): Promise<CatalogProduct | null> => {
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/i.test(slug)) return null;
  const shard = slug.match(/^wecatalog-(\d+)/)?.[1].slice(0, 3) || "misc";
  let loading = shardCache.get(shard);
  if (!loading) {
    loading = readFile(path.join(process.cwd(), "public", "product-shards", `${shard}.json`))
      .then(bytes => new Map((JSON.parse(bytes.toString()) as CatalogProduct[]).map(p => [p.slug, p])));
    shardCache.set(shard, loading);
    if (shardCache.size > 4) shardCache.delete(shardCache.keys().next().value!);
  }
  try {
    return (await loading).get(slug) || null;
  } catch (error) {
    shardCache.delete(shard);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
});
