"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import { catalogProducts, type CatalogProduct } from "../data/catalog";
import { displayLabel, displayPath, pathKey, topNavigationCategories } from "../data/display";
import { imagePath } from "../data/images";

const pageSize = 72;

function matchesCategory(product: CatalogProduct, categoryKey: string) {
  if (!categoryKey) return true;
  return pathKey(product.categoryPath).startsWith(categoryKey);
}

function optionKey(value: string[]) {
  return pathKey(value);
}

export default function ShopClient() {
  const params = useSearchParams();
  const initialCategory = params.get("category") || "";
  const initialSearch = params.get("search") || "";
  const [categoryKey, setCategoryKey] = useState(initialCategory);
  const [collection, setCollection] = useState("");
  const [query, setQuery] = useState(initialSearch);
  const [visible, setVisible] = useState(pageSize);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useMemo(() => topNavigationCategories(), []);

  const categoryProducts = useMemo(() => catalogProducts.filter((product) => matchesCategory(product, categoryKey)), [categoryKey]);
  const collectionOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const product of categoryProducts) {
      const key = product.collection || product.categoryPath?.[1] || "";
      if (key) options.set(key, displayLabel(key));
    }
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [categoryProducts]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return categoryProducts.filter((product) => {
      const collectionMatch = !collection || product.collection === collection;
      const text = [product.productNumber, product.brand, product.collection, product.series, product.version, displayPath(product.categoryPath), product.searchText].join(" ").toLowerCase();
      return collectionMatch && (!normalized || text.includes(normalized));
    });
  }, [categoryProducts, collection, query]);

  const visibleProducts = filteredProducts.slice(0, visible);
  const activeCategoryLabel = categoryKey ? displayPath(categoryKey.split(">")) : "All Categories";

  function resetVisible() {
    setVisible(pageSize);
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1fr] lg:items-end">
          <div>
            <p className="text-sm font-medium text-[#6e6e73]">Shop</p>
            <h1 className="mt-2 text-4xl font-semibold sm:text-6xl">{activeCategoryLabel}</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#6e6e73]">Browse by category, then narrow by brand or collection. The source hierarchy stays intact behind the scenes.</p>
          </div>
          <label className="flex h-14 items-center gap-3 rounded-full bg-white px-5 ring-1 ring-[#d2d2d7]">
            <span className="text-sm font-semibold text-[#6e6e73]">Search</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetVisible();
              }}
              placeholder="Product number, brand, collection, keyword"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#86868b]"
            />
          </label>
        </div>
      </section>

      <section className="sticky top-14 z-30 border-y border-[#d2d2d7]/70 bg-[#fbfbfd]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setFiltersOpen((value) => !value)} className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white md:hidden">
            Filters
          </button>
          <div className={`${filtersOpen ? "grid" : "hidden"} w-full gap-3 md:flex md:w-auto md:flex-1 md:flex-wrap`}>
            <button
              type="button"
              onClick={() => {
                setCategoryKey("");
                setCollection("");
                resetVisible();
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[#d2d2d7] ${!categoryKey ? "bg-[#1d1d1f] text-white" : "bg-white text-[#424245]"}`}
            >
              All
            </button>
            {categories.map((category) => {
              const key = optionKey(category.path);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setCategoryKey(key);
                    setCollection("");
                    resetVisible();
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[#d2d2d7] ${categoryKey === key ? "bg-[#1d1d1f] text-white" : "bg-white text-[#424245]"}`}
                >
                  {displayLabel(category.name)}
                </button>
              );
            })}
          </div>
          <span className="ml-auto text-sm text-[#6e6e73]">{filteredProducts.length.toLocaleString()} products</span>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setCollection("");
                resetVisible();
              }}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${!collection ? "bg-[#1d1d1f] text-white" : "bg-white text-[#424245] ring-1 ring-[#d2d2d7]"}`}
            >
              All Collections
            </button>
            {collectionOptions.slice(0, 28).map(([raw, label]) => (
              <button
                key={raw}
                type="button"
                onClick={() => {
                  setCollection(raw);
                  resetVisible();
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${collection === raw ? "bg-[#1d1d1f] text-white" : "bg-white text-[#424245] ring-1 ring-[#d2d2d7]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleProducts.map((product, index) => (
            <Link key={product.albumId} href={`/product/${product.slug}`} className="group rounded-[24px] bg-white p-3 ring-1 ring-[#d2d2d7]/70 transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.10)]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-[#f5f5f7]">
                <img src={imagePath(product.coverImage)} alt={product.productNumber} loading={index < 8 ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                {product.hasVideo && (
                  <span className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-xs text-white backdrop-blur">
                    ▶
                  </span>
                )}
              </div>
              <div className="px-2 py-4">
                <p className="truncate text-xs font-medium text-[#6e6e73]">{displayPath(product.categoryPath)}</p>
                <h2 className="mt-1 text-lg font-semibold">{product.productNumber}</h2>
                <p className="mt-1 truncate text-sm text-[#6e6e73]">{displayLabel(product.collection)}</p>
                <p className="mt-3 text-sm font-semibold text-[#1d1d1f]">{product.publicPriceLabel}</p>
              </div>
            </Link>
          ))}
        </div>

        {visibleProducts.length < filteredProducts.length && (
          <div className="flex justify-center py-10">
            <button type="button" onClick={() => setVisible((value) => value + pageSize)} className="rounded-full bg-[#1d1d1f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black">
              Show More
            </button>
          </div>
        )}
      </section>

      <a
        href="https://wa.me/8617336648172"
        aria-label="Contact VIPSUI on WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1f7a43] text-sm font-bold text-white shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:scale-105 hover:bg-[#269653]"
      >
        WA
      </a>
    </main>
  );
}
