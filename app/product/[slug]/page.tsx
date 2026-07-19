import ProductDetailLoader from "./ProductDetailLoader";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return <ProductDetailLoader slug={slug} />;
}
