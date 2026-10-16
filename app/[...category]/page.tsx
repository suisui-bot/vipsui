import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CatalogListing from "../components/CatalogListing";
import { jsonLd, ORIGIN, PAGE_SIZE, paginationPage, seoCategories } from "../lib/seo-catalog";
import { categoryProducts } from "../lib/catalog-listing";

type Props = { params: Promise<{ category: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function resolve(props: Props) {
  const path = "/" + (await props.params).category.join("/");
  const category = seoCategories.find(c => c.path === path);
  if (!category) notFound();
  const products = categoryProducts(category);
  const page = paginationPage((await props.searchParams).page);
  if (!page || page > Math.max(1, Math.ceil(products.length / PAGE_SIZE))) notFound();
  return { category, products, page };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { category, products, page } = await resolve(props);
  return { title: category.title + (page > 1 ? ` | Page ${page}` : ""), description: category.description,
    alternates: { canonical: `${ORIGIN}${category.path}${page > 1 ? `?page=${page}` : ""}` },
    robots: { index: category.category !== "Uncategorized" && products.length > 0, follow: true } };
}

export default async function CategoryPage(props: Props) {
  const { category, products, page } = await resolve(props);
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" },
    { "@type": "ListItem", position: 2, name: category.name, item: ORIGIN + category.path },
  ] };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumb) }} /><CatalogListing products={products} title={category.name} description={category.description} path={category.path} page={page} category={category} /></>;
}
