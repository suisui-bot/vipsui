import "server-only";
import type { Metadata } from "next";
import type { CatalogProduct } from "../data/catalog";
import productData from "../data/seoProducts.json";
import categoryData from "../data/seoCategories.json";
import type { ProductNavigation } from "./product-navigation";

export const ORIGIN = "https://vipsui.vercel.app";
export const PAGE_SIZE = 72;
export type SeoProduct = { reference: string; name: string; category: string; subcategories: string[]; basis: string };
export type SeoCategory = { name: string; path: string; category: string; subcategory: string | null; title: string; description: string; intro: string };
export const seoProducts = productData as Record<string, SeoProduct>;
export const seoCategories = categoryData as SeoCategory[];
type ProductReference = Pick<CatalogProduct, "slug" | "productNumber">;
export const productsBySlug = new Map(Object.entries(seoProducts).map(([slug, p]) => [slug, { slug, productNumber: p.reference }]));
const groups = new Map<string, ProductReference[]>();
for (const product of productsBySlug.values()) {
  const category = seoProducts[product.slug].category;
  if (!groups.has(category)) groups.set(category, []);
  groups.get(category)!.push(product);
}

export function catalogRelated(product: CatalogProduct, existing: ProductNavigation | null): ProductNavigation {
  const entry = seoProducts[product.slug];
  const pool = groups.get(entry.category)!;
  const position = pool.findIndex(p => p.slug === product.slug);
  const targets = existing ? existing.relatedProducts.map(p => productsBySlug.get(p.href.slice("/product/".length))!).filter(Boolean)
    : Array.from({ length: Math.min(6, pool.length - 1) }, (_, i) => pool[(position + i + 1) % pool.length]);
  return {
    productId: product.albumId, label: entry.name,
    relatedCategories: [{ href: categoryPath(entry.category) || "/shop", label: entry.category }],
    relatedSubcategories: entry.subcategories.map(s => ({ href: categoryPath(entry.category, s)!, label: seoCategories.find(c => c.path === categoryPath(entry.category, s))!.name })),
    relatedProducts: targets.map(p => ({ href: `/product/${p.slug}`, label: seoProducts[p.slug].name, productNumber: p.productNumber, category: seoProducts[p.slug].category })),
  };
}

export function productSeo(product: CatalogProduct) {
  const entry = seoProducts[product.slug];
  const name = entry?.name || "Fashion & Lifestyle Item";
  const reference = product.productNumber;
  const title = `${name} | Ref ${reference} | VIPSUI`;
  const videos = product.videoCount || 0;
  const description = `${name}. View ${product.imageCount} product photos${videos ? ` and ${videos} video${videos === 1 ? "" : "s"}` : ""}. Ref ${reference}. Confirm specifications, fit and current pricing before ordering.`;
  return { name, title, description, canonical: `${ORIGIN}/product/${product.slug}`, indexable: !!entry && entry.basis !== "unknown" && !!product.coverImage };
}

export function productMetadata(product: CatalogProduct): Metadata {
  const seo = productSeo(product);
  return {
    title: seo.title, description: seo.description,
    alternates: { canonical: seo.canonical },
    robots: { index: seo.indexable, follow: true },
    openGraph: { title: seo.title, description: seo.description, url: seo.canonical, images: product.coverImage ? [product.coverImage] : [] },
  };
}

export function productJsonLd(product: CatalogProduct) {
  const seo = productSeo(product);
  const images = product.galleryImages?.length ? product.galleryImages : product.coverImage ? [product.coverImage] : [];
  // Price-on-request is not an Offer. Supplier labels do not establish brand authenticity, specifications or availability.
  return {
    "@context": "https://schema.org", "@type": "Product", "@id": `${seo.canonical}#product`,
    name: seo.name, description: seo.description, productID: product.productNumber,
    url: seo.canonical, ...(images.length ? { image: [...new Set(images)] } : {}), category: seoProducts[product.slug]?.category,
  };
}

export function categoryPath(category: string, subcategory?: string) {
  return seoCategories.find(c => c.category === category && (c.subcategory || undefined) === subcategory)?.path;
}

export function paginationPage(value: string | string[] | undefined) {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return null;
  return Number(value);
}

export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
