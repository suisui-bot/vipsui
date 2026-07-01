import { notFound } from "next/navigation";
import { catalogProducts, getProductBySlug } from "../../data/catalog";
import ProductDetail from "./ProductDetail";

export function generateStaticParams() {
  return catalogProducts.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return <ProductDetail product={product} />;
}
