import { notFound } from "next/navigation";
import ProductDetail from "./ProductDetail";
import { ProductBreadcrumb, ProductRelatedLinks } from "../../components/ProductNavigation";
import { getProduct, getProductNavigation } from "../../lib/product-navigation";
import { displayLabel } from "../../data/display";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const product = await getProduct(slug);
  if (!product) notFound();
  const navigation = getProductNavigation(slug);
  const categories = navigation
    ? [...navigation.relatedCategories, ...navigation.relatedSubcategories]
    : product.categoryPath.slice(0, 1).map((name) => ({
        href: `/shop?category=${encodeURIComponent(name)}`, label: displayLabel(name) || "Category",
      }));
  const breadcrumbs = [
    { href: "/", label: "Home" }, { href: "/shop", label: "Catalog" }, ...categories,
    { href: `/product/${product.slug}`, label: product.productNumber },
  ];
  return <ProductDetail product={product}
    breadcrumb={<ProductBreadcrumb items={breadcrumbs} />}
    relatedLinks={navigation ? <ProductRelatedLinks navigation={navigation} /> : null} />;
}
