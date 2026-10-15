import Link from "next/link";
import type { NavigationLink, ProductNavigation } from "../lib/product-navigation";

export function ProductBreadcrumb({ items }: { items: NavigationLink[] }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem", position: index + 1, name: item.label,
      item: new URL(item.href, "https://vipsui.vercel.app").href,
    })),
  };
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#6e6e73]">
          {items.map((item, index) => (
            <li key={`${item.href}-${index}`} className="flex min-w-0 items-center gap-2">
              {index > 0 && <span aria-hidden="true">/</span>}
              {index === items.length - 1 ? (
                <span aria-current="page" className="break-words text-[#1d1d1f]">{item.label}</span>
              ) : <Link href={item.href} prefetch={false} className="break-words hover:underline">{item.label}</Link>}
            </li>
          ))}
        </ol>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </div>
  );
}

export function ProductRelatedLinks({ navigation }: { navigation: ProductNavigation }) {
  return (
    <section aria-labelledby="related-products-heading" className="mx-auto max-w-7xl border-t border-[#d2d2d7] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h2 id="related-products-heading" className="text-2xl font-semibold">Related Products</h2>
        <nav aria-label="Related categories" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
          {[...navigation.relatedCategories, ...navigation.relatedSubcategories].map((item) => (
            <Link key={item.href} href={item.href} prefetch={false} className="text-[#0066cc] hover:underline">{item.label}</Link>
          ))}
        </nav>
      </div>
      <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {navigation.relatedProducts.map((item) => (
          <li key={item.href} className="min-w-0 border-b border-[#d2d2d7] pb-4">
            <Link href={item.href} prefetch={false} className="block rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0066cc]">
              <span className="block break-words text-base font-medium leading-6 hover:underline">{item.label}</span>
              <span className="mt-2 block text-sm text-[#6e6e73]">{item.category} / {item.productNumber}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
