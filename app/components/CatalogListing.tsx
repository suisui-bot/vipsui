import Link from "next/link";
import SiteHeader from "./SiteHeader";
import type { CatalogProduct } from "../data/catalog";
import { imagePath } from "../data/images";
import { PAGE_SIZE, productSeo, seoCategories, type SeoCategory } from "../lib/seo-catalog";

export function CategoryNavigation() {
  return <nav aria-label="Catalog categories" className="flex flex-wrap gap-x-5 gap-y-3 border-y border-[#d2d2d7] py-4">
    {seoCategories.filter(c => !c.subcategory).map(c => <Link key={c.path} href={c.path} prefetch={false} className="text-sm font-medium text-[#0066cc] hover:underline">{c.name}</Link>)}
  </nav>;
}

export default function CatalogListing({ products, title, description, path, page, category, query, filterForm }: {
  products: CatalogProduct[]; title: string; description: string; path: string; page: number;
  category?: SeoCategory; query?: Record<string, string>; filterForm?: React.ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const visible = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (n: number) => {
    const params = new URLSearchParams(query);
    if (n > 1) params.set("page", String(n));
    return path + (params.size ? `?${params}` : "");
  };
  const neighbors = new Set([1, pages, page - 1, page, page + 1].filter(n => n > 0 && n <= pages));
  return <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
    <SiteHeader />
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap gap-2 text-sm text-[#6e6e73]">
        <Link href="/">Home</Link><span>/</span><Link href="/shop">Catalog</Link>
        {category?.subcategory && <><span>/</span><Link href={`/${category.category.toLowerCase()}`}>{category.category}</Link></>}
        <span>/</span><span aria-current="page">{title}</span>
      </nav>
      <h1 className="break-words text-3xl font-semibold sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-[#424245]">{description}</p>
      <div className="mt-6"><CategoryNavigation /></div>
      {category && <nav aria-label="Subcategories" className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
        {seoCategories.filter(c => c.category === category.category && c.subcategory).map(c => <Link key={c.path} href={c.path} prefetch={false} className="text-sm text-[#0066cc] hover:underline">{c.name}</Link>)}
      </nav>}
      {filterForm}
      <p className="my-6 text-sm text-[#6e6e73]">{products.length.toLocaleString("en-US")} products · Page {page} of {pages}</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {visible.map((p, i) => {
          const seo = productSeo(p);
          return <Link key={p.slug} href={`/product/${p.slug}`} prefetch={false} className="min-w-0 overflow-hidden rounded-lg bg-white ring-1 ring-[#d2d2d7] hover:ring-[#86868b]">
            <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-[#ededf0]">{p.coverImage ? <img src={imagePath(p.coverImage)} alt={`${seo.name} - catalog photograph`} loading={i < 4 ? "eager" : "lazy"} className="h-full w-full object-cover" /> : <span className="p-4 text-sm text-[#6e6e73]">Photo unavailable</span>}</div>
            <div className="p-4"><h2 className="break-words text-base font-semibold leading-6">{seo.name}</h2><p className="mt-2 text-xs text-[#6e6e73]">Reference {p.productNumber}</p><p className="mt-2 text-sm font-semibold">{p.publicPriceLabel}</p></div>
          </Link>;
        })}
      </div>
      {pages > 1 && <nav aria-label="Pagination" className="my-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-4 text-sm">
        {page > 1 && <Link rel="prev" href={href(page - 1)} prefetch={false} className="text-[#0066cc]">Previous</Link>}
        {[...neighbors].sort((a, b) => a - b).map(n => <Link key={n} href={href(n)} prefetch={false} aria-current={n === page ? "page" : undefined} className={n === page ? "font-bold underline" : "text-[#0066cc]"}>{n}</Link>)}
        {page < pages && <Link rel="next" href={href(page + 1)} prefetch={false} className="text-[#0066cc]">Next</Link>}
      </nav>}
      {category && <section aria-label={`About ${category.name}`} className="mt-12 border-t border-[#d2d2d7] pt-8">
        <h2 className="text-xl font-semibold">About {category.name}</h2>
        <div className="mt-4 max-w-4xl space-y-4 text-base leading-7 text-[#424245]">{category.intro.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
      </section>}
    </div>
  </main>;
}
