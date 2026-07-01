import { notFound } from "next/navigation";
import { getProductBySlug, watchProducts } from "../../data/watches";
import ProductDetail from "./ProductDetail";

export function generateStaticParams() {
  return watchProducts.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return <ProductDetail product={product} />;
}
