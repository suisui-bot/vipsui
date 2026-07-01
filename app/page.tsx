"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { watchProducts } from "./data/watches";

const categories = ["All", "Classic", "Sport", "Dress"] as const;
const brands = ["All", ...Array.from(new Set(watchProducts.map((product) => product.brand)))] as const;

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [activeBrand, setActiveBrand] = useState<(typeof brands)[number]>("All");
  const featured = watchProducts[0];

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return watchProducts.filter((product) => {
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      const matchesBrand = activeBrand === "All" || product.brand === activeBrand;
      const searchable = [
        product.productNumber,
        product.name,
        product.brand,
        product.category,
        product.description,
        product.tagline,
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && matchesBrand && (normalizedQuery.length === 0 || searchable.includes(normalizedQuery));
    });
  }, [activeBrand, activeCategory, query]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#050604] text-[#f7f0df]">
      <header className="fixed left-0 right-0 top-0 z-30 border-b border-[#d6b45a]/15 bg-[#050604]/75 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold tracking-[0.35em] text-[#f5d172]">
            VIPSUI
          </Link>
          <div className="hidden items-center gap-8 text-xs uppercase tracking-[0.28em] text-[#d9d0bd] md:flex">
            <a href="#collection" className="transition hover:text-[#f5d172]">
              Collection
            </a>
            <a href="#craft" className="transition hover:text-[#f5d172]">
              Craft
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

      <section className="relative flex min-h-[94vh] items-end pt-16">
        <div className="absolute inset-0">
          <Image src={featured.image} alt={featured.name} fill priority sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(5,6,4,0.96)_0%,_rgba(5,6,4,0.72)_42%,_rgba(5,6,4,0.18)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#050604] to-transparent" />
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 pb-14 sm:px-6 lg:grid-cols-[0.82fr_0.52fr] lg:px-8 lg:pb-20">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.56em] text-[#d6b45a]">Luxury watch house</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.98] text-white sm:text-7xl lg:text-8xl">
              Timepieces with a private-room presence.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#d9d0bd] sm:text-lg">
              A polished VIPSUI gallery for collectors who want sculptural cases, quiet motion, and a deep black, gold, and green buying experience.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#collection"
                className="rounded-full bg-[#d6b45a] px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-[#071006] transition hover:bg-[#f5d172]"
              >
                View collection
              </a>
              <Link
                href={`/product/${featured.slug}`}
                className="rounded-full border border-white/25 px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-white transition hover:border-[#d6b45a] hover:text-[#f5d172]"
              >
                Featured watch
              </Link>
            </div>
          </div>

          <div className="hidden self-end border-l border-[#d6b45a]/25 pl-8 lg:block">
            <p className="text-xs uppercase tracking-[0.4em] text-[#d6b45a]">{featured.productNumber}</p>
            <h2 className="mt-4 text-3xl font-semibold text-white">{featured.name}</h2>
            <p className="mt-4 text-sm leading-7 text-[#bcb29d]">{featured.tagline}</p>
          </div>
        </div>
      </section>

      <section id="craft" className="border-y border-[#d6b45a]/10 bg-[#07110a]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            ["Gallery motion", "Slow reveals, tactile hover states, and image-forward browsing."],
            ["Collector search", "Find pieces by product number, name, category, or maison."],
            ["Private contact", "A direct WhatsApp path stays close without interrupting browsing."],
          ].map(([title, text]) => (
            <div key={title} className="border-t border-[#d6b45a]/30 pt-6">
              <h2 className="text-xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#bcb29d]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="collection" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[0.55fr_1fr] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.54em] text-[#d6b45a]">Elegant watch gallery</p>
            <h2 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">Curated for close inspection.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="flex min-h-14 items-center gap-3 border border-[#d6b45a]/20 bg-black/35 px-5 text-sm text-[#d9d0bd]">
              <span className="text-[#f5d172]">Search</span>
              <input
                aria-label="Search by product number"
                placeholder="Product number, name, or category"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent outline-none placeholder:text-[#827866]"
              />
            </label>
            <span className="flex min-h-14 items-center justify-center border border-[#d6b45a]/20 px-5 text-xs uppercase tracking-[0.24em] text-[#bcb29d]">
              {filteredProducts.length} pieces
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.42fr_1fr]">
          <div className="space-y-5">
            <FilterGroup title="Brand" items={brands} activeItem={activeBrand} onSelect={setActiveBrand} />
            <FilterGroup title="Category" items={categories} activeItem={activeCategory} onSelect={setActiveCategory} />
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <Link
                href={`/product/${product.slug}`}
                key={product.slug}
                className="group block overflow-hidden border border-[#d6b45a]/14 bg-[#090b08] transition duration-500 hover:-translate-y-1 hover:border-[#d6b45a]/55 hover:shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-[#0d130e]">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1280px) 28vw, (min-width: 768px) 44vw, 100vw"
                    className="object-cover transition duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70" />
                  <span className="absolute left-4 top-4 bg-black/55 px-3 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-[#f5d172] backdrop-blur">
                    {product.productNumber}
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3 text-[0.68rem] uppercase tracking-[0.24em] text-[#bcb29d]">
                    <span>{product.brand}</span>
                    <span>{product.category}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">{product.name}</h3>
                  <p className="line-clamp-2 text-sm leading-7 text-[#a79e8c]">{product.description}</p>
                  <div className="flex items-center justify-between pt-2 text-xs uppercase tracking-[0.22em]">
                    <span className="text-[#d6b45a]">{product.priceLabel}</span>
                    <span className="text-white transition group-hover:text-[#f5d172]">Details</span>
                  </div>
                </div>
              </Link>
            ))}
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

function FilterGroup<T extends string>({
  title,
  items,
  activeItem,
  onSelect,
}: {
  title: string;
  items: readonly T[];
  activeItem: T;
  onSelect: (item: T) => void;
}) {
  return (
    <div className="border border-[#d6b45a]/14 bg-black/25 p-4">
      <p className="mb-3 text-xs uppercase tracking-[0.32em] text-[#d6b45a]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className={`min-h-10 border px-4 text-xs uppercase tracking-[0.22em] transition ${
              activeItem === item
                ? "border-[#d6b45a] bg-[#d6b45a] text-black"
                : "border-[#d6b45a]/20 text-[#d9d0bd] hover:border-[#d6b45a] hover:text-[#f5d172]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
