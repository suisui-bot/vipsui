"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogProduct } from "../../data/catalog";
import ProductDetail from "./ProductDetail";

function shardForSlug(slug: string) {
  const match = slug.match(/^wecatalog-(\d+)/);
  return match?.[1]?.slice(0, 3) || "misc";
}

export default function ProductDetailLoader({ slug }: { slug: string }) {
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [missing, setMissing] = useState(false);
  const shard = useMemo(() => shardForSlug(slug), [slug]);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setMissing(false);
      setProduct(null);
      const response = await fetch(`/product-shards/${shard}.json`);
      if (!response.ok) {
        throw new Error(`Missing product shard ${shard}`);
      }
      const products = (await response.json()) as CatalogProduct[];
      const match = products.find((item) => item.slug === slug) || null;
      if (!cancelled) {
        setProduct(match);
        setMissing(!match);
      }
    }

    loadProduct().catch(() => {
      if (!cancelled) {
        setMissing(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shard, slug]);

  if (product) {
    return <ProductDetail product={product} />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-6 text-center text-[#1d1d1f]">
      <div>
        <p className="text-xs font-semibold tracking-[0.28em]">VIPSUI</p>
        <h1 className="mt-5 text-3xl font-semibold">{missing ? "Product unavailable" : "Loading product"}</h1>
      </div>
    </main>
  );
}
