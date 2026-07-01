"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { WatchProduct } from "../../data/watches";
import { watchProducts } from "../../data/watches";

export default function ProductDetail({ product }: { product: WatchProduct }) {
  const gallery = useMemo(() => {
    const related = watchProducts
      .filter((item) => item.slug !== product.slug && item.category === product.category)
      .slice(0, 2)
      .map((item) => item.image);

    return [product.image, ...related];
  }, [product]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = gallery[activeIndex] ?? product.image;

  return (
    <main className="min-h-screen bg-[#050604] text-[#f7f0df]">
      <header className="border-b border-[#d6b45a]/15 bg-[#050604]/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm uppercase tracking-[0.28em] text-[#d9d0bd] transition hover:text-[#f5d172]">
            Back to gallery
          </Link>
          <span className="text-lg font-semibold tracking-[0.35em] text-[#f5d172]">VIPSUI</span>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.82fr] lg:px-8 lg:py-16">
        <div className="space-y-4">
          <div className="group relative aspect-[4/5] overflow-hidden bg-[#0a0d08]">
            <Image
              src={activeImage}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 1024px) 56vw, 100vw"
              className="object-cover transition duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/38 via-transparent to-transparent" />
            <span className="absolute left-5 top-5 bg-black/60 px-4 py-3 text-xs uppercase tracking-[0.28em] text-[#f5d172] backdrop-blur">
              {product.productNumber}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {gallery.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                aria-label={`View ${product.name} image ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={`relative aspect-[4/3] overflow-hidden border transition ${
                  activeIndex === index ? "border-[#d6b45a]" : "border-[#d6b45a]/16 hover:border-[#d6b45a]/55"
                }`}
              >
                <Image src={image} alt="" fill sizes="33vw" className="object-cover" />
              </button>
            ))}
          </div>
        </div>

        <aside className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.54em] text-[#d6b45a]">{product.category}</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-6xl">{product.name}</h1>
          <p className="mt-5 text-xl text-[#f1dfad]">{product.tagline}</p>
          <p className="mt-6 max-w-xl text-base leading-8 text-[#bcb29d]">{product.description}</p>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            <div className="border border-[#d6b45a]/18 bg-[#07110a] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-[#827866]">Availability</p>
              <p className="mt-2 text-2xl font-semibold text-[#f5d172]">{product.priceLabel}</p>
            </div>
            <div className="border border-[#d6b45a]/18 bg-[#07110a] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-[#827866]">Brand</p>
              <p className="mt-2 text-2xl font-semibold text-white">{product.brand}</p>
            </div>
          </div>

          <div className="mt-8 border border-[#d6b45a]/18 p-5">
            <p className="mb-4 text-xs uppercase tracking-[0.32em] text-[#d6b45a]">Specifications</p>
            <ul className="space-y-3 text-sm text-[#d9d0bd]">
              {product.specs.map((spec) => (
                <li key={spec} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d6b45a]" />
                  <span>{spec}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={`https://wa.me/8617336648172?text=${encodeURIComponent(`Hello, I am interested in ${product.name} (${product.productNumber}).`)}`}
              className="rounded-full bg-[#d6b45a] px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.22em] text-[#071006] transition hover:bg-[#f5d172]"
            >
              Ask on WhatsApp
            </a>
            <Link
              href="/#collection"
              className="rounded-full border border-[#d6b45a]/28 px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.22em] text-white transition hover:border-[#d6b45a] hover:text-[#f5d172]"
            >
              More watches
            </Link>
          </div>
        </aside>
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
