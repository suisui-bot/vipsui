import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import CatalogListing from "../components/CatalogListing";
import { catalogProducts } from "../data/catalog";
import { displayLabel, displayPath, topNavigationCategories } from "../data/display";
import { categoryPath, ORIGIN, PAGE_SIZE, paginationPage, seoProducts } from "../lib/seo-catalog";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
async function resolve({ searchParams }: Props) {
  const raw = await searchParams;
  const query: Record<string, string> = {};
  for (const key of ["search", "category", "collection", "sort", "seoCategory", "seoSubcategory"]) if (typeof raw[key] === "string" && raw[key]) query[key] = raw[key];
  const page = paginationPage(raw.page);
  if (!page) notFound();
  if (query.seoCategory && !query.category && !query.search && !query.collection) {
    const path = categoryPath(query.seoCategory, query.seoSubcategory);
    if (path) permanentRedirect(path + (page > 1 ? `?page=${page}` : ""));
  }
  const search = query.search?.trim().toLowerCase();
  const products = catalogProducts.filter(p => (!query.category || p.categoryPath.join(">").startsWith(query.category))
    && (!query.collection || p.collection === query.collection)
    && (!query.seoCategory || seoProducts[p.slug].category === query.seoCategory)
    && (!query.seoSubcategory || seoProducts[p.slug].subcategories.includes(query.seoSubcategory))
    && (!search || [seoProducts[p.slug].name, p.productNumber, p.brand, p.collection, p.searchText, displayPath(p.categoryPath)].join(" ").toLowerCase().includes(search)));
  if (query.sort === "new") products.sort((a, b) => Number(b.productNumber) - Number(a.productNumber));
  if (page > Math.max(1, Math.ceil(products.length / PAGE_SIZE))) notFound();
  const title = query.category ? displayPath(query.category.split(">")) : query.search ? `Search: ${query.search}` : "Fashion & Lifestyle Catalog";
  return { products, query, page, title };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { query, page, title } = await resolve(props);
  const params = new URLSearchParams(query);
  if (page > 1) params.set("page", String(page));
  return { title: `${title}${page > 1 ? ` | Page ${page}` : ""} | VIPSUI`,
    description: "Browse watches, bags, shoes, clothing and accessories. Compare original product photographs and request confirmed item details and pricing.",
    alternates: { canonical: `${ORIGIN}/shop${params.size ? `?${params}` : ""}` },
    robots: { index: Object.keys(query).length === 0, follow: true } };
}

export default async function ShopPage(props: Props) {
  const { products, query, page, title } = await resolve(props);
  const collections = [...new Set(catalogProducts.filter(p => !query.category || p.categoryPath.join(">").startsWith(query.category)).map(p => p.collection).filter(Boolean))].sort();
  const form = <form method="get" action="/shop" className="mt-6 flex flex-wrap items-end gap-4">
    <label className="min-w-0 flex-1 text-sm">Search<input name="search" defaultValue={query.search} className="mt-1 block w-full rounded border border-[#86868b] bg-white px-3 py-2" /></label>
    <label className="text-sm">Category<select name="category" defaultValue={query.category || ""} className="mt-1 block max-w-full rounded border border-[#86868b] bg-white px-3 py-2"><option value="">All categories</option>
      {topNavigationCategories().map(c => <option key={c.id} value={c.path.join(">")}>{displayLabel(c.name)}</option>)}
      {query.category && !topNavigationCategories().some(c => c.path.join(">") === query.category) && <option value={query.category}>{displayPath(query.category.split(">"))}</option>}
    </select></label>
    <label className="text-sm">Collection<select name="collection" defaultValue={query.collection || ""} className="mt-1 block max-w-full rounded border border-[#86868b] bg-white px-3 py-2"><option value="">All collections</option>{collections.map(c => <option key={c} value={c}>{displayLabel(c)}</option>)}</select></label>
    <label className="text-sm">Order<select name="sort" defaultValue={query.sort || ""} className="mt-1 block rounded border border-[#86868b] bg-white px-3 py-2"><option value="">Catalog order</option><option value="new">Newest references</option></select></label>
    <button type="submit" className="rounded bg-[#1d1d1f] px-5 py-2 text-sm text-white">Search</button>
  </form>;
  return <CatalogListing products={products} title={title} description="Browse original product galleries by category, collection or keyword." path="/shop" page={page} query={query} filterForm={form} />;
}
