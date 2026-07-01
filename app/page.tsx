"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { watchProducts } from "./data/watches";

const brandMarks = ["Cartier", "Rolex", "Omega", "Patek", "Audemars"];
const categories = ["All", "Classic", "Sport", "Dress"] as const;

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return watchProducts.filter((product) => {
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [product.name, product.brand, product.description, product.tagline]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.2),_transparent_32%),linear-gradient(135deg,_#060606,_#181818)] text-stone-100">
      <section className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-amber-500/20 bg-black/70 px-6 py-5 shadow-[0_0_70px_rgba(212,175,55,0.1)] backdrop-blur md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="text-sm uppercase tracking-[0.5em] text-amber-400">VIPSUI</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[0.24em] text-white sm:text-4xl">
              LUXURY WATCH HOUSE
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
            <a href="#collection" className="rounded-full border border-stone-700 px-4 py-2 transition hover:border-amber-400 hover:text-amber-300">
              Collection
            </a>
            <a href="#categories" className="rounded-full border border-stone-700 px-4 py-2 transition hover:border-amber-400 hover:text-amber-300">
              Categories
            </a>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[2rem] border border-stone-800 bg-zinc-950 shadow-[0_0_80px_rgba(0,0,0,0.4)]">
            <Image
              src="https://photo.yupoo.com/1688dafan/cacbeacc4a/medium.jpg"
              alt="Luxury watch showcase"
              width={1400}
              height={900}
              priority
              className="h-[420px] w-full object-cover sm:h-[540px]"
            />
          </div>
          <div className="flex flex-col justify-between rounded-[2rem] border border-amber-500/20 bg-black/70 p-6 shadow-[0_0_60px_rgba(212,175,55,0.12)] backdrop-blur sm:p-8">
            <div>
              <p className="text-sm uppercase tracking-[0.5em] text-amber-400">Featured release</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[0.2em] text-white sm:text-4xl">
                Crafted for the modern collector
              </h2>
              <p className="mt-4 max-w-lg text-base leading-8 text-stone-400">
                Discover sculptural timepieces with a black-and-gold palette, precision detailing, and a timeless presence built for private collections.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#collection" className="rounded-full bg-amber-500 px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-amber-400">
                Explore watches
              </a>
              <a href="#categories" className="rounded-full border border-stone-700 px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.3em] text-stone-100 transition hover:border-amber-400 hover:text-amber-300">
                Browse categories
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-800 bg-stone-950/70 p-6 shadow-[0_0_50px_rgba(0,0,0,0.25)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-amber-400">Trusted marks</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[0.2em] text-white">Curated icons from the world’s most esteemed maisons</h3>
            </div>
            <div className="flex flex-wrap gap-3 text-sm uppercase tracking-[0.35em] text-stone-400">
              {brandMarks.map((mark) => (
                <span key={mark} className="rounded-full border border-stone-800 px-3 py-2">
                  {mark}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="categories" className="grid gap-4 rounded-[2rem] border border-stone-800 bg-black/70 p-6 backdrop-blur sm:grid-cols-3 sm:p-8">
          {[
            { title: "Classic", text: "Sculptural silhouettes with evening elegance." },
            { title: "Sport", text: "Precision-built for motion and modern contrast." },
            { title: "Dress", text: "Ceremonial profiles with high-gloss detail." },
          ].map((item) => (
            <div key={item.title} className="rounded-[1.25rem] border border-stone-800 bg-stone-950/70 p-5">
              <p className="text-sm uppercase tracking-[0.35em] text-amber-400">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-stone-400">{item.text}</p>
            </div>
          ))}
        </section>

        <section id="collection" className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.45em] text-amber-400">Signature collection</p>
              <h3 className="text-3xl font-semibold tracking-[0.2em] text-white">Discover refined watches</h3>
            </div>
            <label className="flex items-center gap-3 rounded-full border border-stone-700 bg-black/60 px-4 py-3 text-sm text-stone-300">
              <span className="text-amber-400">⌕</span>
              <input
                aria-label="Search watches"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent outline-none placeholder:text-stone-500"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm uppercase tracking-[0.3em] transition ${
                  activeCategory === category
                    ? "border-amber-400 bg-amber-500 text-black"
                    : "border-stone-700 bg-black/50 text-stone-300 hover:border-amber-400 hover:text-amber-300"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <article key={product.slug} className="group overflow-hidden rounded-[1.6rem] border border-stone-800 bg-stone-950/90 shadow-[0_10px_50px_rgba(0,0,0,0.25)]">
                <div className="relative h-72 overflow-hidden">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={700}
                    height={900}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="space-y-3 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm uppercase tracking-[0.35em] text-amber-400">{product.brand}</p>
                    <span className="text-xs uppercase tracking-[0.3em] text-stone-500">{product.category}</span>
                  </div>
                  <h4 className="text-xl font-semibold text-white">{product.name}</h4>
                  <p className="text-sm leading-7 text-stone-400">{product.description}</p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-stone-400">{product.priceLabel}</span>
                    <Link href={`/product/${product.slug}`} className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400 transition hover:text-amber-300">
                      View details
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
