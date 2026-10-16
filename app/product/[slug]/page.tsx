import { notFound } from "next/navigation";
import ProductDetail from "./ProductDetail";
import { ProductBreadcrumb, ProductRelatedLinks } from "../../components/ProductNavigation";
import { getProduct, getProductNavigation } from "../../lib/product-navigation";
import { displayLabel } from "../../data/display";
import { jsonLd, productJsonLd, productMetadata, productSeo, seoProducts, categoryPath, catalogRelated } from "../../lib/seo-catalog";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  return productMetadata(product);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const product = await getProduct(slug);
  if (!product) notFound();
  const navigation = getProductNavigation(slug);
  const seo = productSeo(product);
  const entry = seoProducts[slug];
  const categories = entry ? [
    { href: categoryPath(entry.category) || "/shop", label: entry.category },
    ...entry.subcategories.slice(0, 1).map(s => ({ href: categoryPath(entry.category, s)!, label: s.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ") })),
  ] : product.categoryPath.slice(0, 1).map(name => ({ href: `/shop?category=${encodeURIComponent(name)}`, label: displayLabel(name) || "Category" }));
  const breadcrumbs = [
    { href: "/", label: "Home" }, { href: "/shop", label: "Catalog" }, ...categories,
    { href: `/product/${product.slug}`, label: seo.name },
  ];
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd(product)) }} /><ProductDetail product={product} seo={seo}
    breadcrumb={<ProductBreadcrumb items={breadcrumbs} />}
    relatedLinks={<ProductRelatedLinks navigation={catalogRelated(product, navigation)} />} /></>;
}
