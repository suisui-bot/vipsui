"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { catalog, catalogBrands, catalogProducts, imagePath } from "./data/catalog";

const allOption = "All";
const visibleProductLimit = 180;

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeBrand, setActiveBrand] = useState(allOption);
  const [activeCollection, setActiveCollection] = useState(allOption);
  const [activeVersion, setActiveVersion] = useState(allOption);
  const featured = catalogProducts[0];

  const brandOptions = useMemo(() => catalogBrands.map((brand) => brand.name), []);
  const collectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        catalogProducts
          .filter((product) => activeBrand === allOption || product.brand === activeBrand)
          .map((product) => product.collection)
      )
    ).sort();
  }, [activeBrand]);
  const versionOptions = useMemo(() => {
    return Array.from(
      new Set(
        catalogProducts
          .filter((product) => activeBrand === allOption || product.brand === activeBrand)
          .filter((product) => activeCollection === allOption || product.collection === activeCollection)
          .map((product) => product.version)
      )
    ).sort();
  }, [activeBrand, activeCollection]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return catalogProducts.filter((product) => {
      const matchesBrand = activeBrand === allOption || product.brand === activeBrand;
      const matchesCollection = activeCollection === allOption || product.collection === activeCollection;
      const matchesVersion = activeVersion === allOption || product.version === activeVersion;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        product.searchText.includes(normalizedQuery) ||
        product.productNumber.toLowerCase().includes(normalizedQuery);

      return matchesBrand && matchesCollection && matchesVersion && matchesQuery;
    });
  }, [activeBrand, activeCollection, activeVersion, query]);

  const heroProducts = catalogProducts.slice(0, 6);
  const visibleProducts = filteredProducts.slice(0, visibleProductLimit);

  return (
    <main className="min-h-screen overflow-hidden bg-[#050604] text-[#f7f0df]">
      <header className="fixed left-0 right-0 top-0 z-30 border-b border-[#d6b45a]/15 bg-[#050604]/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold tracking-[0.35em] text-[#f5d172]">
            VIPSUI
          </Link>
          <div className="hidden items-center gap-8 text-xs uppercase tracking-[0.28em] text-[#d9d0bd] md:flex">
            <a href="#collection" className="transition hover:text-[#f5d172]">
              Collection
            </a>
            <a href="#database" className="transition hover:text-[#f5d172]">
              Database
            </a>
            <a href="#contact" className="transition hover:text-[#f5d172]">
              Contact
            </a>
          </div>
          <a
            href="#collection"
            className="rounded-full border border-[#d6b45a]/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#f5d172] transition hover:bg-[#d6b45a] hover:text-black"
          >
            Explore
          </a>
        </nav>
      </header>

      <section className="relative min-h-[92vh] pt-16">
        <div className="absolute inset-0">
          <img src={imagePath(featured.coverImage)} alt={featured.productNumber} className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(5,6,4,0.96)_0%,_rgba(5,6,4,0.76)_44%,_rgba(5,6,4,0.28)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#050604] to-transparent" />
        </div>

        <div className="relative mx-auto grid min-h-[calc(92vh-4rem)] max-w-7xl items-end gap-10 px-4 pb-14 sm:px-6 lg:grid-cols-[0.78fr_0.52fr] lg:px-8 lg:pb-20">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.56em] text-[#d6b45a]">Yupoo master catalog</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.98] text-white sm:text-7xl lg:text-8xl">
              {catalog.stats.totalProducts} watches, structured by collection.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#d9d0bd] sm:text-lg">
              VIPSUI now follows the Yupoo hierarchy: brand, collection, series, version, and complete product galleries.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#collection"
                className="rounded-full bg-[#d6b45a] px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-[#071006] transition hover:bg-[#f5d172]"
              >
                View all products
              </a>
              <Link
                href={`/product/${featured.slug}`}
                className="rounded-full border border-white/25 px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-white transition hover:border-[#d6b45a] hover:text-[#f5d172]"
              >
                Featured watch
              </Link>
            </div>
          </div>

          <div className="hidden grid-cols-3 gap-3 self-end lg:grid">
            {heroProducts.map((product) => (
              <Link key={product.albumId} href={`/product/${product.slug}`} className="group relative aspect-[3/4] overflow-hidden border border-[#d6b45a]/18">
                <img
                  src={imagePath(product.coverImage)}
                  alt={product.productNumber}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute bottom-3 left-3 right-3 text-xs font-semibold text-white">{product.productNumber}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="database" className="border-y border-[#d6b45a]/10 bg-[#07110a]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <Stat label="Brands" value={catalog.stats.totalBrands} />
          <Stat label="Source Nodes" value={catalog.stats.publicCategories} />
          <Stat label="Products" value={catalog.stats.totalProducts} />
          <Stat label="Images" value={catalog.stats.totalImages} />
        </div>
      </section>

      <section id="collection" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[0.55fr_1fr] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.54em] text-[#d6b45a]">Professional catalog</p>
            <h2 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">Filter by hierarchy, inspect every image.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="flex min-h-14 items-center gap-3 border border-[#d6b45a]/20 bg-black/35 px-5 text-sm text-[#d9d0bd]">
              <span className="text-[#f5d172]">Search</span>
              <input
                aria-label="Search by product number"
                placeholder="Product number, brand, collection"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent outline-none placeholder:text-[#827866]"
              />
            </label>
            <span className="flex min-h-14 items-center justify-center border border-[#d6b45a]/20 px-5 text-xs uppercase tracking-[0.24em] text-[#bcb29d]">
              {filteredProducts.length.toLocaleString()} products
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.34fr_1fr]">
          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <FilterSelect
              label="Brand"
              value={activeBrand}
              values={[allOption, ...brandOptions]}
              onChange={(value) => {
                setActiveBrand(value);
                setActiveCollection(allOption);
                setActiveVersion(allOption);
              }}
            />
            <FilterSelect
              label="Collection"
              value={activeCollection}
              values={[allOption, ...collectionOptions]}
              onChange={(value) => {
                setActiveCollection(value);
                setActiveVersion(allOption);
              }}
            />
            <FilterSelect label="Version" value={activeVersion} values={[allOption, ...versionOptions]} onChange={setActiveVersion} />
          </aside>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => (
              <Link
                href={`/product/${product.slug}`}
                key={product.albumId}
                className="group block overflow-hidden border border-[#d6b45a]/14 bg-[#090b08] transition duration-500 hover:-translate-y-1 hover:border-[#d6b45a]/55 hover:shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-[#0d130e]">
                  <img
                    src={imagePath(product.coverImage)}
                    alt={product.productNumber}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />
                  <span className="absolute left-4 top-4 bg-black/55 px-3 py-2 text-[0.68rem] uppercase tracking-[0.18em] text-[#f5d172] backdrop-blur">
                    {product.productNumber}
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3 text-[0.68rem] uppercase tracking-[0.18em] text-[#bcb29d]">
                    <span className="truncate">{product.brand}</span>
                    <span>{product.imageCount} photos</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">{product.productNumber}</h3>
                  <p className="line-clamp-2 text-sm leading-7 text-[#a79e8c]">
                    {product.collection} / {product.version}
                  </p>
                  <div className="flex items-center justify-between pt-2 text-xs uppercase tracking-[0.18em]">
                    <span className="text-[#d6b45a]">{product.publicPriceLabel}</span>
                    <span className="text-white transition group-hover:text-[#f5d172]">Details</span>
                  </div>
                </div>
              </Link>
            ))}
            {filteredProducts.length > visibleProducts.length && (
              <div className="border border-[#d6b45a]/14 bg-[#090b08] p-6 text-sm leading-7 text-[#bcb29d] md:col-span-2 xl:col-span-3">
                Showing {visibleProducts.length.toLocaleString()} of {filteredProducts.length.toLocaleString()} matching products. Refine by source category or product number to open the exact item.
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[#07110a] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 border-y border-[#d6b45a]/20 py-10 md:flex-row md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-[#d6b45a]">Private sourcing</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Ask for availability and close-up media.</h2>
          </div>
          <a
            href="https://wa.me/8617336648172"
            className="rounded-full bg-[#d6b45a] px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-[#071006] transition hover:bg-[#f5d172]"
          >
            WhatsApp +86 17336648172
          </a>
        </div>
      </section>

      <a
        href="https://wa.me/8617336648172"
        aria-label="Contact VIPSUI on WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1f7a43] text-sm font-bold text-white shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition hover:scale-105 hover:bg-[#269653]"
      >
        WA
      </a>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-[#d6b45a]/30 pt-5">
      <p className="text-4xl font-semibold text-white">{value.toLocaleString()}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.32em] text-[#d6b45a]">{label}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block border border-[#d6b45a]/14 bg-black/25 p-4">
      <span className="mb-3 block text-xs uppercase tracking-[0.32em] text-[#d6b45a]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full border border-[#d6b45a]/20 bg-[#050604] px-3 text-sm text-[#f7f0df] outline-none"
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}
